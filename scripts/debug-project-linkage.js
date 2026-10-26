// 只读探测: 登录 -> 加载创建表单 -> 搜项目 -> 模拟明细行初始化 + 项目选择联动
// 只调用 loadForm / browser / linkage 接口, 不调用 requestOperation, 不会创建任何流程
import {
  loadCreateForm,
  searchProjects,
  initDetailRow,
  applyProjectSelection,
  applyCustomerProjectSelection,
  loadDetailData,
  buildDetailRow,
  mergeAssignInfo,
  parseArgs
} from './oa-client.js';
import { loginWithPassword } from './login.js';
import { findProject } from './submit-month-worktime.js';

async function main() {
  const args = parseArgs(process.argv);
  const projectCode = args.projectCode || 'Y3018005';
  const projectType = args.projectType || (/^A/i.test(projectCode) ? 'customer' : 'research');

  const loginResult = await loginWithPassword({
    loginId: process.env.SYNYI_OA_USERNAME,
    password: process.env.SYNYI_OA_PASSWORD
  });
  if (loginResult.loginResult.loginstatus !== 'true') {
    throw new Error(`登录失败: ${loginResult.loginResult.msg || '未知错误'}`);
  }
  process.env.OA_COOKIE = loginResult.cookieHeader;
  const applicantId = Number(loginResult.loginResult.userid);
  console.error(`登录成功 userid=${applicantId}`);

  // 1. 项目搜索
  const search = await searchProjects({ projectCode, applicantId, requestId: -1, projectType });
  const datas = search.datas || [];
  console.error(`searchProjects 返回 ${datas.length} 条`);
  for (const item of datas.slice(0, 5)) {
    console.error(`  id=${item.id} cpbh=${item.cpbh} cpmc=${item.cpmc}`);
  }
  const codeKey = projectType === 'customer' ? 'xmbh' : 'cpbh';
  const nameKey = projectType === 'customer' ? 'xmmc' : 'cpmc';
  const exact = projectType === 'customer'
    ? await findProject(projectCode, applicantId, projectType)
    : datas.find((item) => item[codeKey] === projectCode);
  if (!exact) {
    console.error(`!! 没查到 ${codeKey} === ${projectCode} 的项目, 原始返回:`);
    console.error(JSON.stringify(search).slice(0, 2000));
    process.exit(2);
  }
  console.error(`命中项目: id=${exact.id} ${codeKey}=${exact[codeKey] || exact.projectCode} ${nameKey}=${exact[nameKey] || exact.projectName}`);

  // 2. 用创建表单上下文模拟明细行联动(不落库)
  const createLoad = await loadCreateForm();
  const context = createLoad.context;
  console.error(`createForm nodeId=${context.nodeId} requestId=${context.requestId ?? '(none)'} creatorId=${context.creatorId}`);

  const detailData = await loadDetailData(context);
  const detailDefaults = detailData.detail_1?.addRowDefValue || {};
  const indexnum = detailData.detail_1?.indexnum;
  const rowIndex = (indexnum ?? 0) + 1;
  console.error(`detail_1.indexnum=${JSON.stringify(indexnum)} -> rowIndex=${rowIndex}`);
  console.error(`addRowDefValue keys: ${Object.keys(detailDefaults).join(',') || '(empty)'}`);

  const initial = buildDetailRow(detailDefaults, rowIndex);
  const initPayload = await initDetailRow(context, rowIndex);
  let row = mergeAssignInfo(initial, initPayload.sql);
  row = mergeAssignInfo(row, initPayload.input);

  const projectPayload = projectType === 'customer'
    ? await applyCustomerProjectSelection(context, rowIndex, exact.id)
    : await applyProjectSelection(context, rowIndex, exact.id);
  console.error(`--- ${projectType === 'customer' ? 'applyCustomerProjectSelection' : 'applyProjectSelection'} inputPayload ---`);
  console.error(JSON.stringify(projectPayload.inputPayload, null, 2).slice(0, 3000));
  console.error('--- sqlPayload ---');
  console.error(JSON.stringify(projectPayload.sqlPayload, null, 2).slice(0, 3000));
  console.error('--- managerPayload ---');
  console.error(JSON.stringify(projectPayload.managerPayload, null, 2).slice(0, 2000));

  row = mergeAssignInfo(row, projectPayload.inputPayload);
  row = mergeAssignInfo(row, projectPayload.sqlPayload);
  row = mergeAssignInfo(row, projectPayload.managerPayload);

  console.error('--- 合并后的行字段(项目相关) ---');
  const interesting = projectType === 'customer'
    ? ['field19762', 'field19819', 'field19763', 'field19769', 'field30946', 'field30947', 'field30948', 'field19768', 'field27560']
    : ['field19760', 'field19818', 'field19761', 'field19765', 'field20549', 'field20550', 'field20551', 'field19768', 'field27559'];
  for (const key of interesting) {
    const k = `${key}_${rowIndex}`;
    console.error(`  ${k} = ${JSON.stringify(row[k])}  ${k}name=${JSON.stringify(row[`${k}name`])}`);
  }
  console.log(JSON.stringify({ rowIndex, row }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
