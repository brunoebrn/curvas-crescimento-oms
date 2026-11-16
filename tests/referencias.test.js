import test from 'node:test';
import assert from 'node:assert/strict';
import { validarReferencia } from '../js/referencias.js';
import { kellySintetico, tannerSintetico } from './_sinteticos.js';

test('aceita arquivos válidos de Kelly e de Tanner', () => {
  const k = validarReferencia(kellySintetico());
  assert.equal(k.ok, true);
  assert.equal(k.tipo, 'kelly2014');
  assert.equal(k.dados.tabelas['2a'].M.idade[0], 5.5);
  const t = validarReferencia(tannerSintetico());
  assert.equal(t.ok, true);
  assert.equal(t.tipo, 'tanner1985');
  assert.deepEqual(t.avisos, []);
});

test('recusa formato, versão ou tipo desconhecidos', () => {
  assert.equal(validarReferencia(null).ok, false);
  assert.equal(validarReferencia({ qualquer: 1 }).ok, false);
  assert.match(validarReferencia({ ...kellySintetico(), versaoFormato: 2 }).erros[0], /versão/i);
  assert.match(validarReferencia({ ...kellySintetico(), tipo: 'outro' }).erros[0], /tipo/i);
});

test('Kelly: exige a tabela 2a dos dois sexos e vetores coerentes', () => {
  const semF = kellySintetico();
  delete semF.tabelas['2a'].F;
  assert.equal(validarReferencia(semF).ok, false);

  const curto = kellySintetico();
  curto.tabelas['2a'].M.L.pop();
  assert.match(validarReferencia(curto).erros.join(' '), /tamanho/);

  const desordenado = kellySintetico();
  desordenado.tabelas['2a'].M.idade[3] = 5.5;
  assert.match(validarReferencia(desordenado).erros.join(' '), /crescente/);

  const sNeg = kellySintetico();
  sNeg.tabelas['2b'].F.tardia.S[0] = -0.1;
  assert.match(validarReferencia(sNeg).erros.join(' '), /S/);

  const naoNum = kellySintetico();
  naoNum.tabelas['2a'].F.M[2] = 'x';
  assert.equal(validarReferencia(naoNum).ok, false);
});

test('Kelly: a tabela 2b é opcional e pode faltar algum grupo', () => {
  const k = kellySintetico();
  delete k.tabelas['2b'].F.precoce;
  assert.equal(validarReferencia(k).ok, true);
  delete k.tabelas['2b'];
  assert.equal(validarReferencia(k).ok, true);
});

test('Tanner: exige as 7 curvas em ordem e o bloco de validação', () => {
  const sem = tannerSintetico();
  delete sem.curvas.M.p25;
  assert.match(validarReferencia(sem).erros.join(' '), /p25/);

  const cruzado = tannerSintetico();
  cruzado.curvas.F.p10[4] = 9;
  assert.match(validarReferencia(cruzado).erros.join(' '), /ordem/);

  const semVal = tannerSintetico();
  delete semVal.validacao;
  assert.match(validarReferencia(semVal).erros.join(' '), /validacao/);
});

test('Tanner de baixa confiança é aceito com aviso', () => {
  const t = tannerSintetico();
  t.validacao.baixaConfianca = true;
  t.validacao.erroMaximo = 0.35;
  const r = validarReferencia(t);
  assert.equal(r.ok, true);
  assert.match(r.avisos[0], /baixa confiança/);
});
