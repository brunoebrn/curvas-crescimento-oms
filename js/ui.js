// Interface: estado só em memória (nada de localStorage, cookies ou rede além dos arquivos do próprio site).

import { calcular } from './modelo.js';
import { validarReferencia } from './referencias.js';
import { desenharEstatura, desenharVc } from './graficos.js';
import { formatarIdade, hojeIso } from './idade.js';
import { EXEMPLO } from './exemplo.js';

const $ = (id) => document.getElementById(id);
const MENOS = '−';

// ---------------------------------------------------------------- estado

let proximoId = 1;
const novaMedida = (dados = {}) => ({
  id: `m${proximoId++}`, modo: 'data', data: '', anos: '', meses: '', cm: '', ...dados,
});

const estado = {
  sexo: '',
  nascimento: '',
  pai: '',
  mae: '',
  medidas: [novaMedida(), novaMedida()],
  kelly: null,
  tanner: null,
  arquivos: { kelly: '', tanner: '' },
  preferencia: 'kelly',
  kellyTabela: '2a',
  par: null,
  manual: {},
  vistaEstatura: 'medidas',
  vistaVc: 'medidas',
};
let tabelas = null;
let resultado = null;

// ---------------------------------------------------------------- formatação

const num = (v, casas = 1) => v.toFixed(casas).replace('.', ',');
const fmtZ = (z) => {
  if (z === null || z === undefined || Number.isNaN(z)) return '–';
  if (!Number.isFinite(z)) return z < 0 ? `${MENOS}∞` : '+∞';
  return `${z < 0 ? MENOS : '+'}${num(Math.abs(z), 2)}`;
};
const fmtPercentil = (p) => {
  if (p === null || p === undefined || Number.isNaN(p)) return '–';
  if (p < 0.1) return '< 0,1';
  if (p > 99.9) return '> 99,9';
  return num(p, 1);
};
const fmtData = (iso) => (iso ? iso.split('-').reverse().join('/') : '–');
const ROTULO_STATUS = { atende: 'Atende', 'nao-atende': 'Não atende', 'nao-avaliavel': 'Não avaliável' };
const TEXTO_ALERTA = {
  'intervalo-curto': 'Intervalo menor que 6 meses: VC pouco confiável.',
  'vc-negativa': 'VC negativa: provável erro de medida.',
};

function criar(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...filhos.filter((f) => f !== null && f !== undefined));
  return el;
}

// ---------------------------------------------------------------- medidas (entrada)

const ICONE_REMOVER = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

function linhaMedida(m, indice) {
  const n = indice + 1;
  const li = criar('li', { class: 'medida', 'data-id': m.id });
  const campo = (rotulo, input, classe) => {
    const id = `${m.id}-${input.dataset.campo}`;
    input.id = id;
    return criar('div', { class: classe }, criar('label', { for: id, text: rotulo }), input);
  };
  const entrada = (campoNome, attrs) => {
    const el = criar('input', { autocomplete: 'off', ...attrs });
    el.dataset.campo = campoNome;
    el.value = m[campoNome] ?? '';
    el.addEventListener('input', () => { m[campoNome] = el.value; agendar(); });
    return el;
  };

  const modo = criar('select', {},
    criar('option', { value: 'data', text: 'Data' }),
    criar('option', { value: 'idade', text: 'Idade' }));
  modo.dataset.campo = 'modo';
  modo.value = m.modo;
  modo.addEventListener('change', () => { m.modo = modo.value; renderMedidas(); atualizar(); });

  let quando;
  if (m.modo === 'idade') {
    const anos = entrada('anos', { type: 'text', inputmode: 'numeric', placeholder: 'anos', 'aria-label': `Medida ${n}: idade, anos` });
    const meses = entrada('meses', { type: 'text', inputmode: 'decimal', placeholder: 'meses', 'aria-label': `Medida ${n}: idade, meses` });
    anos.id = `${m.id}-anos`;
    quando = criar('div', { class: 'c-quando' },
      criar('label', { for: anos.id, text: 'Idade (anos, meses)' }),
      criar('div', { class: 'idade-dupla' }, anos, meses));
  } else {
    quando = campo('Data da medida', entrada('data', { type: 'date' }), 'c-quando');
  }

  const remover = criar('button', {
    type: 'button', class: 'botao-icone', 'aria-label': `Remover medida ${n}`, title: 'Remover medida',
    onclick: () => {
      estado.medidas = estado.medidas.filter((x) => x.id !== m.id);
      if (!estado.medidas.length) estado.medidas.push(novaMedida());
      renderMedidas();
      atualizar();
    },
  });
  remover.innerHTML = ICONE_REMOVER;

  li.append(
    criar('div', { class: 'medida-campos' },
      campo(`Medida ${n}`, modo, 'c-modo'),
      quando,
      campo('Estatura (cm)', entrada('cm', { type: 'text', inputmode: 'decimal' }), 'c-cm'),
      criar('div', { class: 'c-rem' }, remover)),
    criar('ul', { class: 'medida-msgs', 'aria-live': 'polite' }),
  );
  return li;
}

function renderMedidas() {
  $('medidas').replaceChildren(...estado.medidas.map(linhaMedida));
}

function renderMensagensMedidas() {
  for (const linha of resultado.linhas) {
    const li = $('medidas').querySelector(`[data-id="${linha.id}"]`);
    if (!li) continue;
    const msgs = [
      ...linha.erros.map((t) => criar('li', { class: 'msg-erro', text: t })),
      ...linha.alertas.map((t) => criar('li', { class: 'msg-alerta', text: t })),
    ];
    li.querySelector('.medida-msgs').replaceChildren(...msgs);
    li.querySelectorAll('input').forEach((i) => i.setAttribute('aria-invalid', linha.erros.length ? 'true' : 'false'));
  }
}

// ---------------------------------------------------------------- referências

function renderRefs() {
  const item = (chave, nome, dados) => {
    const li = criar('li', {}, criar('span', { text: nome }));
    if (!dados) {
      li.append(criar('span', { class: 'estado', text: 'Não carregado.' }));
      return li;
    }
    li.append(criar('button', {
      type: 'button', class: 'botao botao-discreto', text: 'Remover',
      onclick: () => { estado[chave] = null; estado.arquivos[chave] = ''; renderRefs(); atualizar(); },
    }));
    const partes = [`Ativo: ${estado.arquivos[chave]}`, `gerado em ${fmtData(dados.geradoEm)}`];
    if (chave === 'tanner') {
      partes.push(`erro máximo do P50: ${String(dados.validacao.erroMaximo).replace('.', ',')} cm/ano`
        + (dados.validacao.baixaConfianca ? ' (BAIXA CONFIANÇA)' : ''));
    }
    li.append(criar('span', { class: 'estado ativo', text: partes.join(' · ') }));
    return li;
  };
  $('refs').replaceChildren(
    item('kelly', 'Kelly 2014 (a partir de 5,5 anos)', estado.kelly),
    item('tanner', 'Tanner & Davies 1985 (2 a 19 anos)', estado.tanner),
  );
  const ambas = Boolean(estado.kelly && estado.tanner);
  document.querySelectorAll('input[name="preferencia"]').forEach((r) => { r.disabled = !ambas; });
  $('kellyTabela').disabled = !estado.kelly;
}

async function carregarArquivos(arquivos) {
  const msgs = [];
  for (const arq of arquivos) {
    let obj;
    try {
      obj = JSON.parse(await arq.text());
    } catch {
      msgs.push({ erro: true, texto: `${arq.name}: não é um JSON válido.` });
      continue;
    }
    const v = validarReferencia(obj);
    if (!v.ok) {
      msgs.push({ erro: true, texto: `${arq.name}: ${v.erros.slice(0, 3).join(' ')}` });
      continue;
    }
    const chave = v.tipo === 'kelly2014' ? 'kelly' : 'tanner';
    estado[chave] = v.dados;
    estado.arquivos[chave] = arq.name;
    msgs.push({ erro: false, texto: `${arq.name}: carregado (${chave === 'kelly' ? 'Kelly 2014' : 'Tanner & Davies 1985'}).` });
    v.avisos.forEach((t) => msgs.push({ erro: false, alerta: true, texto: `${arq.name}: ${t}` }));
  }
  $('msgArquivo').replaceChildren(...msgs.map((m) => criar('p', {
    class: `msg-arquivo ${m.erro ? 'msg-erro' : (m.alerta ? 'msg-alerta' : '')}`, text: m.texto,
  })));
  renderRefs();
  atualizar();
}

// ---------------------------------------------------------------- saídas

function renderAlvo() {
  const a = resultado.alvo;
  const el = $('alvo');
  if (!a) {
    el.textContent = resultado.sexo
      ? 'Estatura-alvo: informe as estaturas do pai e da mãe.'
      : 'Estatura-alvo: informe o sexo e as estaturas dos pais.';
    return;
  }
  el.replaceChildren(
    'Estatura-alvo (SBP 2023): ',
    criar('strong', { text: `${num(a.alvo)} cm` }),
    ` (${num(a.min)} a ${num(a.max)} cm), z ${fmtZ(a.zAlvo)} aos 19 anos (faixa ${fmtZ(a.zMin)} a ${fmtZ(a.zMax)}).`,
  );
}

const rotuloMedida = (m) => formatarIdade(m.dias);

function renderPar() {
  const sel = $('par');
  const ms = resultado.medidas;
  const opcoes = [criar('option', { value: '', text: 'Intervalo mais recente (automático)' })];
  for (let j = ms.length - 1; j >= 1; j -= 1) {
    for (let i = j - 1; i >= 0; i -= 1) {
      const meses = (ms[j].dias - ms[i].dias) / 30.4375;
      opcoes.push(criar('option', {
        value: `${ms[i].id}|${ms[j].id}`,
        text: `${rotuloMedida(ms[i])} → ${rotuloMedida(ms[j])} (${num(meses)} meses)`,
      }));
    }
  }
  sel.replaceChildren(...opcoes);
  const pu = resultado.parUsado;
  sel.value = pu && pu.origem === 'escolhido' ? `${pu.a}|${pu.b}` : '';
  if (!pu || pu.origem !== 'escolhido') estado.par = null;
  sel.disabled = ms.length < 2;

  const sug = $('sugestao');
  const s = resultado.sugestaoPar;
  if (!s) {
    sug.hidden = true;
    sug.replaceChildren();
    return;
  }
  sug.hidden = false;
  sug.replaceChildren(
    criar('span', { text: `O intervalo em uso tem ${num(pu.intervalo.meses)} meses. Há um par de ${num(s.anos * 12)} meses terminando na última medida.` }),
    criar('button', {
      type: 'button', class: 'botao botao-discreto', text: 'Usar par de cerca de 12 meses',
      onclick: () => { estado.par = { a: s.a, b: s.b }; atualizar(); },
    }),
  );
}

const DEFINICOES = {
  C1: 'Estatura abaixo de −3 DP.',
  C2: 'Estatura entre −3 e −2 DP e VC abaixo do P25.',
  C3: 'Estatura igual ou acima de −2 DP e VC abaixo de −1 DP em 12 meses.',
};

function renderCriterios() {
  const itens = Object.entries(resultado.criterios).map(([chave, c]) => {
    const cab = criar('div', { class: 'criterio-cab' },
      criar('h3', { text: chave }),
      criar('span', { class: `selo selo-${c.status}`, text: ROTULO_STATUS[c.status] }),
      c.origem === 'manual' ? criar('span', { class: 'selo selo-manual', text: 'classificação manual' }) : null);
    const corpo = criar('div', {}, cab, criar('p', { class: 'definicao', text: DEFINICOES[chave] }));
    if (c.origem === 'manual') {
      corpo.append(criar('p', { class: 'motivo', text: c.motivo }),
        criar('p', { class: 'meta', text: `Automático: ${ROTULO_STATUS[c.automatico.status].toLowerCase()}. ${c.automatico.motivo}` }));
    } else {
      corpo.append(criar('p', { class: 'motivo', text: c.motivo }));
      if (c.referencia) corpo.append(criar('p', { class: 'meta', text: `Referência: ${c.referencia}.` }));
      if (c.ressalvas.length) corpo.append(criar('ul', { class: 'ressalvas' }, ...c.ressalvas.map((t) => criar('li', { text: t }))));
    }
    const idSel = `manual-${chave}`;
    const sel = criar('select', { id: idSel },
      criar('option', { value: '', text: 'Automática' }),
      criar('option', { value: 'atende', text: 'Manual: atende' }),
      criar('option', { value: 'nao-atende', text: 'Manual: não atende' }));
    sel.value = estado.manual[chave] ?? '';
    sel.addEventListener('change', () => {
      estado.manual[chave] = sel.value;
      atualizar();
      $(idSel)?.focus();
    });
    return criar('li', { class: 'criterio', 'data-criterio': chave, 'data-status': c.status, 'data-origem': c.origem },
      corpo,
      criar('div', {}, criar('label', { for: idSel, text: `Classificação de ${chave}` }), sel));
  });
  $('criterios').replaceChildren(...itens);
}

function tabela(colunas, linhas, legenda) {
  const thead = criar('thead', {}, criar('tr', {}, ...colunas.map((c) => criar('th', { scope: 'col', class: c.classe, text: c.titulo }))));
  // cada linha pode trazer observações, mostradas numa segunda linha de largura total
  const tbody = criar('tbody', {}, ...linhas.flatMap((l) => {
    const temObs = Boolean(l.obs?.length);
    const tr = criar('tr', { class: [l.classe, temObs ? 'com-obs' : ''].filter(Boolean).join(' ') || null },
      ...colunas.map((c, i) => criar('td', { class: c.classe, text: l.celulas[i] })));
    if (!temObs) return [tr];
    return [tr, criar('tr', { class: ['obs', l.classe].filter(Boolean).join(' ') },
      criar('td', { colspan: String(colunas.length) }, criar('ul', {}, ...l.obs.map((t) => criar('li', { text: t })))))];
  }));
  return criar('div', { class: 'rolagem', tabindex: '0', role: 'region', 'aria-label': legenda },
    criar('table', {}, criar('caption', { class: 'oculto-visual', text: legenda }), thead, tbody));
}

function renderTabelas() {
  const ms = resultado.medidas;
  const datas = new Map(estado.medidas.map((m) => [m.id, m.modo === 'data' ? m.data : '']));
  if (!ms.length) {
    $('tabMedidas').replaceChildren(criar('p', { class: 'vazio', text: 'Sem medidas válidas. Preencha sexo e ao menos uma medida para ver z e percentil.' }));
  } else {
    $('tabMedidas').replaceChildren(tabela(
      [{ titulo: 'Idade' }, { titulo: 'Data', classe: 'txt' }, { titulo: 'Estatura (cm)' }, { titulo: 'z' }, { titulo: 'Percentil' }, { titulo: 'Tabela', classe: 'txt' }],
      ms.map((m) => ({
        celulas: [
          `${rotuloMedida(m)} (${num(m.idadeAnos, 2)} a)`, fmtData(datas.get(m.id)), num(m.cm), fmtZ(m.z), fmtPercentil(m.percentil), m.fonte ?? 'informe o sexo',
        ],
      })),
      'Resultados por medida',
    ));
  }

  const porId = new Map(ms.map((m) => [m.id, m]));
  const linhasInt = resultado.intervalos.map((i) => ({ ...i }));
  const pu = resultado.parUsado;
  if (pu && !linhasInt.some((i) => i.a === pu.a && i.b === pu.b)) linhasInt.push({ ...pu });
  if (!linhasInt.length) {
    $('tabIntervalos').replaceChildren(criar('p', { class: 'vazio', text: 'São necessárias duas medidas válidas para calcular a velocidade de crescimento.' }));
    return;
  }
  $('tabIntervalos').replaceChildren(tabela(
    [{ titulo: 'Período (idade)' }, { titulo: 'Duração' }, { titulo: 'VC (cm/ano)' }, { titulo: 'Variação do z de estatura' },
      { titulo: 'Referência', classe: 'txt' }, { titulo: 'z da VC' }, { titulo: 'Percentil' }],
    linhasInt.map((i) => {
      const av = i.avaliacao;
      const emUso = pu && i.a === pu.a && i.b === pu.b;
      const obs = [
        ...(emUso ? ['Intervalo usado no checklist.'] : []),
        ...i.intervalo.alertas.map((a) => TEXTO_ALERTA[a]),
        ...(av.naoAvaliavel ? [av.motivo] : av.ressalvas),
        ...(av.guiaSbp ? [`Guia SBP para a idade: cerca de ${av.guiaSbp} cm/ano.`] : []),
      ];
      return {
        classe: emUso ? 'em-uso' : '',
        celulas: [
          `${rotuloMedida(porId.get(i.a))} → ${rotuloMedida(porId.get(i.b))}`,
          `${num(i.intervalo.meses)} meses`,
          num(i.intervalo.vc),
          fmtZ(i.deltaZ),
          av.referencia ?? 'não avaliável',
          av.naoAvaliavel ? '–' : (av.limitado ? `${av.z < 0 ? '≤' : '≥'} ${fmtZ(av.z)}` : fmtZ(av.z)),
          av.naoAvaliavel ? '–' : (av.limitado ? (av.z < 0 ? '< 3' : '> 97') : fmtPercentil(av.percentil)),
        ],
        obs,
      };
    }),
    'Resultados por intervalo',
  ));
}

function renderGraficos() {
  desenharEstatura({ el: $('grafEstatura'), leitura: $('leituraEstatura'), legenda: $('legEstatura') }, resultado, estado.vistaEstatura);
  desenharVc({ el: $('grafVc'), leitura: $('leituraVc'), legenda: $('legVc') }, resultado, estado, tabelas, estado.vistaVc);
}

// ---------------------------------------------------------------- ciclo

function atualizar() {
  if (!tabelas) return;
  resultado = calcular({ ...estado, hoje: hojeIso() }, tabelas);
  renderMensagensMedidas();
  renderAlvo();
  renderPar();
  renderCriterios();
  renderTabelas();
  renderGraficos();
}

let temporizador = null;
function agendar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(atualizar, 200);
}

function sincronizarCampos() {
  document.querySelectorAll('input[name="sexo"]').forEach((r) => { r.checked = r.value === estado.sexo; });
  $('nascimento').value = estado.nascimento;
  $('pai').value = estado.pai;
  $('mae').value = estado.mae;
  renderMedidas();
}

function novoPaciente(dados = null) {
  estado.sexo = dados?.sexo ?? '';
  estado.nascimento = dados?.nascimento ?? '';
  estado.pai = dados?.pai ?? '';
  estado.mae = dados?.mae ?? '';
  estado.medidas = dados ? dados.medidas.map((m) => novaMedida(m)) : [novaMedida(), novaMedida()];
  estado.par = null;
  estado.manual = {};
  sincronizarCampos();
  atualizar();
}

function ligarEventos() {
  document.querySelectorAll('input[name="sexo"]').forEach((r) => r.addEventListener('change', () => { estado.sexo = r.value; atualizar(); }));
  $('nascimento').max = hojeIso();
  for (const campo of ['nascimento', 'pai', 'mae']) {
    $(campo).addEventListener('input', () => { estado[campo] = $(campo).value; agendar(); });
  }
  $('btnAdicionar').addEventListener('click', () => {
    const ultima = estado.medidas.at(-1);
    const nova = novaMedida({ modo: ultima?.modo ?? 'data' });
    estado.medidas.push(nova);
    renderMedidas();
    atualizar();
    $('medidas').querySelector(`[data-id="${nova.id}"] input`)?.focus();
  });
  $('btnExemplo').addEventListener('click', () => novoPaciente(EXEMPLO));
  $('btnLimpar').addEventListener('click', () => novoPaciente());
  $('arquivos').addEventListener('change', (e) => { carregarArquivos([...e.target.files]); e.target.value = ''; });
  document.querySelectorAll('input[name="preferencia"]').forEach((r) => r.addEventListener('change', () => { estado.preferencia = r.value; atualizar(); }));
  $('kellyTabela').addEventListener('change', (e) => { estado.kellyTabela = e.target.value; atualizar(); });
  $('par').addEventListener('change', (e) => {
    const [a, b] = e.target.value.split('|');
    estado.par = b ? { a, b } : null;
    atualizar();
  });
  for (const [nome, chave] of [['vistaEstatura', 'vistaEstatura'], ['vistaVc', 'vistaVc']]) {
    document.querySelectorAll(`input[name="${nome}"]`).forEach((r) => r.addEventListener('change', () => { estado[chave] = r.value; renderGraficos(); }));
  }
}

async function iniciar() {
  ligarEventos();
  sincronizarCampos();
  renderRefs();
  try {
    const ler = async (nome) => {
      const resp = await fetch(`data/${nome}`);
      if (!resp.ok) throw new Error(`${nome}: HTTP ${resp.status}`);
      return resp.json();
    };
    const [t2006, t2007, oms2009] = await Promise.all([
      ler('oms-estatura-2006.json'), ler('oms-estatura-2007.json'), ler('oms-velocidade-2009.json'),
    ]);
    tabelas = { t2006, t2007, oms2009 };
  } catch (e) {
    const el = $('erroGeral');
    el.hidden = false;
    el.textContent = `Não foi possível carregar as tabelas da OMS (${e.message}). Abra a página por um servidor HTTP `
      + '(GitHub Pages ou "python3 -m http.server"), não direto do arquivo.';
    return;
  }
  atualizar();
  document.documentElement.dataset.pronto = '1';
}

iniciar();
