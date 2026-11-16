// Idade: datas em UTC, idade em dias, conversões (especificação, seção 6).

export const DIAS_POR_ANO = 365.25;
export const DIAS_POR_MES = 30.4375;
const MS_POR_DIA = 86400000;

/** Converte 'AAAA-MM-DD' em milissegundos UTC. Lança erro se a data não existir. */
export function parseData(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? '').trim());
  if (!m) throw new Error(`Data inválida: "${texto}"`);
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(ano, mes - 1, dia);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new Error(`Data inválida: "${texto}"`);
  }
  return ms;
}

/** Dias corridos de `inicio` até `fim` (ambas 'AAAA-MM-DD'). */
export function diasEntre(inicio, fim) {
  return Math.round((parseData(fim) - parseData(inicio)) / MS_POR_DIA);
}

export function idadeDecimal(dias) {
  return dias / DIAS_POR_ANO;
}

export function mesesDeDias(dias) {
  return dias / DIAS_POR_MES;
}

/** Idade informada em anos e meses, convertida em dias (mês = 30,4375 dias). */
export function diasDeAnosMeses(anos, meses) {
  return Math.round(anos * DIAS_POR_ANO + meses * DIAS_POR_MES);
}

/** Idade em anos e meses completos, por exemplo "2 a 6 m". */
export function formatarIdade(dias) {
  // meio dia de folga: idades informadas em anos e meses são arredondadas para dias inteiros
  const totalMeses = Math.floor((dias + 0.5) / DIAS_POR_MES);
  return `${Math.floor(totalMeses / 12)} a ${totalMeses % 12} m`;
}

/** Data de hoje no fuso local, como 'AAAA-MM-DD'. */
export function hojeIso(agora = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}
