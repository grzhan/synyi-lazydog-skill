import {
  applySupplementSelection,
  assertDate,
  callCreateDateLinkage,
  flattenMainFields,
  getSecondAuthConfig,
  loadCreateForm,
  mergeAssignInfo,
  parseArgs,
  request
} from './oa-client.js';

function buildPhase1SubmitPayload(context, mainFields) {
  const requestName = `${context.workflowName || '产研医工时录入流程(Redmine Sync)'}-${context.lastName || ''}-${mainFields.field19788}`;

  const payload = {
    formid: context.formId,
    f_weaver_belongto_userid: context.creatorId,
    isWorkflowDoc: 'false',
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype,
    nodetype: context.nodeType || '0',
    method: '',
    needoutprint: '',
    src: 'submit',
    isMultiDoc: '',
    topage: '',
    workflowtype: context.workflowType || '30',
    iscreate: '1',
    comemessage: '',
    remindTypes: '',
    rand: '',
    requestid: '-1',
    htmlfieldids: '',
    needwfback: '1',
    lastloginuserid: context.creatorId,
    nodeid: context.nodeId,
    workflowid: context.workflowId,
    isbill: context.isBill,
    annexdocids: '',
    signdocids: '',
    annexdocinfos: '',
    handWrittenSign: '',
    remark: '',
    'field-annexupload': '',
    signworkflowids: '',
    remarkLocation: '',
    isOdocRequest: '0',
    enableIntervenor: '',
    verifyRequiredRange: 'field19790,field19829,',
    linkageUnFinishedKey: '',
    remarkquote: '',
    actiontype: 'requestOperation',
    isFirstSubmit: '',
    selectNextFlow: '0',
    wfTestStr: '',
    signatureAttributesStr: context.signatureAttributesStr || '',
    signatureSecretKey: context.signatureSecretKey || '',
    requestname: requestName,
    requestlevel: mainFields['field-2'] || '0',
    nodesnum0: '0',
    indexnum0: '0',
    submitdtlid0: '',
    deldtlid0: '',
    nodesnum1: '0',
    indexnum1: '0',
    submitdtlid1: '',
    deldtlid1: '',
    detailFieldUnEmptyCount: '0'
  };

  for (const [key, value] of Object.entries(context.tokens)) {
    payload[key] = value;
  }

  const fieldKeys = [
    'field19808',
    'field31043',
    'field19829',
    'field19805',
    'field19802',
    'field19800',
    'field19801',
    'field19812',
    'field19787',
    'field19788',
    'field19799',
    'field19786',
    'field19794',
    'field19795',
    'field19790',
    'field25687',
    'field19791',
    'field25688',
    'field26175',
    'field25685',
    'field25686',
    'field25684',
    'field19789',
    'field19797',
    'field19796',
    'field19798',
    'field19813',
    'field19792',
    'field19793',
    'field19806',
    'field19807',
    'field19803',
    'field19804',
    'field19811',
    'field31140',
    'field21194',
    'field31830'
  ];

  for (const key of fieldKeys) {
    if (mainFields[key] !== undefined) {
      payload[key] = mainFields[key];
    }
    const nameKey = `${key}name`;
    if (mainFields[nameKey] !== undefined) {
      payload[nameKey] = mainFields[nameKey];
    }
  }

  payload.mainFieldUnEmptyCount = String(
    fieldKeys.filter((key) => (payload[key] ?? '') !== '').length
  );

  payload.existChangeRange = [
    'field19808',
    'field31043',
    'field19829',
    'field19805',
    'field19802',
    'field19800',
    'field19801',
    'field19812',
    'field19787',
    'field19788',
    'field19799',
    'field19786',
    'field19794',
    'field19795',
    'field19790',
    'field25687',
    'field19791',
    'field25688',
    'field26175',
    'field25685',
    'field25686',
    'field25684',
    'field19789',
    'field19797',
    'field19806',
    'field19807',
    'field19803',
    'field19804',
    'field19811',
    'field31140',
    'field21194',
    'field31830'
  ].join(',');

  return payload;
}

async function createPhase1(date, { supplementRequestId } = {}) {
  const createLoad = await loadCreateForm();
  const createContext = createLoad.context;
  const mainFields = flattenMainFields(createLoad.payload.maindata);

  if (supplementRequestId) {
    const supplementPayload = await applySupplementSelection(createContext, supplementRequestId);
    Object.assign(mainFields, mergeAssignInfo({}, supplementPayload));
    mainFields.field25684 = String(supplementRequestId);
    mainFields.field25684name = String(supplementRequestId);
  }

  mainFields.field19790 = date;
  mainFields.field19790name = date;

  const dateLinkage = await callCreateDateLinkage(createContext, mainFields, date);
  Object.assign(mainFields, mergeAssignInfo({}, dateLinkage));
  const linkedType = dateLinkage.assignInfo_1620?.changeValue?.field19791?.value;
  if (linkedType !== undefined) {
    mainFields.field19791 = String(linkedType);
  }
  if (mainFields.field19791 !== '0') {
    throw new Error(`日期 ${date} 不是工作日，系统返回 field19791=${mainFields.field19791}`);
  }

  if (supplementRequestId) {
    mainFields.field19799 = '1';
  }
  mainFields.field19792 ||= '0';
  mainFields.field19793 ||= '0';
  mainFields.field19803 ||= '0.0';
  mainFields.field19804 ||= '0.0';
  mainFields.field19807 ||= '0.0';
  mainFields.field19811 ||= '0.0';

  await getSecondAuthConfig({ ...createContext, requestId: -1 });
  const payload = buildPhase1SubmitPayload(createContext, mainFields);

  const response = await request('/api/workflow/reqform/requestOperation', {
    method: 'POST',
    form: payload,
    referer: createContext.referer
  });

  return {
    context: createContext,
    payload,
    responseText: response.text
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const date = args.date;
  const supplementRequestId = args.supplementRequestId;

  if (!date) {
    console.error('用法: OA_COOKIE="..." node phase1.js --date 2026-05-09 [--supplementRequestId 1058063]');
    process.exit(1);
  }

  assertDate(date);
  const result = await createPhase1(date, { supplementRequestId });

  console.log(JSON.stringify({
    auth: 'cookie',
    requestIdBeforeSubmit: result.context.requestId,
    nodeId: result.context.nodeId,
    payloadPreview: {
      field19790: result.payload.field19790,
      field19791: result.payload.field19791,
      field19787: result.payload.field19787,
      field19788: result.payload.field19788,
      field19786: result.payload.field19786,
      field31140: result.payload.field31140,
      requestname: result.payload.requestname,
      mainFieldUnEmptyCount: result.payload.mainFieldUnEmptyCount
    },
    response: result.responseText.slice(0, 4000)
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

export {
  buildPhase1SubmitPayload,
  createPhase1
};
