// Referências sintéticas para testes. NÃO são dados de Kelly nem de Tanner:
// valores inventados só para exercitar o formato e os cálculos.
const Z = { p3: -1.8807936, p10: -1.2815516, p25: -0.6744898, p50: 0, p75: 0.6744898, p90: 1.2815516, p97: 1.8807936 };

function tabelaKelly(idades, M = 5, S = 0.2, L = 1) {
  const t = { idade: idades, L: idades.map(() => L), S: idades.map(() => S), M: idades.map(() => M) };
  for (const p of ['p3', 'p10', 'p50', 'p90', 'p97']) t[p] = idades.map(() => +(M * (1 + L * S * Z[p])).toFixed(1));
  return t;
}

export function kellySintetico() {
  const idades = [];
  for (let a = 5.5; a <= 17.5; a += 0.25) idades.push(a);
  return {
    formato: 'curvas-crescimento-referencia',
    versaoFormato: 1,
    tipo: 'kelly2014',
    fonte: { citacao: 'SINTÉTICO – apenas para teste', doi: '' },
    geradoEm: '2026-11-16',
    metodo: 'valores inventados',
    tabelas: {
      '2a': { M: tabelaKelly(idades), F: tabelaKelly(idades) },
      '2b': {
        M: { precoce: tabelaKelly(idades, 5, 0.1), media: tabelaKelly(idades), tardia: tabelaKelly(idades, 5, 0.3) },
        F: { precoce: tabelaKelly(idades, 5, 0.1), media: tabelaKelly(idades), tardia: tabelaKelly(idades, 5, 0.3) },
      },
    },
  };
}

export function tannerSintetico() {
  const idade = [];
  for (let a = 2; a <= 19; a += 0.25) idade.push(a);
  const curva = () => {
    const c = { idade };
    for (const [p, z] of Object.entries(Z)) c[p] = idade.map(() => +(5 + z).toFixed(3));
    return c;
  };
  return {
    formato: 'curvas-crescimento-referencia',
    versaoFormato: 1,
    tipo: 'tanner1985',
    fonte: { citacao: 'SINTÉTICO – apenas para teste', doi: '' },
    geradoEm: '2026-11-16',
    metodo: 'valores inventados',
    curvas: { M: curva(), F: curva() },
    validacao: { aceite: 0.2, erroMaximo: 0.05, porIdade: [], baixaConfianca: false },
  };
}
