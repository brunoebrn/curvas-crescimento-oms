import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularVc, zOms2009, zKelly, zTanner, guiaSbp, avaliarVc, valorNoZ,
} from '../js/vc.js';
import { oms2009, perto } from './_dados.js';

// ---------- cálculo da VC ----------

test('VC em cm/ano entre duas medidas, no ponto médio', () => {
  const v = calcularVc({ dias: 1000, cm: 90 }, { dias: 1365, cm: 96 });
  assert.equal(v.dias, 365);
  perto(v.vc, 6 / (365 / 365.25), 1e-12);
  assert.equal(v.idadeMedioDias, 1182.5);
  perto(v.meses, 365 / 30.4375, 1e-12);
  assert.deepEqual(v.alertas, []);
});

test('alertas de intervalo curto e de VC negativa', () => {
  assert.deepEqual(calcularVc({ dias: 1000, cm: 90 }, { dias: 1100, cm: 91 }).alertas, ['intervalo-curto']);
  assert.deepEqual(calcularVc({ dias: 1000, cm: 90 }, { dias: 1400, cm: 89 }).alertas, ['vc-negativa']);
  assert.equal(calcularVc({ dias: 1000, cm: 90 }, { dias: 1000, cm: 91 }), null);
});

// ---------- OMS 2009 ----------

test('OMS 2009: z confere com as tabelas oficiais de z-score', () => {
  // meninos, 0-2 meses: mediana 8,5; -1 DP 7,3; -3 DP 5,1 (tabela arredondada a 0,1)
  perto(zOms2009(oms2009, 'M', 0, 61, 8.482).z, 0, 1e-9);
  perto(zOms2009(oms2009, 'M', 0, 61, 7.3).z, -1, 0.06);
  perto(zOms2009(oms2009, 'M', 0, 61, 5.1).z, -3, 0.05);
  perto(zOms2009(oms2009, 'M', 0, 61, 11.9).z, 3, 0.05);
  // meninas, 18-24 meses: mediana 5,6; -2 DP 3,7
  const r = zOms2009(oms2009, 'F', 548, 731, 5.6454);
  perto(r.z, 0, 1e-9);
  assert.equal(r.nominalMeses, 6);
  assert.equal(r.intervaloTabela, '18–24 meses');
  assert.equal(r.rateado, false);
  perto(zOms2009(oms2009, 'F', 548, 731, 3.7).z, -2, 0.06);
});

test('OMS 2009: rateio quando o intervalo sai da tolerância (documento de métodos, p. 233)', () => {
  // início aos 11 meses, 84 dias de intervalo: nominal mais próximo é 3 meses (91 dias);
  // desvio de 7,3 dias excede a tolerância de 7 dias, então o incremento é rateado.
  const r = zOms2009(oms2009, 'M', 335, 419, 3.0);
  assert.equal(r.nominalMeses, 3);
  assert.equal(r.rateado, true);
  perto(r.incrementoUsado, 3.0 * (3 * 30.4375) / 84, 1e-9);
  assert.equal(r.intervaloTabela, '11–14 meses');
  assert.ok(r.ressalvas.some((t) => t.includes('rateado')));
  // 60 dias a partir dos 11 meses: dentro da tolerância, sem rateio
  const s = zOms2009(oms2009, 'M', 335, 395, 2.0);
  assert.equal(s.nominalMeses, 2);
  assert.equal(s.rateado, false);
  assert.equal(s.incrementoUsado, 2.0);
});

test('OMS 2009: casos não avaliáveis', () => {
  assert.equal(zOms2009(oms2009, 'M', 100, 100 + 274, 8).naoAvaliavel, true); // 9 meses
  assert.equal(zOms2009(oms2009, 'M', 100, 120, 1).naoAvaliavel, true); // menos de 1 mês
  assert.equal(zOms2009(oms2009, 'M', 650, 650 + 183, 5).naoAvaliavel, true); // termina após 24 meses
});

test('OMS 2009: incremento nulo dá z finito no limite inferior', () => {
  const r = zOms2009(oms2009, 'M', 670, 731, 0);
  perto(r.z, -1 / (0.9497 * 0.48129), 1e-6);
  assert.ok(r.ressalvas.some((t) => t.includes('limite inferior')));
});

// ---------- Kelly (tabelas sintéticas; os dados reais não ficam no repositório) ----------

const kellySint = { idade: [6, 7, 8], L: [1, 1, 0.5], S: [0.2, 0.2, 0.3], M: [5, 5, 6] };

test('Kelly: z pelo LMS com interpolação linear de L, M e S', () => {
  perto(zKelly(kellySint, 6, 5).z, 0, 1e-12);
  perto(zKelly(kellySint, 6, 4).z, -1, 1e-12);
  perto(zKelly(kellySint, 6.5, 4).z, -1, 1e-12);
  perto(zKelly(kellySint, 8, 4).z, (Math.sqrt(4 / 6) - 1) / (0.5 * 0.3), 1e-12);
  // meio caminho entre 7 e 8: L 0,75, S 0,25, M 5,5
  perto(zKelly(kellySint, 7.5, 5).z, ((5 / 5.5) ** 0.75 - 1) / (0.75 * 0.25), 1e-12);
  perto(zKelly(kellySint, 6, 5).percentil, 50, 1e-9);
  assert.equal(zKelly(kellySint, 5.9, 5), null);
  assert.equal(zKelly(kellySint, 8.1, 5), null);
});

test('Kelly: mediana zero (fim de tabela) não tem z', () => {
  assert.equal(zKelly({ idade: [16, 17], L: [0.5, 0.5], S: [0.9, 0.9], M: [0, 0] }, 16.5, 1), null);
});

test('valorNoZ inverte o LMS', () => {
  perto(valorNoZ({ L: 0.5, M: 6, S: 0.3 }, (Math.sqrt(4 / 6) - 1) / 0.15), 4, 1e-12);
  perto(valorNoZ({ L: 1, M: 5, S: 0.2 }, -1), 4, 1e-12);
});

// ---------- Tanner (curvas sintéticas) ----------

const Z = { p3: -1.8807936, p10: -1.2815516, p25: -0.6744898, p50: 0, p75: 0.6744898, p90: 1.2815516, p97: 1.8807936 };
function tannerSint() {
  const idade = [2, 3, 4];
  const c = { idade };
  for (const [k, z] of Object.entries(Z)) c[k] = idade.map((a) => (8 - a) + z); // P50 = 6, 5, 4; 1 cm por z
  return c;
}

test('Tanner: z por interpolação entre as curvas', () => {
  const c = tannerSint();
  perto(zTanner(c, 3, 5).z, 0, 1e-6);
  perto(zTanner(c, 3, 5 - 0.6744898).z, -0.6744898, 1e-6);
  perto(zTanner(c, 3, 5 - 1).z, -1, 1e-6); // entre P10 e P25
  perto(zTanner(c, 2.5, 5.5 + 0.3).z, 0.3, 1e-6); // idade interpolada
  perto(zTanner(c, 3, 5 - 1).percentil, 15.87, 0.01);
});

test('Tanner: fora de P3–P97 o z é limitado e sinalizado', () => {
  const c = tannerSint();
  const r = zTanner(c, 3, 1);
  perto(r.z, -1.8807936, 1e-6);
  assert.equal(r.limitado, true);
  assert.equal(zTanner(c, 3, 9).limitado, true);
  assert.equal(zTanner(c, 3, 5).limitado, false);
  assert.equal(zTanner(c, 1.9, 5), null);
  assert.equal(zTanner(c, 4.1, 5), null);
});

// ---------- guia SBP ----------

test('guia SBP: 7 cm/ano de 2 a 4 anos e 6 cm/ano de 4 a 6 anos', () => {
  assert.equal(guiaSbp(1.9), null);
  assert.equal(guiaSbp(2), 7);
  assert.equal(guiaSbp(3.99), 7);
  assert.equal(guiaSbp(4), 6);
  assert.equal(guiaSbp(5.99), 6);
  assert.equal(guiaSbp(6), null);
});

// ---------- escolha da referência ----------

function intervalo(idadeInicioAnos, duracaoAnos, deltaCm) {
  const ini = Math.round(idadeInicioAnos * 365.25);
  return calcularVc({ dias: ini, cm: 100 }, { dias: ini + Math.round(duracaoAnos * 365.25), cm: 100 + deltaCm });
}
const kelly = {
  tabelas: {
    '2a': { M: { idade: [5.5, 17.5], L: [1, 1], S: [0.2, 0.2], M: [5, 5] }, F: { idade: [5.5, 17.5], L: [1, 1], S: [0.2, 0.2], M: [5, 5] } },
    '2b': { M: { precoce: { idade: [6.5, 16], L: [1, 1], S: [0.1, 0.1], M: [5, 5] } }, F: {} },
  },
};
function tannerLargo() {
  const idade = [2, 19];
  const c = { idade };
  for (const [k, z] of Object.entries(Z)) c[k] = idade.map(() => 5 + z);
  return { curvas: { M: c, F: c }, validacao: { baixaConfianca: false } };
}
const base = { sexo: 'M', oms2009, kelly: null, tanner: null, preferencia: 'kelly', kellyTabela: '2a' };

test('avaliarVc: menos de 24 meses usa a OMS 2009', () => {
  const r = avaliarVc(calcularVc({ dias: 183, cm: 67 }, { dias: 366, cm: 75 }), base);
  assert.equal(r.chave, 'oms2009');
  assert.equal(r.naoAvaliavel, false);
  assert.ok(Number.isFinite(r.z));
});

test('avaliarVc: 2 a 5,5 anos depende de Tanner', () => {
  const i = intervalo(2.5, 1, 7);
  const sem = avaliarVc(i, base);
  assert.equal(sem.naoAvaliavel, true);
  assert.match(sem.motivo, /Tanner/);
  assert.equal(sem.guiaSbp, 7);
  const com = avaliarVc(i, { ...base, tanner: tannerLargo() });
  assert.equal(com.chave, 'tanner');
  assert.ok(com.ressalvas.some((t) => t.includes('aproximado')));
  // Kelly carregado não cobre esta idade
  assert.equal(avaliarVc(i, { ...base, kelly }).naoAvaliavel, true);
});

test('avaliarVc: a partir de 5,5 anos usa Kelly, com alerta fora de 11 a 13 meses', () => {
  const ok = avaliarVc(intervalo(7.5, 1, 4), { ...base, kelly });
  assert.equal(ok.chave, 'kelly');
  perto(ok.z, (4 / (365 / 365.25) / 5 - 1) / 0.2, 1e-9);
  assert.deepEqual(ok.ressalvas, []);
  const curto = avaliarVc(intervalo(7.5, 8 / 12, 3), { ...base, kelly });
  assert.ok(curto.ressalvas.some((t) => t.includes('11 a 13 meses')));
});

test('avaliarVc: preferência por Tanner e tabela 2b de Kelly', () => {
  const i = intervalo(7.5, 1, 4);
  assert.equal(avaliarVc(i, { ...base, kelly, tanner: tannerLargo(), preferencia: 'tanner' }).chave, 'tanner');
  assert.equal(avaliarVc(i, { ...base, kelly, tanner: tannerLargo() }).chave, 'kelly');
  const b = avaliarVc(i, { ...base, kelly, kellyTabela: 'precoce' });
  perto(b.z, (4 / (365 / 365.25) / 5 - 1) / 0.1, 1e-9);
  assert.match(b.referencia, /precoce/);
  // tabela 2b escolhida mas ausente para o sexo: não avaliável
  assert.equal(avaliarVc(i, { ...base, sexo: 'F', kelly, kellyTabela: 'precoce' }).naoAvaliavel, true);
});

test('avaliarVc: Tanner fora de 0,85 a 1,15 ano e baixa confiança geram ressalvas', () => {
  const t = tannerLargo();
  t.validacao.baixaConfianca = true;
  const r = avaliarVc(intervalo(8, 0.5, 2), { ...base, tanner: t });
  assert.ok(r.ressalvas.some((x) => x.includes('0,85 a 1,15')));
  assert.ok(r.ressalvas.some((x) => x.includes('baixa confiança')));
});

test('avaliarVc: idade além de Kelly cai em Tanner; sem Tanner não é avaliável', () => {
  const i = intervalo(17.8, 1, 1);
  assert.equal(avaliarVc(i, { ...base, kelly }).naoAvaliavel, true);
  assert.equal(avaliarVc(i, { ...base, kelly, tanner: tannerLargo() }).chave, 'tanner');
});
