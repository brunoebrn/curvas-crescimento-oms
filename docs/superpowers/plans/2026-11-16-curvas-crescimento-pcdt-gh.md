# Curvas de crescimento e critérios auxológicos do PCDT de GH – plano de implementação

> **Para agentes:** executar tarefa a tarefa com TDD (skill superpowers:executing-plans ou subagent-driven-development). Os passos usam caixas (`- [ ]`).

**Objetivo:** página estática (GitHub Pages) que plota estatura e velocidade de crescimento (VC) e verifica os critérios auxológicos C1–C3 do PCDT de deficiência de GH, sem armazenar dado de paciente.

**Arquitetura:** `index.html` (CSS embutido) + ES modules em `js/` + dados públicos em `data/` + uPlot vendorizado em `vendor/`. Módulos de cálculo puros recebem as tabelas por parâmetro (sem `fetch` nem DOM), testados com `node --test`. Referências restritas (Kelly, Tanner) entram só por upload no navegador, num formato JSON único validado.

**Stack:** HTML/CSS/JS puro (ES modules), uPlot 1.6.32 (MIT), Node ≥ 20 só para testes (`node --test`, zero dependências), Python 3 só para scripts de dados (`pdfplumber`, `openpyxl`, `pymupdf`).

Fonte de verdade: `docs/superpowers/specs/2026-11-15-curvas-crescimento-pcdt-gh-design.md`.

---

## Decisões fechadas neste plano (pendências da seção 8 da especificação)

| Pendência | Decisão | Fonte verificada |
|---|---|---|
| Fonte e licença OMS estatura | `lenanthro.txt` (WorldHealthOrganization/anthro) e `hfawho2007.txt` (WorldHealthOrganization/anthroplus), ambos GPL-3 (campo `License` do `DESCRIPTION` de cada pacote) | Arquivos baixados em 16/11/2026 |
| Cobertura real da tabela 2006 | 0 a 1826 dias (não 1856). De 1827 dias até 228 meses usa-se a tabela 2007, que tem linha de 60 meses; idade em meses = dias/30,4375, interpolação linear | Contagem das linhas de `lenanthro.txt` |
| Licença OMS velocidade 2009 | Sem licença aberta (publicação: "All rights reserved"; site: extratos para uso educacional não comercial com citação da URL). Bruno decidiu em 16/11/2026 versionar só L, M, S com atribuição e aviso | Página de copyright do documento; https://www.who.int/about/policies/terms-of-use |
| Regra de intervalo OMS 2009 | Desvio tolerado por medida: ±3 dias (0–6 m), ±5 dias (6–12 m), ±7 dias (12–24 m). Fora disso: ratear (prorate) o incremento para o intervalo nominal ou usar o intervalo maior seguinte. Idades de início que não coincidem: usar o intervalo tabulado mais próximo | Documento de métodos OMS 2009, "Measurement intervals in field application", p. 233; Tabela 2, p. 7 |
| z da velocidade OMS | LMS com restrição além de ±3 DP (DP fixado na distância entre ±2 e ±3 DP); sem delta para comprimento | Idem, cap. 6, p. 223 |
| Plausibilidade da estatura | Alerta quando \|z\| > 6 (mesmo limiar de flag do pacote anthro, `flag_threshold = 6`) | `R/z-score-length-for-age.R` do pacote anthro |
| Biblioteca de gráfico | uPlot 1.6.32, MIT, vendorizada | pacote npm `uplot` |
| Formato do JSON carregável | Ver Tarefa 7 | – |

Regra de projeto (não é regra da OMS, fica identificada como tal na interface): o rateio só é aplicado quando o intervalo observado dista até 1 mês do nominal mais próximo (2, 3, 4 ou 6 meses); fora disso a VC fica "não avaliável" pela OMS 2009.

C3 (janela de cerca de 12 meses): a partir de 2 anos, exige intervalo entre 0,85 e 1,15 ano; fora disso "não avaliável". Abaixo de 2 anos segue a especificação ("automático com ressalva"), pois a OMS 2009 só tem intervalos de até 6 meses.

## Estrutura de arquivos

```
index.html                    página única, CSS embutido
js/normal.js                  cdf e quantil da normal padrão
js/idade.js                   idade em dias, decimal, parse de datas
js/oms.js                     estatura para idade (2006 + 2007): LMS, z, percentil, curva de z
js/alvo.js                    estatura-alvo (SBP 2023) e z aos 19 anos
js/vc.js                      VC entre medidas; referências OMS 2009, Kelly, Tanner, guia SBP
js/referencias.js             validação do JSON carregável (Kelly, Tanner)
js/validacao.js               validações de entrada (seção 5)
js/criterios.js               checklist C1–C3 com classificação manual
js/graficos.js                montagem dos gráficos uPlot (DOM)
js/ui.js                      estado em memória, eventos, renderização (DOM)
js/exemplo.js                 paciente fictício de demonstração
data/oms-estatura-2006.json   M e S por dia, 0–1826, por sexo
data/oms-estatura-2007.json   M e S por mês, 60–228, por sexo
data/oms-velocidade-2009.json L, M, S por intervalo (2, 3, 4, 6 meses), por sexo
data/README.md                atribuição, licença, datas de download, checksums
vendor/uPlot.iife.min.js, vendor/uPlot.min.css, vendor/LICENSE-uPlot.txt
scripts/gerar_dados_oms.py    baixa e converte as tabelas OMS para data/
scripts/extrair_kelly.py      PDF suplementar → JSON (fora do repositório)
scripts/tanner_renderizar.py  PDF → PNG ≥ 300 dpi das p. 5 e 7
scripts/tanner_digitalizar.py pontos marcados + calibração → JSON com erro medido
scripts/tanner-marcador.html  ferramenta local para marcar pontos na imagem
tests/*.test.js               um arquivo por módulo de cálculo
tests/scripts/*.py            testes dos scripts (dados sintéticos; Kelly real se o PDF existir)
package.json                  só "type": "module" e script de teste
.nojekyll
```

Comando único de teste: `npm test` (= `node --test tests/`). Saída esperada: todos os testes passam, 0 falhas.

---

## Tarefa 1 – Esqueleto e dados OMS de estatura

**Arquivos:** `package.json`, `.nojekyll`, `scripts/gerar_dados_oms.py`, `data/oms-estatura-2006.json`, `data/oms-estatura-2007.json`, `data/README.md`

- [ ] `package.json` com `"type": "module"`, `"private": true`, `"scripts": {"test": "node --test tests/"}`.
- [ ] `scripts/gerar_dados_oms.py`: baixa os dois TXT e os 8 XLSX de velocidade (URLs no topo do script), grava JSON compacto `{meta:{fonte,url,licenca,baixadoEm,sha256}, M:{"1":[...],"2":[...]}, S:{...}}` (índice = dia, ou mês − 60) e, para velocidade, `{meta, tabelas:{"2":{"1":[{inicio,fim,L,M,S}],"2":[...]},"3":...}}`.
- [ ] Rodar o script; conferir contagens: 1827 dias por sexo; 169 meses (60–228) por sexo; 23/22/21/19 intervalos nas tabelas de 2/3/4/6 meses.
- [ ] `data/README.md` com citação, URL, licença e a ressalva da velocidade 2009.
- [ ] Commit: `feat: tabelas OMS de estatura e velocidade com atribuição`.

## Tarefa 2 – `normal.js` e `idade.js`

**Testes (`tests/normal.test.js`, `tests/idade.test.js`):**

- `cdf(0) = 0,5`; `cdf(-1,96) ≈ 0,0250` (±1e-4); `cdf(-0,674) ≈ 0,2501` (±1e-3); `quantil(0,25) ≈ −0,6745`; `quantil(0,03) ≈ −1,8808` (±1e-4); `quantil(cdf(1,3)) ≈ 1,3`.
- `diasEntre('2020-01-01','2021-01-01') = 366`; `idadeDecimal(3652,5) = 10`; `diasDeAnosMeses(2,6) = 913` (2×365,25 + 6×30,4375 = 913,125, arredondado); `mesesDeDias(1826,25) = 60`; data inválida lança erro; datas tratadas em UTC (sem deslocamento por fuso).

- [ ] Escrever testes, ver falhar, implementar (cdf por erf de Abramowitz–Stegun 7.1.26 não basta em precisão: usar a aproximação de W. J. Cody ou série; quantil por Acklam com um passo de Newton), ver passar.
- [ ] Commit: `feat: normal padrão e cálculo de idade`.

## Tarefa 3 – `oms.js` (estatura para idade)

Interface: `criarOms({t2006, t2007})` → `{ lms(sexo, dias) → {M, S, fonte:'OMS 2006'|'OMS 2007'}, z(sexo, dias, cm), percentil(z), estaturaNoZ(sexo, dias, z), DIAS_MAX }`. `sexo`: `'M'` ou `'F'`. Fora de 0–228 meses → `null`.

**Testes com valores das tabelas oficiais (lidos dos TXT versionados):**

- Menino, dia 0: M = 49,8842, S = 0,03795 → estatura 49,8842 dá z = 0; estatura M·(1 − 2·S) dá z = −2.
- Menino, dia 1826: M = 109,9593, S = 0,04214, fonte OMS 2006.
- Menina, dia 731: M = 85,7299 (quebra deitado/em pé já embutida na tabela).
- Menino, 61 meses exatos (1856,6875 dias → usar dias = 1857): fonte OMS 2007, M entre 110,2647 e o valor de 62 meses.
- Menina, 228 meses: M = 163,1548, S = 0,04009; 229 meses → `null`.
- Interpolação: menino a 60,5 meses → M = (109,7265 + 110,2647)/2.
- Conferência cruzada com as tabelas de z da OMS: menino aos 228 meses, −3 DP = M·(1 − 3·S) (L = 1).
- `percentil(0) = 50`; `percentil(-2) ≈ 2,28`.

- [ ] Testes → falha → implementação → passa. Commit: `feat: z-score de estatura para idade (OMS 2006/2007)`.

## Tarefa 4 – `alvo.js`

Interface: `estaturaAlvo({sexo, pai, mae}, oms)` → `{alvo, min, max, zAlvo, zMin, zMax}` ou `null` se faltar altura.

**Testes:** menino, pai 175, mãe 162 → alvo 175,0, faixa 170,0–180,0; menina, mesmos pais → 162,0 (157,0–167,0); z aos 228 meses = (alvo − M)/(M·S) com M, S da tabela 2007; pai ausente → `null`.

- [ ] Testes → implementação. Commit: `feat: estatura-alvo (SBP 2023)`.

## Tarefa 5 – `vc.js`: cálculo de VC e OMS 2009

Interface:

- `calcularVc(a, b)` com `{dias, cm}` → `{dias, anos, meses, deltaCm, vc, idadeMedioDias, alertas[]}`; alertas `intervalo-curto` (< 6 meses) e `vc-negativa`.
- `zOms2009(tab, sexo, inicioDias, fimDias, deltaCm)` → `{z, percentil, nominalMeses, intervaloTabela:'11-13 mo', rateado:boolean, incrementoUsado, ressalvas[]}` ou `{naoAvaliavel:true, motivo}`.

Regras (documento OMS 2009, p. 233): nominal = o mais próximo entre 2, 3, 4, 6 meses; se o intervalo observado dista mais de 1 mês do nominal → não avaliável; se o desvio em dias excede a tolerância (3/5/7 dias conforme a idade final) → ratear `deltaCm × (nominal×30,4375 / dias)` e marcar `rateado`; linha da tabela = a de início mais próximo do início observado (em meses, arredondado), limitada à última linha; fim tabulado > 24 meses → não avaliável. z restrito: se |z_LMS| ≤ 3 usar LMS; senão `z = ±3 + (y − SD3)/SD23`.

**Testes:**

- `calcularVc({dias:1000,cm:90},{dias:1365.25→1365,cm:96})` → vc = 6/(365/365,25).
- Intervalo de 100 dias gera `intervalo-curto`; queda de estatura gera `vc-negativa`.
- Menino 0–2 meses (0 a 61 dias), incremento 8,482 → z ≈ 0; incremento 7,3 → z ≈ −1 (tabela: −1 DP = 7,3, tolerância 0,06); 5,1 → z ≈ −3 (±0,05).
- Menina 18–24 meses (548 a 731 dias), incremento 5,6454 → z ≈ 0; 3,7 → z ≈ −2 (±0,06).
- Exemplo adaptado do próprio documento: início 11 meses (335 dias), fim 13 meses e 24 dias (84 dias depois) → nominal 3 meses sem rateio (dentro de ±7 dias de 91)… conferir: 84 dias dista 7,3 dias de 91,3 → rateado para 3 meses; o teste fixa o comportamento calculado.
- Intervalo de 9 meses → não avaliável.
- Incremento 0 no intervalo 22–24 meses (menino) → z < −2 finito (ramo restrito ou LMS conforme o caso).

- [ ] Testes → implementação. Commit: `feat: velocidade de crescimento e z pela OMS 2009`.

## Tarefa 6 – `vc.js`: Kelly, Tanner, guia SBP e escolha da referência

Interface:

- `zKelly(tabela, idadeAnos, vc)` → `{z, percentil}` ou `null` fora da faixa; `tabela = {idade[], L[], S[], M[]}`; interpolação linear de L, M, S; `z = ((vc/M)^L − 1)/(L·S)`.
- `zTanner(curvas, idadeAnos, vc)` → `{z, percentil, limitado:boolean}`; `curvas = {idade[], p3[], p10[], p25[], p50[], p75[], p90[], p97[]}`; interpola cada curva na idade, depois z linear entre curvas vizinhas (z dos percentis pela normal); fora de P3–P97 → z limitado a ±1,881 com `limitado:true`.
- `guiaSbp(idadeAnos)` → 7 (2 ≤ idade < 4), 6 (4 ≤ idade < 6), senão `null`.
- `avaliarVc(intervalo, ctx)` → escolhe a referência conforme a tabela da seção 6 e devolve `{referencia, z, percentil, ressalvas[], naoAvaliavel, motivo}`; `ctx = {sexo, oms2009, kelly, tanner, preferencia:'kelly'|'tanner', kellyTabela:'2a'|'precoce'|'media'|'tardia'}`.

**Testes (só com tabelas sintéticas no repositório; nenhum valor real de Kelly ou Tanner):**

- Kelly sintético: L = 1, S = 0,2, M = 5 → vc 5 dá z 0; vc 4 dá z −1; L = 0,5 confere com a fórmula; interpolação no meio de duas idades; fora da faixa → `null`.
- Tanner sintético com curvas iguais a `p50 = 5` e espaçamento 1 cm por z: vc no P25 → z = −0,674; vc entre P10 e P25 interpola; abaixo de P3 → `limitado`.
- `avaliarVc`: ponto médio de 1 ano → OMS 2009; 3 anos sem Tanner → não avaliável com motivo "Tanner não carregado"; 3 anos com Tanner → Tanner com ressalva "aproximado"; 8 anos com Kelly e intervalo de 12 meses → Kelly sem ressalva; 8 anos com Kelly e intervalo de 8 meses → ressalva "fora da condição da referência (11 a 13 meses)"; preferência Tanner respeitada; Tanner com intervalo fora de 0,85–1,15 ano → ressalva; 18,5 anos só com Kelly → não avaliável.

- [ ] Testes → implementação. Commit: `feat: referências de VC (Kelly, Tanner, guia SBP)`.

## Tarefa 7 – `referencias.js` (formato carregável)

```json
{
  "formato": "curvas-crescimento-referencia",
  "versaoFormato": 1,
  "tipo": "kelly2014",
  "fonte": {"citacao": "...", "doi": "..."},
  "geradoEm": "2026-11-16",
  "metodo": "...",
  "tabelas": {"2a": {"M": {"idade": [], "L": [], "S": [], "M": [], "p3": [], "p10": [], "p50": [], "p90": [], "p97": []}, "F": {}},
               "2b": {"M": {"precoce": {}, "media": {}, "tardia": {}}, "F": {}}}
}
```

Para `"tipo": "tanner1985"`: `"curvas": {"M": {"idade": [], "p3": [], ..., "p97": []}, "F": {}}` e `"validacao": {"aceite": 0.2, "erroMaximo": 0.0, "porIdade": [{"sexo","idade","tabela","digitalizado","erro"}], "baixaConfianca": false}`.

Interface: `validarReferencia(obj)` → `{ok:true, tipo, dados, avisos[]}` ou `{ok:false, erros[]}`. Verifica formato, versão, tipo, arrays de mesmo tamanho, idades crescentes, números finitos, S > 0, M > 0, percentis em ordem não decrescente; em Tanner exige `validacao` e emite aviso se `baixaConfianca`.

**Testes:** objeto válido de cada tipo (sintético); cada violação acima gera erro específico; JSON de outro formato é recusado.

- [ ] Testes → implementação. Commit: `feat: validação do arquivo de referência carregável`.

## Tarefa 8 – `validacao.js`

Interface: `validarMedidas({nascimento, hoje, medidas:[{id, data?, anos?, meses?, cm}], sexo}, oms)` → `{medidas:[{id, dias, cm, erros[], alertas[]}], ordenadas:[...]}`.

**Testes:** data futura → erro; anterior ao nascimento → erro; idade > 19 anos (dias > 228 meses) → erro "recusa"; estatura com |z| > 6 → alerta; queda > 1 cm entre consecutivas → alerta na segunda; queda de 0,8 cm → sem alerta; datas duplicadas → erro nas duas; linha sem estatura → ignorada sem erro; estatura não numérica ou ≤ 0 → erro; saída ordenada por idade.

- [ ] Testes → implementação. Commit: `feat: validação das medidas`.

## Tarefa 9 – `criterios.js`

Interface: `avaliarCriterios({zEstatura, vc, idadeAnos}, manual)` → `{C1, C2, C3}`, cada um `{status:'atende'|'nao-atende'|'nao-avaliavel', motivo, referencia, origem:'automatico'|'manual', automatico:{status,motivo}}`. `vc` é a saída de `avaliarVc` mais `{anos}` do intervalo. `manual = {C1?:'atende'|'nao-atende', ...}` prevalece.

**Testes:**

- z = −3,2 → C1 atende; C2 e C3 não atendem (condição de estatura não satisfeita), mesmo sem VC.
- z = −3,0 exato → C1 não atende; C2 depende da VC.
- z = −2,5, VC z = −0,8 → C2 atende; VC z = −0,5 → não atende; VC z = −0,674 exato → não atende.
- z = −2,5 sem VC → C2 não avaliável com motivo.
- z = −2,0 exato → C2 não atende; C3 depende da VC.
- z = −1, VC z = −1,2, intervalo 1,0 ano → C3 atende; VC z = −0,9 → não atende; intervalo 0,5 ano com idade ≥ 2 → não avaliável; idade < 2 com OMS 2009 → avaliado com ressalva.
- Tanner com z limitado em −1,881 → atende C2/C3 (limite inferior é suficiente).
- Sem medida → três não avaliáveis.
- Manual: C2 manual "atende" sobre automático não avaliável → status atende, origem manual, `automatico` preservado.

- [ ] Testes → implementação. Commit: `feat: checklist auxológico C1–C3`.

## Tarefa 10 – Scripts de dados restritos

**`scripts/extrair_kelly.py`** `--pdf <caminho> --saida <caminho.json>`: usa posições x das palavras (pdfplumber `extract_words`) para atribuir cada número à coluna certa, já que a Tabela S2b tem blocos vazios. Autoverificação embutida, que aborta se falhar: para cada linha, o P50 impresso deve ser igual a M, e P3/P10/P90/P97 recalculados por LMS devem diferir do impresso em no máximo 0,15 cm/ano (arredondamento de L e S a 2 casas); registra o maior desvio em `metodo`. Teste (`tests/scripts/test_kelly.py`): roda só se `referencias-restritas/kelly-2014-suplementar.pdf` existir; confere nº de linhas e a autoverificação.

**Tanner (digitalização assistida):** a extração totalmente automática depende de inspecionar o escaneado; o PDF (21 MB) excede o limite de 10 MB do conector do Drive nesta sessão. Fica um fluxo testável:

1. `scripts/tanner_renderizar.py --pdf <pdf> --paginas 5 7 --dpi 300 --saida referencias-restritas/` → PNG.
2. `scripts/tanner-marcador.html` (abre local): carrega o PNG, marca ≥ 4 pontos de calibração da grade (idade, cm/ano conhecidos) e pontos ao longo de cada uma das 7 curvas; exporta CSV `tipo,curva,x_px,y_px,idade,vc`.
3. `scripts/tanner_digitalizar.py --pontos-m <csv> --pontos-f <csv> --tabela-p50 <csv> --saida <json>`: calibração afim por mínimos quadrados (relata resíduo), interpolação monotônica por partes de cada curva em passo de 0,25 ano de 2 a 19 anos, validação do P50 contra a Tabela I (CSV `sexo,idade,p50` digitado pelo usuário a partir do PDF; nunca versionado), `erroMaximo` e `baixaConfianca = erroMaximo > 0,2` gravados no JSON.

Teste (`tests/scripts/test_tanner.py`): curvas sintéticas conhecidas → pixels por uma transformação afim conhecida com ruído de ±1 px → o script recupera as curvas com erro < 0,05 cm/ano; um P50 sintético deslocado em 0,3 → `baixaConfianca = true`.

- [ ] Implementar, rodar testes, gerar o JSON de Kelly, conferir com `validarReferencia` (Node), salvar no Drive. Commit (só scripts e testes): `feat: scripts de extração de Kelly e digitalização de Tanner`.

## Tarefa 11 – Interface (`index.html`, `js/ui.js`, `js/graficos.js`, `js/exemplo.js`, `vendor/`)

Seguir as seções 5 e 6 da especificação e as diretrizes do Impeccable (detector `npx impeccable detect index.html` sem achados primários).

- Cabeçalho com título, aviso de privacidade e botão "Carregar exemplo fictício".
- Bloco Paciente: sexo, nascimento, pai, mãe. Bloco Referências: upload Kelly e Tanner com estado (ativo, fonte, erro medido, baixa confiança), preferência ≥ 5,5 anos, tabela de Kelly (2a, precoce, média, tardia).
- Tabela de medidas editável: modo por linha "data" ou "idade (anos, meses)", estatura; adicionar/remover linha; erros e alertas ao lado da linha.
- Par de VC para o checklist: padrão "intervalo mais recente"; seletor de qualquer par.
- Saídas: checklist C1–C3 (status, motivo, referência, seletor manual), gráfico de estatura (z −3, −2, 0, +2, +3; pontos; faixa de estatura-alvo aos 19 anos), gráfico de VC (percentis da referência por faixa, guia SBP, pontos no ponto médio), tabela de medidas (idade, estatura, z, percentil) e de intervalos (duração, VC, referência, z/percentil, alertas).
- "Como interpretar" e rodapé de fontes (PCDT, OMS, SBP, Kelly, Tanner, divergência do guia CEAF/AL, aviso de que são critérios de investigação).
- Estado só em memória: sem `localStorage`, `sessionStorage`, cookies, nem rede além dos arquivos estáticos do próprio site.
- Responsivo (uma coluna em telas estreitas), teclado e leitor de tela (rótulos, `aria-live` nos resultados), contraste AA.

- [ ] Vendorizar uPlot; implementar; conferir no navegador. Commits por parte: `feat: interface de entrada e validação`, `feat: gráficos de estatura e VC`, `feat: tabelas de resultado e checklist`.

## Tarefa 12 – Verificação de ponta a ponta

`tests/e2e/verificar.mjs` (Playwright já instalado no ambiente; não é dependência do projeto): sobe `python3 -m http.server`, abre a página e confere:

1. Sem dados: três critérios "não avaliável".
2. Exemplo fictício (menino, z de estatura entre −3 e −2): sem referências → C1 não atende, C2 não avaliável (motivo cita referência não carregada).
3. Carrega JSON sintético de teste (gerado em pasta temporária, não versionado) → C2 atende; classificação manual prevalece e aparece identificada.
4. Nenhuma requisição externa; `localStorage` e `sessionStorage` vazios; sem erros no console.
5. Capturas em 1280 px e 390 px para inspeção visual.

- [ ] Rodar `npm test`, o e2e e o detector Impeccable. Commit: `test: verificação de ponta a ponta`.

## Tarefa 13 – Publicação e documentação

- [ ] `README.md` curto (o que é, como testar, privacidade, licenças).
- [ ] Atualizar `CLAUDE.md` e `docs/HANDOFF.md` (feito, pendente, limitações, roteiro de teste, comandos de Kelly e Tanner).
- [ ] `git push -u origin main`. Pages: raiz da branch `main` (`.nojekyll` presente).

## Autorrevisão

Cobertura da especificação: seção 3 (Tarefas 1–9, 11), seção 4 (1, 7, 10), seção 5 (8, 11), seção 6 (2–6, 9), seção 8 (decisões no topo, Tarefa 10). Fora do escopo (seção 7) não tem tarefa. Lacuna assumida: digitalização de Tanner não executada nesta sessão por limite do conector; scripts e testes entregues.
