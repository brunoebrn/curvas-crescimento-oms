#!/usr/bin/env python3
"""Renderiza páginas do PDF de Tanner & Davies 1985 em PNG de alta resolução.

Uso:
    python3 scripts/tanner_renderizar.py \
        --pdf "referencias-restritas/Tanner e Davies 1985 - Curvas de velocidade de crescimento.pdf" \
        --paginas 5 7 --dpi 300 --saida referencias-restritas/

Páginas do PDF: 5 = Fig. 4 (meninos), 7 = Fig. 6 (meninas); 3 e 8 = Tabelas I e II (P50).
O PDF e os PNG são material protegido: NUNCA versionar (referencias-restritas/ é ignorada pelo git).
Dependência: pymupdf (pip install pymupdf).
"""
import argparse
import pathlib
import sys


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--paginas", type=int, nargs="+", default=[5, 7], help="páginas, contadas a partir de 1")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--saida", default="referencias-restritas/")
    a = ap.parse_args(argv)
    if a.dpi < 300:
        ap.error("use pelo menos 300 dpi")
    import fitz  # pymupdf

    destino = pathlib.Path(a.saida)
    destino.mkdir(parents=True, exist_ok=True)
    with fitz.open(a.pdf) as doc:
        for n in a.paginas:
            if not 1 <= n <= doc.page_count:
                ap.error(f"página {n} não existe (o PDF tem {doc.page_count})")
            pix = doc[n - 1].get_pixmap(dpi=a.dpi)
            arq = destino / f"tanner-p{n}-{a.dpi}dpi.png"
            pix.save(arq)
            print(f"{arq}: {pix.width} x {pix.height} px")


if __name__ == "__main__":
    sys.exit(main())
