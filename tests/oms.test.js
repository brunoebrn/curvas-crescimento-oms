import test from 'node:test';
import assert from 'node:assert/strict';
import { criarOms } from '../js/oms.js';
import { t2006, t2007, perto } from './_dados.js';

const oms = criarOms({ t2006, t2007 });

test('OMS 2006: valores da tabela oficial por dia', () => {
  const n = oms.lms('M', 0);
  assert.equal(n.M, 49.8842);
  assert.equal(n.S, 0.03795);
  assert.equal(n.fonte, 'OMS 2006');
  perto(oms.z('M', 0, 49.8842), 0, 1e-12);
  perto(oms.z('M', 0, 49.8842 * (1 - 2 * 0.03795)), -2, 1e-9);
  assert.equal(oms.lms('M', 1826).M, 109.9593);
  assert.equal(oms.lms('M', 1826).S, 0.04214);
  assert.equal(oms.lms('F', 730).M, 86.4008); // deitado
  assert.equal(oms.lms('F', 731).M, 85.7299); // em pé (quebra embutida na tabela)
});

test('OMS 2007: valores da tabela oficial por mês e interpolação', () => {
  const m228 = oms.lms('F', Math.floor(228 * 30.4375));
  assert.equal(m228.fonte, 'OMS 2007');
  perto(m228.M, 163.1548, 1e-3);
  perto(m228.S, 0.04009, 1e-6);
  const meio = oms.lms('M', 60.5 * 30.4375);
  perto(meio.M, (109.7265 + 110.2647) / 2, 1e-9);
  perto(meio.S, (0.04156 + 0.04164) / 2, 1e-12);
  const d1857 = oms.lms('M', 1857);
  assert.equal(d1857.fonte, 'OMS 2007');
  assert.ok(d1857.M > 110.2647 && d1857.M < 110.9);
});

test('transição: 1827 dias já usa a tabela 2007', () => {
  assert.equal(oms.lms('M', 1826).fonte, 'OMS 2006');
  assert.equal(oms.lms('M', 1827).fonte, 'OMS 2007');
});

test('limites de idade', () => {
  assert.equal(oms.lms('M', -1), null);
  assert.equal(oms.lms('M', 6941), null);
  assert.ok(oms.lms('M', 6940));
  assert.equal(oms.z('F', 7000, 160), null);
  assert.throws(() => oms.lms('X', 10));
});

test('z, percentil e estatura no z (L = 1)', () => {
  // menino aos 19 anos: -3 DP = M(1 - 3S), como nas tabelas de z da OMS
  const { M, S } = oms.lms('M', 6939);
  perto(oms.z('M', 6939, M * (1 - 3 * S)), -3, 1e-9);
  perto(oms.estaturaNoZ('M', 6939, -3), M * (1 - 3 * S), 1e-9);
  perto(oms.percentil(0), 50, 1e-9);
  perto(oms.percentil(-2), 2.275, 1e-3);
});
