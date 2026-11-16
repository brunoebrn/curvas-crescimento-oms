// Distribuição normal padrão: função de distribuição acumulada e quantil.

const RAIZ_2PI = Math.sqrt(2 * Math.PI);

function densidade(z) {
  return Math.exp(-0.5 * z * z) / RAIZ_2PI;
}

// Cauda superior Q(z) para z >= 5, por fração contínua (avaliada de trás para frente).
function caudaSuperior(z) {
  let f = z;
  for (let k = 60; k >= 1; k -= 1) f = z + k / f;
  return densidade(z) / f;
}

/** Probabilidade acumulada P(Z <= z). */
export function cdf(z) {
  if (Number.isNaN(z)) return NaN;
  const a = Math.abs(z);
  let acima; // P(Z > |z|)
  if (a >= 5) {
    acima = a > 38 ? 0 : caudaSuperior(a);
  } else {
    // Série de termos positivos (Marsaglia): Phi(a) = 1/2 + phi(a) * soma a^(2n+1)/(1*3*...*(2n+1))
    let termo = a;
    let soma = a;
    for (let n = 1; n < 200; n += 1) {
      termo *= (a * a) / (2 * n + 1);
      soma += termo;
      if (termo < 1e-17 * soma) break;
    }
    acima = 0.5 - densidade(a) * soma;
  }
  return z >= 0 ? 1 - acima : acima;
}

// Coeficientes da aproximação racional de P. J. Acklam (erro relativo de cerca de 1e-9).
const A = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
  1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
const B = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
  6.680131188771972e+01, -1.328068155288572e+01];
const C = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
  -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
const D = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
  3.754408661907416e+00];

/** Quantil z tal que P(Z <= z) = p, para 0 < p < 1. */
export function quantil(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('p deve estar entre 0 e 1 (exclusivo)');
  const baixo = 0.02425;
  if (p < baixo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5])
      / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  if (p > 1 - baixo) return -quantil(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q)
    / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}

/** Percentil (0 a 100) correspondente a um z. */
export function percentilDeZ(z) {
  return 100 * cdf(z);
}
