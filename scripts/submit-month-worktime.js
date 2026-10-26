import {
  flattenMainFields,
  initPhase2MainFields,
  listWorktimeSupplementRequests,
  loadDetailData,
  loadExistingFormByPreload,
  parseArgs,
  parseJson,
  searchProjects,
  submitAdvanceForm,
  submitExistingForm,
  applyProjectSelection,
  buildDetailRow,
  initDetailRow,
  mergeAssignInfo,
  applyCustomerProjectSelection
} from './oa-client.js';
import { createPhase1 } from './phase1.js';
import { loginWithPassword } from './login.js';

function extractCreatedRequestId(responseText) {
  const payload = parseJson(responseText, 'phase1 submit');
  const requestId = payload?.data?.resultInfo?.requestid;
  if (!requestId) {
    throw new Error(`Phase1 没拿到 requestid\n${responseText.slice(0, 1000)}`);
  }
  return Number(requestId);
}

function assertSubmitOk(responseText, label) {
  const payload = parseJson(responseText, label);
  const data = payload?.data || payload;
  const type = data?.type;
  const messageDetail = data?.messageInfo?.detail;
  const messageTitle = data?.messageInfo?.title;
  const isAsyncOk = (type === 'FAILD' || type === 'FAILED')
    && !messageDetail
    && typeof messageTitle === 'string'
    && messageTitle.includes('异步');
  if (isAsyncOk) {
    return payload;
  }
  if (type === 'FAILD' || type === 'FAILED') {
    throw new Error(`${label} 失败: ${messageDetail || messageTitle || JSON.stringify(data?.messageInfo || {}).slice(0, 500)}`);
  }
  if (messageDetail && data?.messageInfo?.prompttype === 'errormsg') {
    throw new Error(`${label} 失败: ${messageDetail}`);
  }
  return payload;
}

function inferProjectType(projectCode, explicitProjectType) {
  if (explicitProjectType) {
    if (!['research', 'customer'].includes(explicitProjectType)) {
      throw new Error(`不支持的项目类型: ${explicitProjectType}，可选 research 或 customer`);
    }
    return explicitProjectType;
  }
  return /^A/i.test(projectCode) ? 'customer' : 'research';
}

async function findProject(projectCode, applicantId, projectType = inferProjectType(projectCode)) {
  const codeKey = projectType === 'customer' ? 'xmbh' : 'cpbh';
  const nameKey = projectType === 'customer' ? 'xmmc' : 'cpmc';
  // The customer-project browser currently returns ten rows even when a larger
  // pageSize is requested, so paginate with its stable server-side size.
  const pageSize = 10;
  const firstPage = await searchProjects({
    projectCode,
    applicantId,
    requestId: -1,
    projectType,
    pageSize,
    current: 1
  });
  const total = Number(firstPage.total) || 0;
  const pageCount = Math.min(Math.max(Math.ceil(total / pageSize), 1), 100);
  const pages = [firstPage];
  for (let current = 2; current <= pageCount; current += 1) {
    pages.push(await searchProjects({
      projectCode,
      applicantId,
      requestId: -1,
      projectType,
      pageSize,
      current
    }));
  }
  const exact = pages.flatMap((page) => page.datas || []).find((item) => item[codeKey] === projectCode);
  if (!exact) {
    throw new Error(`没查到项目编号: ${projectCode}`);
  }
  return {
    id: exact.id,
    projectCode: exact[codeKey],
    projectName: exact[nameKey],
    raw: exact
  };
}

function eachDateInRange(startDate, endDate) {
  const dates = [];
  let [year, month, day] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const isBeforeOrEqual = () => {
    if (year !== endYear) return year < endYear;
    if (month !== endMonth) return month < endMonth;
    return day <= endDay;
  };
  const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
  while (isBeforeOrEqual()) {
    dates.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    day += 1;
    if (day > daysInMonth(year, month)) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  return dates;
}

async function pickSupplement({ applicantId, supplementRequestIdArg }) {
  const list = await listWorktimeSupplementRequests({ applicantId, pageSize: 50, current: 1 });
  const mine = list.records.filter((r) => r.creatorId === applicantId);

  if (supplementRequestIdArg) {
    const wanted = Number(supplementRequestIdArg);
    const found = mine.find((r) => r.requestId === wanted);
    if (!found) {
      throw new Error(`补录流程 ${supplementRequestIdArg} 不在你的可用列表里`);
    }
    return found;
  }

  if (mine.length === 0) {
    throw new Error('没找到任何属于你的补录流程,请先在 OA 创建一条');
  }
  return mine[0];
}

async function submitOneDay({ date, supplementRequestId, projectCode, projectType, content, hours, applicantId }) {
  projectType = inferProjectType(projectCode, projectType);
  // Resolve the project before creating a workflow draft so an invalid code
  // cannot leave an unsubmitted request behind.
  const project = await findProject(projectCode, applicantId, projectType);
  const phase1Result = await createPhase1(date, { supplementRequestId });
  const requestId = extractCreatedRequestId(phase1Result.responseText);

  const finalLoad = await loadExistingFormByPreload(requestId);
  const finalContext = finalLoad.context;
  const finalMainFields = flattenMainFields(finalLoad.payload.maindata);
  if (process.env.DEBUG_PHASE2) {
    console.error(`--- after phase1, loaded nodeId=${finalContext.nodeId} ---`);
  }
  await initPhase2MainFields(finalContext, finalMainFields);

  const detailData = await loadDetailData(finalContext);
  const detailDefaults = detailData.detail_1?.addRowDefValue || {};

  const rowIndex = (detailData.detail_1?.indexnum ?? 0) + 1;
  const initial = buildDetailRow(detailDefaults, rowIndex);
  const initPayload = await initDetailRow(finalContext, rowIndex);
  let row = mergeAssignInfo(initial, initPayload.sql);
  row = mergeAssignInfo(row, initPayload.input);

  const projectPayload = projectType === 'customer'
    ? await applyCustomerProjectSelection(finalContext, rowIndex, project.id)
    : await applyProjectSelection(finalContext, rowIndex, project.id);
  row = mergeAssignInfo(row, projectPayload.inputPayload);
  row = mergeAssignInfo(row, projectPayload.sqlPayload);
  row = mergeAssignInfo(row, projectPayload.managerPayload);
  // The browser linkage returns the derived fields, but not always the selected
  // browser value itself. Keep the selected project ID in the submitted row.
  row[`${projectType === 'customer' ? 'field19762' : 'field19760'}_${rowIndex}`] = String(project.id);

  row[`field19759_${rowIndex}`] = content;
  row[`field19767_${rowIndex}`] = Number(hours).toFixed(1);

  const submitText = await submitExistingForm(finalContext, finalMainFields, [row], {
    startIndex: rowIndex,
    omitMainChanged: true,
    projectType
  });
  if (process.env.DEBUG_PHASE2) {
    console.error('--- final submit raw response ---');
    console.error(submitText);
    console.error('--- end final submit raw response ---');
  }
  assertSubmitOk(submitText, 'Final 提交');

  return { date, requestId, projectCode: project.projectCode, projectName: project.projectName, projectType };
}

async function main() {
  const args = parseArgs(process.argv);
  const customerProjectCode = args.customerProjectCode;
  if (customerProjectCode && args.projectCode) {
    throw new Error('--projectCode 和 --customerProjectCode 不能同时传');
  }
  const projectCode = customerProjectCode || args.projectCode || 'Y3018005';
  const projectType = inferProjectType(projectCode, customerProjectCode ? 'customer' : args.projectType);
  const content = args.content || 'Nexus 开发';
  const hours = args.hours ? Number(args.hours) : 8;
  const supplementRequestIdArg = args.supplementRequestId;
  const username = process.env.SYNYI_OA_USERNAME;
  const password = process.env.SYNYI_OA_PASSWORD;

  if (!username || !password) {
    console.error('缺少环境变量。先设置 SYNYI_OA_USERNAME 和 SYNYI_OA_PASSWORD。');
    process.exit(1);
  }

  const loginResult = await loginWithPassword({ loginId: username, password });
  if (loginResult.loginResult.loginstatus !== 'true') {
    throw new Error(`登录失败: ${loginResult.loginResult.msg || '未知错误'}`);
  }
  process.env.OA_COOKIE = loginResult.cookieHeader;
  const applicantId = Number(loginResult.loginResult.userid);
  if (!applicantId) {
    throw new Error('登录返回里没有 userid');
  }

  const supplement = await pickSupplement({ applicantId, supplementRequestIdArg });
  const dates = eachDateInRange(supplement.supplementStartDate, supplement.supplementEndDate);

  console.error(`补录流程: ${supplement.requestId} (${supplement.supplementStartDate} ~ ${supplement.supplementEndDate})`);
  console.error(`待提交日期共 ${dates.length} 天 (服务端会自动跳过非工作日)`);

  const succeeded = [];
  const failed = [];

  for (const date of dates) {
    try {
      console.error(`提交 ${date} ...`);
      const result = await submitOneDay({
        date,
        supplementRequestId: supplement.requestId,
        projectCode,
        projectType,
        content,
        hours,
        applicantId
      });
      succeeded.push(result);
      console.error(`  -> requestId=${result.requestId}`);
    } catch (error) {
      const reason = error.message || String(error);
      failed.push({ date, reason });
      console.error(`  -> 跳过: ${reason.split('\n')[0]}`);
    }
  }

  console.log(JSON.stringify({
    supplementRequestId: supplement.requestId,
    supplementRange: {
      start: supplement.supplementStartDate,
      end: supplement.supplementEndDate
    },
    projectCode,
    projectType,
    content,
    hours,
    succeeded,
    failed
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

export {
  submitOneDay,
  pickSupplement,
  extractCreatedRequestId,
  findProject,
  inferProjectType,
  eachDateInRange
};
