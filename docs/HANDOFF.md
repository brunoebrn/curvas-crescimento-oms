# Handoff – contexto, decisões e fontes (15/11/2026)

Documento para retomar o desenvolvimento em qualquer ambiente (Claude Code em nuvem ou local). O design completo está em `docs/superpowers/specs/2026-11-15-curvas-crescimento-pcdt-gh-design.md`.

## Situação

- Brainstorming concluído; arquitetura, telas/fluxo e regras de cálculo aprovados por Bruno.
- Nenhum código escrito ainda.
- Próximo passo: plano de implementação (`superpowers:writing-plans`) e execução com TDD.

## Decisões do Bruno (com data 15/11/2026)

| Tema | Decisão |
|---|---|
| Faixa etária | 0 a 19 anos, curva contínua (OMS 2006 até 60 meses, OMS 2007 de 61 a 228 meses) |
| Entrada | Data ou idade por linha; sexo, data de nascimento, altura dos pais |
| Saídas | Gráfico de estatura (z), gráfico de VC, tabela com z/percentil e VC, estatura-alvo, checklist PCDT |
| Usuários | Inicialmente só Bruno; depois avaliadores do CEAF (ajuda e validação de entrada) |
| Arquitetura | HTML único + JS puro, sem build, GitHub Pages |
| VC acima de 2 anos | Duas referências selecionáveis: Tanner & Davies 1985 (digitalizada) e Kelly 2014 |
| Arquivos restritos | Kelly e Tanner carregados no navegador a cada uso, fora do repositório |
| Intervalo entre medidas | Sem padronização (depende do prontuário): calcular sempre, alertar intervalos curtos; faltando dado, o avaliador indefere ou pede complementação |
| Checklist | Só critérios auxológicos |
| Deitado/em pé | Assumir padrão (deitado < 2 anos, em pé depois), sem campo |
| 2 a 5 anos sem Kelly | Mostrar variação do z OMS e faixas SBP como guia, além de Tanner |
| Tanner | Digitalizar o gráfico (Bruno quer a curva plotada); classificação manual como adicional |

## Fontes

PCDT

- Portaria Conjunta SAS/SCTIE nº 28, de 30/11/2018 (CID E23.0). Relatório CONITEC nº 351. Cópia no Drive: Trabalho/SESAU/Assistência Farmacêutica/CEAF/PCDT (ENDO_Hipopituitarismo-GH.pdf). Guia CEAF/AL atualizado em 27/04/2023: "Deficiência do Hormônio do Crescimento – Hipopituitarismo.pdf".
- Critérios auxológicos no item 3.1 (quando investigar): C1 z < −3; C2 z entre −3 e −2 e VC < P25; C3 z ≥ −2 e VC < −1 DP em 12 meses. Inclusão (item 4) exige teste de estímulo.
- O PCDT não define: qual tabela OMS, transição 2006/2007, intervalo mínimo de medida, fórmula de estatura-alvo, ponto de corte de IGF-1.

OMS (públicas)

- 0 a 5 anos (2006), tabelas expandidas por dia: https://www.who.int/tools/child-growth-standards/standards/length-height-for-age
- 5 a 19 anos (2007): https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/height-for-age
- Velocidade de comprimento 0 a 24 meses (2009), incrementos de 2, 3, 4, 6 meses: https://www.who.int/tools/child-growth-standards/standards/length-velocity . A OMS não tem padrão de velocidade de estatura acima de 24 meses.
- Tabelas em texto: github.com/WorldHealthOrganization/anthro (`data-raw/growthstandards/lenanthro.txt`) e github.com/WorldHealthOrganization/anthroplus (`data-raw/growthstandards/hfawho2007.txt`). L = 1 em ambas.
- Métodos 2006 (z restrito só para indicadores de peso; ajuste 0,7 cm deitado/em pé): https://iris.who.int/server/api/core/bitstreams/b9a488f7-c337-4c75-a254-8a7d11846f8c/content

SBP

- Manual de Orientação nº 64 (08/05/2023): estatura-alvo (pai + mãe ± 13)/2 ± 5 cm; VC aproximada 2–4 anos ≈ 7 cm/ano, 4–6 anos ≈ 6 cm/ano. https://www.sbp.com.br/fileadmin/user_upload/24038c-ManOrient_-_AvalCrescim_o_que_PediatraPrecisaSaber.pdf

Restritas (NÃO versionar; ficam no Drive em Trabalho/SESAU/Assistência Farmacêutica/CEAF)

- `Kelly 2014 - Supplementary Data.pdf`: Tabela S2a (todos) e S2b (maturação precoce/média/tardia), colunas L, S, M e P3/P10/P50/P90/P97, idades 5,5 a cerca de 17,5 anos, passo 0,25 ano. Texto extraível com pdfplumber (sem OCR). Kelly exige intervalo de 11 a 13 meses. Copyright Endocrine Society. Artigo: `Kelly 2014 - Artigo.pdf` (doi 10.1210/jc.2013-4455).
- `Tanner e Davies 1985 - Curvas de velocidade de crescimento.pdf` (21 MB, escaneado): Fig. 4 (meninos, p. 5 do PDF) e Fig. 6 (meninas, p. 7 do PDF) com curvas de VC P3, P10, P25, P50, P75, P90, P97, 2 a 19 anos, grade milimetrada. Só o P50 tem tabela numérica (Tabela I, p. 3; Tabela II, p. 8, precoce/tardio) – usar para validar a digitalização (aceite: erro ≤ 0,2 cm/ano). As curvas valem para velocidade de ano inteiro (0,85 a 1,15 ano). doi 10.1016/s0022-3476(85)80501-1.

Para uso em nuvem: os PDFs restritos podem ser obtidos pelo conector do Google Drive (buscar pelos nomes acima) ou enviados manualmente para a sessão. Os JSON derivados devem ser salvos de volta no Drive (mesma pasta, subpasta sugerida `curvas-crescimento-referencias/`), nunca no repositório.

## Pendências técnicas (para o plano)

1. Escolher fonte e conferir licença das tabelas OMS antes de versionar.
2. Confirmar no documento de métodos da OMS 2009 (https://www.who.int/publications/i/item/9789241547635) como aplicar os padrões de velocidade a intervalos observados diferentes dos nominais.
3. Gerar JSON de Kelly a partir do suplementar.
4. Digitalizar Tanner (renderizar p. 5 e 7 em ≥ 300 dpi, calibrar pela grade, extrair as 7 curvas em passo de 0,25 ano) e registrar o erro contra a Tabela I.
5. Definir limites de plausibilidade da estatura.
6. Formato do JSON de referência carregável (metadados: fonte, versão, método, erro medido).
