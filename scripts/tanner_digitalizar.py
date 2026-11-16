#!/usr/bin/env python3
"""Converte os pontos marcados sobre as Figuras 4 e 6 de Tanner & Davies 1985 no JSON carregável.

Uso:
    python3 scripts/tanner_digitalizar.py \
        --pontos-m referencias-restritas/tanner-pontos-M.csv \
        --pontos-f referencias-restritas/tanner-pontos-F.csv \
        --tabela-p50 referencias-restritas/tanner-tabela-p50.csv \
        --saida referencias-restritas/tanner-1985.json

Entradas (todas fora do repositório; material protegido, NUNCA versionar):
- CSV de pontos, exportado por scripts/tanner-marcador.html, colunas tipo,curva,x_px,y_px,idade,vc:
    calibracao,,x,y,idade,vc   pelo menos 4 cruzamentos da grade com idade (anos) e VC (cm/ano) conhecidas
    curva,p3,x,y,,             pontos ao longo de cada curva (p3, p10, p25, p50, p75, p90, p97)
- CSV do P50 numérico (Tabela I do artigo, maturação média), digitado a partir do PDF, colunas sexo,idade,p50.

Método: calibração afim por mínimos quadrados (pixel -> idade, VC), que absorve escala, deslocamento e
pequena rotação do escaneado; interpolação cúbica monotônica (Fritsch-Carlson) de cada curva em passo de
0,25 ano; validação do P50 digitalizado contra a tabela. Erro máximo acima do aceite (0,2 cm/ano) marca
o arquivo como de baixa confiança. Sem dependências além da biblioteca padrão.
"""
import argparse
import csv
import datetime
import json
import sys

PERCENTIS = ["p3", "p10", "p25", "p50", "p75", "p90", "p97"]
ACEITE = 0.2
IDADE_MIN, IDADE_MAX, PASSO = 2.0, 19.0, 0.25
FOLGA_EXTREMOS = 0.15  # anos: os pontos marcados podem começar/terminar até aqui dos extremos


# ------------------------------------------------------------------ álgebra

def resolver(a, b):
    """Resolve o sistema linear a·x = b por eliminação de Gauss com pivô parcial."""
    n = len(b)
    m = [linha[:] + [b[i]] for i, linha in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        if abs(m[p][c]) < 1e-12:
            raise ValueError("pontos de calibração colineares ou repetidos")
        m[c], m[p] = m[p], m[c]
        for r in range(c + 1, n):
            f = m[r][c] / m[c][c]
            for k in range(c, n + 1):
                m[r][k] -= f * m[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (m[r][n] - sum(m[r][k] * x[k] for k in range(r + 1, n))) / m[r][r]
    return x


def ajustar_afim(pontos):
    """pontos: [(x_px, y_px, idade, vc)]. Devolve (coef_idade, coef_vc), cada um (a, b, c): a·x + b·y + c."""
    if len(pontos) < 4:
        raise ValueError("são necessários pelo menos 4 pontos de calibração")
    linhas = [(x, y, 1.0) for x, y, _, _ in pontos]
    ata = [[sum(l[i] * l[j] for l in linhas) for j in range(3)] for i in range(3)]
    coefs = []
    for alvo in (2, 3):
        atb = [sum(l[i] * p[alvo] for l, p in zip(linhas, pontos)) for i in range(3)]
        coefs.append(tuple(resolver(ata, atb)))
    return coefs[0], coefs[1]


def aplicar(coef, x, y):
    return coef[0] * x + coef[1] * y + coef[2]


def residuos(pontos, c_idade, c_vc):
    """Maior resíduo da calibração em idade (anos) e em VC (cm/ano)."""
    r_idade = max(abs(aplicar(c_idade, x, y) - i) for x, y, i, _ in pontos)
    r_vc = max(abs(aplicar(c_vc, x, y) - v) for x, y, _, v in pontos)
    return r_idade, r_vc


# ------------------------------------------------------------------ interpolação

def pchip(xs, ys):
    """Interpolador cúbico monotônico (Fritsch-Carlson). xs estritamente crescentes."""
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        x = min(max(x, xs[0]), xs[-1])
        i = 0
        while i < n - 2 and x > xs[i + 1]:
            i += 1
        t = (x - xs[i]) / h[i]
        return ((2 * t**3 - 3 * t**2 + 1) * ys[i] + (t**3 - 2 * t**2 + t) * h[i] * m[i]
                + (-2 * t**3 + 3 * t**2) * ys[i + 1] + (t**3 - t**2) * h[i] * m[i + 1])
    return f


def grade():
    n = round((IDADE_MAX - IDADE_MIN) / PASSO)
    return [round(IDADE_MIN + k * PASSO, 2) for k in range(n + 1)]


# ------------------------------------------------------------------ leitura

def ler_pontos(caminho):
    calib, curvas = [], {p: [] for p in PERCENTIS}
    with open(caminho, newline="", encoding="utf-8") as f:
        for lin in csv.DictReader(f):
            x, y = float(lin["x_px"]), float(lin["y_px"])
            if lin["tipo"] == "calibracao":
                calib.append((x, y, float(lin["idade"]), float(lin["vc"])))
            elif lin["tipo"] == "curva":
                if lin["curva"] not in curvas:
                    raise SystemExit(f"{caminho}: curva desconhecida '{lin['curva']}'")
                curvas[lin["curva"]].append((x, y))
            else:
                raise SystemExit(f"{caminho}: tipo desconhecido '{lin['tipo']}'")
    return calib, curvas


def ler_tabela_p50(caminho):
    tab = {"M": [], "F": []}
    with open(caminho, newline="", encoding="utf-8") as f:
        for lin in csv.DictReader(f):
            tab[lin["sexo"].strip().upper()].append((float(lin["idade"]), float(lin["p50"])))
    return tab


# ------------------------------------------------------------------ digitalização

def digitalizar_sexo(calib, curvas_px, rotulo):
    c_idade, c_vc = ajustar_afim(calib)
    r_idade, r_vc = residuos(calib, c_idade, c_vc)
    idades = grade()
    saida = {"idade": idades}
    for p in PERCENTIS:
        pts = sorted((aplicar(c_idade, x, y), aplicar(c_vc, x, y)) for x, y in curvas_px[p])
        if len(pts) < 8:
            raise SystemExit(f"{rotulo} {p}: marque pelo menos 8 pontos (há {len(pts)})")
        if pts[0][0] > IDADE_MIN + FOLGA_EXTREMOS or pts[-1][0] < IDADE_MAX - FOLGA_EXTREMOS:
            raise SystemExit(f"{rotulo} {p}: os pontos cobrem {pts[0][0]:.2f} a {pts[-1][0]:.2f} anos; "
                             f"precisam cobrir {IDADE_MIN} a {IDADE_MAX}")
        xs, ys = [pts[0][0]], [pts[0][1]]
        for a, v in pts[1:]:
            if a - xs[-1] > 1e-6:  # descarta pontos com a mesma idade
                xs.append(a)
                ys.append(v)
        f = pchip(xs, ys)
        saida[p] = [round(max(f(a), 0.0), 2) for a in idades]
    for i, a in enumerate(idades):
        for k in range(1, len(PERCENTIS)):
            if saida[PERCENTIS[k]][i] < saida[PERCENTIS[k - 1]][i]:
                raise SystemExit(f"{rotulo}: curvas {PERCENTIS[k - 1]} e {PERCENTIS[k]} se cruzam aos {a} anos; "
                                 "revise os pontos marcados")
    return saida, {"idadeAnos": round(r_idade, 4), "vcCmAno": round(r_vc, 4), "pontos": len(calib)}


def validar_p50(curvas, tabela, sexo):
    f = pchip(curvas["idade"], curvas["p50"])
    linhas = []
    for idade, p50 in tabela:
        if not IDADE_MIN <= idade <= IDADE_MAX:
            continue
        dig = round(f(idade), 2)
        linhas.append({"sexo": sexo, "idade": idade, "tabela": p50, "digitalizado": dig,
                       "erro": round(abs(dig - p50), 3)})
    return linhas


def montar(pontos, tabela_p50):
    """pontos: {'M': (calib, curvas_px), 'F': (...)}; tabela_p50: {'M': [(idade, p50)], 'F': [...]}."""
    curvas, calibracao, por_idade = {}, {}, []
    for sexo in ("M", "F"):
        curvas[sexo], calibracao[sexo] = digitalizar_sexo(*pontos[sexo], rotulo=sexo)
        linhas = validar_p50(curvas[sexo], tabela_p50[sexo], sexo)
        if len(linhas) < 5:
            raise SystemExit(f"tabela do P50 ({sexo}): informe pelo menos 5 idades entre 2 e 19 anos")
        por_idade.extend(linhas)
    erro_max = max(l["erro"] for l in por_idade)
    return {
        "formato": "curvas-crescimento-referencia",
        "versaoFormato": 1,
        "tipo": "tanner1985",
        "fonte": {
            "citacao": "Tanner JM, Davies PSW. Clinical longitudinal standards for height and height velocity "
                       "for North American children. J Pediatr. 1985;107(3):317-29. Figuras 4 e 6.",
            "doi": "10.1016/s0022-3476(85)80501-1",
            "direitos": "Material protegido por direito autoral. Uso restrito; não redistribuir.",
        },
        "geradoEm": datetime.date.today().isoformat(),
        "metodo": "Curvas P3 a P97 (maturação média) digitalizadas por pontos marcados sobre a figura "
                  "renderizada a pelo menos 300 dpi (scripts/tanner-marcador.html), calibração afim pela grade "
                  "e interpolação cúbica monotônica em passo de 0,25 ano (scripts/tanner_digitalizar.py).",
        "condicao": "Velocidade de ano inteiro: intervalo de 0,85 a 1,15 ano. Idade = ponto médio, em anos.",
        "calibracao": calibracao,
        "curvas": curvas,
        "validacao": {
            "descricao": "P50 digitalizado comparado ao P50 numérico da Tabela I do artigo.",
            "aceite": ACEITE,
            "erroMaximo": round(erro_max, 3),
            "baixaConfianca": erro_max > ACEITE,
            "porIdade": por_idade,
        },
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--pontos-m", required=True)
    ap.add_argument("--pontos-f", required=True)
    ap.add_argument("--tabela-p50", required=True)
    ap.add_argument("--saida", required=True)
    a = ap.parse_args(argv)
    obj = montar({"M": ler_pontos(a.pontos_m), "F": ler_pontos(a.pontos_f)}, ler_tabela_p50(a.tabela_p50))
    with open(a.saida, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    v = obj["validacao"]
    for s in ("M", "F"):
        c = obj["calibracao"][s]
        print(f"calibração {s}: {c['pontos']} pontos, resíduo máx. {c['idadeAnos']} ano e {c['vcCmAno']} cm/ano")
    print(f"erro máximo do P50: {v['erroMaximo']} cm/ano (aceite {ACEITE}) -> "
          + ("BAIXA CONFIANÇA" if v["baixaConfianca"] else "aceito"))
    print(f"gravado em {a.saida}")


if __name__ == "__main__":
    sys.exit(main())
