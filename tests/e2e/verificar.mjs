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

  // 2. faixa de 2 a 5,5 anos sem Tanner: critério de VC não avaliável, com motivo
  await page.check('input[name="sexo"][value="M"]', { force: true });
  await page.check('input[name="modo"][value="idade"]', { force: true });
  assert.equal(await page.isHidden('#campoNascimento'), true);
  const porIdade = async (lista) => {
    const linhas = page.locator('#medidas .medida');
    for (const [i, anos, meses, cm] of lista) {
      await linhas.nth(i).locator('input[placeholder="anos"]').fill(anos);
      await linhas.nth(i).locator('input[placeholder="meses"]').fill(meses);
      await linhas.nth(i).locator('.c-cm input').fill(cm);
    }
  };
  await porIdade([[0, '3', '0', '89'], [1, '4', '0', '94']]);
  await assentar(page);
  assert.equal((await status(page)).C2, 'nao-avaliavel/automatico');
  assert.match(await page.textContent('[data-criterio="C2"]'), /Tanner/);
  assert.match(await page.textContent('#tabIntervalos'), /Guia SBP para a idade: cerca de 7 cm\/ano/);
  ok('2 a 5,5 anos sem Tanner: C2 não avaliável com motivo e guia SBP');

  // 3. exemplo fictício: Kelly já vem incluído e o par de 12 meses é escolhido sozinho
  await page.click('#btnExemplo');
  await assentar(page);
  assert.deepEqual(await status(page), { C1: 'nao-atende/automatico', C2: 'atende/automatico', C3: 'nao-atende/automatico' });
  assert.match(await page.textContent('[data-criterio="C2"]'), /Kelly 2014/);
  assert.doesNotMatch(await page.textContent('[data-criterio="C2"]'), /11 a 13 meses/);
  assert.match(await page.textContent('#parResumo'), /3,6 cm\/ano.*12,0 meses/);
  assert.equal(await page.$$eval('#tabMedidas tbody tr', (t) => t.length), 5);
  assert.equal(await page.$$eval('#tabIntervalos tbody tr:not(.obs)', (t) => t.length), 5);
  assert.match(await page.textContent('#alvo'), /171,5 cm/);
  assert.equal(await page.$$eval('#grafEstatura canvas, #grafVc canvas', (c) => c.length), 2);
  assert.match(await page.textContent('#refs'), /Kelly 2014.*Incluída/);
  ok('exemplo: sem carregar nada, C1 não atende, C2 atende (Kelly, par de 12 meses), C3 não atende');

  if (pastaCapturas) {
    mkdirSync(pastaCapturas, { recursive: true });
    await page.screenshot({ path: join(pastaCapturas, 'desktop-1280.png'), fullPage: true });
  }

  // 4. trocar o intervalo manualmente
  await page.click('#ajustes > summary');
  const opcoes = await page.$$eval('#par option', (o) => o.map((x) => [x.value, x.textContent]));
  const seisMeses = opcoes.find(([, t]) => /8 a 6 m → 9 a 0 m/.test(t));
  await page.selectOption('#par', seisMeses[0]);
  await assentar(page);
  assert.match(await page.textContent('[data-criterio="C2"]'), /11 a 13 meses/);
  assert.match(await page.textContent('#parResumo'), /escolhido pelo avaliador/);
  await page.selectOption('#par', '');
  await assentar(page);
  ok('intervalo escolhido pelo avaliador prevalece e gera a ressalva da referência');

  // 5. classificação manual prevalece e fica identificada
  await page.selectOption('#manual-C3', 'atende');
  await assentar(page);
  assert.equal((await status(page)).C3, 'atende/manual');
  assert.match(await page.textContent('[data-criterio="C3"]'), /classificação manual/);
  assert.match(await page.textContent('[data-criterio="C3"]'), /Automático: não atende/);
  await page.selectOption('#manual-C3', '');
  await assentar(page);
  assert.equal((await status(page)).C3, 'nao-atende/automatico');
  ok('classificação manual prevalece, é identificada e pode ser desfeita');

  // 6. opções avançadas: arquivo inválido é recusado; Tanner sintético habilita a escolha de referência
  await page.setInputFiles('#arquivos', arqRuim);
  await assentar(page);
  assert.match(await page.textContent('#msgArquivo'), /não reconhecido/);
  assert.equal(await page.isHidden('#campoPreferencia'), true);
  await page.setInputFiles('#arquivos', [arqTanner]);
  await assentar(page);
  await page.click('#avancado > summary');
  assert.match(await page.textContent('#refs'), /Arquivo carregado: tanner-sintetico\.json/);
  await page.check('input[name="preferencia"][value="tanner"]', { force: true });
  await assentar(page);
  assert.match(await page.textContent('[data-criterio="C2"]'), /Tanner/);
  await page.check('input[name="preferencia"][value="kelly"]', { force: true });
  await page.selectOption('#kellyTabela', 'tardia');
  await assentar(page);
  assert.match(await page.textContent('[data-criterio="C2"]'), /maturação tardia/);
  await page.selectOption('#kellyTabela', '2a');
  await page.setInputFiles('#arquivos', [arqKelly]);
  await assentar(page);
  assert.match(await page.textContent('#refs'), /Arquivo carregado: kelly-sintetico\.json/);
  ok('opções avançadas: arquivo inválido recusado; referência alternativa, preferência e tabela de Kelly funcionam');

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
  await nova.locator('input[type="date"]').fill('2026-10-08');
  await nova.locator('.c-cm input').fill('114');
  await assentar(page);
  assert.match(await nova.textContent(), /Queda de 3,2 cm/);
  await nova.locator('button').click();
  await assentar(page);
  ok('validações: data anterior ao nascimento, duplicada e queda de estatura');

  if (pastaCapturas) {
    await page.check('input[name="vistaEstatura"][value="tudo"]', { force: true });
    await page.check('input[name="vistaVc"][value="tudo"]', { force: true });
    await assentar(page);
    await page.screenshot({ path: join(pastaCapturas, 'desktop-graficos-0a19.png'), fullPage: true });
  }

  // 8. novo paciente limpa os dados
  await page.click('#btnLimpar');
  await assentar(page);
  assert.deepEqual(await status(page), { C1: 'nao-avaliavel/automatico', C2: 'nao-avaliavel/automatico', C3: 'nao-avaliavel/automatico' });
  ok('novo paciente limpa os dados');

  // 9. menor de 2 anos por idade: OMS 2009
  await page.check('input[name="sexo"][value="F"]', { force: true });
  await page.check('input[name="modo"][value="idade"]', { force: true });
  await porIdade([[0, '0', '6', '64'], [1, '1', '0', '70']]);
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
