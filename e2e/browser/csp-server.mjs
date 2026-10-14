// Serve o build com os MESMOS cabeçalhos de segurança do netlify.toml, para testar se a CSP bloqueia algo do app.
// Único ajuste: libera o backend local de testes em connect-src.
import { readFileSync, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.env.E2E_DIST ?? 'dist-e2e');
const toml = readFileSync('netlify.toml', 'utf8');
const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)?.[1];
if (!csp) throw new Error('CSP não encontrada no netlify.toml');
const testCsp = csp.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:54321");
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(root, 'index.html'); // SPA
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
    'Content-Security-Policy': testCsp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(readFileSync(file));
}).listen(Number(process.env.CSP_PORT ?? 4174), '127.0.0.1', () => console.log('csp-server pronto'));
