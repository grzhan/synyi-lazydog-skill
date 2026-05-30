const DEFAULT_BASE_URL = process.env.OA_BASE_URL || 'https://oa.synyi.com';

const CREATE_ROUTE_PARAMS = {
  beagenter: '0',
  f_weaver_belongto_userid: '',
  f_weaver_belongto_usertype: '0',
  isagent: '0',
  iscreate: '1',
  menuIds: '1,12',
  menuPathIds: '1,12',
  workflowid: '266'
};

const WORKFLOW_CONFIG = {
  workflowId: 266,
  createNodeId: 2350,
  createModeId: 5602,
  nextNodeId: 2357,
  nextModeId: 5617,
  formId: -364,
  isBill: '1',
  browserFieldId: 19760,
  browserId: 161
};

const WORKTIME_SUPPLEMENT_LIST_CONFIG = {
  browserId: 16,
  workflowId: 313,
  contextWfId: 266,
  contextBillId: -364,
  contextFieldId: 25684,
  defaultStatus: 2,
  defaultCreateDateType: 0,
  defaultDateDuring: 38
};

function requireCookie() {
  const cookie = process.env.OA_COOKIE?.trim();
  if (!cookie) {
    throw new Error('缺少 OA_COOKIE 环境变量。先把浏览器会话 Cookie 放进去。');
  }
  return cookie;
}

function nowMs() {
  return Date.now();
}

function decodeSignatureAttributes(encoded) {
  if (!encoded) {
    return '';
  }
  const bytes = Buffer.from(encoded, 'base64');
  try {
    return new TextDecoder('gb18030').decode(bytes);
  } catch {
    return bytes.toString('latin1');
  }
}

function parseSignatureAttributes(encoded) {
  const decoded = decodeSignatureAttributes(encoded);
  if (!decoded) {
    return {};
  }
  const values = {};
  for (const entry of decoded.split('|')) {
    if (!entry) {
      continue;
    }
    const index = entry.indexOf('=');
    if (index === -1) {
      values[entry] = '';
      continue;
    }
    const key = entry.slice(0, index);
    const value = entry.slice(index + 1);
    values[key] = value;
  }
  return values;
}

function stringifyValue(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function toFormBody(params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        body.append(key, stringifyValue(item));
      }
      continue;
    }
    body.set(key, stringifyValue(value));
  }
  return body;
}

async function request(path, { method = 'GET', query, form, headers = {}, referer } = {}) {
  const cookie = requireCookie();
  const url = new URL(path, DEFAULT_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, stringifyValue(value));
    }
  }

  const finalHeaders = {
    'X-Requested-With': 'XMLHttpRequest',
    'Cookie': cookie,
    ...headers
  };

  let body;
  if (form) {
    body = toFormBody(form);
    finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
  }
  if (referer) {
    finalHeaders['Referer'] = referer;
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body,
    redirect: 'manual'
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`请求失败 ${response.status} ${response.statusText}: ${url}\n${text.slice(0, 500)}`);
  }

  return {
    url: url.toString(),
    status: response.status,
    headers: response.headers,
    text
  };
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} 返回不是有效 JSON\n${text.slice(0, 1000)}`);
  }
}

function walkObject(input, visitor) {
  if (Array.isArray(input)) {
    for (const item of input) {
      walkObject(item, visitor);
    }
    return;
  }
  if (!input || typeof input !== 'object') {
    return;
  }
  visitor(input);
  for (const value of Object.values(input)) {
    walkObject(value, visitor);
  }
}

function extractContext(loadFormPayload) {
  const context = {
    ...WORKFLOW_CONFIG,
    f_weaver_belongto_userid: '',
    f_weaver_belongto_usertype: '0',
    tokens: {},
    signatureContext: {}
  };

  walkObject(loadFormPayload, (node) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'object') {
        continue;
      }
      if (key === 'requestid') context.requestId = Number(value);
      if (key === 'workflowid') context.workflowId = Number(value);
      if (key === 'nodeid') context.nodeId = Number(value);
      if (key === 'currentnodeid') context.currentNodeId = Number(value);
      if (key === 'formid') context.formId = Number(value);
      if (key === 'billid') context.billId = Number(value);
      if (key === 'modeid') context.modeId = Number(value);
      if (key === 'creater') context.creatorId = Number(value);
      if (key === 'workflowtype') context.workflowType = stringifyValue(value);
      if (key === 'currentnodetype') context.currentNodeType = stringifyValue(value);
      if (key === 'nodetype') context.nodeType = stringifyValue(value);
      if (key === 'authStr') context.authStr = stringifyValue(value);
      if (key === 'authSignatureStr') context.authSignatureStr = stringifyValue(value);
      if (key === 'signatureSecretKey') context.signatureSecretKey = stringifyValue(value);
      if (key === 'signatureAttributesStr') context.signatureAttributesStr = stringifyValue(value);
      if (key === 'apiResultCacheKey') context.apiResultCacheKey = stringifyValue(value);
      if (key === 'f_weaver_belongto_userid') context.f_weaver_belongto_userid = stringifyValue(value);
      if (key === 'f_weaver_belongto_usertype') context.f_weaver_belongto_usertype = stringifyValue(value);
      if (key === 'isagent') context.isagent = stringifyValue(value);
      if (key === 'beagenter') context.beagenter = stringifyValue(value);
      if (key === 'creatertype') context.creatertype = stringifyValue(value);
      if (key === 'agentType') context.agentType = stringifyValue(value);
      if (key === 'isviewonly') context.isviewonly = stringifyValue(value);
      if (key === 'isremark') context.isremark = stringifyValue(value);
      if (key === 'workflowname') context.workflowName = stringifyValue(value);
      if (key === 'lastname') context.lastName = stringifyValue(value);
      if (key === 'requestmark') context.requestMark = stringifyValue(value);
      if (key === 'titlename') context.titleName = stringifyValue(value);
      if (key.toLowerCase().includes('submit_token')) {
        context.tokens[key] = stringifyValue(value);
      }
    }
  });

  if (!context.creatorId) {
    const creator = loadFormPayload?.maindata?.field19787?.value;
    if (creator) context.creatorId = Number(creator);
  }

  if (context.signatureAttributesStr) {
    context.signatureContext = parseSignatureAttributes(context.signatureAttributesStr);
  }

  return context;
}

function flattenFieldValue(field) {
  if (!field || typeof field !== 'object') {
    return '';
  }
  if ('value' in field) {
    return stringifyValue(field.value);
  }
  return '';
}

function flattenNameValue(field) {
  if (!field?.specialobj?.length) {
    return '';
  }
  const first = field.specialobj[0];
  return stringifyValue(first.name || first.tips || first.id || '');
}

function flattenMainFields(maindata = {}) {
  const fields = {};
  for (const [fieldKey, field] of Object.entries(maindata)) {
    fields[fieldKey] = flattenFieldValue(field);
    const nameValue = flattenNameValue(field);
    if (nameValue) {
      fields[`${fieldKey}name`] = nameValue;
    }
  }
  return fields;
}

function buildReqParams(context, overrides = {}) {
  return {
    requestid: overrides.requestid ?? context.requestId,
    workflowid: overrides.workflowid ?? context.workflowId,
    nodeid: overrides.nodeid ?? context.nodeId,
    formid: overrides.formid ?? context.formId,
    isbill: overrides.isbill ?? context.isBill,
    f_weaver_belongto_userid: overrides.f_weaver_belongto_userid ?? context.f_weaver_belongto_userid,
    f_weaver_belongto_usertype: overrides.f_weaver_belongto_usertype ?? context.f_weaver_belongto_usertype,
    authStr: overrides.authStr ?? context.authStr ?? '',
    authSignatureStr: overrides.authSignatureStr ?? context.authSignatureStr ?? '',
    signatureSecretKey: overrides.signatureSecretKey ?? context.signatureSecretKey ?? '',
    signatureAttributesStr: overrides.signatureAttributesStr ?? context.signatureAttributesStr ?? '',
    nodetype: overrides.nodetype ?? context.nodeType ?? '0',
    iscreate: overrides.iscreate ?? (context.requestId && context.requestId > 0 ? '0' : '1'),
    isviewonly: overrides.isviewonly ?? context.isviewonly ?? '0',
    ismode: overrides.ismode ?? '2',
    modeid: overrides.modeid ?? context.modeId,
    isagent: overrides.isagent ?? context.isagent ?? '0',
    beagenter: overrides.beagenter ?? context.beagenter ?? '0',
    creater: overrides.creater ?? context.creatorId,
    creatertype: overrides.creatertype ?? context.creatertype ?? '0',
    layouttype: overrides.layouttype ?? '0',
    requestType: overrides.requestType ?? '2',
    isSelfAuth: overrides.isSelfAuth ?? '1',
    selectNextFlow: overrides.selectNextFlow ?? '0',
    apiResultCacheKey: overrides.apiResultCacheKey ?? context.apiResultCacheKey ?? nowMs()
  };
}

async function loadCreateForm() {
  const referer = `${DEFAULT_BASE_URL}/spa/workflow/static4form/index.html?_rdm=${nowMs()}`;
  const response = await request('/api/workflow/reqform/loadForm', {
    method: 'POST',
    form: CREATE_ROUTE_PARAMS,
    referer
  });
  const payload = parseJson(response.text, 'loadForm(create)');
  const context = extractContext(payload);
  context.referer = referer;
  context.isCreatePage = true;
  return { context, payload };
}

async function loadExistingForm(requestUrl) {
  const referer = `${DEFAULT_BASE_URL}/spa/workflow/static4form/index.html?_rdm=${nowMs()}`;
  const url = new URL(requestUrl, DEFAULT_BASE_URL);
  const form = {};
  for (const [key, value] of url.searchParams.entries()) {
    form[key] = value;
  }
  const response = await request('/api/workflow/reqform/loadForm', {
    method: 'POST',
    form,
    referer
  });
  const payload = parseJson(response.text, 'loadForm(existing)');
  const context = extractContext(payload);
  context.referer = referer;
  context.isCreatePage = false;
  context.loadFormParams = form;
  return { context, payload };
}

async function loadExistingFormByPreload(requestId) {
  const preloadkey = String(nowMs());
  const timestamp = preloadkey;
  const referer = `${DEFAULT_BASE_URL}/spa/workflow/static4form/index.html?_rdm=${preloadkey}`;
  const response = await request('/api/workflow/reqform/loadForm', {
    method: 'POST',
    form: {
      preloadkey,
      requestid: requestId,
      timestamp
    },
    referer
  });
  const payload = parseJson(response.text, 'loadForm(preload)');
  const context = extractContext(payload);
  context.referer = referer;
  context.isCreatePage = false;
  context.loadFormParams = {
    preloadkey,
    requestid: String(requestId),
    timestamp
  };
  return { context, payload };
}

async function loadDetailData(context, detailmark = 'detail_1,detail_2') {
  const reqParams = buildReqParams(context);
  const form = context.requestId && context.requestId > 0
    ? {
        ...(context.loadFormParams || {}),
        detailmark,
        reqParams: JSON.stringify(reqParams),
        wfTestStr: '',
        f_weaver_belongto_userid: context.creatorId,
        f_weaver_belongto_usertype: context.f_weaver_belongto_usertype
      }
    : {
        ...CREATE_ROUTE_PARAMS,
        detailmark,
        reqParams: JSON.stringify(reqParams),
        wfTestStr: ''
      };
  const response = await request('/api/workflow/reqform/detailData', {
    method: 'POST',
    form,
    referer: context.referer
  });
  return parseJson(response.text, 'detailData');
}

async function callCreateDateLinkage(context, mainFields, workDate) {
  const common = {
    requestid: '-1',
    workflowid: context.workflowId,
    nodeid: context.nodeId,
    formid: context.formId,
    isbill: context.isBill,
    wfTestStr: '',
    f_weaver_belongto_userid: context.creatorId,
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype
  };

  const sqlResponse = await request('/api/workflow/linkage/reqFieldSqlResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_8770: '19790',
      rowIndexStr_8770: '-1',
      triTableMark_8770: 'main',
      field19790: workDate,
      field19787: context.creatorId,
      triFieldid_8780: '19790',
      rowIndexStr_8780: '-1',
      triTableMark_8780: 'main',
      triFieldid_10693: '19790',
      rowIndexStr_10693: '-1',
      triTableMark_10693: 'main',
      triFieldid_10694: '19790',
      rowIndexStr_10694: '-1',
      triTableMark_10694: 'main',
      triFieldid_10800: '19790',
      rowIndexStr_10800: '-1',
      triTableMark_10800: 'main',
      triFieldid_11268: '19790',
      rowIndexStr_11268: '-1',
      triTableMark_11268: 'main',
      field19789: mainFields.field19789,
      field19786: mainFields.field19786,
      linkageid: '8770,8780,10693,10694,10800,11268'
    },
    referer: context.referer
  });

  const response = await request('/api/workflow/linkage/reqDataInputResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_1620: '19790',
      rowIndexStr_1620: '-1',
      triTableMark_1620: 'main',
      field19790: workDate,
      linkageid: '1620'
    },
    referer: context.referer
  });

  const sqlPayload = parseJson(sqlResponse.text, 'create date linkage sql');
  const inputPayload = parseJson(response.text, 'create date linkage');
  return { ...sqlPayload, ...inputPayload };
}

async function getSecondAuthConfig(context) {
  const response = await request('/api/workflow/secondauth/getSecondAuthConfig', {
    method: 'POST',
    form: {
      workflowid: context.workflowId,
      nodeid: context.nodeId,
      requestid: context.requestId,
      src: 'submit'
    },
    referer: context.referer
  });
  return parseJson(response.text, 'secondAuth');
}

async function initPhase2MainFields(context, mainFields) {
  const currentDate = new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toTimeString().slice(0, 8);

  await request('/api/workflow/reqform/updateReqInfo', {
    method: 'POST',
    form: {
      formid: context.formId,
      isSubmitDirectNode: '',
      openByDefaultBrowser: '',
      iscreate: '0',
      creatertype: context.creatertype || '0',
      isdialog: '1',
      lastOperateDate: mainFields.field19788 || currentDate,
      createdoc: '',
      nodeid: context.nodeId,
      workflowid: context.workflowId,
      isbill: context.isBill,
      authStr: context.authStr || '',
      f_weaver_belongto_userid: context.creatorId,
      currenttime: currentTime,
      f_weaver_belongto_usertype: context.f_weaver_belongto_usertype,
      agentorByAgentId: '-1',
      isMultiDoc: '',
      inputcheck: '',
      comemessage: '',
      lastOperateTime: currentTime,
      temphasUseTempletSucceed: '',
      workflowRequestLogId: '',
      edesign_layout: '',
      requestid: context.requestId,
      isremark: context.isremark || '0',
      creater: context.creatorId,
      htmlfieldids: '',
      SubmitToNodeid: '',
      isCptwf: 'false',
      isovertime: '',
      agentType: context.agentType || '0',
      authSignatureStr: context.authSignatureStr || '',
      nodetype: context.nodeType || '1',
      needoutprint: '',
      lastOperator: context.creatorId,
      topage: '',
      isFormSignature: '0',
      remindTypes: '',
      fromFlowDoc: '',
      RejectNodes: '',
      billid: context.billId,
      lastnodeid: '',
      uploadType: '',
      isSignMustInput: '',
      RejectToNodeid: '',
      isWorkflowDoc: 'false',
      src: '',
      annexmaxUploadImageSize: '',
      takisremark: '0',
      workflowtype: context.workflowType || '30',
      remarkLocation: '',
      needcheck: '',
      needcheckLock: 'false',
      selectfieldvalue: '',
      RejectToType: '',
      currentdate: currentDate,
      needwfback: '',
      currentnodetype: context.currentNodeType || '1',
      wfmonitor: 'false',
      isurger: 'false',
      wfTestStr: '',
      ...context.tokens
    },
    referer: context.referer
  });

  const common = {
    requestid: context.requestId,
    workflowid: context.workflowId,
    nodeid: context.nodeId,
    formid: context.formId,
    isbill: context.isBill,
    wfTestStr: '',
    f_weaver_belongto_userid: context.creatorId,
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype
  };

  const mainSqlInit = await request('/api/workflow/linkage/reqFieldSqlResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '2',
      showAI: '0',
      triFieldid_8784: '',
      rowIndexStr_8784: '-1',
      triTableMark_8784: 'main',
      field19790: mainFields.field19790,
      field19787: context.creatorId,
      triFieldid_8787: '',
      rowIndexStr_8787: '-1',
      triTableMark_8787: 'main',
      triFieldid_10696: '',
      rowIndexStr_10696: '-1',
      triTableMark_10696: 'main',
      triFieldid_10697: '',
      rowIndexStr_10697: '-1',
      triTableMark_10697: 'main',
      triFieldid_10788: '',
      rowIndexStr_10788: '-1',
      triTableMark_10788: 'main',
      triFieldid_10801: '',
      rowIndexStr_10801: '-1',
      triTableMark_10801: 'main',
      triFieldid_14038: '',
      rowIndexStr_14038: '-1',
      triTableMark_14038: 'main',
      field19786: mainFields.field19786,
      linkageid: '8784,8787,10696,10697,10788,10801,14038'
    },
    referer: context.referer
  });
  Object.assign(mainFields, mergeAssignInfo({}, parseJson(mainSqlInit.text, 'phase2 main sql init')));

  const dateInit = await request('/api/workflow/linkage/reqDateTimeResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '2',
      showAI: '0',
      triFieldid_8786: '',
      rowIndexStr_8786: '-1',
      triTableMark_8786: 'main',
      field19788: mainFields.field19788,
      linkageid: '8786'
    },
    referer: context.referer
  });
  Object.assign(mainFields, mergeAssignInfo({}, parseJson(dateInit.text, 'phase2 date init')));

  const applicantSql = await request('/api/workflow/linkage/reqFieldSqlResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_8784: '19787',
      rowIndexStr_8784: '-1',
      triTableMark_8784: 'main',
      field19790: mainFields.field19790,
      field19787: context.creatorId,
      triFieldid_8787: '19787',
      rowIndexStr_8787: '-1',
      triTableMark_8787: 'main',
      triFieldid_10696: '19787',
      rowIndexStr_10696: '-1',
      triTableMark_10696: 'main',
      triFieldid_10697: '19787',
      rowIndexStr_10697: '-1',
      triTableMark_10697: 'main',
      triFieldid_10801: '19787',
      rowIndexStr_10801: '-1',
      triTableMark_10801: 'main',
      linkageid: '8784,8787,10696,10697,10801'
    },
    referer: context.referer
  });
  Object.assign(mainFields, mergeAssignInfo({}, parseJson(applicantSql.text, 'phase2 applicant sql')));

  const applicantInput = await request('/api/workflow/linkage/reqDataInputResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_3291: '19787',
      rowIndexStr_3291: '-1',
      triTableMark_3291: 'main',
      field19787: context.creatorId,
      triFieldid_3454: '19787',
      rowIndexStr_3454: '-1',
      triTableMark_3454: 'main',
      linkageid: '3291,3454'
    },
    referer: context.referer
  });
  Object.assign(mainFields, mergeAssignInfo({}, parseJson(applicantInput.text, 'phase2 applicant input')));

  const workDateSql = await request('/api/workflow/linkage/reqFieldSqlResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_8784: '19790',
      rowIndexStr_8784: '-1',
      triTableMark_8784: 'main',
      field19790: mainFields.field19790,
      field19787: context.creatorId,
      triFieldid_8787: '19790',
      rowIndexStr_8787: '-1',
      triTableMark_8787: 'main',
      triFieldid_10696: '19790',
      rowIndexStr_10696: '-1',
      triTableMark_10696: 'main',
      triFieldid_10697: '19790',
      rowIndexStr_10697: '-1',
      triTableMark_10697: 'main',
      triFieldid_10801: '19790',
      rowIndexStr_10801: '-1',
      triTableMark_10801: 'main',
      linkageid: '8784,8787,10696,10697,10801'
    },
    referer: context.referer
  });
  Object.assign(mainFields, mergeAssignInfo({}, parseJson(workDateSql.text, 'phase2 workdate sql')));

  const workDateInput = await request('/api/workflow/linkage/reqDataInputResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_1620: '19790',
      rowIndexStr_1620: '-1',
      triTableMark_1620: 'main',
      field19790: mainFields.field19790,
      linkageid: '1620'
    },
    referer: context.referer
  });
  Object.assign(mainFields, mergeAssignInfo({}, parseJson(workDateInput.text, 'phase2 workdate input')));

  return mainFields;
}

function buildCreateSubmitPayload(context, mainFields) {
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
    mainFieldUnEmptyCount: Object.values(mainFields).filter(Boolean).length,
    detailFieldUnEmptyCount: '0'
  };

  for (const [key, value] of Object.entries(context.tokens)) {
    payload[key] = value;
  }

  for (const [key, value] of Object.entries(mainFields)) {
    payload[key] = value;
  }

  payload.existChangeRange = [
    'field19800',
    'field31140',
    'field19806',
    'field19802',
    'field31830',
    'field31043',
    'field25687',
    'field25685',
    'field25686',
    'field19789',
    'field19797',
    'field19790',
    'field19792',
    'field19793',
    'field19791',
    'field19807',
    'field19811',
    'field19803',
    'field19804'
  ].join(',');

  return payload;
}

function extractExistingRequestUrl(text) {
  const directUrlMatch = text.match(/https?:\/\/[^"'\\\s]*ViewRequestForwardSPA\.jsp[^"'\\\s]*/);
  if (directUrlMatch) {
    return directUrlMatch[0];
  }

  const requestIdMatch = text.match(/requestid[=:"]+(\d{4,})/i);
  const sessionKeyMatch = text.match(/sessionkey[=:"]+([A-Za-z0-9_]+)/i);
  if (requestIdMatch && sessionKeyMatch) {
    const url = new URL('/workflow/request/ViewRequestForwardSPA.jsp', DEFAULT_BASE_URL);
    url.searchParams.set('isOpenContinuationProcess', 'undefined');
    url.searchParams.set('belongTest', 'false');
    url.searchParams.set('f_weaver_belongto_userid', '');
    url.searchParams.set('f_weaver_belongto_usertype', '0');
    url.searchParams.set('requestid', requestIdMatch[1]);
    url.searchParams.set('sessionkey', sessionKeyMatch[1]);
    url.searchParams.set('isNextNodeOperator', 'true');
    url.searchParams.set('isShowChart', '0');
    url.searchParams.set('needRemind', 'false');
    url.searchParams.set('saveType', 'undefined');
    return url.toString();
  }

  return null;
}

async function submitCreateForm(context, mainFields) {
  await getSecondAuthConfig({ ...context, requestId: -1 });
  const payload = buildCreateSubmitPayload(context, mainFields);
  const response = await request('/api/workflow/reqform/requestOperation', {
    method: 'POST',
    form: payload,
    referer: context.referer
  });
  const requestUrl = extractExistingRequestUrl(response.text);
  if (!requestUrl) {
    throw new Error(`第一次提交已发出，但没从返回里解析出 requestid。\n${response.text.slice(0, 1000)}`);
  }
  return requestUrl;
}

async function callSecondDateLinkage(context, workDate) {
  const common = {
    requestid: context.requestId,
    workflowid: context.workflowId,
    nodeid: context.nodeId,
    formid: context.formId,
    isbill: context.isBill,
    wfTestStr: '',
    f_weaver_belongto_userid: context.creatorId,
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype
  };

  await request('/api/workflow/linkage/reqFieldSqlResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_8784: '19790',
      rowIndexStr_8784: '-1',
      triTableMark_8784: 'main',
      field19790: workDate,
      field19787: context.creatorId,
      triFieldid_8787: '19790',
      rowIndexStr_8787: '-1',
      triTableMark_8787: 'main',
      triFieldid_10696: '19790',
      rowIndexStr_10696: '-1',
      triTableMark_10696: 'main',
      triFieldid_10697: '19790',
      rowIndexStr_10697: '-1',
      triTableMark_10697: 'main',
      triFieldid_10801: '19790',
      rowIndexStr_10801: '-1',
      triTableMark_10801: 'main',
      linkageid: '8784,8787,10696,10697,10801'
    },
    referer: context.referer
  });

  const response = await request('/api/workflow/linkage/reqDataInputResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_1620: '19790',
      rowIndexStr_1620: '-1',
      triTableMark_1620: 'main',
      field19790: workDate,
      linkageid: '1620'
    },
    referer: context.referer
  });
  return parseJson(response.text, 'second date linkage');
}

async function searchProjects({ projectName = '', projectCode = '', applicantId, requestId = -1 }) {
  const currenttime = nowMs();
  const query = {
    pageSize: 10,
    current: 1,
    min: 1,
    max: 10,
    companyId: 1,
    con13042_value: projectName,
    con13043_value: projectCode,
    isFromAdvanceSearch: 1,
    type: 'browser.devprj_notover',
    fielddbtype: 'browser.devprj_notover',
    currenttime,
    nodataloading: 0,
    requestid: requestId,
    workflowid: WORKFLOW_CONFIG.workflowId,
    [`sqr_${currenttime}`]: applicantId,
    wfid: WORKFLOW_CONFIG.workflowId,
    billid: WORKFLOW_CONFIG.formId,
    isbill: WORKFLOW_CONFIG.isBill,
    f_weaver_belongto_userid: applicantId,
    f_weaver_belongto_usertype: 0,
    wf_isagent: 0,
    wf_beagenter: 0,
    wfTestStr: '',
    fieldid: WORKFLOW_CONFIG.browserFieldId,
    viewtype: 1,
    fromModule: 'workflow',
    wfCreater: applicantId,
    __random__: nowMs()
  };

  const response = await request(`/api/public/browser/data/${WORKFLOW_CONFIG.browserId}`, {
    method: 'GET',
    query
  });
  return parseJson(response.text, 'browser data');
}

function buildDetailRow(detailDefaults, index) {
  const row = {};
  for (const [fieldKey, fieldValue] of Object.entries(detailDefaults || {})) {
    row[`${fieldKey}_${index}`] = flattenFieldValue(fieldValue);
  }
  return row;
}

async function initDetailRow(context, index) {
  const common = {
    requestid: context.requestId,
    workflowid: context.workflowId,
    nodeid: context.nodeId,
    formid: context.formId,
    isbill: context.isBill,
    wfTestStr: '',
    f_weaver_belongto_userid: context.creatorId,
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype
  };

  const rowSuffix = `_${index}`;
  const response1 = await request('/api/workflow/linkage/reqFieldSqlResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '3',
      showAI: '0',
      triFieldid_8783: '',
      rowIndexStr_8783: index,
      triTableMark_8783: 'detail_1',
      [`field19765${rowSuffix}`]: context.creatorId,
      triFieldid_8790: '',
      rowIndexStr_8790: index,
      triTableMark_8790: 'detail_1',
      [`field19818${rowSuffix}`]: '',
      [`customDepend_field19760${rowSuffix}`]: JSON.stringify({ sqr: String(context.creatorId) }),
      triFieldid_8791: '',
      rowIndexStr_8791: index,
      triTableMark_8791: 'detail_1',
      triFieldid_8792: '',
      rowIndexStr_8792: index,
      triTableMark_8792: 'detail_1',
      [`field19819${rowSuffix}`]: '',
      triFieldid_8793: '',
      rowIndexStr_8793: index,
      triTableMark_8793: 'detail_1',
      [`customDepend_field19762${rowSuffix}`]: JSON.stringify({ sqr: String(context.creatorId) }),
      triFieldid_8908: '',
      rowIndexStr_8908: index,
      triTableMark_8908: 'detail_1',
      field19787: context.creatorId,
      [`field21343${rowSuffix}`]: context.creatorId,
      [`field22430${rowSuffix}`]: context.creatorId,
      [`field22432${rowSuffix}`]: context.creatorId,
      [`field21746${rowSuffix}`]: '',
      triFieldid_11216: '',
      rowIndexStr_11216: index,
      triTableMark_11216: 'detail_1',
      triFieldid_11217: '',
      rowIndexStr_11217: index,
      triTableMark_11217: 'detail_1',
      triFieldid_13909: '',
      rowIndexStr_13909: index,
      triTableMark_13909: 'detail_1',
      field19791: '0',
      linkageid: '8783,8790,8791,8792,8793,8908,11216,11217,13909'
    },
    referer: context.referer
  });

  const response2 = await request('/api/workflow/linkage/reqDataInputResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '3',
      showAI: '0',
      triFieldid_1696: '19760',
      rowIndexStr_1696: index,
      triTableMark_1696: 'detail_1',
      [`field19760${rowSuffix}`]: '',
      triFieldid_3242: '19762',
      rowIndexStr_3242: index,
      triTableMark_3242: 'detail_1',
      [`field19762${rowSuffix}`]: '',
      triFieldid_3322: '19762',
      rowIndexStr_3322: index,
      triTableMark_3322: 'detail_1',
      linkageid: '1696,3242,3322'
    },
    referer: context.referer
  });

  return {
    sql: parseJson(response1.text, 'row init sql'),
    input: parseJson(response2.text, 'row init input')
  };
}

function mergeAssignInfo(target, assignInfo = {}) {
  const next = { ...target };
  for (const item of Object.values(assignInfo)) {
    if (!item?.changeValue) {
      continue;
    }
    for (const [key, field] of Object.entries(item.changeValue)) {
      next[key] = flattenFieldValue(field);
      const nameValue = flattenNameValue(field);
      if (nameValue) {
        next[`${key}name`] = nameValue;
      }
      if (Array.isArray(field?.specialobj) && field.specialobj.length > 1) {
        next[key] = field.specialobj.map((entry) => entry.id).join(',');
      }
    }
  }
  return next;
}

function isMainPayloadField(key) {
  return /^field\d+$/.test(key) || key === 'field-10' || key === 'field31140name';
}

function isMainCountField(key) {
  return /^field\d+$/.test(key) || key === 'field-10';
}

function isDetailPayloadField(key) {
  return /^field\d+_\d+$/.test(key) || /^field19760_\d+name$/.test(key);
}

function isDetailCountField(key) {
  return /^field\d+_\d+$/.test(key);
}

function buildRequestName(context, mainFields, currentDate) {
  if (context.signatureContext?.requestname) {
    return context.signatureContext.requestname;
  }
  const requestDate = mainFields.field19801 || mainFields.field19788 || currentDate;
  return `${context.workflowName || '产研医工时录入流程(Redmine Sync)'}-${context.lastName || ''}-${requestDate}`;
}

function pickContextValue(context, key, fallback = '') {
  const value = context.signatureContext?.[key];
  if (value !== undefined && value !== null && value !== '') {
    return value;
  }
  return fallback;
}

async function applyProjectSelection(context, rowIndex, projectId) {
  const rowSuffix = `_${rowIndex}`;
  const common = {
    requestid: context.requestId,
    workflowid: context.workflowId,
    nodeid: context.nodeId,
    formid: context.formId,
    isbill: context.isBill,
    wfTestStr: '',
    f_weaver_belongto_userid: context.creatorId,
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype
  };

  const inputResponse = await request('/api/workflow/linkage/reqDataInputResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_1696: '19760',
      rowIndexStr_1696: rowIndex,
      triTableMark_1696: 'detail_1',
      [`field19760${rowSuffix}`]: projectId,
      linkageid: '1696'
    },
    referer: context.referer
  });

  const inputPayload = parseJson(inputResponse.text, 'project selection input');
  const projectCode = flattenFieldValue(inputPayload.assignInfo_1696?.changeValue?.[`field19818${rowSuffix}`]);

  const sqlResponse = await request('/api/workflow/linkage/reqFieldSqlResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_8790: '19818',
      rowIndexStr_8790: rowIndex,
      triTableMark_8790: 'detail_1',
      [`field19818${rowSuffix}`]: projectCode,
      [`customDepend_field19760${rowSuffix}`]: JSON.stringify({ sqr: String(context.creatorId) }),
      triFieldid_8791: '19818',
      rowIndexStr_8791: rowIndex,
      triTableMark_8791: 'detail_1',
      triFieldid_8908: '19818',
      rowIndexStr_8908: rowIndex,
      triTableMark_8908: 'detail_1',
      field19787: context.creatorId,
      [`field21343${rowSuffix}`]: '',
      [`field22430${rowSuffix}`]: '',
      [`field22432${rowSuffix}`]: '',
      [`field21746${rowSuffix}`]: '',
      [`field19819${rowSuffix}`]: '',
      triFieldid_11216: '19818',
      rowIndexStr_11216: rowIndex,
      triTableMark_11216: 'detail_1',
      linkageid: '8790,8791,8908,11216'
    },
    referer: context.referer
  });

  const managerResponse = await request('/api/workflow/linkage/reqFieldSqlResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_8783: '19765',
      rowIndexStr_8783: rowIndex,
      triTableMark_8783: 'detail_1',
      [`field19765${rowSuffix}`]: flattenFieldValue(inputPayload.assignInfo_1696?.changeValue?.[`field19765${rowSuffix}`]),
      linkageid: '8783'
    },
    referer: context.referer
  });

  return {
    inputPayload,
    sqlPayload: parseJson(sqlResponse.text, 'project selection sql'),
    managerPayload: parseJson(managerResponse.text, 'project manager sql')
  };
}

async function applySupplementSelection(context, supplementRequestId) {
  const common = {
    requestid: context.requestId ?? -1,
    workflowid: context.workflowId,
    nodeid: context.nodeId,
    formid: context.formId,
    isbill: context.isBill,
    wfTestStr: '',
    f_weaver_belongto_userid: context.creatorId,
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype
  };

  const response = await request('/api/workflow/linkage/reqDataInputResult', {
    method: 'POST',
    form: {
      ...common,
      triSource: '1',
      showAI: '0',
      triFieldid_2767: '25684',
      rowIndexStr_2767: '-1',
      triTableMark_2767: 'main',
      field25684: supplementRequestId,
      triFieldid_2768: '25684',
      rowIndexStr_2768: '-1',
      triTableMark_2768: 'main',
      linkageid: '2767,2768'
    },
    referer: context.referer
  });
  return parseJson(response.text, 'supplement selection input');
}

function buildFinalSubmitPayload(context, mainFields, rowDataList, { startIndex = 0, omitMainChanged = false } = {}) {
  const totalHours = rowDataList.reduce((sum, row, offset) => {
    const realIndex = startIndex + offset;
    return sum + Number(row[`field19767_${realIndex}`] || 0);
  }, 0);
  mainFields.field19792 = String(totalHours);
  mainFields.field19793 = '0';
  mainFields.field19803 = totalHours.toFixed(1);
  mainFields.field19804 ||= '0.0';
  mainFields.field19807 ||= '0.0';
  mainFields.field19811 ||= '0.0';

  const currentDate = new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toTimeString().slice(0, 8);
  const requestName = buildRequestName(context, mainFields, currentDate);
  const serverLastOperateDate = pickContextValue(context, 'lastOperateDate', mainFields.field19788 || currentDate);
  const serverLastOperateTime = pickContextValue(context, 'lastOperateTime', currentTime);
  const serverLastOperator = pickContextValue(context, 'lastOperator', stringifyValue(context.creatorId));
  const serverNodeId = pickContextValue(context, 'nodeid', stringifyValue(context.nodeId));
  const serverWorkflowType = pickContextValue(context, 'workflowtype', context.workflowType || '30');
  const serverNodeType = pickContextValue(context, 'nodetype', context.nodeType || '1');
  const serverCurrentDate = pickContextValue(context, 'lastOperateDate', currentDate);
  const serverRequestLevel = pickContextValue(context, 'requestlevel', '0');
  const payload = {
    formid: context.formId,
    isSubmitDirectNode: '',
    openByDefaultBrowser: '',
    iscreate: '0',
    creatertype: context.creatertype || '0',
    isdialog: '1',
    lastOperateDate: serverLastOperateDate,
    createdoc: '',
    nodeid: serverNodeId,
    workflowid: context.workflowId,
    isbill: context.isBill,
    authStr: context.authStr || '',
    f_weaver_belongto_userid: context.creatorId,
    currenttime: currentTime,
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype,
    agentorByAgentId: '-1',
    isMultiDoc: '',
    inputcheck: '',
    comemessage: '',
    lastOperateTime: serverLastOperateTime,
    temphasUseTempletSucceed: '',
    workflowRequestLogId: '',
    edesign_layout: '',
    requestid: context.requestId,
    isremark: context.isremark || '0',
    creater: context.creatorId,
    htmlfieldids: '',
    SubmitToNodeid: '',
    isCptwf: 'false',
    isovertime: '',
    agentType: context.agentType || '0',
    authSignatureStr: context.authSignatureStr || '',
    nodetype: serverNodeType,
    needoutprint: '',
    lastOperator: serverLastOperator,
    topage: '',
    isFormSignature: '0',
    remindTypes: '',
    fromFlowDoc: '',
    RejectNodes: '',
    billid: context.billId,
    lastnodeid: '',
    uploadType: '',
    isSignMustInput: '',
    RejectToNodeid: '',
    isWorkflowDoc: 'false',
    src: 'submit',
    annexmaxUploadImageSize: '',
    takisremark: '0',
    workflowtype: serverWorkflowType,
    remarkLocation: '',
    needcheck: '',
    needcheckLock: 'false',
    selectfieldvalue: '',
    RejectToType: '',
    currentdate: serverCurrentDate,
    needwfback: '0',
    annexdocids: '',
    signdocids: '',
    annexdocinfos: '',
    handWrittenSign: '',
    remark: '',
    'field-annexupload': '',
    signworkflowids: '',
    isOdocRequest: '0',
    enableIntervenor: '',
    linkageUnFinishedKey: '',
    remarkquote: '',
    actiontype: 'requestOperation',
    isFirstSubmit: '0',
    requestname: requestName,
    requestlevel: serverRequestLevel,
    selectNextFlow: '',
    wfTestStr: '',
    messageType: '-1',
    chatsType: '-1',
    signatureAttributesStr: context.signatureAttributesStr || '',
    signatureSecretKey: context.signatureSecretKey || '',
    'field-10': '',
    'field-9': '0'
  };

  for (const [key, value] of Object.entries(context.tokens)) {
    payload[key] = value;
  }

  const mainPayloadEntries = Object.entries(mainFields).filter(([key]) => isMainPayloadField(key));
  for (const [key, value] of mainPayloadEntries) {
    payload[key] = value;
  }

  const changed = omitMainChanged
    ? []
    : [
        'field19800',
        'field19803',
        'field19804',
        'field31140',
        'field19806',
        'field19802',
        'field31830',
        'field31043',
        'field19792',
        'field19807',
        'field19793',
        'field19811'
      ];
  const requiredContentFields = [];
  const requiredHourFields = [];
  let detailFieldUnEmptyCount = 0;
  const rowInitKeysFirst = [
    'field30945',
    'field21744',
    'field19769',
    'field30946',
    'field30948',
    'field30947',
    'field21343',
    'field21342',
    'field21341',
    'field22430',
    'field22432',
    'field20549',
    'field19765',
    'field20551',
    'field20550',
    'field19768'
  ];
  const rowInitKeysLater = [
    'field30945',
    'field21744',
    'field30947',
    'field19769',
    'field30946',
    'field21343',
    'field21342',
    'field21341',
    'field22430',
    'field22432',
    'field30948',
    'field20549',
    'field20551',
    'field20550',
    'field19765',
    'field19768'
  ];
  const rowProjectKeysFirst = [
    'field19760',
    'field20549',
    'field19761',
    'field19818',
    'field19765',
    'field20551',
    'field20550',
    'field19768',
    'field27559'
  ];
  const rowProjectKeysLater = [
    'field19760',
    'field20549',
    'field19818',
    'field19761',
    'field20551',
    'field20550',
    'field19765',
    'field19768',
    'field27559'
  ];
  const rowDefaultEmptyKeys = ['field19764', 'field19809', 'field21746'];

  if (startIndex > 0) {
    for (let pseudo = 0; pseudo < startIndex; pseudo += 1) {
      changed.push(...rowInitKeysFirst.map((key) => `${key}_${pseudo}`));
    }
  }

  rowDataList.forEach((row, offset) => {
    const realIndex = startIndex + offset;
    requiredContentFields.push(`field19759_${realIndex}`);
    requiredHourFields.push(`field19767_${realIndex}`);

    for (const fieldKey of rowDefaultEmptyKeys) {
      const key = `${fieldKey}_${realIndex}`;
      if (!(key in row)) {
        row[key] = '';
      }
    }

    for (const [key, value] of Object.entries(row)) {
      if (!isDetailPayloadField(key)) {
        continue;
      }
      payload[key] = value;
      if (value !== '' && isDetailCountField(key)) {
        detailFieldUnEmptyCount += 1;
      }
    }

    const rowInitKeys = realIndex === 0 ? rowInitKeysFirst : rowInitKeysLater;
    const rowProjectKeys = realIndex === 0 ? rowProjectKeysFirst : rowProjectKeysLater;
    changed.push(...rowInitKeys.map((key) => `${key}_${realIndex}`));
    if (realIndex === 0 && offset === 0) {
      changed.push(`field19759_${realIndex}`, `field19767_${realIndex}`, 'field19792', 'field19803');
    } else {
      changed.push(`field19767_${realIndex}`, 'field19792', 'field19803', `field19759_${realIndex}`);
    }
    changed.push(...rowProjectKeys.map((key) => `${key}_${realIndex}`));
  });

  payload.verifyRequiredRange = `${requiredContentFields.join(',')},${requiredHourFields.join(',')},field19787,`;
  payload.existChangeRange = changed.join(',');
  payload.nodesnum0 = String(rowDataList.length);
  payload.indexnum0 = String(startIndex + rowDataList.length);
  payload.submitdtlid0 = rowDataList.map((_, offset) => String(startIndex + offset)).join(',') + (rowDataList.length ? ',' : '');
  payload.deldtlid0 = '';
  payload.nodesnum1 = '0';
  payload.indexnum1 = '0';
  payload.submitdtlid1 = '';
  payload.deldtlid1 = '';
  payload.mainFieldUnEmptyCount = String(
    mainPayloadEntries.filter(([key, value]) => isMainCountField(key) && Boolean(value)).length
  );
  payload.detailFieldUnEmptyCount = String(detailFieldUnEmptyCount);

  return payload;
}

async function submitExistingForm(context, mainFields, rowDataList, options = {}) {
  await getSecondAuthConfig(context);
  const payload = buildFinalSubmitPayload(context, mainFields, rowDataList, options);
  if (process.env.DEBUG_PHASE2) {
    console.error('--- final submit payload form-data ---');
    console.error(new URLSearchParams(payload).toString());
    console.error('--- end final submit payload form-data ---');
  }
  const response = await request('/api/workflow/reqform/requestOperation', {
    method: 'POST',
    form: payload,
    referer: context.referer
  });
  return response.text;
}

function buildAdvanceSubmitPayload(context, mainFields) {
  const currentDate = new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toTimeString().slice(0, 8);
  const requestName = buildRequestName(context, mainFields, currentDate);
  const serverLastOperateDate = pickContextValue(context, 'lastOperateDate', mainFields.field19788 || currentDate);
  const serverLastOperateTime = pickContextValue(context, 'lastOperateTime', currentTime);
  const serverLastOperator = pickContextValue(context, 'lastOperator', stringifyValue(context.creatorId));
  const serverNodeId = pickContextValue(context, 'nodeid', stringifyValue(context.nodeId));
  const serverWorkflowType = pickContextValue(context, 'workflowtype', context.workflowType || '30');
  const serverNodeType = pickContextValue(context, 'nodetype', context.nodeType || '0');
  const serverCurrentDate = pickContextValue(context, 'lastOperateDate', currentDate);
  const serverRequestLevel = pickContextValue(context, 'requestlevel', '0');

  const payload = {
    formid: context.formId,
    isSubmitDirectNode: '',
    openByDefaultBrowser: '',
    iscreate: '0',
    creatertype: context.creatertype || '0',
    isdialog: '1',
    lastOperateDate: serverLastOperateDate,
    createdoc: '',
    nodeid: serverNodeId,
    workflowid: context.workflowId,
    isbill: context.isBill,
    authStr: context.authStr || '',
    f_weaver_belongto_userid: context.creatorId,
    currenttime: currentTime,
    f_weaver_belongto_usertype: context.f_weaver_belongto_usertype,
    agentorByAgentId: '-1',
    isMultiDoc: '',
    inputcheck: '',
    comemessage: '',
    lastOperateTime: serverLastOperateTime,
    temphasUseTempletSucceed: '',
    workflowRequestLogId: '',
    edesign_layout: '',
    requestid: context.requestId,
    isremark: context.isremark || '0',
    creater: context.creatorId,
    htmlfieldids: '',
    SubmitToNodeid: '',
    isCptwf: 'false',
    isovertime: '',
    agentType: context.agentType || '0',
    authSignatureStr: context.authSignatureStr || '',
    nodetype: serverNodeType,
    needoutprint: '',
    lastOperator: serverLastOperator,
    topage: '',
    isFormSignature: '0',
    remindTypes: '',
    fromFlowDoc: '',
    RejectNodes: '',
    billid: context.billId,
    lastnodeid: '',
    uploadType: '',
    isSignMustInput: '',
    RejectToNodeid: '',
    isWorkflowDoc: 'false',
    src: 'submit',
    annexmaxUploadImageSize: '',
    takisremark: '0',
    workflowtype: serverWorkflowType,
    remarkLocation: '',
    needcheck: '',
    needcheckLock: 'false',
    selectfieldvalue: '',
    RejectToType: '',
    currentdate: serverCurrentDate,
    needwfback: '0',
    annexdocids: '',
    signdocids: '',
    annexdocinfos: '',
    handWrittenSign: '',
    remark: '',
    'field-annexupload': '',
    signworkflowids: '',
    isOdocRequest: '0',
    enableIntervenor: '',
    verifyRequiredRange: 'field19790,field19829,',
    linkageUnFinishedKey: '',
    remarkquote: '',
    actiontype: 'requestOperation',
    isFirstSubmit: '0',
    existChangeRange: '',
    chatsType: '-1',
    messageType: '-1',
    'field-9': '0',
    'field-10': '',
    requestname: requestName,
    requestlevel: serverRequestLevel,
    nodesnum0: '0',
    indexnum0: '0',
    submitdtlid0: '',
    deldtlid0: '',
    nodesnum1: '0',
    indexnum1: '0',
    submitdtlid1: '',
    deldtlid1: '',
    detailFieldUnEmptyCount: '0',
    signatureAttributesStr: context.signatureAttributesStr || '',
    signatureSecretKey: context.signatureSecretKey || '',
    selectNextFlow: '',
    wfTestStr: ''
  };

  for (const [key, value] of Object.entries(context.tokens)) {
    payload[key] = value;
  }

  const mainPayloadEntries = Object.entries(mainFields).filter(([key]) => isMainPayloadField(key));
  for (const [key, value] of mainPayloadEntries) {
    payload[key] = value;
  }

  payload.mainFieldUnEmptyCount = String(
    mainPayloadEntries.filter(([key, value]) => isMainCountField(key) && Boolean(value)).length
  );

  return payload;
}

async function submitAdvanceForm(context, mainFields) {
  await getSecondAuthConfig(context);
  const payload = buildAdvanceSubmitPayload(context, mainFields);
  if (process.env.DEBUG_PHASE2) {
    console.error('--- advance payload form-data ---');
    console.error(new URLSearchParams(payload).toString());
    console.error('--- end advance payload form-data ---');
  }
  const response = await request('/api/workflow/reqform/requestOperation', {
    method: 'POST',
    form: payload,
    referer: context.referer
  });
  return response.text;
}

function parseSupplementTitleRange(title) {
  if (!title) {
    return { start: null, end: null };
  }
  const match = String(title).match(
    /工时补录开始日期:(\d{4}-\d{2}-\d{2})\s*,\s*工时补录结束日期:(\d{4}-\d{2}-\d{2})/
  );
  if (!match) {
    return { start: null, end: null };
  }
  return { start: match[1], end: match[2] };
}

async function listWorktimeSupplementRequests({
  applicantId,
  pageSize = 50,
  current = 1,
  status,
  createDateType,
  dateDuring
} = {}) {
  if (!applicantId) {
    throw new Error('listWorktimeSupplementRequests 需要 applicantId');
  }

  const referer = `${DEFAULT_BASE_URL}/spa/workflow/static4form/index.html?_rdm=${nowMs()}`;
  const min = (current - 1) * pageSize + 1;
  const max = current * pageSize;

  const dataKeyResponse = await request(
    `/api/public/browser/data/${WORKTIME_SUPPLEMENT_LIST_CONFIG.browserId}`,
    {
      method: 'GET',
      query: {
        pageSize,
        current,
        min,
        max,
        companyId: 1,
        workflowid: WORKTIME_SUPPLEMENT_LIST_CONFIG.workflowId,
        createdatetype: createDateType ?? WORKTIME_SUPPLEMENT_LIST_CONFIG.defaultCreateDateType,
        status: status ?? WORKTIME_SUPPLEMENT_LIST_CONFIG.defaultStatus,
        date2during: dateDuring ?? WORKTIME_SUPPLEMENT_LIST_CONFIG.defaultDateDuring,
        wfid: WORKTIME_SUPPLEMENT_LIST_CONFIG.contextWfId,
        billid: WORKTIME_SUPPLEMENT_LIST_CONFIG.contextBillId,
        isbill: 1,
        requestid: -1,
        f_weaver_belongto_userid: applicantId,
        f_weaver_belongto_usertype: 0,
        wf_isagent: 0,
        wf_beagenter: 0,
        wfTestStr: '',
        fieldid: WORKTIME_SUPPLEMENT_LIST_CONFIG.contextFieldId,
        viewtype: 0,
        fromModule: 'workflow',
        wfCreater: applicantId,
        __random__: nowMs()
      },
      referer
    }
  );

  const dataKeyPayload = parseJson(dataKeyResponse.text, 'supplement list dataKey');
  if (dataKeyPayload?.type !== 1 || !dataKeyPayload?.datas) {
    throw new Error(
      `获取补录列表 dataKey 失败: ${JSON.stringify(dataKeyPayload).slice(0, 500)}`
    );
  }

  const listResponse = await request('/api/ec/dev/table/datas', {
    method: 'POST',
    form: {
      dataKey: dataKeyPayload.datas,
      min,
      max,
      pageSize,
      current,
      sortParams: '[]'
    },
    referer
  });

  const listPayload = parseJson(listResponse.text, 'supplement list datas');
  const rawRecords = Array.isArray(listPayload?.datas) ? listPayload.datas : [];

  const records = rawRecords.map((row) => {
    const title = stringifyValue(row.requestnamenew);
    const range = parseSupplementTitleRange(title);
    return {
      requestId: Number(row.id),
      requestName: stringifyValue(row.requestname),
      title,
      creatorId: Number(row.creater),
      creatorName: stringifyValue(row.createrspan),
      createDate: stringifyValue(row.createdate),
      createDateTime: stringifyValue(row.createdatespan),
      supplementStartDate: range.start,
      supplementEndDate: range.end
    };
  });

  const total = Number.isFinite(Number(listPayload?.count))
    ? Number(listPayload.count)
    : Number.isFinite(Number(listPayload?.total))
      ? Number(listPayload.total)
      : null;

  return {
    total,
    pageSize,
    current,
    records,
    raw: listPayload
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      continue;
    }
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function assertDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`日期格式不对: ${dateString}，要求 YYYY-MM-DD`);
  }
}

function parseWorklogs(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('工时明细必须是非空数组');
  }
  return parsed.map((item, index) => {
    if (!item.content || item.hours === undefined || (!item.projectName && !item.projectCode)) {
      throw new Error(`第 ${index + 1} 条工时缺少 content / hours / projectName(projectCode 也可以)`);
    }
    return {
      content: String(item.content),
      hours: Number(item.hours),
      projectCode: item.projectCode ? String(item.projectCode) : '',
      projectName: item.projectName ? String(item.projectName) : '',
      customerProjectName: item.customerProjectName ? String(item.customerProjectName) : ''
    };
  });
}

export {
  buildCreateSubmitPayload,
  buildFinalSubmitPayload,
  DEFAULT_BASE_URL,
  WORKFLOW_CONFIG,
  WORKTIME_SUPPLEMENT_LIST_CONFIG,
  assertDate,
  buildDetailRow,
  callCreateDateLinkage,
  callSecondDateLinkage,
  extractContext,
  flattenMainFields,
  getSecondAuthConfig,
  initPhase2MainFields,
  initDetailRow,
  listWorktimeSupplementRequests,
  loadCreateForm,
  loadDetailData,
  loadExistingFormByPreload,
  loadExistingForm,
  mergeAssignInfo,
  parseArgs,
  parseJson,
  parseSupplementTitleRange,
  parseWorklogs,
  request,
  searchProjects,
  submitCreateForm,
  submitExistingForm,
  submitAdvanceForm,
  applyProjectSelection,
  applySupplementSelection
};
