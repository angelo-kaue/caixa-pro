// Proxy mínimo que imita as rotas do Supabase usadas pelo app, para testes locais:
//   /rest/v1/*  -> PostgREST (RLS de verdade)
//   /auth/v1/*  -> respostas simples (o teste cria o JWT por conta própria)
//   /functions/v1/* -> 404 (Edge Functions não rodam aqui)
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const POSTGREST = process.env.POSTGREST_URL ?? 'http://127.0.0.1:3000';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, range, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Expose-Headers': 'content-range, content-type',
};

const used = new Set();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sessionFor(uid) {
  const secret = process.env.E2E_JWT_SECRET ?? 'segredo-de-teste-com-mais-de-32-caracteres!!';
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub: uid, role: 'authenticated', aud: 'authenticated', email: `${uid}@teste.local`, exp: now + 7200 });
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return { access_token: `${head}.${body}.${sig}`, token_type: 'bearer', expires_in: 7200, refresh_token: 'x', user: { id: uid, aud: 'authenticated', role: 'authenticated', email: `${uid}@teste.local`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
}

function userFromJwt(auth) {
  try {
    const payload = JSON.parse(Buffer.from(String(auth).replace(/^Bearer /, '').split('.')[1], 'base64url').toString());
    return { id: payload.sub, aud: 'authenticated', role: 'authenticated', email: payload.email ?? `${payload.sub}@teste.local`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  } catch {
    return null;
  }
}

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    const url = new URL(req.url ?? '/', 'http://x');

    if (url.pathname.startsWith('/rest/v1/')) {
      const target = new URL(POSTGREST + url.pathname.replace('/rest/v1', '') + url.search);
      const headers = { ...req.headers, host: target.host };
      delete headers.apikey; // PostgREST só olha o JWT
      const upstream = http.request(target, { method: req.method, headers }, (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      });
      upstream.on('error', () => {
        res.writeHead(502, cors);
        res.end('upstream error');
      });
      return req.pipe(upstream);
    }

    // Simula o link de e-mail de uso único: tokens "hash-valido-*" funcionam UMA vez; qualquer outro (ou reuso) expira.
    if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const { token_hash: th } = JSON.parse(raw || '{}');
        const ok = typeof th === 'string' && th.startsWith('hash-valido-') && !used.has(th);
        if (ok) used.add(th);
        const uid = JSON.parse(readFileSync('/tmp/e2e-users.json', 'utf8')).free;
        res.writeHead(ok ? 200 : 403, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ok ? sessionFor(uid) : { code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }));
      });
      return;
    }

    if (url.pathname === '/auth/v1/user') {
      const u = userFromJwt(req.headers.authorization);
      res.writeHead(u ? 200 : 401, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(u ?? { message: 'invalid' }));
    }

    if (url.pathname.startsWith('/auth/v1/')) {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end('{}');
    }

    res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NOT_FOUND' }));
  })
  .listen(PORT, '127.0.0.1', () => console.log(`fake-supabase em http://127.0.0.1:${PORT}`));
