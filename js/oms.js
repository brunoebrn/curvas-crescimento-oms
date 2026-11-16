// Estatura para idade da OMS: 2006 por dia (0 a 1826 dias) e 2007 por mês (60 a 228 meses).
// L = 1 nas duas tabelas, então z = (estatura - M) / (M * S).

import { DIAS_POR_MES } from './idade.js';
import { percentilDeZ } from './normal.js';

const CODIGO_SEXO = { M: '1', F: '2' };
const DIAS_MAX_2006 = 1826;
const MES_MIN_2007 = 60;
const MES_MAX_2007 = 228;
/** Último dia aceito: 228 meses arredondado para cima (19 anos completos pelas datas). */
export const DIAS_MAX = Math.ceil(MES_MAX_2007 * DIAS_POR_MES);

function interpolar(vetor, posicao) {
  const i = Math.floor(posicao);
  if (i >= vetor.length - 1) return vetor[vetor.length - 1];
  const f = posicao - i;
  return vetor[i] + f * (vetor[i + 1] - vetor[i]);
}

/**
 * @param {{t2006: object, t2007: object}} tabelas JSON de data/
 */
export function criarOms({ t2006, t2007 }) {
  function lms(sexo, dias) {
    const cod = CODIGO_SEXO[sexo];
    if (!cod) throw new Error(`Sexo inválido: ${sexo}`);
    if (!(dias >= 0) || dias > DIAS_MAX) return null;
    if (dias <= DIAS_MAX_2006) {
      return {
        M: interpolar(t2006.M[cod], dias),
        S: interpolar(t2006.S[cod], dias),
        fonte: 'OMS 2006',
      };
    }
    const meses = Math.min(Math.max(dias / DIAS_POR_MES, MES_MIN_2007), MES_MAX_2007);
    return {
      M: interpolar(t2007.M[cod], meses - MES_MIN_2007),
      S: interpolar(t2007.S[cod], meses - MES_MIN_2007),
      fonte: 'OMS 2007',
    };
  }

  function z(sexo, dias, cm) {
    const p = lms(sexo, dias);
    return p ? (cm - p.M) / (p.M * p.S) : null;
  }

  function estaturaNoZ(sexo, dias, valorZ) {
    const p = lms(sexo, dias);
    return p ? p.M * (1 + valorZ * p.S) : null;
  }

  return { lms, z, estaturaNoZ, percentil: percentilDeZ, DIAS_MAX };
}
