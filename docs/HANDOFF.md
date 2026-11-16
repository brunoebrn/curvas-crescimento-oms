# Handoff – estado, decisões, pendências e roteiro de teste (16/11/2026)

Documento para retomar o projeto em qualquer ambiente. Design: `docs/superpowers/specs/2026-11-15-curvas-crescimento-pcdt-gh-design.md`. Plano: `docs/superpowers/plans/2026-11-16-curvas-crescimento-pcdt-gh.md`.

## Situação

Implementado e publicado na branch `main` (GitHub Pages pela raiz): https://brunoebrn.github.io/curvas-crescimento-oms/

Se a página não abrir, falta ligar o Pages uma vez: no repositório, Settings → Pages → Source "Deploy from a branch", branch `main`, pasta `/ (root)`.

Feito em 16/11/2026:

- Módulos de cálculo com TDD (65 testes, `npm test`): normal padrão, idade, estatura para idade OMS 2006/2007, estatura-alvo, VC, referências (OMS 2009, Kelly, Tanner, guia SBP), validação de entrada, checklist C1–C3, modelo da tela.
- Dados OMS versionados em `data/` com atribuição e licença (`data/README.md`); z-score testado contra valores das tabelas oficiais.
- Scripts de dados restritos (14 testes, `python3 -m unittest discover -s tests/scripts -v`): extração de Kelly e digitalização assistida de Tanner.
- JSON de Kelly gerado, salvo no Drive (Trabalho/SESAU/Assistência Farmacêutica/CEAF/curvas-crescimento-referencias/`kelly-2014.json`) e, desde a segunda rodada de 16/11/2026, versionado em `data/kelly-2014.json` e carregado sozinho pela página.
- Tela simplificada (segunda rodada): nenhuma referência precisa ser anexada; medidas todas por data ou todas por idade (um seletor só); o intervalo de VC do checklist é escolhido sozinho (par que termina na última medida mais próximo de 12 meses; antes dos 2 anos, o intervalo mais recente); troca de intervalo, classificação manual, tabela de Kelly e upload de referência alternativa ficam recolhidos; "Como interpretar" recolhido.
- Interface em `index.html` (entrada, validações, dois gráficos, tabelas, checklist com classificação manual, ajuda, fontes, exemplo fictício).
- Verificação de ponta a ponta no Chromium headless (11 checagens, `node tests/e2e/verificar.mjs`), incluindo estados "não avaliável", ausência de armazenamento e de requisições externas, e largura de 390 px.
- Detector de anti-padrões do Impeccable (`npx impeccable detect index.html`): sem achados.

## Pendências

1. **Tanner & Davies 1985 não foi digitalizado nem incluído.** Quando o JSON existir, salvar como `data/tanner-1985.json`, trocar `"tanner":null` por `"tanner":"tanner-1985.json"` em `data/referencias.json` e fazer push: a página passa a carregá-lo sozinha. O PDF tem 21,6 MB e o conector do Google Drive recusa arquivos acima de 10 MB ("File too large for download, over limit of 10 MB"). Os scripts estão prontos e testados com dados sintéticos. Duas saídas:
   - Local (roteiro abaixo, cerca de 30 a 40 minutos de marcação de pontos).
   - Em nuvem: salvar no Drive um PDF menor que 10 MB só com as páginas 3, 5, 7 e 8 e pedir a uma nova sessão que faça a digitalização.
2. **Sem Tanner, a faixa de 2 a 5,5 anos fica "não avaliável" no automático** (classificação manual disponível em "Trocar o intervalo ou classificar manualmente"). É a única parte que ainda não vem automática.
   - A autorização para versionar Kelly e Tanner foi declarada pelo Bruno; o documento não está no repositório. Vale guardá-lo junto dos PDFs no Drive.
3. **Licença das tabelas de velocidade OMS 2009**: versionadas por decisão do Bruno, sem permissão explícita da OMS. Opcional: pedir permissão em https://www.who.int/about/policies/publishing/permissions (a publicação indica permissions@who.int). Se a OMS negar, remover `data/oms-velocidade-2009.json` e torná-lo carregável.
4. **O repositório não tem arquivo LICENSE próprio.** Os dados de estatura são GPL-3; definir a licença do código é decisão do Bruno.
5. Fora do escopo desta entrega (seção 7 da especificação): impressão/PDF, IGF-1, idade óssea, testes de estímulo.

## Como digitalizar Tanner localmente

Dependência: `pip install pymupdf`. Todos os arquivos ficam em `referencias-restritas/` (ignorada pelo git).

```bash
python3 scripts/tanner_renderizar.py --pdf "referencias-restritas/Tanner e Davies 1985 - Curvas de velocidade de crescimento.pdf" --paginas 5 7 --dpi 300 --saida referencias-restritas/
```

Abrir `scripts/tanner-marcador.html` no navegador (duplo clique). Para cada figura (página 5 = meninos, página 7 = meninas): carregar o PNG, marcar pelo menos 4 cruzamentos da grade em modo calibração (idade e VC conhecidas, bem espalhados), marcar pontos ao longo de cada uma das 7 curvas de 2 a 19 anos (mais pontos no pico puberal, mínimo de 8 por curva) e baixar o CSV. Salvar como `referencias-restritas/tanner-pontos-M.csv` e `tanner-pontos-F.csv`.

Digitar o P50 da Tabela I (página 3 do PDF, maturação média) em `referencias-restritas/tanner-tabela-p50.csv`, com cabeçalho `sexo,idade,p50` e uma linha por idade (sexo `M` ou `F`).

```bash
python3 scripts/tanner_digitalizar.py --pontos-m referencias-restritas/tanner-pontos-M.csv --pontos-f referencias-restritas/tanner-pontos-F.csv --tabela-p50 referencias-restritas/tanner-tabela-p50.csv --saida data/tanner-1985.json
```

O script informa o resíduo da calibração e o erro máximo do P50. Acima de 0,2 cm/ano o JSON sai marcado como de baixa confiança (a página avisa). Depois, ativar em `data/referencias.json` (pendência 1) e guardar uma cópia na pasta do Drive do `kelly-2014.json`.

## Como regerar o JSON de Kelly

Dependência: `pip install pdfplumber`.

```bash
python3 scripts/extrair_kelly.py --pdf referencias-restritas/kelly-2014-suplementar.pdf --saida data/kelly-2014.json
```

## Roteiro de teste para validação

1. Abrir a página. Sem dados, os três critérios aparecem como "Não avaliável" e os gráficos pedem o sexo.
2. Clicar em "Carregar exemplo fictício" (menino, 5 medidas, z de estatura perto de −2,6), sem anexar nada. Esperado: C1 não atende; C2 atende (Kelly 2014, VC de 3,6 cm/ano em 12,0 meses, z perto de −2,4); C3 não atende; estatura-alvo 171,5 cm; 5 linhas em "Resultados por medida" e 5 em "Resultados por intervalo" (4 consecutivos mais o par de 12 meses, destacado).
3. Abrir "Trocar o intervalo ou classificar manualmente" e escolher o intervalo de 6 meses (8 a 6 m → 9 a 0 m). Esperado: ressalva de intervalo fora de 11 a 13 meses. Voltar para "Automático".
4. No mesmo bloco, em "Classificação de C3", escolher "Manual: atende". Esperado: selo "Atende" com a marca "classificação manual" e a linha "Automático: não atende". Voltar para "Automática".
5. "Novo paciente", sexo masculino, "Por idade": 3 a 0 m com 89 cm e 4 a 0 m com 94 cm. Esperado: C2 não avaliável, com motivo citando Tanner, e guia SBP de 7 cm/ano na tabela de intervalos.
6. Em "Opções avançadas", trocar a tabela de Kelly (precoce, média, tardia) num paciente de 5,5 anos ou mais e ver o z da VC mudar.
7. Alternar os gráficos entre "Medidas" e "0 a 19 anos". Em 0 a 19 anos, a faixa da estatura-alvo aparece aos 19 anos.
8. Validações: adicionar medida com data futura, anterior ao nascimento, repetida, ou com estatura 3 cm menor que a anterior. Esperado: erro ou alerta ao lado da linha; linhas com erro não entram no cálculo.
9. "Novo paciente", sexo feminino, "Por idade" (o campo de nascimento some): 0 a 6 m com 64 cm e 1 a 0 m com 70 cm. Esperado: VC avaliada pela "OMS 2009 (incremento de 6 meses, 6–12 meses)".
10. Recarregar a página: os dados do paciente somem.
11. Conferir no celular (uma coluna, sem rolagem horizontal da página).
12. Conferência cruzada sugerida: comparar o z de estatura de 2 ou 3 pacientes reais com o WHO Anthro/AnthroPlus.

## Limitações conhecidas

- A tabela OMS 2006 por dia vai de 0 a 1826 dias (não 1856, como dizia a especificação). De 1827 dias em diante vale a OMS 2007 (que tem linha de 60 meses). Há um degrau pequeno na troca de tabela e outro aos 2 anos (deitado para em pé), ambos das próprias tabelas.
- OMS 2009: a tolerância por medida (±3, ±5, ±7 dias) foi aplicada à duração do intervalo. O limite de rateio de 1 mês em torno do nominal é regra deste projeto, não da OMS. Usa-se a linha tabulada de início mais próximo (a OMS cita também interpolar L, M, S, não implementado).
- C3 antes dos 2 anos é avaliado com incrementos de até 6 meses (com ressalva), porque a OMS não tem padrão de 12 meses nessa idade. A partir de 2 anos, C3 exige intervalo de 0,85 a 1,15 ano; fora disso fica "não avaliável".
- C2 não exige janela mínima: a VC é avaliada com ressalva quando o intervalo sai da condição da referência (Kelly 11 a 13 meses; Tanner 0,85 a 1,15 ano).
- Kelly: no PDF, a coluna P90 impressa fica até 0,30 cm/ano acima do valor recalculado por LMS com z = 1,2816; P3, P10 e P97 ficam dentro do arredondamento (até 0,26). A ferramenta calcula z e desenha as curvas por L, M e S, não pelos percentis impressos. Algumas idades finais têm M = 0,0 (sem z) e percentis em branco.
- Kelly cobre de 5,5 a 18,5 anos (meninos) e 17,5 anos (meninas) na Tabela S2a; a S2b começa entre 6,25 e 6,5 anos e termina antes.
- Tanner: z estimado por interpolação entre curvas, supondo normalidade; fora de P3–P97 o z é limitado ao extremo (suficiente para C2 e C3).
- No gráfico de VC antes dos 2 anos, as curvas são os incrementos da OMS anualizados (tabela do intervalo nominal mais recente do paciente, ou 6 meses). Incrementos de intervalos diferentes não são comparáveis entre si depois de anualizados.
- Idade informada em anos e meses é convertida com mês de 30,4375 dias e arredondada para dias inteiros.
- O Impeccable foi usado pelo detector de linha de comando e pelas diretrizes da skill lidas do repositório do projeto no GitHub; a instalação da skill no ambiente falhou porque o proxy desta sessão bloqueia impeccable.style.
- A página depende de servidor HTTP (ES modules e `fetch`); não abre direto do arquivo.

## Decisões

Do Bruno, em 15/11/2026:

| Tema | Decisão |
|---|---|
| Faixa etária | 0 a 19 anos, curva contínua (OMS 2006 e 2007) |
| Entrada | Data ou idade por linha; sexo, data de nascimento, altura dos pais |
| Saídas | Gráfico de estatura (z), gráfico de VC, tabela com z/percentil e VC, estatura-alvo, checklist PCDT |
| Arquitetura | HTML único + JS puro, sem build, GitHub Pages |
| VC acima de 2 anos | Tanner & Davies 1985 (digitalizada) e Kelly 2014, selecionáveis |
| Arquivos restritos | Carregados no navegador a cada uso, fora do repositório (revertida em 16/11/2026, ver abaixo) |
| Intervalo entre medidas | Sem padronização: calcular sempre, alertar intervalos curtos |
| Checklist | Só critérios auxológicos |
| Deitado/em pé | Padrão (deitado < 2 anos), sem campo e sem ajuste |
| 2 a 5 anos sem Kelly | Variação do z OMS e faixas SBP como guia, além de Tanner |

Do Bruno, em 16/11/2026:

| Tema | Decisão |
|---|---|
| Tabelas de velocidade OMS 2009 | Versionar em `data/` só L, M, S, com atribuição e aviso de uso não comercial |
| Referências restritas | Reverte a decisão de 15/11: versionar e carregar automaticamente ("Pode versionar tudo. Já tive a autorização de tudo"). Kelly incluído por inteiro; Tanner entra quando digitalizado |
| Simplicidade | Tela simples e intuitiva, preenchendo só o essencial; usuário não anexa nada |

Tomadas na implementação (opção mais conservadora, revisáveis):

| Tema | Decisão | Base |
|---|---|---|
| Fonte OMS de estatura | TXT dos pacotes `anthro` e `anthroplus` (GPL-3) | Licença explícita no `DESCRIPTION` |
| Plausibilidade da estatura | Alerta com \|z\| > 6 | `flag_threshold = 6` do pacote `anthro` |
| z da velocidade OMS | LMS restrito além de ±3 DP; incremento nulo sem −3 DP definido usa o limite inferior | Métodos OMS 2009, cap. 6 |
| Rateio OMS 2009 | Até 1 mês do nominal; fora disso "não avaliável" | Regra do projeto |
| Janela do C3 | 0,85 a 1,15 ano a partir de 2 anos | Mesma faixa de "ano inteiro" de Tanner |
| Limite do P25 | z < −0,6745 (quantil exato) | Especificação cita −0,674 |
| Biblioteca de gráfico | uPlot 1.6.32 (MIT), vendorizada | – |
| "Novo paciente" | Limpa os dados e mantém as referências carregadas | Avaliações em sequência |
| Modo das medidas | Um seletor para todas as linhas (por data ou por idade), em vez de um por linha como na especificação | Pedido de simplicidade de 16/11 |
| Intervalo de VC do checklist | Automático: par terminando na última medida mais próximo de 12 meses (0,85 a 1,15 ano, ponto médio a partir de 2 anos); senão o mais recente. O avaliador pode trocar | Condição das referências anuais; pedido de simplicidade |
| Download das tabelas OMS | `curl` no script (o CDN da OMS responde 403 ao agente padrão do `urllib`) | – |
| Rede da sessão em nuvem | `iris.who.int` liberado no ambiente "Default" para ler o documento de métodos | Aprovado pelo Bruno no pedido da sessão |

## Fontes

PCDT

- Portaria Conjunta SAS/SCTIE nº 28, de 30/11/2018 (CID E23.0). Relatório CONITEC nº 351. Cópia no Drive: Trabalho/SESAU/Assistência Farmacêutica/CEAF/PCDT (ENDO_Hipopituitarismo-GH.pdf). Guia CEAF/AL atualizado em 27/04/2023.
- Critérios auxológicos no item 3.1: C1 z < −3; C2 z entre −3 e −2 e VC < P25; C3 z ≥ −2 e VC < −1 DP em 12 meses. Inclusão (item 4) exige teste de estímulo.

OMS

- Estatura 0 a 5 anos (2006): `data-raw/growthstandards/lenanthro.txt` em github.com/WorldHealthOrganization/anthro.
- Estatura 5 a 19 anos (2007): `data-raw/growthstandards/hfawho2007.txt` em github.com/WorldHealthOrganization/anthroplus.
- Velocidade de comprimento 0 a 24 meses (2009): https://www.who.int/tools/child-growth-standards/standards/length-velocity (tabelas XLSX de z-score).
- Métodos de velocidade: WHO Child Growth Standards: growth velocity based on weight, length and head circumference: methods and development. Geneva: WHO; 2009. ISBN 978 92 4 154763 5. https://www.who.int/publications/i/item/9789241547635 . Trechos usados: Tabela 2 (p. 7), cap. 6 (p. 223), "Measurement intervals in field application" (p. 233), nota de copyright.
- Termos de uso do site: https://www.who.int/about/policies/terms-of-use . Política de copyright: https://www.who.int/about/policies/publishing/copyright .

SBP

- Manual de Orientação nº 64 (08/05/2023): estatura-alvo (pai + mãe ± 13)/2 ± 5 cm; VC aproximada 2–4 anos ≈ 7 cm/ano, 4–6 anos ≈ 6 cm/ano. https://www.sbp.com.br/fileadmin/user_upload/24038c-ManOrient_-_AvalCrescim_o_que_PediatraPrecisaSaber.pdf

Kelly e Tanner (PDFs originais só no Drive, em Trabalho/SESAU/Assistência Farmacêutica/CEAF)

- `Kelly 2014 - Supplementary Data.pdf` (Tabelas S2a e S2b; doi 10.1210/jc.2013-4455; copyright Endocrine Society).
- `Tanner e Davies 1985 - Curvas de velocidade de crescimento.pdf` (Fig. 4, p. 5; Fig. 6, p. 7; Tabela I, p. 3; Tabela II, p. 8; doi 10.1016/s0022-3476(85)80501-1).
- Derivados: subpasta `curvas-crescimento-referencias/` (`kelly-2014.json`; `tanner-1985.json` quando existir).
