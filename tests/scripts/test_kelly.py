"""Testes de scripts/extrair_kelly.py. Rodar: python3 -m unittest discover -s tests/scripts -v

Os testes de coluna usam palavras sintéticas. O teste de ponta a ponta só roda se o PDF
restrito existir em referencias-restritas/ (ele nunca é versionado).
"""
import pathlib
import sys
import unittest

RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import extrair_kelly as ek  # noqa: E402

PDF = RAIZ / "referencias-restritas" / "kelly-2014-suplementar.pdf"


def palavra(texto, x0, top=100):
    return {"text": texto, "x0": x0, "x1": x0 + 5 * len(texto), "top": top}


class Colunas(unittest.TestCase):
    def test_agrupa_linhas_por_altura(self):
        ws = [palavra("1.00", 10, 100), palavra("2.00", 50, 101), palavra("3.00", 10, 120)]
        linhas = ek.linhas_de_palavras(ws)
        self.assertEqual([[w["text"] for w in l] for l in linhas], [["1.00", "2.00"], ["3.00"]])

    def test_bloco_vazio_nao_desloca_colunas(self):
        ancoras = [20, 60, 100, 140]
        linha = [palavra("6.25", 10), palavra("-0.57", 128)]
        self.assertEqual(ek.atribuir_colunas(linha, ancoras), {0: 6.25, 3: -0.57})

    def test_duas_palavras_na_mesma_coluna_e_erro(self):
        with self.assertRaises(ValueError):
            ek.atribuir_colunas([palavra("1.00", 10), palavra("2.00", 12)], [20, 60])

    def test_verificacao_detecta_coluna_trocada(self):
        t = ek.nova_tabela()
        for idade in (6.0, 6.25):
            bloco = {"L": 1.0, "S": 0.2, "p50": 5.0}
            for p, z in ek.Z.items():
                bloco[p] = round(5.0 * (1 + 0.2 * z), 1)
            ek.acrescentar(t, idade, bloco)
        self.assertLess(ek.verificar(t, "sintética"), 0.06)
        t["p3"][0], t["p97"][0] = t["p97"][0], t["p3"][0]
        with self.assertRaises(SystemExit):
            ek.verificar(t, "sintética")


@unittest.skipUnless(PDF.exists(), "PDF restrito ausente (referencias-restritas/)")
class PontaAPonta(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.obj = ek.montar(*ek.extrair(str(PDF)))

    def test_estrutura(self):
        t = self.obj["tabelas"]
        for s in ("M", "F"):
            self.assertEqual(t["2a"][s]["idade"][0], 5.5)
            self.assertGreaterEqual(len(t["2a"][s]["idade"]), 45)
            for g in ("precoce", "media", "tardia"):
                self.assertGreaterEqual(len(t["2b"][s][g]["idade"]), 30)

    def test_autoverificacao_dentro_do_limite(self):
        self.assertLessEqual(self.obj["maiorDesvioAutoverificacao"], ek.TOLERANCIA)


if __name__ == "__main__":
    unittest.main()
