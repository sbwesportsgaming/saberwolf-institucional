/* Central SBW: consultas somente de leitura, sem armazenamento de eventos. */
export class RequestError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

const MAX_BODY = 2048;
const RANGE_MS = 86400000;

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function parameters(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['days', 'start_date', 'end_date', 'streamer'].includes(key))) {
    throw new RequestError(400, 'invalid_parameters');
  }
  const days = value.days ?? 7;
  const start = value.start_date ?? null, end = value.end_date ?? null;
  const streamer = value.streamer ?? null;
  if (!Number.isInteger(days) || days < 1 || days > 180 ||
      ((start === null) !== (end === null)) ||
      (start !== null && (!validDate(start) || !validDate(end) || start > end ||
        (Date.parse(end) - Date.parse(start)) / RANGE_MS > 179)) ||
      (streamer !== null && (typeof streamer !== 'string' || !/^[a-z0-9][a-z0-9_.-]{0,79}$/.test(streamer)))) {
    throw new RequestError(400, 'invalid_parameters');
  }
  return { p_days: days, p_start_date: start, p_end_date: end, p_streamer: streamer };
}

async function readBody(request) {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) throw new RequestError(415, 'json_required');
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) throw new RequestError(413, 'body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, 'invalid_parameters');
  let length = 0; const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY) { await reader.cancel(); throw new RequestError(413, 'body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length); let offset = 0;
  chunks.forEach(chunk => { body.set(chunk, offset); offset += chunk.byteLength; });
  try { return JSON.parse(new TextDecoder().decode(body)); }
  catch { throw new RequestError(400, 'invalid_parameters'); }
}

async function jsonFetch(fetcher, url, options, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const result = await fetcher(url, { ...options, redirect: 'error', cache: 'no-store', signal: controller.signal });
    if (!result.ok) throw new RequestError(result.status === 401 ? 401 : result.status === 403 ? 403 : 503, 'upstream_unavailable');
    return await result.json();
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(503, 'upstream_unavailable');
  } finally { clearTimeout(timer); }
}

export async function authorizeOwner(request, config, fetcher) {
  const header = request.headers.get('authorization') || '';
  if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header) || header.length > 8192) {
    throw new RequestError(401, 'authentication_required');
  }
  const headers = { apikey: config.authKey, Authorization: header, 'Content-Type': 'application/json' };
  const user = await jsonFetch(fetcher, config.authUrl + '/auth/v1/user', { headers }, 7000);
  if (!user || typeof user.id !== 'string' || !user.id) throw new RequestError(401, 'authentication_required');
  const caps = await jsonFetch(fetcher, config.authUrl + '/rest/v1/rpc/sbw_admin_get_capabilities',
    { method: 'POST', headers, body: '{}' }, 7000);
  if (caps?.ok !== true || caps?.is_owner !== true) throw new RequestError(403, 'owner_required');
  return { header, userId: user.id };
}

function setup(config, dependencies, run) {
  const fetcher = dependencies.fetcher || fetch;
  const now = dependencies.now || Date.now;
  const requests = new Map();
  return async request => {
    const origin = request.headers.get('origin') || '';
    const allowed = config.origins.includes(origin);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private',
      'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff',
      ...(allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Max-Age': '600' } : {})
    };
    const respond = (status, data) => new Response(JSON.stringify(data), { status, headers });
    if (!allowed) return respond(403, { ok: false, code: 'origin_not_allowed' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond(405, { ok: false, code: 'method_not_allowed' });
    if (request.headers.get('apikey') !== config.publicKey) return respond(401, { ok: false, code: 'authentication_required' });
    try {
      const params = parameters(await readBody(request));
      const auth = await authorizeOwner(request, config, fetcher);
      const minute = Math.floor(now() / 60000), saved = requests.get(auth.userId);
      const count = saved?.minute === minute ? saved.count + 1 : 1;
      requests.set(auth.userId, { minute, count });
      if (requests.size > 100) for (const [id, entry] of requests) if (entry.minute !== minute) requests.delete(id);
      if (count > 60) throw new RequestError(429, 'too_many_requests');
      const data = await run({ params, auth, fetcher, now });
      return respond(data.status || 200, data.body);
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 503;
      const code = status === 401 ? 'authentication_required' : status === 403 ? 'owner_required' :
        error instanceof RequestError ? error.code : 'report_unavailable';
      return respond(status, { ok: false, code });
    }
  };
}

export function createSourceHandler(config, dependencies = {}) {
  return setup(config, dependencies, async ({ params, fetcher }) => {
    if (!config.serverKey) throw new RequestError(503, 'report_unavailable');
    const headers = { apikey: config.serverKey, 'Content-Type': 'application/json' };
    if (config.serverKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + config.serverKey;
    const data = await jsonFetch(fetcher, config.projectUrl + '/rest/v1/rpc/sbw_project_get_access_analytics_summary',
      { method: 'POST', headers, body: JSON.stringify(params) });
    if (data?.ok !== true || data?.site !== config.site) throw new RequestError(503, 'report_unavailable');
    return { body: data };
  });
}

export function createGroupHandler(config, dependencies = {}) {
  return setup(config, dependencies, async ({ params: requested, auth, fetcher, now }) => {
    const params = { ...requested };
    // A mesma janela de Brasília é enviada às duas bases, inclusive à meia-noite.
    if (params.p_start_date === null) {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now()));
      const part = type => parts.find(item => item.type === type).value;
      params.p_end_date = part('year') + '-' + part('month') + '-' + part('day');
      params.p_start_date = new Date(Date.parse(params.p_end_date) - (params.p_days - 1) * RANGE_MS).toISOString().slice(0, 10);
    }
    const body = JSON.stringify({ days: params.p_days, start_date: params.p_start_date,
      end_date: params.p_end_date, streamer: params.p_streamer });
    const reports = await Promise.all(config.sites.map(async site => {
      try {
        const url = site.kind === 'local' ? config.authUrl + '/rest/v1/rpc/sbw_admin_get_access_analytics_summary' : site.endpoint;
        const data = await jsonFetch(fetcher, url, { method: 'POST',
          headers: { apikey: site.publicKey, Authorization: auth.header, 'Content-Type': 'application/json',
            ...(site.kind === 'local' ? {} : { Origin: config.bridgeOrigin }) },
          body: site.kind === 'local' ? JSON.stringify(params) : body }, 22000);
        if (data?.ok !== true || data?.site !== site.site) throw new RequestError(503, 'report_unavailable');
        return { site: site.site, label: site.label, origin: site.origin, status: 'ok', data };
      } catch { return { site: site.site, label: site.label, origin: site.origin, status: 'unavailable' }; }
    }));
    const available = reports.filter(report => report.status === 'ok').length;
    return { status: available ? 200 : 503, body: { ok: available > 0, partial: available !== reports.length,
      timezone: 'America/Sao_Paulo', generated_at: new Date(now()).toISOString(), reports } };
  });
}
