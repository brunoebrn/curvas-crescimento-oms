import test from 'node:test';
import assert from 'node:assert/strict';
import { estaturaAlvo } from '../js/alvo.js';
import { criarOms } from '../js/oms.js';
import { t2006, t2007, perto } from './_dados.js';

const oms = criarOms({ t2006, t2007 });

test('estatura-alvo SBP 2023: meninos somam 13, meninas subtraem 13, faixa de 5 cm', () => {
  const m = estaturaAlvo({ sexo: 'M', pai: 175, mae: 162 }, oms);
  assert.equal(m.alvo, 175);
  assert.equal(m.min, 170);
  assert.equal(m.max, 180);
  const f = estaturaAlvo({ sexo: 'F', pai: 175, mae: 162 }, oms);
  assert.equal(f.alvo, 162);
  assert.equal(f.min, 157);
  assert.equal(f.max, 167);
});

test('z da estatura-alvo aos 19 anos (OMS 2007, 228 meses)', () => {
  const f = estaturaAlvo({ sexo: 'F', pai: 175, mae: 162 }, oms);
  perto(f.zAlvo, (162 - 163.1548) / (163.1548 * 0.04009), 1e-3);
  assert.ok(f.zMin < f.zAlvo && f.zAlvo < f.zMax);
});

test('sem altura de um dos pais não há estatura-alvo', () => {
  assert.equal(estaturaAlvo({ sexo: 'M', pai: null, mae: 162 }, oms), null);
  assert.equal(estaturaAlvo({ sexo: 'M', pai: 175, mae: NaN }, oms), null);
});
