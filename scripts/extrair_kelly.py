#!/usr/bin/env python3
"""Extrai as Tabelas Suplementares 2a e 2b de Kelly et al. 2014 para o JSON carregável.

Uso:
    python3 scripts/extrair_kelly.py --pdf referencias-restritas/kelly-2014-suplementar.pdf \
        --saida referencias-restritas/kelly-2014.json

O PDF e o JSON são material protegido (Endocrine Society): NUNCA versionar. Ficam em
referencias-restritas/ (ignorada pelo git) e no Drive.

Método: o texto do PDF é extraível (sem OCR). Cada número é atribuído à coluna pela posição
horizontal, porque na Tabela 2b há blocos vazios em algumas idades. Autoverificação: os
percentis impressos são recalculados por LMS; desvio acima de TOLERANCIA aborta a extração.

Dependência: pdfplumber.
"""
import argparse
import datetime
import json
import math
import re
import sys
from collections import defaultdict

NUMERO = re.compile(r"^-?\d+\.\d+$")
COLUNAS_BLOCO = ["L", "S", "p3", "p10", "p50", "p90", "p97"]
Z = {"p3": -1.8807936, "p10": -1.2815516, "p50": 0.0, "p90": 1.2815516, "p97": 1.8807936}
# L e S têm 2 casas e os percentis 1 casa: o recálculo não é exato. Além disso, a coluna P90 impressa
# fica sistematicamente acima do recálculo por LMS com z = 1,2816 (até 0,30 cm/ano neste PDF), enquanto
# P3, P10 e P97 ficam dentro do arredondamento. É característica da fonte, registrada no JSON gerado.
# Acima de TOLERANCIA assume-se erro de coluna e a extração é abortada.
TOLERANCIA = 0.35


def linhas_de_palavras(palavras, folga=3):
    """Agrupa palavras (dicts com text, x0, x1, top) em linhas, de cima para baixo."""
    linhas = []
    for p in sorted(palavras, key=lambda w: (w["top"], w["x0"])):
        if linhas and abs(linhas[-1][0]["top"] - p["top"]) <= folga:
            linhas[-1].append(p)
        else:
            linhas.append([p])
    return [sorted(l, key=lambda w: w["x0"]) for l in linhas]


def eh_linha_de_dados(linha):
    return len(linha) >= 8 and all(NUMERO.match(w["text"]) for w in linha) \
        and re.match(r"^\d+\.\d\d$", linha[0]["text"])


def centro(w):
    return (w["x0"] + w["x1"]) / 2


def atribuir_colunas(linha, ancoras):
    """Devolve {indice_da_coluna: valor} pela âncora horizontal mais próxima."""
    saida = {}
    for w in linha:
        i = min(range(len(ancoras)), key=lambda k: abs(ancoras[k] - centro(w)))
        if i in saida:
            raise ValueError(f"duas palavras na mesma coluna: {[x['text'] for x in linha]}")
        saida[i] = float(w["text"])
    return saida


def nova_tabela():
    return {"idade": [], "L": [], "S": [], "M": [], "p3": [], "p10": [], "p50": [], "p90": [], "p97": []}


def acrescentar(tabela, idade, bloco):
    tabela["idade"].append(idade)
    for c in COLUNAS_BLOCO:
        tabela[c].append(bloco[c])
    tabela["M"].append(bloco["p50"])  # a coluna M da tabela é a do percentil 50


def percentil_lms(L, M, S, z):
    if abs(L) < 1e-9:
        return M * math.exp(S * z)
    base = 1 + L * S * z
    return M * base ** (1 / L) if base > 0 else float("nan")


def verificar(tabela, nome, por_percentil=None):
    """Maior desvio entre percentis impressos e recalculados por LMS."""
    pior = 0.0
    if por_percentil is None:
        por_percentil = {}
    for i, idade in enumerate(tabela["idade"]):
        for p, z in Z.items():
            calc = percentil_lms(tabela["L"][i], tabela["M"][i], tabela["S"][i], z)
            if tabela[p][i] is None:
                if not math.isnan(calc) and calc > 0.25:
                    raise SystemExit(f"{nome}, idade {idade}, {p}: em branco no PDF, mas o LMS dá {calc:.2f}")
                continue
            if math.isnan(calc):
                continue
            desvio = abs(calc - tabela[p][i])
            pior = max(pior, desvio)
            por_percentil[p] = max(por_percentil.get(p, 0.0), desvio)
            if desvio > TOLERANCIA:
                raise SystemExit(f"{nome}, idade {idade}, {p}: impresso {tabela[p][i]}, "
                                 f"recalculado {calc:.2f} – provável erro de coluna")
        passos = [round(b - a, 2) for a, b in zip(tabela["idade"], tabela["idade"][1:])]
    if any(p != 0.25 for p in passos):
        raise SystemExit(f"{nome}: idades fora do passo de 0,25 ano")
    return pior


def extrair(caminho_pdf):
    import pdfplumber

    t2a = {"M": nova_tabela(), "F": nova_tabela()}
    t2b = {s: {g: nova_tabela() for g in ("precoce", "media", "tardia")} for s in ("M", "F")}
    modo, sexo = None, None
    with pdfplumber.open(caminho_pdf) as pdf:
        for pagina in pdf.pages:
            linhas = linhas_de_palavras(pagina.extract_words())
            textos = [" ".join(w["text"] for w in l) for l in linhas]
            for t in textos:
                if t.startswith("Supplemental Table 2a"):
                    modo = "2a"
                elif t.startswith("Supplemental Table 2b"):
                    modo, sexo = "2b", "M"
                elif t == "Females" and modo == "2b":
                    sexo = "F"
                elif t.startswith("Supplementary File Figure"):
                    modo = None
            if modo is None:
                continue
            dados = [l for l in linhas if eh_linha_de_dados(l)]
            if not dados:
                continue
            n_colunas = 15 if modo == "2a" else 22
            completas = [l for l in dados if len(l) == n_colunas]
            if not completas:
                raise SystemExit(f"página {pagina.page_number}: nenhuma linha completa para ancorar colunas")
            ancoras = [sum(centro(l[i]) for l in completas) / len(completas) for i in range(n_colunas)]
            for l in dados:
                col = atribuir_colunas(l, ancoras)
                idade = col[0]
                grupos = ["M", "F"] if modo == "2a" else ["precoce", "media", "tardia"]
                for g, nome in enumerate(grupos):
                    indices = range(1 + 7 * g, 8 + 7 * g)
                    presentes = [i for i in indices if i in col]
                    if not presentes:
                        continue
                    bloco = dict(zip(COLUNAS_BLOCO, (col.get(i) for i in indices)))
                    # O PDF deixa em branco percentis que o LMS não define (1 + L·S·z <= 0);
                    # L, S e M (P50) são sempre obrigatórios.
                    if any(bloco[c] is None for c in ("L", "S", "p50")):
                        raise SystemExit(f"página {pagina.page_number}, idade {idade}: bloco {nome} incompleto")
                    acrescentar(t2a[nome] if modo == "2a" else t2b[sexo][nome], idade, bloco)
    return t2a, t2b


def montar(t2a, t2b):
    pior, por_p = 0.0, {}
    for s in ("M", "F"):
        pior = max(pior, verificar(t2a[s], f"2a {s}", por_p))
        for g, t in t2b[s].items():
            pior = max(pior, verificar(t, f"2b {s} {g}", por_p))
    desvios = {p: round(v, 3) for p, v in por_p.items()}
    return {
        "formato": "curvas-crescimento-referencia",
        "versaoFormato": 1,
        "tipo": "kelly2014",
        "fonte": {
            "citacao": "Kelly A, Winer KK, Kalkwarf H, et al. Age-based reference ranges for annual height "
                       "velocity in US children. J Clin Endocrinol Metab. 2014;99(6):2104-12. "
                       "Supplemental Tables 2a e 2b.",
            "doi": "10.1210/jc.2013-4455",
            "direitos": "Copyright Endocrine Society. Uso restrito; não redistribuir.",
        },
        "geradoEm": datetime.date.today().isoformat(),
        "metodo": "Texto extraído do PDF suplementar com pdfplumber (scripts/extrair_kelly.py); colunas "
                  "atribuídas pela posição horizontal. Autoverificação: percentis impressos recalculados "
                  f"por LMS, maior desvio {pior:.2f} cm/ano (limite {TOLERANCIA}). A ferramenta calcula z "
                  "e curvas por L, M e S; os percentis impressos servem só de conferência.",
        "condicao": "Velocidade anual: intervalo de 11 a 13 meses. Idade = ponto médio do intervalo, em anos.",
        "maiorDesvioAutoverificacao": round(pior, 3),
        "desvioPorPercentil": desvios,
        "tabelas": {"2a": t2a, "2b": t2b},
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--saida", required=True)
    a = ap.parse_args(argv)
    obj = montar(*extrair(a.pdf))
    with open(a.saida, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    t = obj["tabelas"]
    print(f"2a: M {len(t['2a']['M']['idade'])} linhas, F {len(t['2a']['F']['idade'])} linhas")
    for s in ("M", "F"):
        print(f"2b {s}: " + ", ".join(f"{g} {len(tb['idade'])}" for g, tb in t["2b"][s].items()))
    print(f"maior desvio na autoverificação: {obj['maiorDesvioAutoverificacao']} cm/ano "
          f"(por percentil: {obj['desvioPorPercentil']})")
    print(f"gravado em {a.saida}")


if __name__ == "__main__":
    sys.exit(main())
