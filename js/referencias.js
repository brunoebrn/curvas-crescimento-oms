// Validação do arquivo de referência carregável (Kelly 2014 ou Tanner & Davies 1985).
// Formato único: JSON com metadados de fonte, versão e método (docs/HANDOFF.md).

export const FORMATO = 'curvas-crescimento-referencia';
export const VERSAO_FORMATO = 1;

const PERCENTIS_KELLY = ['p3', 'p10', 'p50', 'p90', 'p97'];
const PERCENTIS_TANNER = ['p3', 'p10', 'p25', 'p50', 'p75', 'p90', 'p97'];
const GRUPOS_2B = ['precoce', 'media', 'tardia'];

const ehVetorNumerico = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'number' && Number.isFinite(x));

function conferirVetores(obj, campos, onde, erros) {
  if (!obj || typeof obj !== 'object') {
    erros.push(`${onde}: bloco ausente.`);
    return false;
  }
  let ok = true;
  for (const c of campos) {
    if (!ehVetorNumerico(obj[c])) {
      erros.push(`${onde}: campo "${c}" ausente ou com valor não numérico.`);
      ok = false;
    }
  }
  if (!ok) return false;
  const n = obj.idade.length;
  if (campos.some((c) => obj[c].length !== n)) {
    erros.push(`${onde}: os vetores não têm o mesmo tamanho.`);
    return false;
  }
  if (n < 2) {
    erros.push(`${onde}: são necessárias pelo menos duas idades.`);
    return false;
  }
  if (obj.idade.some((a, i) => i > 0 && a <= obj.idade[i - 1])) {
    erros.push(`${onde}: as idades devem estar em ordem crescente.`);
    return false;
  }
  return true;
}

function conferirOrdem(obj, percentis, onde, erros) {
  for (let i = 0; i < obj.idade.length; i += 1) {
    for (let k = 1; k < percentis.length; k += 1) {
      if (obj[percentis[k]][i] < obj[percentis[k - 1]][i]) {
        erros.push(`${onde}: percentis fora de ordem na idade ${obj.idade[i]} (${percentis[k - 1]} > ${percentis[k]}).`);
        return;
      }
    }
  }
}

function conferirTabelaKelly(t, onde, erros) {
  const campos = ['idade', 'L', 'S', 'M'];
  if (!conferirVetores(t, campos, onde, erros)) return;
  if (t.S.some((s) => s <= 0)) erros.push(`${onde}: S deve ser positivo.`);
  if (t.M.some((m) => m <= 0)) erros.push(`${onde}: M deve ser positivo.`);
  // os percentis impressos são opcionais (servem de conferência), mas se vierem precisam ser coerentes
  if (PERCENTIS_KELLY.every((p) => p in t)) {
    if (conferirVetores(t, ['idade', ...PERCENTIS_KELLY], onde, erros)) conferirOrdem(t, PERCENTIS_KELLY, onde, erros);
  }
}

function validarKelly(obj, erros) {
  const tabelas = obj.tabelas;
  if (!tabelas || typeof tabelas !== 'object' || !tabelas['2a']) {
    erros.push('Kelly: bloco "tabelas" com a Tabela 2a é obrigatório.');
    return;
  }
  for (const sexo of ['M', 'F']) conferirTabelaKelly(tabelas['2a'][sexo], `Kelly 2a ${sexo}`, erros);
  if (tabelas['2b']) {
    for (const sexo of ['M', 'F']) {
      for (const grupo of GRUPOS_2B) {
        const t = tabelas['2b'][sexo]?.[grupo];
        if (t) conferirTabelaKelly(t, `Kelly 2b ${sexo} ${grupo}`, erros);
      }
    }
  }
}

function validarTanner(obj, erros, avisos) {
  if (!obj.curvas || typeof obj.curvas !== 'object') {
    erros.push('Tanner: bloco "curvas" é obrigatório.');
  } else {
    for (const sexo of ['M', 'F']) {
      const c = obj.curvas[sexo];
      const onde = `Tanner ${sexo}`;
      if (conferirVetores(c, ['idade', ...PERCENTIS_TANNER], onde, erros)) conferirOrdem(c, PERCENTIS_TANNER, onde, erros);
    }
  }
  const v = obj.validacao;
  if (!v || typeof v !== 'object' || typeof v.erroMaximo !== 'number' || typeof v.baixaConfianca !== 'boolean') {
    erros.push('Tanner: bloco "validacao" (erroMaximo, baixaConfianca) é obrigatório.');
  } else if (v.baixaConfianca) {
    avisos.push(`Digitalização de baixa confiança: erro máximo de ${String(v.erroMaximo).replace('.', ',')} cm/ano `
      + 'contra a tabela do P50 (aceite: 0,2 cm/ano).');
  }
}

/**
 * Valida o objeto lido de um arquivo de referência.
 * @returns {{ok:true, tipo:string, dados:object, avisos:string[]} | {ok:false, erros:string[]}}
 */
export function validarReferencia(obj) {
  if (!obj || typeof obj !== 'object' || obj.formato !== FORMATO) {
    return { ok: false, erros: [`Arquivo não reconhecido: esperado "formato": "${FORMATO}".`] };
  }
  if (obj.versaoFormato !== VERSAO_FORMATO) {
    return { ok: false, erros: [`Versão do formato não suportada: ${obj.versaoFormato} (esperada ${VERSAO_FORMATO}).`] };
  }
  const erros = [];
  const avisos = [];
  if (obj.tipo === 'kelly2014') validarKelly(obj, erros);
  else if (obj.tipo === 'tanner1985') validarTanner(obj, erros, avisos);
  else return { ok: false, erros: [`Tipo de referência desconhecido: "${obj.tipo}".`] };
  if (!obj.fonte || typeof obj.fonte.citacao !== 'string') erros.push('Metadado "fonte.citacao" é obrigatório.');
  if (erros.length) return { ok: false, erros };
  return { ok: true, tipo: obj.tipo, dados: obj, avisos };
}
