import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseData, diasEntre, idadeDecimal, mesesDeDias, diasDeAnosMeses, formatarIdade,
} from '../js/idade.js';

test('dias entre datas, em UTC, com ano bissexto', () => {
  assert.equal(diasEntre('2020-01-01', '2021-01-01'), 366);
  assert.equal(diasEntre('2021-01-01', '2022-01-01'), 365);
  assert.equal(diasEntre('2024-03-10', '2024-03-10'), 0);
  assert.equal(diasEntre('2024-03-10', '2024-03-09'), -1);
});

test('datas inválidas lançam erro', () => {
  assert.throws(() => parseData('2024-02-30'));
  assert.throws(() => parseData('30/02/2024'));
  assert.throws(() => parseData(''));
});

test('conversões de idade', () => {
  assert.equal(idadeDecimal(3652.5), 10);
  assert.equal(mesesDeDias(1826.25), 60);
  assert.equal(diasDeAnosMeses(2, 6), 913);
  assert.equal(diasDeAnosMeses(0, 0), 0);
  assert.equal(diasDeAnosMeses(19, 0), 6940);
});

test('idade por extenso', () => {
  assert.equal(formatarIdade(913), '2 a 6 m');
  assert.equal(formatarIdade(45), '0 a 1 m');
  assert.equal(formatarIdade(3653), '10 a 0 m');
});
