import { createPublicKey, publicEncrypt, constants } from 'node:crypto';

const DEFAULT_BASE_URL = process.env.OA_BASE_URL || 'https://oa.synyi.com';

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
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
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
    body.set(key, stringifyValue(value));
  }
  return body.toString();
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  update(setCookieValues = []) {
    for (const raw of setCookieValues) {
      if (!raw) {
        continue;
      }
      const first = raw.split(';', 1)[0];
      const index = first.indexOf('=');
      if (index === -1) {
        continue;
      }
      const key = first.slice(0, index).trim();
      const value = first.slice(index + 1).trim();
      if (!key) {
        continue;
      }
      this.cookies.set(key, value);
    }
  }

  toHeader() {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  toJSON() {
    return Object.fromEntries(this.cookies.entries());
  }
}

function getSetCookie(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

async function request(path, { method = 'GET', query, form, cookieJar, referer } = {}) {
  const url = new URL(path, DEFAULT_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, stringifyValue(value));
    }
  }

  const headers = {
    'X-Requested-With': 'XMLHttpRequest'
  };
  if (cookieJar && cookieJar.toHeader()) {
    headers.Cookie = cookieJar.toHeader();
  }
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
  }
  if (referer) {
    headers.Referer = referer;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: form ? toFormBody(form) : undefined,
    redirect: 'manual'
  });

  if (cookieJar) {
    cookieJar.update(getSetCookie(response.headers));
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`请求失败 ${response.status} ${response.statusText}: ${url}\n${text.slice(0, 1000)}`);
  }

  return {
    url: url.toString(),
    status: response.status,
    text,
    headers: response.headers
  };
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} 返回不是有效 JSON\n${text.slice(0, 1000)}`);
  }
}

function buildPemFromBase64PublicKey(base64Key) {
  const lines = base64Key.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

function encryptWithRsa(value, rsaInfo) {
  const plain = `${value}${rsaInfo.rsa_code || ''}`;
  const groupLength = 240;
  const chunks = [];
  for (let index = 0; index < plain.length; index += groupLength) {
    chunks.push(plain.slice(index, index + groupLength));
  }

  const publicKey = createPublicKey(buildPemFromBase64PublicKey(rsaInfo.rsa_pub));
  return chunks.map((chunk) => {
    const encrypted = publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_PADDING
      },
      Buffer.from(chunk, 'utf8')
    );
    return `${encrypted.toString('base64')}${rsaInfo.rsa_flag}`;
  }).join('');
}

async function loadInitialSession(cookieJar) {
  await request('/wui/index.html', {
    method: 'GET',
    cookieJar
  });
}

async function loadRsaInfo(cookieJar) {
  const response = await request('/rsa/weaver.rsa.GetRsaInfo', {
    method: 'GET',
    query: { ts: Date.now() },
    cookieJar,
    referer: `${DEFAULT_BASE_URL}/wui/index.html`
  });
  return parseJson(response.text, 'rsa info');
}

async function checkLogin({ loginId, password, cookieJar }) {
  const rsaInfo = await loadRsaInfo(cookieJar);
  const encryptedLoginId = encryptWithRsa(loginId, rsaInfo);
  const encryptedPassword = encryptWithRsa(password, rsaInfo);
  const response = await request('/api/hrm/login/checkLogin', {
    method: 'POST',
    cookieJar,
    referer: `${DEFAULT_BASE_URL}/wui/index.html`,
    form: {
      islanguid: '7',
      loginid: encryptedLoginId,
      userpassword: encryptedPassword,
      dynamicPassword: '',
      tokenAuthKey: '',
      validatecode: '',
      validateCodeKey: '',
      logintype: '1',
      messages: '',
      isie: 'false'
    }
  });
  return parseJson(response.text, 'checkLogin');
}

async function remindLogin(cookieJar) {
  const response = await request('/api/hrm/login/remindLogin', {
    method: 'POST',
    cookieJar,
    referer: `${DEFAULT_BASE_URL}/wui/index.html`,
    form: {
      logintype: '1'
    }
  });
  return parseJson(response.text, 'remindLogin');
}

async function loginWithPassword({ loginId, password }) {
  if (!loginId || !password) {
    throw new Error('缺少账号或密码。先设置 SYNYI_OA_USERNAME 和 SYNYI_OA_PASSWORD。');
  }

  const cookieJar = new CookieJar();
  await loadInitialSession(cookieJar);
  const loginResult = await checkLogin({ loginId, password, cookieJar });

  let remindResult = null;
  if (loginResult.loginstatus === 'true') {
    remindResult = await remindLogin(cookieJar);
  }

  return {
    loginResult,
    remindResult,
    cookies: cookieJar.toJSON(),
    cookieHeader: cookieJar.toHeader()
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const loginId = args.username || process.env.SYNYI_OA_USERNAME;
  const password = args.password || process.env.SYNYI_OA_PASSWORD;

  if (!loginId || !password) {
    console.error('缺少账号或密码。先设置 SYNYI_OA_USERNAME 和 SYNYI_OA_PASSWORD，或通过 --username/--password 传入。');
    process.exit(1);
  }

  const result = await loginWithPassword({ loginId, password });

  console.log(JSON.stringify({
    auth: 'password',
    loginstatus: result.loginResult.loginstatus,
    msg: result.loginResult.msg,
    userid: result.loginResult.userid ?? null,
    remindResult: result.remindResult,
    cookies: result.cookies,
    cookieHeader: result.cookieHeader
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

export {
  loginWithPassword
};
