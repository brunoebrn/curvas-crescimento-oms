import test from 'node:test';
import assert from 'node:assert/strict';
import { calcular } from '../js/modelo.js';
import { validarReferencia } from '../js/referencias.js';
import { EXEMPLO } from '../js/exemplo.js';
import { t2006, t2007, oms2009, perto } from './_dados.js';
import { kellySintetico, tannerSintetico } from './_sinteticos.js';

const tabelas = { t2006, t2007, oms2009 };
const estadoBase = () => ({
  ...structuredClone(EXEMPLO),
  medidas: EXEMPLO.medidas.map((m, i) => ({ id: `m${i}`, ...m })),
  hoje: '2026-11-16',
  kelly: null,
  tanner: null,
  preferencia: 'kelly',
  kellyTabela: '2a',
  par: null,
  manual: {},
});
const kelly = validarReferencia(kellySintetico()).dados;
const tanner = validarReferencia(tannerSintetico()).dados;

test('sem dados: nada calculado e três critérios não avaliáveis', () => {
  const r = calcular({ ...estadoBase(), sexo: '', nascimento: '', pai: '', mae: '', medidas: [] }, tabelas);
  assert.deepEqual(r.medidas, []);
  assert.deepEqual(r.intervalos, []);
  assert.equal(r.alvo, null);
  assert.deepEqual(Object.values(r.criterios).map((c) => c.status), ['nao-avaliavel', 'nao-avaliavel', 'nao-avaliavel']);
});

test('exemplo fictício: estatura entre −3 e −2 DP; sem referência C2 fica não avaliável', () => {
  const r = calcular(estadoBase(), tabelas);
  assert.equal(r.medidas.length, 5);
  const ultima = r.medidas.at(-1);
  assert.ok(ultima.z < -2 && ultima.z >= -3, `z = ${ultima.z}`);
  assert.equal(ultima.fonte, 'OMS 2007');
  assert.equal(r.intervalos.length, 4);
  assert.equal(r.criterios.C1.status, 'nao-atende');
  assert.equal(r.criterios.C2.status, 'nao-avaliavel');
  assert.match(r.criterios.C2.motivo, /referência/i);
  assert.equal(r.criterios.C3.status, 'nao-atende');
  perto(r.alvo.alvo, 171.5, 1e-9);
});

test('par automático: o que termina na última medida e fica mais perto de 12 meses', () => {
  const r = calcular(estadoBase(), tabelas);
  assert.equal(r.parUsado.origem, 'automatico');
  assert.equal(r.parUsado.a, 'm2');
  assert.equal(r.parUsado.b, 'm4');
  perto(r.parUsado.intervalo.anos, 1, 0.01);
});

test('par automático: sem par de cerca de 12 meses, usa o intervalo mais recente', () => {
  const e = estadoBase();
  e.medidas = e.medidas.slice(3); // só as duas últimas, 6 meses de distância
  const r = calcular(e, tabelas);
  assert.equal(r.parUsado.origem, 'automatico');
  perto(r.parUsado.intervalo.meses, 6, 0.1);
});

test('par automático antes dos 2 anos: intervalo mais recente, não o de 12 meses', () => {
  const e = { ...estadoBase(), sexo: 'F', nascimento: '' };
  e.medidas = [
    { id: 'a', modo: 'idade', anos: 0, meses: 6, cm: 64 },
    { id: 'b', modo: 'idade', anos: 1, meses: 0, cm: 71 },
    { id: 'c', modo: 'idade', anos: 1, meses: 6, cm: 77 },
  ];
  const r = calcular(e, tabelas);
  assert.equal(r.parUsado.a, 'b');
  assert.equal(r.parUsado.avaliacao.chave, 'oms2009');
});

test('exemplo fictício com referência e par de 12 meses: C2 atende', () => {
  const e = { ...estadoBase(), kelly };
  const r = calcular(e, tabelas);
  perto(r.parUsado.intervalo.vc, 3.6 / (364 / 365.25), 1e-6);
  assert.equal(r.parUsado.avaliacao.chave, 'kelly');
  assert.ok(r.parUsado.avaliacao.z < -0.6745);
  assert.equal(r.criterios.C2.status, 'atende');
});

test('par escolhido pelo avaliador prevalece sobre o automático', () => {
  const r = calcular({ ...estadoBase(), kelly, par: { a: 'm3', b: 'm4' } }, tabelas);
  assert.equal(r.parUsado.origem, 'escolhido');
  perto(r.parUsado.intervalo.meses, 6, 0.1);
});

test('classificação manual prevalece', () => {
  const r = calcular({ ...estadoBase(), manual: { C2: 'atende' } }, tabelas);
  assert.equal(r.criterios.C2.status, 'atende');
  assert.equal(r.criterios.C2.origem, 'manual');
});

test('intervalos trazem variação do z de estatura e guia SBP', () => {
  const e = estadoBase();
  e.nascimento = '';
  e.medidas = [
    { id: 'a', modo: 'idade', anos: 2, meses: 6, cm: 88 },
    { id: 'b', modo: 'idade', anos: 3, meses: 6, cm: 94 },
  ];
  const r = calcular({ ...e, tanner }, tabelas);
  const i = r.intervalos[0];
  perto(i.deltaZ, r.medidas[1].z - r.medidas[0].z, 1e-12);
  assert.equal(i.avaliacao.guiaSbp, 7);
  assert.equal(i.avaliacao.chave, 'tanner');
});

test('par escolhido inválido volta ao automático', () => {
  const r = calcular({ ...estadoBase(), par: { a: 'x', b: 'm4' } }, tabelas);
  assert.equal(r.parUsado.origem, 'automatico');
});

test('linhas com erro não entram no cálculo, mas são devolvidas', () => {
  const e = estadoBase();
  e.medidas.push({ id: 'ruim', modo: 'data', data: '2030-01-01', cm: '120' });
  const r = calcular(e, tabelas);
  assert.equal(r.medidas.length, 5);
  assert.match(r.linhas.find((l) => l.id === 'ruim').erros[0], /futura/);
});
