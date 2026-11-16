import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarCriterios } from '../js/criterios.js';

const vcOk = (z, extra = {}) => ({ naoAvaliavel: false, z, chave: 'kelly', referencia: 'Kelly 2014', anos: 1, ressalvas: [], ...extra });
const st = (r) => [r.C1.status, r.C2.status, r.C3.status];

test('C1: estatura abaixo de −3 DP', () => {
  const r = avaliarCriterios({ zEstatura: -3.2, vc: null, idadeAnos: 8 });
  assert.deepEqual(st(r), ['atende', 'nao-atende', 'nao-atende']);
  assert.equal(r.C1.origem, 'automatico');
});

test('limites exatos de estatura: −3 pertence a C2 e −2 pertence a C3', () => {
  assert.deepEqual(st(avaliarCriterios({ zEstatura: -3, vc: vcOk(-0.8), idadeAnos: 8 })), ['nao-atende', 'atende', 'nao-atende']);
  assert.deepEqual(st(avaliarCriterios({ zEstatura: -2, vc: vcOk(-1.2), idadeAnos: 8 })), ['nao-atende', 'nao-atende', 'atende']);
});

test('C2: VC abaixo do P25', () => {
  assert.equal(avaliarCriterios({ zEstatura: -2.5, vc: vcOk(-0.8), idadeAnos: 8 }).C2.status, 'atende');
  assert.equal(avaliarCriterios({ zEstatura: -2.5, vc: vcOk(-0.5), idadeAnos: 8 }).C2.status, 'nao-atende');
  assert.equal(avaliarCriterios({ zEstatura: -2.5, vc: vcOk(-0.674), idadeAnos: 8 }).C2.status, 'nao-atende');
  // C2 não exige janela de 12 meses
  assert.equal(avaliarCriterios({ zEstatura: -2.5, vc: vcOk(-0.8, { anos: 0.6 }), idadeAnos: 8 }).C2.status, 'atende');
});

test('C2 e C3 não avaliáveis sem VC ou sem referência, com motivo', () => {
  const semVc = avaliarCriterios({ zEstatura: -2.5, vc: null, idadeAnos: 8 });
  assert.equal(semVc.C2.status, 'nao-avaliavel');
  assert.match(semVc.C2.motivo, /duas medidas/);
  const semRef = avaliarCriterios({ zEstatura: -1, vc: { naoAvaliavel: true, motivo: 'Tanner não carregado', anos: 1 }, idadeAnos: 3 });
  assert.equal(semRef.C3.status, 'nao-avaliavel');
  assert.match(semRef.C3.motivo, /Tanner/);
});

test('C3: VC abaixo de −1 DP em cerca de 12 meses', () => {
  assert.equal(avaliarCriterios({ zEstatura: -1, vc: vcOk(-1.2), idadeAnos: 8 }).C3.status, 'atende');
  assert.equal(avaliarCriterios({ zEstatura: -1, vc: vcOk(-0.9), idadeAnos: 8 }).C3.status, 'nao-atende');
  assert.equal(avaliarCriterios({ zEstatura: -1, vc: vcOk(-1), idadeAnos: 8 }).C3.status, 'nao-atende');
  const curto = avaliarCriterios({ zEstatura: -1, vc: vcOk(-1.2, { anos: 0.5 }), idadeAnos: 8 });
  assert.equal(curto.C3.status, 'nao-avaliavel');
  assert.match(curto.C3.motivo, /12 meses/);
});

test('C3 abaixo de 2 anos: avaliado pela OMS 2009 com ressalva', () => {
  const r = avaliarCriterios({ zEstatura: -1, vc: vcOk(-1.5, { chave: 'oms2009', anos: 0.5, referencia: 'OMS 2009' }), idadeAnos: 1.5 });
  assert.equal(r.C3.status, 'atende');
  assert.ok(r.C3.ressalvas.some((t) => t.includes('12 meses')));
});

test('z limitado de Tanner no extremo inferior basta para C2 e C3', () => {
  const lim = vcOk(-1.8807936, { chave: 'tanner', limitado: true });
  assert.equal(avaliarCriterios({ zEstatura: -2.5, vc: lim, idadeAnos: 4 }).C2.status, 'atende');
  assert.equal(avaliarCriterios({ zEstatura: -1, vc: lim, idadeAnos: 4 }).C3.status, 'atende');
});

test('sem medida de estatura: três critérios não avaliáveis', () => {
  assert.deepEqual(st(avaliarCriterios({ zEstatura: null, vc: null, idadeAnos: null })), ['nao-avaliavel', 'nao-avaliavel', 'nao-avaliavel']);
});

test('classificação manual prevalece e fica identificada', () => {
  const r = avaliarCriterios({ zEstatura: -2.5, vc: null, idadeAnos: 8 }, { C2: 'atende', C1: '' });
  assert.equal(r.C2.status, 'atende');
  assert.equal(r.C2.origem, 'manual');
  assert.equal(r.C2.automatico.status, 'nao-avaliavel');
  assert.equal(r.C1.origem, 'automatico');
  const n = avaliarCriterios({ zEstatura: -3.5, vc: null, idadeAnos: 8 }, { C1: 'nao-atende' });
  assert.equal(n.C1.status, 'nao-atende');
  assert.equal(n.C1.automatico.status, 'atende');
});
