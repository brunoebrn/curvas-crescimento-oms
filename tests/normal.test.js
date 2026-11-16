import test from 'node:test';
import assert from 'node:assert/strict';
import { cdf, quantil } from '../js/normal.js';
import { perto } from './_dados.js';

test('cdf da normal padrão em pontos conhecidos', () => {
  perto(cdf(0), 0.5, 1e-9);
  perto(cdf(-1.96), 0.0249979, 1e-6);
  perto(cdf(1.96), 0.9750021, 1e-6);
  perto(cdf(-0.674), 0.250158, 1e-5);
  perto(cdf(-1), 0.1586553, 1e-6);
  perto(cdf(-3), 0.0013499, 1e-6);
  assert.equal(cdf(-40), 0);
  assert.equal(cdf(40), 1);
});

test('quantil da normal padrão em pontos conhecidos', () => {
  perto(quantil(0.5), 0, 1e-9);
  perto(quantil(0.25), -0.6744898, 1e-6);
  perto(quantil(0.03), -1.8807936, 1e-6);
  perto(quantil(0.10), -1.2815516, 1e-6);
  perto(quantil(0.97), 1.8807936, 1e-6);
  perto(quantil(cdf(1.3)), 1.3, 1e-6);
  assert.throws(() => quantil(0));
  assert.throws(() => quantil(1));
});
