import test from 'node:test';
import assert from 'node:assert/strict';
import { validarMedidas } from '../js/validacao.js';
import { criarOms } from '../js/oms.js';
import { t2006, t2007 } from './_dados.js';

const oms = criarOms({ t2006, t2007 });
const base = { sexo: 'M', nascimento: '2015-03-10', hoje: '2026-11-16' };
const porData = (id, data, cm) => ({ id, modo: 'data', data, cm });
const porIdade = (id, anos, meses, cm) => ({ id, modo: 'idade', anos, meses, cm });
const rodar = (medidas, extra = {}) => validarMedidas({ ...base, ...extra, medidas }, oms);
const linha = (r, id) => r.linhas.find((l) => l.id === id);

test('medidas válidas saem ordenadas por idade', () => {
  const r = rodar([porData('b', '2023-03-10', 120), porData('a', '2022-03-10', 114)]);
  assert.deepEqual(r.validas.map((m) => m.id), ['a', 'b']);
  assert.equal(r.validas[0].dias, 2557);
  assert.deepEqual(linha(r, 'a').erros, []);
});

test('data futura, anterior ao nascimento ou inexistente', () => {
  const r = rodar([porData('f', '2027-01-01', 140), porData('p', '2015-03-09', 50), porData('x', '2020-02-30', 100)]);
  assert.match(linha(r, 'f').erros[0], /futura/);
  assert.match(linha(r, 'p').erros[0], /anterior ao nascimento/);
  assert.match(linha(r, 'x').erros[0], /inválida/);
  assert.equal(r.validas.length, 0);
});

test('idade acima de 19 anos é recusada', () => {
  const r = rodar([porIdade('v', 19, 1, 170), porIdade('ok', 19, 0, 170)]);
  assert.match(linha(r, 'v').erros[0], /19 anos/);
  assert.deepEqual(linha(r, 'ok').erros, []);
});

test('medida por data exige data de nascimento; por idade não', () => {
  const r = rodar([porData('d', '2020-01-01', 100), porIdade('i', 4, 10, 100)], { nascimento: '' });
  assert.match(linha(r, 'd').erros[0], /nascimento/);
  assert.deepEqual(linha(r, 'i').erros, []);
});

test('estatura inválida é erro; implausível (|z| > 6) é alerta', () => {
  const r = rodar([porIdade('n', 5, 0, 'abc'), porIdade('z', 6, 0, 0), porIdade('i', 7, 0, 60), porIdade('ok', 8, 0, 120)]);
  assert.match(linha(r, 'n').erros[0], /Estatura/);
  assert.match(linha(r, 'z').erros[0], /Estatura/);
  assert.match(linha(r, 'i').alertas[0], /implausível/);
  assert.deepEqual(linha(r, 'ok').alertas, []);
  assert.equal(r.validas.length, 2); // implausível entra, com alerta
});

test('queda maior que 1 cm entre medidas consecutivas gera alerta', () => {
  const r = rodar([porIdade('a', 8, 0, 125), porIdade('b', 8, 6, 123.9), porIdade('c', 9, 0, 123.2)]);
  assert.match(linha(r, 'b').alertas[0], /Queda/);
  assert.deepEqual(linha(r, 'c').alertas, []); // 0,7 cm
});

test('datas ou idades duplicadas são erro nas duas linhas', () => {
  const r = rodar([porData('a', '2022-03-10', 114), porData('b', '2022-03-10', 115), porIdade('c', 9, 0, 130)]);
  assert.match(linha(r, 'a').erros[0], /duplicada/);
  assert.match(linha(r, 'b').erros[0], /duplicada/);
  assert.equal(r.validas.length, 1);
});

test('linha vazia é ignorada; linha incompleta é erro', () => {
  const r = rodar([{ id: 'v', modo: 'data', data: '', cm: '' }, porData('s', '2022-03-10', ''), { id: 'd', modo: 'data', data: '', cm: 110 }]);
  assert.deepEqual(linha(r, 'v').erros, []);
  assert.equal(linha(r, 'v').vazia, true);
  assert.match(linha(r, 's').erros[0], /Estatura/);
  assert.match(linha(r, 'd').erros[0], /data/i);
});

test('aceita vírgula decimal na estatura', () => {
  const r = rodar([porIdade('a', 8, 0, '125,5')]);
  assert.equal(r.validas[0].cm, 125.5);
});
