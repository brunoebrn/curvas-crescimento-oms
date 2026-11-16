// Verificação de ponta a ponta no navegador (Playwright). Não é dependência do projeto:
// rode com `node tests/e2e/verificar.mjs` num ambiente que tenha o pacote `playwright` e o Chromium.
// Usa só referências SINTÉTICAS (tests/_sinteticos.js), gravadas em pasta temporária.
//
// Opções: --capturas <pasta> grava PNG da página em 1280 px e 390 px.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { kellySintetico, tannerSintetico } from '../_sinteticos.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORTA = 8765;
const URL_BASE = `http://127.0.0.1:${PORTA}/`;
const iCap = process.argv.indexOf('--capturas');
const pastaCapturas = iCap > 0 ? process.argv[iCap + 1] : null;

const tmp = mkdtempSync(join(tmpdir(), 'curvas-e2e-'));
const arqKelly = join(tmp, 'kelly-sintetico.json');
const arqTanner = join(tmp, 'tanner-sintetico.json');
const arqRuim = join(tmp, 'ruim.json');
writeFileSync(arqKelly, JSON.stringify(kellySintetico()));
writeFileSync(arqTanner, JSON.stringify(tannerSintetico()));
writeFileSync(arqRuim, JSON.stringify({ formato: 'outro' }));

const servidor = spawn('python3', ['-m', 'http.server', String(PORTA), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
const passos = [];
const ok = (nome) => { passos.push(nome); console.log(`ok – ${nome}`); };

async function esperarServidor() {
  for (let i = 0; i < 50; i += 1) {
    try { if ((await fetch(URL_BASE)).ok) return; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('servidor não subiu');
}

const status = (page) => page.$$eval('#criterios .criterio', (els) => Object.fromEntries(els.map((e) => [e.dataset.criterio, `${e.dataset.status}/${e.dataset.origem}`])));
const assentar = (page) => page.waitForTimeout(350);

let navegador;
try {
  await esperarServidor();
  navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'pt-BR' });
  const page = await contexto.newPage();
  const errosConsole = [];
  const externas = [];
  page.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text()); });
  page.on('pageerror', (e) => errosConsole.push(String(e)));
  page.on('request', (rq) => { if (!rq.url().startsWith(URL_BASE) && !rq.url().startsWith('data:') && !rq.url().startsWith('blob:')) externas.push(rq.url()); });

  await page.goto(URL_BASE);
  await page.waitForSelector('html[data-pronto="1"]');

  // 1. sem dados
  assert.deepEqual(await status(page), { C1: 'nao-avaliavel/automatico', C2: 'nao-avaliavel/automatico', C3: 'nao-avaliavel/automatico' });
  assert.match(await page.textContent('#grafEstatura'), /Informe o sexo/);
  ok('sem dados: três critérios não avaliáveis e gráficos em estado vazio');

  // 2. exemplo fictício sem referências
  await page.click('#btnExemplo');
  await assentar(page);
  assert.deepEqual(await status(page), { C1: 'nao-atende/automatico', C2: 'nao-avaliavel/automatico', C3: 'nao-atende/automatico' });
  assert.match(await page.textContent('[data-criterio="C2"]'), /referência/i);
  assert.equal(await page.$$eval('#tabMedidas tbody tr', (t) => t.length), 5);
  assert.equal(await page.$$eval('#tabIntervalos tbody tr:not(.obs)', (t) => t.length), 4);
  assert.match(await page.textContent('#alvo'), /171,5 cm/);
  assert.equal(await page.$$eval('#grafEstatura canvas, #grafVc canvas', (c) => c.length), 2);
  ok('exemplo sem referências: C1 não atende, C2 não avaliável (referência não carregada), C3 não atende');

  // 3. arquivo inválido é recusado
  await page.setInputFiles('#arquivos', arqRuim);
  await assentar(page);
  assert.match(await page.textContent('#msgArquivo'), /não reconhecido/);
  ok('arquivo de referência inválido é recusado com mensagem');

  // 4. referências sintéticas + par de 12 meses
  await page.setInputFiles('#arquivos', [arqKelly, arqTanner]);
  await assentar(page);
  assert.match(await page.textContent('#refs'), /Ativo: kelly-sintetico\.json/);
  assert.match(await page.textContent('#refs'), /Ativo: tanner-sintetico\.json/);
  assert.equal((await status(page)).C2, 'atende/automatico'); // 6 meses, com ressalva
  assert.match(await page.textContent('[data-criterio="C2"]'), /11 a 13 meses/);
  await page.click('#sugestao button');
  await assentar(page);
  assert.deepEqual(await status(page), { C1: 'nao-atende/automatico', C2: 'atende/automatico', C3: 'nao-atende/automatico' });
  assert.doesNotMatch(await page.textContent('[data-criterio="C2"]'), /11 a 13 meses/);
  assert.equal(await page.$$eval('#tabIntervalos tbody tr:not(.obs)', (t) => t.length), 5);
  assert.equal(await page.isHidden('#sugestao'), true);
  ok('com referências e par de 12 meses: C2 atende sem ressalva de intervalo');

  // 5. preferência por Tanner
  await page.check('input[name="preferencia"][value="tanner"]', { force: true });
  await assentar(page);
  assert.match(await page.textContent('[data-criterio="C2"]'), /Tanner/);
  await page.check('input[name="preferencia"][value="kelly"]', { force: true });
  ok('troca de referência preferida reflete no checklist');

  // 6. classificação manual prevalece e fica identificada
  await page.selectOption('#manual-C3', 'atende');
  await assentar(page);
  assert.equal((await status(page)).C3, 'atende/manual');
  assert.match(await page.textContent('[data-criterio="C3"]'), /classificação manual/);
  assert.match(await page.textContent('[data-criterio="C3"]'), /Automático: não atende/);
  await page.selectOption('#manual-C3', '');
  await assentar(page);
  assert.equal((await status(page)).C3, 'nao-atende/automatico');
  ok('classificação manual prevalece, é identificada e pode ser desfeita');

  // 7. validações de entrada
  await page.click('#btnAdicionar');
  const nova = page.locator('#medidas .medida').last();
  await nova.locator('input[type="date"]').fill('2016-01-01');
  await nova.locator('.c-cm input').fill('80');
  await assentar(page);
  assert.match(await nova.textContent(), /anterior ao nascimento/);
  await nova.locator('input[type="date"]').fill('2026-06-08');
  await assentar(page);
  assert.equal(await page.$$eval('#medidas .msg-erro', (e) => e.filter((x) => /duplicada/.test(x.textContent)).length), 2);
  await nova.locator('select').selectOption('idade');
  const nova2 = page.locator('#medidas .medida').last();
  await nova2.locator('input[placeholder="anos"]').fill('9');
  await nova2.locator('input[placeholder="meses"]').fill('6');
  await nova2.locator('.c-cm input').fill('114');
  await assentar(page);
  assert.match(await nova2.textContent(), /Queda de 3,2 cm/);
  await nova2.locator('button').click();
  await assentar(page);
  ok('validações: data anterior ao nascimento, duplicada e queda de estatura');

  if (pastaCapturas) {
    mkdirSync(pastaCapturas, { recursive: true });
    await page.screenshot({ path: join(pastaCapturas, 'desktop-1280.png'), fullPage: true });
    await page.check('input[name="vistaEstatura"][value="tudo"]', { force: true });
    await page.check('input[name="vistaVc"][value="tudo"]', { force: true });
    await assentar(page);
    await page.locator('#hEstatura').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(pastaCapturas, 'desktop-graficos-0a19.png'), fullPage: true });
  }

  // 8. novo paciente mantém referências e zera o resto
  await page.click('#btnLimpar');
  await assentar(page);
  assert.deepEqual(await status(page), { C1: 'nao-avaliavel/automatico', C2: 'nao-avaliavel/automatico', C3: 'nao-avaliavel/automatico' });
  assert.match(await page.textContent('#refs'), /Ativo: kelly-sintetico\.json/);
  ok('novo paciente limpa os dados e mantém as referências carregadas');

  // 9. menor de 2 anos por idade, sem data de nascimento: OMS 2009
  await page.check('input[name="sexo"][value="F"]', { force: true });
  const linhas = page.locator('#medidas .medida');
  for (const [i, anos, meses, cm] of [[0, '0', '6', '64'], [1, '1', '0', '70']]) {
    await linhas.nth(i).locator('select').selectOption('idade');
    await linhas.nth(i).locator('input[placeholder="anos"]').fill(anos);
    await linhas.nth(i).locator('input[placeholder="meses"]').fill(meses);
    await linhas.nth(i).locator('.c-cm input').fill(cm);
  }
  await assentar(page);
  assert.match(await page.textContent('#tabIntervalos'), /OMS 2009 \(incremento de 6 meses, 6–12 meses\)/);
  assert.equal((await status(page)).C1, 'nao-atende/automatico');
  ok('menor de 2 anos, medidas por idade: VC avaliada pela OMS 2009');

  // 10. privacidade e higiene
  const armazenado = await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length, c: document.cookie }));
  assert.deepEqual(armazenado, { l: 0, s: 0, c: '' });
  assert.deepEqual(externas, []);
  assert.deepEqual(errosConsole, []);
  ok('nada em localStorage, sessionStorage ou cookies; nenhuma requisição externa; console sem erros');

  // 11. celular
  const movel = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'pt-BR' });
  const pm = await movel.newPage();
  await pm.goto(URL_BASE);
  await pm.waitForSelector('html[data-pronto="1"]');
  await pm.click('#btnExemplo');
  await assentar(pm);
  const transborda = await pm.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(transborda, false);
  if (pastaCapturas) await pm.screenshot({ path: join(pastaCapturas, 'celular-390.png'), fullPage: true });
  ok('390 px: sem rolagem horizontal da página');

  console.log(`\n${passos.length} verificações passaram.`);
} finally {
  await navegador?.close();
  servidor.kill();
}
