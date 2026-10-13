// Testes de navegador: abre o app de verdade (Chromium headless) contra Postgres + PostgREST reais.
// Verifica: erros de console, rolagem horizontal, acessibilidade (axe) e fluxos principais; salva capturas de tela.
import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire((process.env.E2E_BROWSER_DIR ?? '/tmp/browser') + '/');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:4173';
const SECRET = process.env.E2E_JWT_SECRET ?? 'segredo-de-teste-com-mais-de-32-caracteres!!';
const OUT = process.env.E2E_SHOTS ?? '/tmp/shots';
mkdirSync(OUT, { recursive: true });
const users = JSON.parse(readFileSync('/tmp/e2e-users.json', 'utf8'));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function session(uid) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub: uid, role: 'authenticated', aud: 'authenticated', email: `${uid}@teste.local`, exp: now + 7200 });
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return {
    access_token: `${head}.${body}.${sig}`, token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'x',
    user: { id: uid, aud: 'authenticated', role: 'authenticated', email: `${uid}@teste.local`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
}

const VIEWPORTS = { mobile: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, desktop: { width: 1280, height: 800 } };
const findings = [];
const note = (level, where, msg) => findings.push({ level, where, msg });

const executablePath = await chromium.executablePath();
const launchArgs = [...chromium.args, '--no-sandbox', '--disable-gpu'];

async function open(viewport, userId) {
  // Um navegador por página: o Chromium empacotado não aguenta abrir outra aba depois de fechar a primeira.
  const browser = await puppeteer.launch({ args: launchArgs, executablePath, headless: 'shell' });
  const page = await browser.newPage();
  page.__browser = browser;
  await page.setViewport(VIEWPORTS[viewport]);
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource.*(fonts|ERR_)/i.test(m.text())) page.__errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('127.0.0.1:54321')) page.__errors.push(`http ${r.status()} ${r.request().method()} ${r.url().replace(/^.*54321/, '').slice(0, 90)}`); });
  await page.setRequestInterception(true);
  page.on('request', (req) => (/fonts\.(googleapis|gstatic)\.com/.test(req.url()) ? req.abort() : req.continue()));
  if (userId) {
    await page.evaluateOnNewDocument((s) => localStorage.setItem('sb-127-auth-token', JSON.stringify(s)), session(userId));
  }
  return page;
}

async function audit(page, name, { expectText, allowHttp = [] } = {}) {
  await new Promise((r) => setTimeout(r, 700));
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (overflow.sw > overflow.iw + 1) note('FALHA', name, `rolagem horizontal: conteúdo ${overflow.sw}px > tela ${overflow.iw}px`);
  if (expectText) {
    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    for (const t of [].concat(expectText)) if (!body.includes(t.toLowerCase())) note('FALHA', name, `texto esperado ausente: "${t}"`);
  }
  await page.evaluate(axeSource);
  const axe = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0]?.target?.join(' ').slice(0, 80) })));
  for (const v of axe) if (v.impact === 'serious' || v.impact === 'critical') note('A11Y', name, `${v.id} (${v.impact}) x${v.n} ex: ${v.ex}`);
  for (const e of page.__errors) if (!allowHttp.some((a) => e.includes(a))) note('ERRO', name, e);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

async function visit(name, viewport, userId, path, opts) {
  const page = await open(viewport, userId);
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 });
    await audit(page, name, opts);
  } catch (e) {
    note('FALHA', name, `exceção: ${e.message}`);
  } finally {
    await page.__browser.close();
  }
}

// ---------- páginas públicas ----------
for (const vp of ['mobile', 'desktop']) {
  await visit(`landing-${vp}`, vp, null, '/', { expectText: ['Controle seu dinheiro', 'Planos', 'R$ 19,90'] });
  await visit(`cadastro-${vp}`, vp, null, '/cadastro', { expectText: 'Criar conta' });
  await visit(`entrar-${vp}`, vp, null, '/entrar', { expectText: 'Entrar' });
}
await visit('esqueci-senha-mobile', 'mobile', null, '/esqueci-senha', { expectText: 'Recuperar senha' });
await visit('termos-mobile', 'mobile', null, '/termos', { expectText: 'Termos de uso' });
await visit('404-mobile', 'mobile', null, '/nada-aqui', { expectText: 'Página não encontrada' });

// ---------- área logada: usuário Free ----------
for (const vp of ['mobile', 'desktop']) {
  await visit(`app-resumo-${vp}`, vp, users.free, '/app', { expectText: ['Resumo', 'Saldo registrado', 'Receitas', 'Últimos lançamentos'] });
  await visit(`app-lancamentos-${vp}`, vp, users.free, '/app/lancamentos', { expectText: ['Lançamentos', 'Mercado', 'Uber'] });
  await visit(`app-planejamento-${vp}`, vp, users.free, '/app/planejamento', { expectText: ['Planejamento', 'Alimentação'] });
  await visit(`app-plano-${vp}`, vp, users.free, '/app/plano', { expectText: ['Plano e cobrança', 'Free', 'Assinar no cartão'] });
  await visit(`app-relatorios-free-${vp}`, vp, users.free, '/app/relatorios', { expectText: 'fazem parte do plano Pro' });
}
await visit('app-plano-retorno-pix', 'mobile', users.free, '/app/plano?payment_id=123456&status=approved', { expectText: 'Estamos confirmando seu pagamento', allowHttp: ['404', '502'] });
await visit('app-onboarding-mobile', 'mobile', users.empty, '/app', { expectText: 'Como você pretende usar o CaixaPro?' });

// ---------- área logada: negócio Pro ----------
for (const vp of ['mobile', 'desktop']) {
  await visit(`pro-resumo-${vp}`, vp, users.pro, '/app', { expectText: ['Fluxo de caixa', 'Saldo projetado', 'Saldo disponível registrado'] });
  await visit(`pro-contas-${vp}`, vp, users.pro, '/app/contas', { expectText: ['Contas a pagar e a receber', 'Fornecedor ABC', 'Atrasada'] });
  await visit(`pro-relatorios-${vp}`, vp, users.pro, '/app/relatorios', { expectText: ['Comparação com o mês anterior', 'Últimos 6 meses', 'Exportar'] });
  await visit(`pro-plano-${vp}`, vp, users.pro, '/app/plano', { expectText: ['Plano atual', 'liberado manualmente'] });
}

// ---------- fluxos ----------
{
  const page = await open('mobile', users.free);
  try {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle0' });
    await page.type('#quick-entry', '27,50 Padaria hoje');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.body.innerText.includes('Registrado: Padaria'), { timeout: 10000 });
    await page.goto(BASE + '/app/lancamentos', { waitUntil: 'networkidle0' });
    const has = await page.evaluate(() => document.body.innerText.includes('Padaria'));
    if (!has) note('FALHA', 'fluxo-registro-direto', 'lançamento não apareceu no histórico');
    await page.screenshot({ path: `${OUT}/fluxo-registro-direto.png` });

    await page.goto(BASE + '/app', { waitUntil: 'networkidle0' });
    await page.type('#quick-entry', '32,90 iFood');
    await page.keyboard.press('Enter');
    await page.waitForSelector('dialog[open]', { timeout: 8000 });
    const dlg = await page.evaluate(() => document.querySelector('dialog[open]')?.innerText ?? '');
    if (!dlg.includes('Confira antes de salvar')) note('FALHA', 'fluxo-confirmacao', 'modal sem os motivos da confirmação');
    await page.screenshot({ path: `${OUT}/fluxo-confirmacao.png` });
    await page.keyboard.press('Escape');
    await page.click('#quick-entry', { clickCount: 3 });
    await page.keyboard.press('Backspace');

    // texto sem categoria conhecida sugerida: pede confirmação e salva depois de escolher
    await page.type('#quick-entry', 'Xpto 30');
    await page.keyboard.press('Enter');
    await page.waitForSelector('dialog[open]', { timeout: 8000 });
    await page.click('dialog[open] button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Registrado: Xpto'), { timeout: 10000 });
  } catch (e) {
    note('FALHA', 'fluxos-registro', e.message);
  } finally {
    note('INFO', 'fluxos-registro', `erros coletados: ${page.__errors.join(' | ') || 'nenhum'}`);
    await page.__browser.close();
  }
}
{
  // celular: filtros recolhidos por padrão e acessíveis pelo botão
  const page = await open('mobile', users.free);
  try {
    await page.goto(BASE + '/app/lancamentos', { waitUntil: 'networkidle0' });
    const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('filtros-extras')).display === 'none');
    if (!hidden) note('FALHA', 'fluxo-filtros-mobile', 'filtros deveriam começar recolhidos no celular');
    await page.click('button[aria-controls="filtros-extras"]');
    const shown = await page.evaluate(() => getComputedStyle(document.getElementById('filtros-extras')).display !== 'none');
    if (!shown) note('FALHA', 'fluxo-filtros-mobile', 'botão Filtros não abriu os filtros');
    await page.screenshot({ path: `${OUT}/fluxo-filtros-mobile.png` });
  } catch (e) {
    note('FALHA', 'fluxo-filtros-mobile', e.message);
  } finally {
    await page.__browser.close();
  }
}
{
  const page = await open('desktop', users.free);
  try {
    await page.goto(BASE + '/app/lancamentos', { waitUntil: 'networkidle0' });
    await page.type('#quick-entry', '');
    const rowsBefore = await page.$$eval('table tbody tr', (r) => r.length);
    // busca
    const search = await page.$('input[placeholder="Ex.: Uber"]');
    await search.type('Uber');
    await new Promise((r) => setTimeout(r, 900));
    const rowsAfter = await page.$$eval('table tbody tr', (r) => r.length);
    if (!(rowsAfter > 0 && rowsAfter < rowsBefore)) note('FALHA', 'fluxo-busca', `busca por "Uber": ${rowsBefore} -> ${rowsAfter} linhas`);
    // edição
    await page.click('button[aria-label^="Editar Uber"]');
    await page.waitForSelector('dialog[open]');
    await page.screenshot({ path: `${OUT}/fluxo-edicao.png` });
    await page.keyboard.press('Escape');
    // exclusão
    await page.click('button[aria-label^="Excluir Uber"]');
    await page.waitForSelector('dialog[open]');
    await page.keyboard.press('Escape');

    // orçamentos: criar um novo e ver a barra
    await page.goto(BASE + '/app/planejamento', { waitUntil: 'networkidle0' });
    const txt = await page.evaluate(() => document.body.innerText);
    if (!txt.includes('Alimentação')) note('FALHA', 'fluxo-orcamento', 'orçamento semeado não apareceu');
    await page.screenshot({ path: `${OUT}/fluxo-orcamento.png` });
    await page.click('button[role="tab"]:nth-of-type(2)');
    await new Promise((r) => setTimeout(r, 500));
    const goals = await page.evaluate(() => document.body.innerText);
    if (!goals.includes('plano Pro')) note('FALHA', 'fluxo-metas-free', 'aviso do plano Pro não apareceu');
  } catch (e) {
    note('FALHA', 'fluxos-historico', e.message);
  } finally {
    await page.__browser.close();
  }
}

const order = { FALHA: 0, ERRO: 1, A11Y: 2, INFO: 3 };
findings.sort((a, b) => order[a.level] - order[b.level]);
console.log(`\n=== ${findings.filter((f) => f.level !== 'INFO').length} achados ===`);
for (const f of findings) console.log(`[${f.level}] ${f.where}: ${f.msg}`);
