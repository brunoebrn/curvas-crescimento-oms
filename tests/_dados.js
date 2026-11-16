// Carrega as tabelas públicas de data/ para os testes (sem rede).
import { readFileSync } from 'node:fs';

const ler = (nome) => JSON.parse(readFileSync(new URL(`../data/${nome}`, import.meta.url), 'utf8'));

export const t2006 = ler('oms-estatura-2006.json');
export const t2007 = ler('oms-estatura-2007.json');
export const oms2009 = ler('oms-velocidade-2009.json');

export function perto(real, esperado, tol, msg = '') {
  if (!(Math.abs(real - esperado) <= tol)) {
    throw new Error(`${msg} esperado ${esperado} ± ${tol}, obtido ${real}`);
  }
}
