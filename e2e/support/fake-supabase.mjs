// Proxy mínimo que imita as rotas do Supabase usadas pelo app, para testes locais:
//   /rest/v1/*  -> PostgREST (RLS de verdade)
//   /auth/v1/*  -> respostas simples (o teste cria o JWT por conta própria)
//   /functions/v1/* -> 404 (Edge Functions não rodam aqui)
import http from 'node:http';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const POSTGREST = process.env.POSTGREST_URL ?? 'http://127.0.0.1:3000';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, range, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Expose-Headers': 'content-range, content-type',
};

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
