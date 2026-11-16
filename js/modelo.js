// Junta os módulos de cálculo: do estado da tela para tudo o que as saídas mostram.
// Puro (sem DOM), para poder ser testado com Node.

import { criarOms } from './oms.js';
import { estaturaAlvo } from './alvo.js';
import { validarMedidas } from './validacao.js';
import { calcularVc, avaliarVc } from './vc.js';
import { avaliarCriterios } from './criterios.js';
import { idadeDecimal } from './idade.js';

const JANELA_MIN = 0.85;
const JANELA_MAX = 1.15;

function numeroOuNulo(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * @param estado {sexo, nascimento, hoje, pai, mae, medidas[], kelly, tanner, preferencia, kellyTabela, par, manual}
 * @param tabelas {t2006, t2007, oms2009} JSON de data/
 */
export function calcular(estado, tabelas) {
  const oms = criarOms(tabelas);
  const sexo = estado.sexo === 'M' || estado.sexo === 'F' ? estado.sexo : null;

  const { linhas, validas } = validarMedidas({
    sexo, nascimento: estado.nascimento, hoje: estado.hoje, medidas: estado.medidas,
  }, oms);

  const medidas = validas.map((m) => {
    const lms = sexo ? oms.lms(sexo, m.dias) : null;
    const z = sexo ? oms.z(sexo, m.dias, m.cm) : null;
    return {
      ...m, idadeAnos: idadeDecimal(m.dias), z, percentil: z === null ? null : oms.percentil(z), fonte: lms?.fonte ?? null,
    };
  });

  const ctx = {
    sexo, oms2009: tabelas.oms2009, kelly: estado.kelly, tanner: estado.tanner,
    preferencia: estado.preferencia, kellyTabela: estado.kellyTabela,
  };
  const montarIntervalo = (a, b) => {
    const intervalo = calcularVc(a, b);
    const avaliacao = sexo
      ? avaliarVc(intervalo, ctx)
      : { naoAvaliavel: true, motivo: 'Informe o sexo.', ressalvas: [], referencia: null, chave: null, guiaSbp: null };
    return {
      a: a.id, b: b.id, intervalo, avaliacao, deltaZ: a.z === null || b.z === null ? null : b.z - a.z,
    };
  };

  const intervalos = [];
  for (let i = 1; i < medidas.length; i += 1) intervalos.push(montarIntervalo(medidas[i - 1], medidas[i]));

  // par usado no checklist: o escolhido (se válido) ou o intervalo mais recente
  let parUsado = null;
  const porId = new Map(medidas.map((m) => [m.id, m]));
  const pa = estado.par ? porId.get(estado.par.a) : null;
  const pb = estado.par ? porId.get(estado.par.b) : null;
  if (pa && pb && pb.dias > pa.dias) parUsado = { ...montarIntervalo(pa, pb), origem: 'escolhido' };
  else if (intervalos.length) parUsado = { ...intervalos.at(-1), origem: 'recente' };

  // sugestão: par que termina na última medida e fica mais perto de 12 meses, se o par em uso não estiver na janela
  let sugestaoPar = null;
  const ultima = medidas.at(-1) ?? null;
  const naJanela = (anos) => anos >= JANELA_MIN && anos <= JANELA_MAX;
  if (ultima && parUsado && !naJanela(parUsado.intervalo.anos)) {
    for (const m of medidas) {
      const anos = idadeDecimal(ultima.dias - m.dias);
      if (m === ultima || !naJanela(anos)) continue;
      if (!sugestaoPar || Math.abs(anos - 1) < Math.abs(sugestaoPar.anos - 1)) sugestaoPar = { a: m.id, b: ultima.id, anos };
    }
  }

  const vcParaCriterios = parUsado ? { ...parUsado.avaliacao, anos: parUsado.intervalo.anos } : null;
  const criterios = avaliarCriterios({ zEstatura: ultima ? ultima.z : null, vc: vcParaCriterios }, estado.manual);

  const alvo = sexo
    ? estaturaAlvo({ sexo, pai: numeroOuNulo(estado.pai) ?? NaN, mae: numeroOuNulo(estado.mae) ?? NaN }, oms)
    : null;

  return {
    oms, sexo, linhas, medidas, intervalos, parUsado, sugestaoPar, criterios, alvo, ultima,
  };
}
