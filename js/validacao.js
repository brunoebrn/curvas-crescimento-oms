// Validação das medidas informadas (especificação, seção 5).

import { diasEntre, diasDeAnosMeses, parseData } from './idade.js';
import { DIAS_MAX } from './oms.js';

/** |z| acima do qual a estatura é sinalizada como implausível (mesmo limiar de flag do pacote anthro da OMS). */
export const Z_IMPLAUSIVEL = 6;
const QUEDA_MAXIMA_CM = 1;

const vazio = (v) => v === null || v === undefined || String(v).trim() === '';

function lerNumero(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function idadeDaLinha(m, nascimento, hoje, erros) {
  if (m.modo === 'idade') {
    const anos = vazio(m.anos) ? 0 : lerNumero(m.anos);
    const meses = vazio(m.meses) ? 0 : lerNumero(m.meses);
    if (vazio(m.anos) && vazio(m.meses)) {
      erros.push('Informe a idade (anos e meses).');
      return null;
    }
    if (!(anos >= 0) || !(meses >= 0) || meses >= 12 || !Number.isInteger(anos)) {
      erros.push('Idade inválida: anos inteiros e meses de 0 a 11,9.');
      return null;
    }
    return diasDeAnosMeses(anos, meses);
  }
  if (vazio(m.data)) {
    erros.push('Informe a data da medida.');
    return null;
  }
  try {
    parseData(m.data);
  } catch {
    erros.push('Data inválida.');
    return null;
  }
  if (vazio(nascimento)) {
    erros.push('Informe a data de nascimento para usar medidas por data.');
    return null;
  }
  if (!vazio(hoje) && diasEntre(hoje, m.data) > 0) {
    erros.push('Data futura.');
    return null;
  }
  const dias = diasEntre(nascimento, m.data);
  if (dias < 0) {
    erros.push('Data anterior ao nascimento.');
    return null;
  }
  return dias;
}

/**
 * @param entrada {sexo, nascimento, hoje, medidas:[{id, modo:'data'|'idade', data, anos, meses, cm}]}
 * @returns {{linhas: object[], validas: {id, dias, cm}[]}} `validas` em ordem de idade
 */
export function validarMedidas({ sexo, nascimento, hoje, medidas }, oms) {
  let nascimentoOk = nascimento;
  try {
    if (!vazio(nascimento)) parseData(nascimento);
  } catch {
    nascimentoOk = '';
  }

  const linhas = medidas.map((m) => {
    const semIdade = m.modo === 'idade' ? vazio(m.anos) && vazio(m.meses) : vazio(m.data);
    if (semIdade && vazio(m.cm)) return { id: m.id, vazia: true, dias: null, cm: null, erros: [], alertas: [] };
    const erros = [];
    const dias = idadeDaLinha(m, nascimentoOk, hoje, erros);
    const cm = vazio(m.cm) ? NaN : lerNumero(m.cm);
    if (!(cm > 0)) erros.push('Estatura ausente ou inválida (em cm).');
    if (dias !== null && dias > DIAS_MAX) erros.push('Idade acima de 19 anos: fora do alcance da ferramenta.');
    return { id: m.id, vazia: false, dias, cm: cm > 0 ? cm : null, erros, alertas: [] };
  });

  // duplicadas: mesma idade em dias entre linhas sem outros erros
  const porDia = new Map();
  for (const l of linhas) {
    if (l.vazia || l.erros.length) continue;
    if (!porDia.has(l.dias)) porDia.set(l.dias, []);
    porDia.get(l.dias).push(l);
  }
  for (const grupo of porDia.values()) {
    if (grupo.length > 1) grupo.forEach((l) => l.erros.push('Data ou idade duplicada.'));
  }

  const boas = linhas.filter((l) => !l.vazia && l.erros.length === 0).sort((a, b) => a.dias - b.dias);
  boas.forEach((l, i) => {
    const z = sexo ? oms.z(sexo, l.dias, l.cm) : null;
    if (z !== null && Math.abs(z) > Z_IMPLAUSIVEL) {
      l.alertas.push(`Estatura implausível para a idade (z = ${z.toFixed(1).replace('.', ',')}): confira o valor.`);
    }
    if (i > 0 && boas[i - 1].cm - l.cm > QUEDA_MAXIMA_CM) {
      l.alertas.push(`Queda de ${(boas[i - 1].cm - l.cm).toFixed(1).replace('.', ',')} cm em relação à medida anterior: provável erro.`);
    }
  });

  return { linhas, validas: boas.map(({ id, dias, cm }) => ({ id, dias, cm })) };
}
