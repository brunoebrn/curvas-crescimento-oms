// Velocidade de crescimento (VC) e suas referências (especificação, seção 6).
//
// - Menos de 24 meses: OMS 2009 (incrementos de comprimento em 2, 3, 4 e 6 meses).
// - 2 a 5,5 anos: Tanner & Davies 1985 (se carregado).
// - A partir de 5,5 anos: Kelly et al. 2014 (se carregado) ou Tanner, conforme a preferência.
//
// Kelly e Tanner nunca ficam no repositório: chegam por upload, já validados por referencias.js.

import { DIAS_POR_ANO, DIAS_POR_MES } from './idade.js';
import { cdf, quantil } from './normal.js';

const CODIGO_SEXO = { M: '1', F: '2' };

function num(valor, casas = 1) {
  return valor.toFixed(casas).replace('.', ',');
}

function interpolarEm(xs, ys, x) {
  if (x < xs[0] || x > xs[xs.length - 1]) return null;
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i += 1;
  const f = (x - xs[i]) / (xs[i + 1] - xs[i]);
  return ys[i] + f * (ys[i + 1] - ys[i]);
}

// ---------------------------------------------------------------- cálculo

/**
 * VC entre duas medidas `{dias, cm}` (idade em dias). Devolve `null` se o intervalo não for positivo.
 */
export function calcularVc(a, b) {
  const dias = b.dias - a.dias;
  if (!(dias > 0)) return null;
  const deltaCm = b.cm - a.cm;
  const anos = dias / DIAS_POR_ANO;
  const meses = dias / DIAS_POR_MES;
  const alertas = [];
  if (meses < 6) alertas.push('intervalo-curto');
  if (deltaCm < 0) alertas.push('vc-negativa');
  return {
    inicioDias: a.dias,
    fimDias: b.dias,
    dias,
    anos,
    meses,
    deltaCm,
    vc: deltaCm / anos,
    idadeMedioDias: (a.dias + b.dias) / 2,
    alertas,
  };
}

// ---------------------------------------------------------------- LMS

/** Valor da medida no z dado, pelo LMS: M(1 + L·S·z)^(1/L). `NaN` se não existir. */
export function valorNoZ({ L, M, S }, z) {
  const base = 1 + L * S * z;
  if (L === 0) return M * Math.exp(S * z);
  return base > 0 ? M * base ** (1 / L) : NaN;
}

function zLms({ L, M, S }, y) {
  if (L === 0) return Math.log(y / M) / S;
  return ((y / M) ** L - 1) / (L * S);
}

// ---------------------------------------------------------------- OMS 2009

const NOMINAIS = [2, 3, 4, 6];
const LIMITE_RATEIO_MESES = 1; // regra deste projeto, não da OMS (ver docs/HANDOFF.md)

// Desvio tolerado em dias (documento de métodos OMS 2009, Tabela 2 e p. 233).
function toleranciaDias(idadeMeses) {
  if (idadeMeses <= 6) return 3;
  if (idadeMeses <= 12) return 5;
  return 7;
}

/**
 * z do incremento de comprimento pela OMS 2009.
 * Regras do documento de métodos (p. 233): dentro da tolerância o incremento observado vale como está;
 * fora dela é rateado para o intervalo nominal; usa-se a linha tabulada de início mais próximo.
 * O z segue o LMS restrito (cap. 6): além de ±3 DP, o DP é a distância entre ±2 e ±3 DP.
 */
export function zOms2009(tab, sexo, inicioDias, fimDias, deltaCm) {
  const dias = fimDias - inicioDias;
  const mesesObs = dias / DIAS_POR_MES;
  const nominal = NOMINAIS.reduce((m, n) => (Math.abs(mesesObs - n) < Math.abs(mesesObs - m) ? n : m));
  if (Math.abs(mesesObs - nominal) > LIMITE_RATEIO_MESES) {
    return {
      naoAvaliavel: true,
      motivo: `Intervalo de ${num(mesesObs)} meses: a OMS 2009 só tem incrementos de 2, 3, 4 e 6 meses `
        + '(rateio aceito até 1 mês de diferença).',
    };
  }
  const linhas = tab.tabelas[String(nominal)][CODIGO_SEXO[sexo]];
  const inicioMeses = inicioDias / DIAS_POR_MES;
  const inicioTab = Math.round(inicioMeses);
  const linha = linhas.find((l) => l.inicio === inicioTab);
  if (!linha) {
    return {
      naoAvaliavel: true,
      motivo: `Intervalo de ${nominal} meses iniciado aos ${num(inicioMeses)} meses termina depois dos `
        + '24 meses cobertos pela OMS 2009.',
    };
  }

  const ressalvas = [];
  const tolerancia = toleranciaDias(fimDias / DIAS_POR_MES);
  const diasNominais = nominal * DIAS_POR_MES;
  const rateado = Math.abs(dias - diasNominais) > tolerancia;
  const y = rateado ? deltaCm * (diasNominais / dias) : deltaCm;
  if (rateado) {
    ressalvas.push(`Incremento rateado de ${dias} dias para ${nominal} meses (OMS 2009, métodos, p. 233; `
      + 'supõe crescimento constante no período).');
  }
  if (Math.abs(inicioDias - inicioTab * DIAS_POR_MES) > toleranciaDias(inicioMeses)) {
    ressalvas.push(`Idade de início (${num(inicioMeses)} meses) não coincide com a tabulada; `
      + `usada a linha ${linha.inicio}–${linha.fim} meses.`);
  }

  let z;
  const sd3neg = valorNoZ(linha, -3);
  if (!(y > 0)) {
    if (Number.isFinite(sd3neg)) {
      z = -3 + (y - sd3neg) / (valorNoZ(linha, -2) - sd3neg);
    } else {
      z = -1 / (linha.L * linha.S);
      ressalvas.push('Incremento nulo ou negativo: z no limite inferior da distribuição.');
    }
  } else {
    z = zLms(linha, y);
    if (z < -3 && Number.isFinite(sd3neg)) {
      z = -3 + (y - sd3neg) / (valorNoZ(linha, -2) - sd3neg);
    } else if (z > 3) {
      const sd3pos = valorNoZ(linha, 3);
      z = 3 + (y - sd3pos) / (sd3pos - valorNoZ(linha, 2));
    }
  }

  return {
    naoAvaliavel: false,
    z,
    percentil: 100 * cdf(z),
    nominalMeses: nominal,
    intervaloTabela: `${linha.inicio}–${linha.fim} meses`,
    rateado,
    incrementoUsado: y,
    ressalvas,
  };
}

// ---------------------------------------------------------------- Kelly 2014

/** Parâmetros L, M, S de Kelly interpolados na idade (anos); `null` fora da tabela. */
export function lmsKelly(tabela, idadeAnos) {
  const L = interpolarEm(tabela.idade, tabela.L, idadeAnos);
  if (L === null) return null;
  return {
    L,
    M: interpolarEm(tabela.idade, tabela.M, idadeAnos),
    S: interpolarEm(tabela.idade, tabela.S, idadeAnos),
  };
}

/** z da VC por Kelly et al. 2014: ((VC/M)^L − 1)/(L·S). `null` fora da faixa etária. */
export function zKelly(tabela, idadeAnos, vc) {
  const p = lmsKelly(tabela, idadeAnos);
  if (!p || !(p.M > 0)) return null; // M = 0 no fim de algumas tabelas: sem z definido
  let z;
  let limitado = false;
  if (vc > 0) {
    z = zLms(p, vc);
  } else {
    z = p.L > 0 ? -1 / (p.L * p.S) : -Infinity;
    limitado = true;
  }
  return { z, percentil: 100 * cdf(z), limitado };
}

// ---------------------------------------------------------------- Tanner & Davies 1985

export const PERCENTIS_TANNER = ['p3', 'p10', 'p25', 'p50', 'p75', 'p90', 'p97'];
const Z_TANNER = PERCENTIS_TANNER.map((p) => quantil(Number(p.slice(1)) / 100));

/** Valores das 7 curvas de Tanner na idade (anos); `null` fora da faixa. */
export function curvasTannerNaIdade(curvas, idadeAnos) {
  const valores = PERCENTIS_TANNER.map((p) => interpolarEm(curvas.idade, curvas[p], idadeAnos));
  return valores[0] === null ? null : valores;
}

/**
 * z aproximado da VC pelas curvas digitalizadas de Tanner: interpolação linear do z entre as curvas
 * vizinhas, supondo normalidade. Fora de P3–P97 o z fica no limite e `limitado` vem `true`.
 */
export function zTanner(curvas, idadeAnos, vc) {
  const v = curvasTannerNaIdade(curvas, idadeAnos);
  if (!v) return null;
  let z;
  let limitado = false;
  if (vc < v[0]) {
    z = Z_TANNER[0];
    limitado = true;
  } else if (vc > v[v.length - 1]) {
    z = Z_TANNER[Z_TANNER.length - 1];
    limitado = true;
  } else {
    let i = 0;
    while (i < v.length - 2 && vc > v[i + 1]) i += 1;
    const largura = v[i + 1] - v[i];
    const f = largura > 0 ? (vc - v[i]) / largura : 0;
    z = Z_TANNER[i] + f * (Z_TANNER[i + 1] - Z_TANNER[i]);
  }
  return { z, percentil: 100 * cdf(z), limitado };
}

// ---------------------------------------------------------------- guia SBP

/** VC aproximada da SBP (Manual nº 64, 2023), só como guia visual: 7 cm/ano (2–4 a), 6 cm/ano (4–6 a). */
export function guiaSbp(idadeAnos) {
  if (idadeAnos >= 2 && idadeAnos < 4) return 7;
  if (idadeAnos >= 4 && idadeAnos < 6) return 6;
  return null;
}

// ---------------------------------------------------------------- escolha da referência

const ROTULO_KELLY = {
  '2a': 'Kelly 2014 (Tabela S2a, todos)',
  precoce: 'Kelly 2014 (Tabela S2b, maturação precoce)',
  media: 'Kelly 2014 (Tabela S2b, maturação média)',
  tardia: 'Kelly 2014 (Tabela S2b, maturação tardia)',
};

/** Tabela de Kelly para o sexo e a opção escolhida, ou `null`. */
export function tabelaKelly(kelly, sexo, opcao) {
  if (!kelly) return null;
  if (opcao === '2a') return kelly.tabelas['2a']?.[sexo] ?? null;
  return kelly.tabelas['2b']?.[sexo]?.[opcao] ?? null;
}

function tentarKelly(intervalo, idade, ctx) {
  const tabela = tabelaKelly(ctx.kelly, ctx.sexo, ctx.kellyTabela);
  if (!tabela) return null;
  const r = zKelly(tabela, idade, intervalo.vc);
  if (!r) return null;
  const ressalvas = [];
  if (intervalo.meses < 11 || intervalo.meses > 13) {
    ressalvas.push(`Intervalo de ${num(intervalo.meses)} meses: fora da condição da referência (11 a 13 meses).`);
  }
  if (r.limitado) ressalvas.push('VC nula ou negativa: z no limite inferior da distribuição.');
  return {
    chave: 'kelly', referencia: ROTULO_KELLY[ctx.kellyTabela], z: r.z, percentil: r.percentil, ressalvas,
  };
}

function tentarTanner(intervalo, idade, ctx) {
  const curvas = ctx.tanner?.curvas?.[ctx.sexo];
  if (!curvas) return null;
  const r = zTanner(curvas, idade, intervalo.vc);
  if (!r) return null;
  const ressalvas = ['Percentil aproximado (curvas digitalizadas; z estimado supondo normalidade).'];
  if (intervalo.anos < 0.85 || intervalo.anos > 1.15) {
    ressalvas.push(`Intervalo de ${num(intervalo.anos, 2)} ano: fora da condição de velocidade de ano inteiro `
      + '(0,85 a 1,15 ano).');
  }
  if (ctx.tanner.validacao?.baixaConfianca) {
    ressalvas.push('Digitalização de baixa confiança (erro acima de 0,2 cm/ano contra a tabela do P50).');
  }
  if (r.limitado) ressalvas.push('VC fora da faixa P3–P97: z limitado ao extremo.');
  return {
    chave: 'tanner',
    referencia: 'Tanner & Davies 1985 (digitalizada)',
    z: r.z,
    percentil: r.percentil,
    limitado: r.limitado,
    ressalvas,
  };
}

/**
 * Avalia a VC de um intervalo (saída de `calcularVc`) contra a referência adequada à idade no ponto médio.
 * @param ctx {sexo, oms2009, kelly, tanner, preferencia:'kelly'|'tanner', kellyTabela:'2a'|'precoce'|'media'|'tardia'}
 */
export function avaliarVc(intervalo, ctx) {
  const idade = intervalo.idadeMedioDias / DIAS_POR_ANO;
  const guia = guiaSbp(idade);

  if (intervalo.idadeMedioDias / DIAS_POR_MES < 24) {
    const r = zOms2009(ctx.oms2009, ctx.sexo, intervalo.inicioDias, intervalo.fimDias, intervalo.deltaCm);
    if (r.naoAvaliavel) {
      return { chave: 'oms2009', referencia: 'OMS 2009', naoAvaliavel: true, motivo: r.motivo, ressalvas: [], guiaSbp: guia };
    }
    return {
      chave: 'oms2009',
      referencia: `OMS 2009 (incremento de ${r.nominalMeses} meses, ${r.intervaloTabela})`,
      nominalMeses: r.nominalMeses,
      z: r.z,
      percentil: r.percentil,
      naoAvaliavel: false,
      ressalvas: ['Padrão de incremento de até 6 meses, não de velocidade anual.', ...r.ressalvas],
      guiaSbp: guia,
    };
  }

  const ordem = idade < 5.5 || ctx.preferencia === 'tanner'
    ? [tentarTanner, tentarKelly]
    : [tentarKelly, tentarTanner];
  for (const tentar of ordem) {
    if (tentar === tentarKelly && idade < 5.5) continue;
    const r = tentar(intervalo, idade, ctx);
    if (r) return { ...r, naoAvaliavel: false, guiaSbp: guia };
  }

  let motivo;
  if (idade < 5.5) {
    motivo = ctx.tanner
      ? 'Idade fora da faixa das curvas de Tanner carregadas.'
      : 'Entre 2 e 5,5 anos a referência é Tanner & Davies 1985, que não está carregada.';
  } else if (!ctx.kelly && !ctx.tanner) {
    motivo = 'Nenhuma referência de VC carregada (Kelly 2014 ou Tanner & Davies 1985).';
  } else {
    motivo = 'As referências carregadas não cobrem esta idade (ou a tabela de Kelly escolhida não existe para o sexo).';
  }
  return { chave: null, referencia: null, naoAvaliavel: true, motivo, ressalvas: [], guiaSbp: guia };
}
