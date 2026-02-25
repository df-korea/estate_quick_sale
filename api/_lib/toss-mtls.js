import https from 'https';

const BASE_URL = 'https://apps-in-toss-api.toss.im';

function getAgent() {
  const key = process.env.TOSS_MTLS_PRIVATE_KEY;
  const cert = process.env.TOSS_MTLS_PUBLIC_CERT;
  if (!key || !cert) throw new Error('TOSS_MTLS_PRIVATE_KEY and TOSS_MTLS_PUBLIC_CERT required');
  return new https.Agent({
    key: key.replace(/\\n/g, '\n'),
    cert: cert.replace(/\\n/g, '\n'),
  });
}

function request(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const agent = getAgent();
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      agent,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(`Toss API ${res.statusCode}: ${data}`);
            err.status = res.statusCode;
            err.body = json;
            reject(err);
          } else {
            resolve(json);
          }
        } catch {
          if (res.statusCode >= 400) {
            const err = new Error(`Toss API ${res.statusCode}: ${data}`);
            err.status = res.statusCode;
            reject(err);
          } else {
            resolve(data);
          }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

export function postWithMtls(path, body) {
  return request('POST', path, { body });
}

export function getWithMtls(path, headers) {
  return request('GET', path, { headers });
}
