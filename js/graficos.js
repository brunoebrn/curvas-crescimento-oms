// Gráficos de estatura e de velocidade de crescimento (uPlot, vendorizado em vendor/).
// Usa DOM e o global `uPlot`; a lógica de cálculo fica nos outros módulos.

import { DIAS_POR_ANO } from './idade.js';
import { DIAS_MAX } from './oms.js';
import { quantil } from './normal.js';
import { valorNoZ, lmsKelly, tabelaKelly, PERCENTIS_TANNER } from './vc.js';

const COR = {
  tinta: '#1a2a31',
  eixo: '#47575f',
  grade: '#e6e2d9',
  mediana: '#1a2a31',
  dp2: '#5d6d75',
  dp3: '#9a6a4f',
  paciente: '#0c5f63',
  centil: '#7c8a91',
  p25: '#9a6a4f',
  guia: '#7d4b00',
  alvo: '#0c5f63',
};
const FONTE = '12px "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Arial, sans-serif';
const IDADE_MAX = DIAS_MAX / DIAS_POR_ANO;
const Z_PERCENTIS = PERCENTIS_TANNER.map((p) => quantil(Number(p.slice(1)) / 100));

const instancias = new WeakMap();
const observadores = new WeakMap();

const virgula = (v, casas) => (casas === undefined ? String(v) : v.toFixed(casas)).replace('.', ',');

function limpar(el) {
  instancias.get(el)?.destroy();
  instancias.delete(el);
  el.replaceChildren();
}

function vazio(el, texto) {
  limpar(el);
  const p = document.createElement('p');
  p.className = 'grafico-vazio';
  p.textContent = texto;
  el.append(p);
}

function altura(el) {
  return el.clientWidth < 520 ? 300 : 400;
}

function montar(el, opcoes, dados) {
  limpar(el);
  const u = new uPlot({ width: Math.max(el.clientWidth - 10, 240), height: altura(el), ...opcoes }, dados, el);
  instancias.set(el, u);
  if (!observadores.has(el)) {
    const ro = new ResizeObserver(() => {
      const atual = instancias.get(el);
      if (atual) atual.setSize({ width: Math.max(el.clientWidth - 10, 240), height: altura(el) });
    });
    ro.observe(el);
    observadores.set(el, ro);
  }
  return u;
}

function eixos(rotuloY) {
  const base = {
    stroke: COR.eixo, font: FONTE, labelFont: FONTE, grid: { stroke: COR.grade, width: 1 }, ticks: { stroke: COR.grade, width: 1 },
    values: (u, vals) => vals.map((v) => virgula(v)),
  };
  return [
    { ...base, label: 'Idade (anos)', labelSize: 22, size: 34 },
    { ...base, label: rotuloY, labelSize: 22, size: 46 },
  ];
}

// Rótulo direto na ponta direita visível de cada curva (dispensa legenda de cores).
function rotularCurvas(rotulos) {
  return (u) => {
    const { ctx } = u;
    const pr = uPlot.pxRatio;
    ctx.save();
    ctx.font = `${11 * pr}px "Segoe UI", system-ui, Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const xs = u.data[0];
    const { min, max } = u.scales.x;
    // prioridade para as curvas do meio e dos extremos; rótulos que se sobreporiam são omitidos
    const ordem = [...rotulos].sort((a, b2) => (a.prioridade ?? 9) - (b2.prioridade ?? 9));
    const usados = [];
    for (const { serie, texto, cor } of ordem) {
      const ys = u.data[serie];
      let i = xs.length - 1;
      while (i >= 0 && (xs[i] > max || ys[i] === null || ys[i] === undefined)) i -= 1;
      if (i < 0 || xs[i] < min) continue;
      const x = Math.min(u.valToPos(xs[i], 'x', true), u.bbox.left + u.bbox.width) - 4 * pr;
      const y = u.valToPos(ys[i], 'y', true) - 2 * pr;
      if (y < u.bbox.top + 10 * pr || y > u.bbox.top + u.bbox.height) continue;
      if (usados.some((yu) => Math.abs(yu - y) < 12 * pr)) continue;
      usados.push(y);
      ctx.fillStyle = cor;
      ctx.fillText(texto, x, y);
    }
    ctx.restore();
  };
}

function recortar(u, desenhar) {
  const { ctx, bbox } = u;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bbox.left, bbox.top, bbox.width, bbox.height);
  ctx.clip();
  desenhar(ctx, uPlot.pxRatio);
  ctx.restore();
}

function leitura(elLeitura, formatar) {
  return (u) => {
    if (!elLeitura) return;
    const { idx } = u.cursor;
    elLeitura.textContent = idx === null || idx === undefined ? '' : formatar(idx, u) ?? '';
  };
}

function itemLegenda(desenho, texto) {
  const li = document.createElement('li');
  li.innerHTML = `<svg width="26" height="10" viewBox="0 0 26 10" aria-hidden="true">${desenho}</svg>`;
  li.append(texto);
  return li;
}
const linhaSvg = (cor, tracejado = '', largura = 2) => `<line x1="1" y1="5" x2="25" y2="5" stroke="${cor}" stroke-width="${largura}" ${tracejado ? `stroke-dasharray="${tracejado}"` : ''}/>`;
const pontoSvg = (cor, vazado = false) => `<circle cx="13" cy="5" r="4" fill="${vazado ? 'none' : cor}" stroke="${cor}" stroke-width="2"/>`;

// ---------------------------------------------------------------- estatura

/**
 * @param alvos {el, leitura, legenda} elementos
 * @param r resultado de calcular()
 * @param vista 'medidas' | 'tudo'
 */
export function desenharEstatura(alvos, r, vista) {
  const { el } = alvos;
  alvos.legenda.replaceChildren();
  if (alvos.leitura) alvos.leitura.textContent = '';
  if (!r.sexo) {
    vazio(el, 'Informe o sexo para ver as curvas da OMS.');
    return;
  }
  const idadesPaciente = r.medidas.map((m) => m.idadeAnos);
  const conjunto = new Set(idadesPaciente);
  for (let m = 0; m <= 228; m += 1) conjunto.add(m / 12);
  conjunto.add(1826 / DIAS_POR_ANO); // último dia da tabela 2006
  conjunto.add(IDADE_MAX);
  const xs = [...conjunto].filter((x) => x <= IDADE_MAX).sort((a, b) => a - b);
  const zs = [-3, -2, 0, 2, 3];
  const curvas = zs.map((z) => xs.map((x) => r.oms.estaturaNoZ(r.sexo, Math.min(x * DIAS_POR_ANO, DIAS_MAX), z)));
  const porIdade = new Map(r.medidas.map((m) => [m.idadeAnos, m]));
  const paciente = xs.map((x) => porIdade.get(x)?.cm ?? null);

  let faixaX = [0, 19.4];
  if (vista === 'medidas' && idadesPaciente.length) {
    const a = Math.max(0, Math.min(...idadesPaciente) - 1);
    const b = Math.min(19.4, Math.max(...idadesPaciente) + 1);
    faixaX = [a, Math.max(b, a + 2)];
  }
  const naFaixa = (x) => x >= faixaX[0] && x <= faixaX[1];
  const visiveis = [];
  xs.forEach((x, i) => {
    if (!naFaixa(x)) return;
    visiveis.push(curvas[0][i], curvas[4][i]);
    if (paciente[i] !== null) visiveis.push(paciente[i]);
  });
  if (r.alvo && faixaX[1] >= 19) visiveis.push(r.alvo.min, r.alvo.max);
  const faixaY = [Math.floor(Math.min(...visiveis) - 2), Math.ceil(Math.max(...visiveis) + 3)];

  const estilo = (cor, largura, dash) => ({
    stroke: cor, width: largura, dash, points: { show: false }, spanGaps: true, pxAlign: 0,
  });
  const series = [
    {},
    estilo(COR.dp3, 1.25, [5, 4]),
    estilo(COR.dp2, 1.25),
    estilo(COR.mediana, 1.75),
    estilo(COR.dp2, 1.25),
    estilo(COR.dp3, 1.25, [5, 4]),
    {
      stroke: COR.paciente, width: 2, spanGaps: true, pxAlign: 0,
      points: { show: true, size: 9, stroke: COR.paciente, fill: COR.paciente, width: 1 },
    },
  ];
  const rotulos = ['−3', '−2', '0', '+2', '+3'].map((texto, i) => ({
    serie: i + 1, texto, cor: [COR.dp3, COR.dp2, COR.mediana, COR.dp2, COR.dp3][i],
  }));

  const desenharAlvo = (u) => {
    if (!r.alvo || u.scales.x.max < 19) return;
    recortar(u, (ctx, pr) => {
      const x = u.valToPos(19, 'x', true);
      const y1 = u.valToPos(r.alvo.max, 'y', true);
      const y2 = u.valToPos(r.alvo.min, 'y', true);
      const ym = u.valToPos(r.alvo.alvo, 'y', true);
      ctx.fillStyle = 'rgba(12, 95, 99, 0.22)';
      ctx.fillRect(x - 5 * pr, y1, 10 * pr, y2 - y1);
      ctx.strokeStyle = COR.alvo;
      ctx.lineWidth = 2 * pr;
      ctx.beginPath();
      ctx.moveTo(x - 9 * pr, ym);
      ctx.lineTo(x + 9 * pr, ym);
      ctx.stroke();
    });
  };

  montar(el, {
    scales: { x: { time: false, range: () => faixaX }, y: { range: () => faixaY } },
    legend: { show: false },
    cursor: { y: false, drag: { x: false, y: false }, points: { show: false } },
    axes: eixos('Estatura (cm)'),
    series,
    hooks: {
      draw: [rotularCurvas(rotulos), desenharAlvo],
      setCursor: [leitura(alvos.leitura, (idx, u) => {
        const x = u.data[0][idx];
        const m = porIdade.get(x);
        if (m) return `Medida aos ${virgula(x, 2)} anos: ${virgula(m.cm, 1)} cm, z ${virgula(m.z, 2).replace('-', '−')}`;
        return `Aos ${virgula(x, 2)} anos: mediana ${virgula(u.data[3][idx], 1)} cm; −2 DP ${virgula(u.data[2][idx], 1)} cm; −3 DP ${virgula(u.data[1][idx], 1)} cm`;
      })],
    },
  }, [xs, ...curvas, paciente]);

  alvos.legenda.append(
    itemLegenda(linhaSvg(COR.mediana, '', 2), 'Mediana (z 0)'),
    itemLegenda(linhaSvg(COR.dp2, '', 1.5), 'z −2 e +2'),
    itemLegenda(linhaSvg(COR.dp3, '5 4', 1.5), 'z −3 e +3'),
    itemLegenda(pontoSvg(COR.paciente), 'Medidas do paciente'),
  );
  if (r.alvo) alvos.legenda.append(itemLegenda(`<rect x="8" y="0" width="10" height="10" fill="rgba(12,95,99,0.22)"/><line x1="4" y1="5" x2="22" y2="5" stroke="${COR.alvo}" stroke-width="2"/>`, 'Estatura-alvo ±5 cm, aos 19 anos (visível em "0 a 19 anos")'));
}

// ---------------------------------------------------------------- velocidade

// Segmentos de curvas de referência conforme a faixa etária (especificação, seção 6).
function segmentosVc(r, estado, tabelas) {
  const segmentos = [];

  // menos de 2 anos: OMS 2009, incrementos anualizados; usa a tabela do intervalo nominal mais recente, ou 6 meses
  const recente = [...r.intervalos].reverse().find((i) => i.avaliacao.chave === 'oms2009' && i.avaliacao.nominalMeses);
  const nominal = recente ? recente.avaliacao.nominalMeses : 6;
  const linhas = tabelas.oms2009.tabelas[String(nominal)][r.sexo === 'M' ? '1' : '2'];
  segmentos.push({
    rotulo: `OMS 2009, incrementos de ${nominal} meses anualizados`,
    xs: linhas.map((l) => (l.inicio + l.fim) / 24),
    ys: Z_PERCENTIS.map((z) => linhas.map((l) => {
      const v = valorNoZ(l, z);
      return Number.isFinite(v) ? v * (12 / nominal) : null;
    })),
  });

  const curvasT = estado.tanner?.curvas?.[r.sexo] ?? null;
  const tabK = tabelaKelly(estado.kelly, r.sexo, estado.kellyTabela);
  const segTanner = (de, ate) => {
    const idx = curvasT.idade.map((a, i) => (a >= de && a <= ate ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return;
    segmentos.push({
      rotulo: 'Tanner & Davies 1985 (digitalizada)',
      xs: idx.map((i) => curvasT.idade[i]),
      ys: PERCENTIS_TANNER.map((p) => idx.map((i) => curvasT[p][i])),
    });
  };
  const usarKelly = tabK && (estado.preferencia === 'kelly' || !curvasT);
  if (usarKelly) {
    const idx = tabK.idade.map((a, i) => (tabK.M[i] > 0 ? i : -1)).filter((i) => i >= 0);
    const fimKelly = tabK.idade[idx.at(-1)];
    if (curvasT) segTanner(2, Math.min(tabK.idade[0] - 0.25, 5.25));
    segmentos.push({
      rotulo: 'Kelly 2014 (percentis pelo LMS)',
      xs: idx.map((i) => tabK.idade[i]),
      ys: Z_PERCENTIS.map((z) => idx.map((i) => {
        const v = valorNoZ(lmsKelly(tabK, tabK.idade[i]), z);
        return Number.isFinite(v) ? v : null;
      })),
    });
    if (curvasT) segTanner(fimKelly + 0.25, 19);
  } else if (curvasT) {
    segTanner(2, 19);
  }
  return segmentos;
}

/**
 * @param alvos {el, leitura, legenda}
 * @param r resultado de calcular()
 * @param estado estado da tela (referências e preferências)
 * @param tabelas {oms2009}
 * @param vista 'medidas' | 'tudo'
 */
export function desenharVc(alvos, r, estado, tabelas, vista) {
  const { el } = alvos;
  alvos.legenda.replaceChildren();
  if (alvos.leitura) alvos.leitura.textContent = '';
  if (!r.sexo) {
    vazio(el, 'Informe o sexo para ver as referências de velocidade.');
    return;
  }
  const segmentos = segmentosVc(r, estado, tabelas);

  // intervalos do paciente: consecutivos mais o par escolhido, se for outro
  const pontos = r.intervalos.map((i) => ({ ...i, emUso: r.parUsado && i.a === r.parUsado.a && i.b === r.parUsado.b }));
  if (r.parUsado && !pontos.some((p) => p.emUso)) pontos.push({ ...r.parUsado, emUso: true });
  const xPonto = (p) => p.intervalo.idadeMedioDias / DIAS_POR_ANO;

  // eixo x: união das idades, com um ponto nulo entre segmentos para interromper as curvas
  const mapa = new Map(); // x -> {ys: [7], guia, vc, par}
  const celula = (x) => {
    if (!mapa.has(x)) mapa.set(x, { ys: Array(7).fill(null), guia: null, vc: null, par: null });
    return mapa.get(x);
  };
  segmentos.forEach((s, k) => {
    s.xs.forEach((x, i) => { const c = celula(x); s.ys.forEach((ys, j) => { c.ys[j] = ys[i]; }); });
    if (k < segmentos.length - 1) celula((s.xs.at(-1) + segmentos[k + 1].xs[0]) / 2 + 1e-6);
  });
  [[2, 7], [3.999, 7], [4, 6], [5.999, 6]].forEach(([x, v]) => { celula(x).guia = v; });
  pontos.forEach((p) => {
    const c = celula(xPonto(p));
    if (p.emUso) c.par = p.intervalo.vc; else c.vc = p.intervalo.vc;
  });
  const xs = [...mapa.keys()].sort((a, b) => a - b);
  const col = (f) => xs.map((x) => f(mapa.get(x)));
  // curvas de referência: nulo só onde há quebra de segmento
  const quebras = new Set();
  segmentos.forEach((s, k) => { if (k < segmentos.length - 1) quebras.add((s.xs.at(-1) + segmentos[k + 1].xs[0]) / 2 + 1e-6); });
  const refs = Array.from({ length: 7 }, (_, j) => xs.map((x) => (quebras.has(x) ? null : mapa.get(x).ys[j])));

  let faixaX = [0, 19.4];
  if (vista === 'medidas' && pontos.length) {
    const a = Math.max(0, Math.min(...pontos.map((p) => p.intervalo.inicioDias / DIAS_POR_ANO)) - 0.75);
    const b = Math.min(19.4, Math.max(...pontos.map((p) => p.intervalo.fimDias / DIAS_POR_ANO)) + 0.75);
    faixaX = [a, Math.max(b, a + 2)];
  }
  const naFaixa = (x) => x >= faixaX[0] && x <= faixaX[1];
  const visiveis = [0];
  xs.forEach((x, i) => {
    if (!naFaixa(x)) return;
    if (refs[6][i] !== null) visiveis.push(refs[6][i]);
    const c = mapa.get(x);
    [c.guia, c.vc, c.par].forEach((v) => { if (v !== null) visiveis.push(v); });
  });
  const faixaY = [Math.min(0, Math.floor(Math.min(...visiveis))), Math.ceil(Math.max(...visiveis, 8) + 1)];

  const estiloRef = (j) => ({
    stroke: j === 2 ? COR.p25 : (j === 3 ? COR.mediana : COR.centil),
    width: j === 3 ? 1.75 : (j === 2 ? 1.5 : 1),
    dash: j === 2 ? [6, 3] : undefined,
    points: { show: false },
    pxAlign: 0,
    spanGaps: (u, sidx, i0, i1) => !xs.slice(i0, i1 + 1).some((x) => quebras.has(x)),
  });
  const series = [
    {},
    ...Array.from({ length: 7 }, (_, j) => estiloRef(j)),
    { stroke: COR.guia, width: 1.25, dash: [2, 4], points: { show: false }, spanGaps: true },
    { stroke: 'transparent', width: 0, points: { show: true, size: 9, stroke: COR.paciente, fill: '#fefdfb', width: 2 } },
    { stroke: 'transparent', width: 0, points: { show: true, size: 11, stroke: COR.paciente, fill: COR.paciente, width: 2 } },
  ];
  const rotulos = ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'].map((texto, j) => ({
    serie: j + 1, texto, cor: j === 2 ? COR.p25 : (j === 3 ? COR.mediana : COR.eixo), prioridade: [2, 4, 1, 0, 5, 6, 3][j],
  }));

  const desenharIntervalos = (u) => recortar(u, (ctx, pr) => {
    ctx.strokeStyle = COR.paciente;
    ctx.setLineDash([]);
    for (const p of pontos) {
      const y = u.valToPos(p.intervalo.vc, 'y', true);
      const x1 = u.valToPos(p.intervalo.inicioDias / DIAS_POR_ANO, 'x', true);
      const x2 = u.valToPos(p.intervalo.fimDias / DIAS_POR_ANO, 'x', true);
      ctx.lineWidth = (p.emUso ? 2 : 1) * pr;
      ctx.globalAlpha = p.emUso ? 0.9 : 0.55;
      ctx.beginPath();
      ctx.moveTo(x1, y); ctx.lineTo(x2, y);
      ctx.moveTo(x1, y - 4 * pr); ctx.lineTo(x1, y + 4 * pr);
      ctx.moveTo(x2, y - 4 * pr); ctx.lineTo(x2, y + 4 * pr);
      ctx.stroke();
    }
  });

  const porX = new Map(pontos.map((p) => [xPonto(p), p]));
  montar(el, {
    scales: { x: { time: false, range: () => faixaX }, y: { range: () => faixaY } },
    legend: { show: false },
    cursor: { y: false, drag: { x: false, y: false }, points: { show: false } },
    axes: eixos('Velocidade (cm/ano)'),
    series,
    hooks: {
      drawSeries: [(u, sidx) => { if (sidx === 8) desenharIntervalos(u); }],
      draw: [rotularCurvas(rotulos)],
      setCursor: [leitura(alvos.leitura, (idx, u) => {
        const x = u.data[0][idx];
        const p = porX.get(x);
        if (p) {
          const z = p.avaliacao.naoAvaliavel ? 'sem z' : `z ${virgula(p.avaliacao.z, 2).replace('-', '−')}`;
          return `VC de ${virgula(p.intervalo.vc, 1)} cm/ano em ${virgula(p.intervalo.meses, 1)} meses (ponto médio aos ${virgula(x, 2)} anos), ${z}`;
        }
        const p50 = u.data[4][idx];
        const p25 = u.data[3][idx];
        if (p50 === null || p50 === undefined) return '';
        return `Aos ${virgula(x, 2)} anos: P50 ${virgula(p50, 1)} cm/ano; P25 ${virgula(p25, 1)} cm/ano`;
      })],
    },
  }, [xs, ...refs, col((c) => c.guia), col((c) => c.vc), col((c) => c.par)]);

  alvos.legenda.append(
    itemLegenda(linhaSvg(COR.mediana, '', 2), 'P50'),
    itemLegenda(linhaSvg(COR.p25, '6 3', 1.5), 'P25 (limite do C2)'),
    itemLegenda(linhaSvg(COR.centil, '', 1), 'P3, P10, P75, P90, P97'),
    itemLegenda(linhaSvg(COR.guia, '2 4', 1.5), 'Guia SBP (7 e 6 cm/ano)'),
    itemLegenda(pontoSvg(COR.paciente, true), 'VC do paciente (barra = intervalo)'),
    itemLegenda(pontoSvg(COR.paciente), 'VC usada no checklist'),
  );
  const fontes = document.createElement('li');
  fontes.textContent = `Curvas: ${[...new Set(segmentos.map((s) => s.rotulo))].join('; ')}.`;
  alvos.legenda.append(fontes);
}
