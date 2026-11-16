#!/usr/bin/env python3
"""Baixa as tabelas públicas da OMS e gera os JSON de data/.

Uso: python3 scripts/gerar_dados_oms.py [--cache PASTA]

Fontes (ver data/README.md para licença e atribuição):
- OMS 2006, comprimento/estatura para idade: pacote R anthro (GPL-3).
- OMS 2007, estatura para idade: pacote R anthroplus (GPL >= 3).
- OMS 2009, velocidade de comprimento: tabelas XLSX do site who.int.
Dependências: curl no PATH e openpyxl (só para os XLSX de velocidade).
"""
import argparse
import datetime
import hashlib
import io
import json
import pathlib
import re
import subprocess

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL_2006 = ("https://raw.githubusercontent.com/WorldHealthOrganization/anthro/"
            "master/data-raw/growthstandards/lenanthro.txt")
URL_2007 = ("https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/"
            "master/data-raw/growthstandards/hfawho2007.txt")
BASE_VEL = ("https://cdn.who.int/media/docs/default-source/child-growth/"
            "child-growth-standards/indicators/length-velocity/")
PAGINA_VEL = "https://www.who.int/tools/child-growth-standards/standards/length-velocity"
SEXOS_VEL = {"1": "boys", "2": "girls"}
INTERVALOS = [2, 3, 4, 6]


def baixar(url, cache):
    nome = url.rsplit("/", 1)[1]
    if cache:
        arq = pathlib.Path(cache) / nome
        if arq.exists():
            return arq.read_bytes()
    # curl em vez de urllib: o CDN da OMS responde 403 ao agente padrão do urllib
    dados = subprocess.run(["curl", "-sSfL", "--max-time", "120", url],
                           check=True, capture_output=True).stdout
    if cache:
        pathlib.Path(cache).mkdir(parents=True, exist_ok=True)
        (pathlib.Path(cache) / nome).write_bytes(dados)
    return dados


def sha(dados):
    return hashlib.sha256(dados).hexdigest()


def ler_txt(dados):
    linhas = dados.decode("utf-8").strip().splitlines()
    cab = linhas[0].split("\t")
    return [dict(zip(cab, l.split("\t"))) for l in linhas[1:]]


def gravar(nome, obj):
    destino = RAIZ / "data" / nome
    destino.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n",
                       encoding="utf-8")
    print(f"{nome}: {destino.stat().st_size} bytes")


def estatura(dados, idade_min, idade_max):
    reg = ler_txt(dados)
    saida = {"M": {}, "S": {}}
    for sexo in ("1", "2"):
        do_sexo = {int(r["age"]): r for r in reg if r["sex"] == sexo}
        for r in do_sexo.values():
            if float(r["l"]) != 1:
                raise SystemExit("L diferente de 1: a ferramenta assume L = 1")
        idades = list(range(idade_min, idade_max + 1))
        faltando = [i for i in idades if i not in do_sexo]
        if faltando:
            raise SystemExit(f"idades ausentes: {faltando[:5]}")
        saida["M"][sexo] = [float(do_sexo[i]["m"]) for i in idades]
        saida["S"][sexo] = [float(do_sexo[i]["s"]) for i in idades]
    return saida


def velocidade(cache):
    import openpyxl
    tabelas, hashes = {}, {}
    for n in INTERVALOS:
        tabelas[str(n)] = {}
        for sexo, nome in SEXOS_VEL.items():
            url = f"{BASE_VEL}ttt_length_{nome}_{n}mon_z.xlsx"
            dados = baixar(url, cache)
            hashes[url.rsplit("/", 1)[1]] = sha(dados)
            ws = openpyxl.load_workbook(io.BytesIO(dados)).active
            linhas = list(ws.iter_rows(values_only=True))
            if [str(c).strip() for c in linhas[0][:4]] != ["Interval", "L", "M", "S"]:
                raise SystemExit(f"cabeçalho inesperado em {url}")
            lista = []
            for lin in linhas[1:]:
                if lin[0] is None:
                    continue
                m = re.match(r"\s*(\d+)\s*-\s*(\d+)\s*mo", str(lin[0]))
                if not m or int(m.group(2)) - int(m.group(1)) != n:
                    raise SystemExit(f"intervalo inesperado: {lin[0]}")
                lista.append({"inicio": int(m.group(1)), "fim": int(m.group(2)),
                              "L": float(lin[1]), "M": float(lin[2]), "S": float(lin[3])})
            tabelas[str(n)][sexo] = lista
    return tabelas, hashes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", help="pasta para guardar/reusar os arquivos baixados")
    a = ap.parse_args()
    hoje = datetime.date.today().isoformat()

    d06 = baixar(URL_2006, a.cache)
    gravar("oms-estatura-2006.json", {
        "meta": {"fonte": "WHO Child Growth Standards (2006), length/height-for-age",
                 "url": URL_2006, "licenca": "GPL-3 (pacote R anthro, OMS)",
                 "baixadoEm": hoje, "sha256": sha(d06),
                 "unidadeIdade": "dias", "idadeMin": 0, "idadeMax": 1826,
                 "sexos": {"1": "masculino", "2": "feminino"}},
        **estatura(d06, 0, 1826)})

    d07 = baixar(URL_2007, a.cache)
    gravar("oms-estatura-2007.json", {
        "meta": {"fonte": "WHO Growth Reference 5-19 years (2007), height-for-age",
                 "url": URL_2007, "licenca": "GPL (>= 3) (pacote R anthroplus, OMS)",
                 "baixadoEm": hoje, "sha256": sha(d07),
                 "unidadeIdade": "meses", "idadeMin": 60, "idadeMax": 228,
                 "sexos": {"1": "masculino", "2": "feminino"}},
        **estatura(d07, 60, 228)})

    tabelas, hashes = velocidade(a.cache)
    gravar("oms-velocidade-2009.json", {
        "meta": {"fonte": "WHO Child Growth Standards: growth velocity (2009), "
                          "length increments, 2-, 3-, 4- and 6-month intervals (z-scores)",
                 "url": PAGINA_VEL,
                 "licenca": "© World Health Organization. Sem licença aberta; reproduzido "
                            "com atribuição para uso educacional não comercial "
                            "(ver data/README.md)",
                 "baixadoEm": hoje, "sha256": hashes,
                 "unidadeIntervalo": "meses", "unidadeIncremento": "cm",
                 "sexos": {"1": "masculino", "2": "feminino"}},
        "tabelas": tabelas})


if __name__ == "__main__":
    main()
