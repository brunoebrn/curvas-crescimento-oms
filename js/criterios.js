// Critérios auxológicos de investigação do PCDT de deficiência de GH
// (Portaria Conjunta SAS/SCTIE nº 28, de 30/11/2018, item 3.1).
//
//   C1: estatura < −3 DP.
//   C2: estatura entre −3 e −2 DP e VC < P25.
//   C3: estatura ≥ −2 DP e VC < −1 DP em 12 meses.
//
// Atender a um critério indica investigação; a inclusão exige ainda teste de estímulo (item 4).

import { quantil } from './normal.js';

export const Z_P25 = quantil(0.25);
const JANELA_MIN_ANOS = 0.85;
const JANELA_MAX_ANOS = 1.15;

const fmt = (z) => (Number.isFinite(z) ? z.toFixed(2).replace('.', ',').replace('-', '−') : '−∞');

function resultado(status, motivo, extra = {}) {
  return { status, motivo, referencia: extra.referencia ?? 'OMS (estatura para idade)', ressalvas: extra.ressalvas ?? [] };
}

function c1(z) {
  if (z === null) return resultado('nao-avaliavel', 'Sem medida de estatura válida.');
  return z < -3
    ? resultado('atende', `Estatura com z = ${fmt(z)}, abaixo de −3 DP.`)
    : resultado('nao-atende', `Estatura com z = ${fmt(z)}, não está abaixo de −3 DP.`);
}

function vcIndisponivel(vc) {
  if (!vc) return 'Sem intervalo de VC: são necessárias duas medidas válidas.';
  if (vc.naoAvaliavel) return `VC não avaliável: ${vc.motivo}`;
  return null;
}

function c2(z, vc) {
  if (z === null) return resultado('nao-avaliavel', 'Sem medida de estatura válida.');
  if (!(z >= -3 && z < -2)) return resultado('nao-atende', `Estatura com z = ${fmt(z)}, fora da faixa de −3 a −2 DP.`);
  const falta = vcIndisponivel(vc);
  if (falta) return resultado('nao-avaliavel', `Estatura na faixa (z = ${fmt(z)}). ${falta}`);
  const extra = { referencia: vc.referencia, ressalvas: vc.ressalvas };
  return vc.z < Z_P25
    ? resultado('atende', `Estatura com z = ${fmt(z)} e VC com z = ${fmt(vc.z)}, abaixo do P25.`, extra)
    : resultado('nao-atende', `Estatura com z = ${fmt(z)}, mas VC com z = ${fmt(vc.z)}, não está abaixo do P25.`, extra);
}

function c3(z, vc) {
  if (z === null) return resultado('nao-avaliavel', 'Sem medida de estatura válida.');
  if (z < -2) return resultado('nao-atende', `Estatura com z = ${fmt(z)}, abaixo de −2 DP.`);
  const falta = vcIndisponivel(vc);
  if (falta) return resultado('nao-avaliavel', `Estatura na faixa (z = ${fmt(z)}). ${falta}`);
  const ressalvas = [...(vc.ressalvas ?? [])];
  const foraDaJanela = vc.anos < JANELA_MIN_ANOS || vc.anos > JANELA_MAX_ANOS;
  if (vc.chave === 'oms2009') {
    ressalvas.push('O critério pede VC em 12 meses; antes dos 2 anos a OMS só tem incrementos de até 6 meses.');
  } else if (foraDaJanela) {
    return resultado('nao-avaliavel', `Intervalo de ${vc.anos.toFixed(2).replace('.', ',')} ano: o critério pede VC em `
      + 'cerca de 12 meses (aceito de 0,85 a 1,15 ano). Escolha outro par de medidas ou classifique manualmente.',
    { referencia: vc.referencia, ressalvas });
  }
  const extra = { referencia: vc.referencia, ressalvas };
  return vc.z < -1
    ? resultado('atende', `Estatura com z = ${fmt(z)} e VC com z = ${fmt(vc.z)}, abaixo de −1 DP.`, extra)
    : resultado('nao-atende', `Estatura com z = ${fmt(z)}, mas VC com z = ${fmt(vc.z)}, não está abaixo de −1 DP.`, extra);
}

/**
 * @param dados {zEstatura:number|null, vc:object|null} `vc` = saída de avaliarVc acrescida de `anos` do intervalo
 * @param manual {C1?, C2?, C3?} com 'atende' ou 'nao-atende'; prevalece sobre o automático
 */
export function avaliarCriterios({ zEstatura, vc }, manual = {}) {
  const z = Number.isFinite(zEstatura) ? zEstatura : null;
  const auto = { C1: c1(z), C2: c2(z, vc), C3: c3(z, vc) };
  const saida = {};
  for (const [chave, a] of Object.entries(auto)) {
    const m = manual?.[chave];
    if (m === 'atende' || m === 'nao-atende') {
      saida[chave] = {
        ...a, status: m, motivo: 'Classificação manual do avaliador.', origem: 'manual', automatico: { status: a.status, motivo: a.motivo },
      };
    } else {
      saida[chave] = { ...a, origem: 'automatico', automatico: { status: a.status, motivo: a.motivo } };
    }
  }
  return saida;
}
