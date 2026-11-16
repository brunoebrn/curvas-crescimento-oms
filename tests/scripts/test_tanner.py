"""Testes de scripts/tanner_digitalizar.py com curvas sintéticas (nenhum dado do artigo).

Rodar: python3 -m unittest discover -s tests/scripts -v
"""
import math
import pathlib
import random
import sys
import unittest

RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import tanner_digitalizar as td  # noqa: E402

Z = {"p3": -1.88, "p10": -1.28, "p25": -0.67, "p50": 0.0, "p75": 0.67, "p90": 1.28, "p97": 1.88}


def curva(p, idade):
    """Curva inventada com formato parecido: queda lenta e um pico na puberdade."""
    base = 9 - 0.35 * idade + 5 * math.exp(-((idade - 13.5) ** 2) / 2.5)
    base *= 1 / (1 + math.exp((idade - 16.5) * 1.6))
    return max(base * (1 + 0.14 * Z[p]) + 0.3 * Z[p] + 0.9, 0.0)


def para_pixel(idade, vc, ruido=0.0, rng=None):
    """Afim conhecida com leve rotação: cerca de 118 px por ano e 59 px por cm/ano (300 dpi)."""
    x = 400 + 118.1 * idade + 0.9 * vc
    y = 3000 - 59.0 * vc + 0.6 * idade
    if rng:
        x += rng.uniform(-ruido, ruido)
        y += rng.uniform(-ruido, ruido)
    return x, y


def pontos_sinteticos(ruido=1.0, semente=1):
    rng = random.Random(semente)
    calib = [(*para_pixel(i, v), i, v) for i in (2, 10, 19) for v in (1, 12, 24)]
    curvas = {}
    for p in td.PERCENTIS:
        idades = [1.95 + k * 0.1 for k in range(172)]
        curvas[p] = [para_pixel(a, curva(p, a), ruido, rng) for a in idades]
    return calib, curvas


class Calibracao(unittest.TestCase):
    def test_recupera_afim_exata(self):
        calib, _ = pontos_sinteticos(ruido=0)
        c_idade, c_vc = td.ajustar_afim(calib)
        x, y = para_pixel(7.3, 5.4)
        self.assertAlmostEqual(td.aplicar(c_idade, x, y), 7.3, places=6)
        self.assertAlmostEqual(td.aplicar(c_vc, x, y), 5.4, places=6)
        self.assertLess(max(td.residuos(calib, c_idade, c_vc)), 1e-6)

    def test_exige_quatro_pontos_nao_colineares(self):
        with self.assertRaises(ValueError):
            td.ajustar_afim([(0, 0, 2, 1), (1, 1, 3, 2), (2, 2, 4, 3)])
        with self.assertRaises(ValueError):
            td.ajustar_afim([(k, k, 2 + k, 1 + k) for k in range(5)])


class Interpolacao(unittest.TestCase):
    def test_pchip_passa_pelos_pontos_e_nao_oscila(self):
        xs, ys = [0, 1, 2, 3, 4], [0, 0, 1, 1, 1]
        f = td.pchip(xs, ys)
        for x, y in zip(xs, ys):
            self.assertAlmostEqual(f(x), y)
        self.assertTrue(all(0 <= f(k / 10) <= 1 for k in range(41)))

    def test_grade_de_2_a_19_em_passo_de_um_quarto(self):
        g = td.grade()
        self.assertEqual((g[0], g[1], g[-1], len(g)), (2.0, 2.25, 19.0, 69))


class PontaAPonta(unittest.TestCase):
    def montar(self, deslocamento=0.0):
        pontos = {"M": pontos_sinteticos(semente=1), "F": pontos_sinteticos(semente=2)}
        tabela = {s: [(float(a), round(curva("p50", a) + deslocamento, 1)) for a in range(2, 20)] for s in "MF"}
        return td.montar(pontos, tabela)

    def test_recupera_as_curvas_com_ruido_de_um_pixel(self):
        obj = self.montar()
        for sexo in "MF":
            c = obj["curvas"][sexo]
            for p in td.PERCENTIS:
                for a, v in zip(c["idade"], c[p]):
                    self.assertLess(abs(v - curva(p, a)), 0.06, f"{sexo} {p} {a}")
        self.assertLessEqual(obj["validacao"]["erroMaximo"], 0.11)  # inclui arredondamento da tabela a 0,1
        self.assertFalse(obj["validacao"]["baixaConfianca"])
        self.assertEqual(len(obj["validacao"]["porIdade"]), 36)

    def test_p50_deslocado_marca_baixa_confianca(self):
        obj = self.montar(deslocamento=0.3)
        self.assertTrue(obj["validacao"]["baixaConfianca"])
        self.assertGreater(obj["validacao"]["erroMaximo"], 0.2)

    def test_curva_incompleta_e_recusada(self):
        calib, curvas = pontos_sinteticos()
        curvas["p25"] = curvas["p25"][:100]  # só até cerca de 12 anos
        with self.assertRaises(SystemExit):
            td.digitalizar_sexo(calib, curvas, "M")

    def test_curvas_cruzadas_sao_recusadas(self):
        calib, curvas = pontos_sinteticos()
        curvas["p10"], curvas["p75"] = curvas["p75"], curvas["p10"]
        with self.assertRaises(SystemExit):
            td.digitalizar_sexo(calib, curvas, "M")


if __name__ == "__main__":
    unittest.main()
