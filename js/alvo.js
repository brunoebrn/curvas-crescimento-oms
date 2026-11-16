// Estatura-alvo (SBP, Manual de Orientação nº 64, 2023):
// meninos (pai + mãe + 13)/2, meninas (pai + mãe - 13)/2, faixa de ±5 cm.
// O z é calculado aos 19 anos (OMS 2007, 228 meses).

import { DIAS_MAX } from './oms.js';

const FAIXA_CM = 5;

export function estaturaAlvo({ sexo, pai, mae }, oms) {
  if (!Number.isFinite(pai) || !Number.isFinite(mae) || pai <= 0 || mae <= 0) return null;
  const alvo = (pai + mae + (sexo === 'M' ? 13 : -13)) / 2;
  const min = alvo - FAIXA_CM;
  const max = alvo + FAIXA_CM;
  return {
    alvo,
    min,
    max,
    zAlvo: oms.z(sexo, DIAS_MAX, alvo),
    zMin: oms.z(sexo, DIAS_MAX, min),
    zMax: oms.z(sexo, DIAS_MAX, max),
  };
}
