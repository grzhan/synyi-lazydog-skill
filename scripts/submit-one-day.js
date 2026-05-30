import { parseArgs } from './oa-client.js';
import { loginWithPassword } from './login.js';
import { submitOneDay, pickSupplement } from './submit-month-worktime.js';

async function main() {
  const args = parseArgs(process.argv);
  const date = args.date;
  const projectCode = args.projectCode || 'Y3018005';
  const content = args.content || 'Nexus 开发';
  const hours = args.hours ? Number(args.hours) : 8;
  const supplementRequestIdArg = args.supplementRequestId;
  const noSupplement = args.noSupplement === true || args.noSupplement === 'true';
  const username = process.env.SYNYI_OA_USERNAME;
  const password = process.env.SYNYI_OA_PASSWORD;

  if (!date) {
    console.error('用法: node submit-one-day.js --date 2026-05-26 [--supplementRequestId 1058063 | --noSupplement] [--projectCode Y3018005] [--content "Nexus 开发"] [--hours 8]');
    process.exit(1);
  }

  if (noSupplement && supplementRequestIdArg) {
    console.error('--noSupplement 和 --supplementRequestId 不能同时传');
    process.exit(1);
  }

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

  let supplementRequestId;
  if (noSupplement) {
    console.error('未关联补录流程，按普通工时录入提交');
    supplementRequestId = undefined;
  } else {
    const supplement = await pickSupplement({ applicantId, supplementRequestIdArg });
    console.error(`补录流程: ${supplement.requestId} (${supplement.supplementStartDate} ~ ${supplement.supplementEndDate})`);
    if (date < supplement.supplementStartDate || date > supplement.supplementEndDate) {
      console.error(`警告: 日期 ${date} 不在补录区间 ${supplement.supplementStartDate} ~ ${supplement.supplementEndDate} 内,服务端可能会拒绝`);
    }
    supplementRequestId = supplement.requestId;
  }

  console.error(`提交 ${date} ...`);
  const result = await submitOneDay({
    date,
    supplementRequestId,
    projectCode,
    content,
    hours,
    applicantId
  });

  console.log(JSON.stringify({
    supplementRequestId: supplementRequestId ?? null,
    date: result.date,
    requestId: result.requestId,
    projectCode: result.projectCode,
    projectName: result.projectName,
    content,
    hours
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
