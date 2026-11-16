# Curvas de crescimento OMS e critérios auxológicos do PCDT de deficiência de GH – design

Data: 15/11/2026. Status: aprovado em brainstorming (arquitetura, seção 1 e seção 2).

## 1. Objetivo

Ferramenta web estática, hospedada no GitHub Pages, para o avaliador do CEAF (SESAU/AL) plotar estatura e velocidade de crescimento (VC) de crianças e adolescentes a partir de dados de prontuário e verificar os critérios auxológicos do PCDT de deficiência de GH. Nenhum dado de paciente é armazenado ou transmitido: tudo roda no navegador e some ao fechar a página.

Usuário inicial: médico avaliador. Usuário posterior: equipe de avaliadores do CEAF. Por isso há textos de ajuda e validação de entrada.

## 2. Base normativa

PCDT vigente: Portaria Conjunta SAS/SCTIE nº 28, de 30/11/2018 (CID E23.0). Cópia em Drive: Trabalho/SESAU/Assistência Farmacêutica/CEAF/PCDT (ENDO_Hipopituitarismo-GH.pdf).

Os critérios auxológicos estão no item 3.1 ("quando investigar"), não no item 4 (inclusão). A inclusão exige ainda deficiência de GH comprovada por teste de estímulo. A ferramenta rotula o checklist como "Critérios auxológicos de investigação (PCDT, item 3.1)" e avisa que atendê-los não basta para inclusão.

- C1: estatura < −3 DP (OMS).
- C2: estatura entre −3 e −2 DP e VC < P25 da curva de velocidade (PCDT cita Tanner & Davies 1985 e Rosenfield 1988).
- C3: estatura ≥ −2 DP e VC < −1 DP em 12 meses.

Divergência registrada: o guia CEAF/AL (2023) pede "1 teste de estímulo"; o PCDT exige 2 na deficiência isolada. Fora do escopo do checklist (só auxológicos), mas citada na ajuda.

## 3. Arquitetura

- Um único `index.html` com JavaScript puro e CSS embutido, mais arquivos de dados em `data/`. Sem etapa de build. Deploy por push na branch principal (GitHub Pages).
- Biblioteca de gráfico leve via arquivo local vendorizado (sem CDN em tempo de uso), a escolher no plano.
- Módulos JS separados por responsabilidade, carregados como ES modules: `idade`, `oms` (estatura para idade), `vc` (velocidade e referências), `alvo` (estatura-alvo), `criterios` (checklist), `validacao`, `ui`. Cada módulo de cálculo é puro e testável sem DOM.
- Testes unitários dos módulos de cálculo com valores de referência conhecidos (tabelas OMS, Tabela I de Tanner, Tabela S2 de Kelly), executáveis com Node sem dependências pesadas.

## 4. Dados de referência

Públicos (no repositório, com atribuição e licença conferida no plano):

- OMS 2006, comprimento/estatura para idade, 0 a 1856 dias, por sexo (L, M, S; L = 1). Fonte: tabelas expandidas da OMS ou `lenanthro.txt` do repositório WorldHealthOrganization/anthro.
- OMS 2007, estatura para idade, 61 a 228 meses, por sexo. Fonte: tabelas da OMS ou `hfawho2007.txt` de WorldHealthOrganization/anthroplus.
- OMS 2009, padrões de velocidade de comprimento, 0 a 24 meses, incrementos de 2, 3, 4 e 6 meses.
- Faixas aproximadas de VC da SBP (manual nº 64, 2023): cerca de 7 cm/ano dos 2 aos 4 anos e 6 cm/ano dos 4 aos 6 anos. Uso apenas como guia visual.

Restritos (não ficam no repositório; o usuário carrega o arquivo no navegador a cada uso):

- Kelly et al. 2014, Supplemental Table 2a (todos) e 2b (maturação precoce, média, tardia): L, M, S e P3/P10/P50/P90/P97 de 5,5 a cerca de 17,5 anos, passo de 0,25 ano. Extraídos para um JSON gerado a partir do PDF suplementar e guardado na pasta CEAF do Drive.
- Tanner & Davies 1985, Figuras 4 (meninos) e 6 (meninas): curvas de VC P3, P10, P25, P50, P75, P90, P97 para maturação média, de 2 a 19 anos. Digitalizadas a partir do PDF em alta resolução, calibradas pela grade, validadas contra o P50 numérico da Tabela I (critério de aceite: diferença máxima de 0,2 cm/ano em cada idade inteira; se não atingir, os valores são marcados como de baixa confiança). JSON guardado no Drive, com o erro medido registrado no próprio arquivo.

Formato único de arquivo de referência carregável (JSON com metadados de fonte, versão e método), validado ao carregar. A ferramenta funciona sem esses arquivos; apenas as partes dependentes ficam como "não avaliável".

## 5. Telas e fluxo

Entrada:

- Sexo, data de nascimento, estatura do pai e da mãe (opcionais).
- Carregar arquivos de referência (Kelly, Tanner), com indicação do que está ativo.
- Tabela editável de medidas: por linha, data da medida ou idade (anos e meses), e estatura em cm.

Validação:

- Data futura ou anterior ao nascimento; idade acima de 19 anos (recusa).
- Estatura fora de faixa plausível para a idade (alerta; limite definido no plano a partir de z extremos da OMS).
- Queda de estatura maior que 1 cm entre medidas consecutivas (alerta de provável erro).
- Datas duplicadas.

Saídas:

1. Gráfico de estatura para idade: linhas z −3, −2, 0, +2, +3 (OMS contínua), pontos do paciente, faixa da estatura-alvo.
2. Gráfico de VC: referência conforme a faixa etária (seção 6), pontos de VC no ponto médio do intervalo.
3. Tabela por medida: idade, estatura, z, percentil; por intervalo: duração, VC em cm/ano, referência usada, z/percentil da VC, alertas.
4. Checklist C1, C2, C3 com status atende / não atende / não avaliável, motivo e referência usada; campo de classificação manual por critério, que prevalece sobre o automático e fica identificado como manual.
5. Rodapé com fontes, versão do PCDT e aviso de que os critérios auxológicos são de investigação.

Ajuda: texto curto junto a cada campo e seção "Como interpretar". Impressão/PDF fora do escopo inicial.

## 6. Regras de cálculo

Idade: em dias a partir das datas, ou informada em anos e meses (convertida em dias com mês = 30,4375 dias). Idade decimal = dias/365,25.

Estatura para idade:

- Até 60 meses completos: OMS 2006 por dia.
- De 61 a 228 meses: OMS 2007 mensal, com interpolação linear de M e DP entre meses.
- z = (estatura − M)/DP (L = 1 nas duas tabelas; sem correção de z restrita, que a OMS aplica só a indicadores de peso). Percentil pela normal padrão.
- Posição: deitado antes de 2 anos e em pé depois; sem ajuste de 0,7 cm.

Estatura-alvo (SBP 2023): meninos (pai + mãe + 13)/2, meninas (pai + mãe − 13)/2, faixa ±5 cm, convertida em z aos 19 anos (OMS 2007, 228 meses).

VC:

- Calculada entre medidas consecutivas em cm/ano e plotada no ponto médio; o usuário pode escolher qualquer par adicional (por exemplo, janela de cerca de 12 meses).
- Intervalo menor que 6 meses: alerta de baixa confiabilidade. VC negativa: alerta de provável erro.

Referência de VC por idade no ponto médio:

| Faixa | Referência | Uso no checklist |
|---|---|---|
| Menos de 24 meses | OMS 2009, tabela do incremento mais próximo do intervalo observado; regra de tolerância a confirmar no documento de métodos da OMS | Automático com ressalva |
| 2 anos até 5,5 anos | Tanner (se carregado); sempre: cm/ano, variação do z OMS e faixas SBP como guia | Tanner: automático aproximado; sem Tanner: manual |
| A partir de 5,5 anos | Kelly (se carregado), z pelo LMS; intervalo de 11 a 13 meses exigido pela referência, senão alerta "fora da condição da referência". Tanner também disponível, selecionável | Automático |
| Qualquer idade | Classificação manual | Prevalece se preenchida |

Kelly: z = ((VC/M)^L − 1)/(L·S), com interpolação linear de L, M, S entre idades da tabela. Usa a Tabela 2a por padrão; 2b selecionável se o avaliador souber o tempo de maturação.

Tanner: percentil por interpolação entre as curvas digitalizadas; z estimado assumindo normalidade (P25 → z −0,674; −1 DP ≈ P16, interpolado entre P10 e P25). Alerta quando o intervalo sai de 0,85 a 1,15 ano (condição de velocidade de ano inteiro definida pelos autores).

Checklist (medida mais recente para a estatura; VC do intervalo mais recente que termina nela, ou do par escolhido):

- C1: z < −3.
- C2: −3 ≤ z < −2 e VC abaixo do P25 (z de VC < −0,674).
- C3: z ≥ −2 e VC < −1 DP em janela de cerca de 12 meses.
- Não avaliável quando falta VC, a referência não cobre a idade ou não está carregada, sempre com o motivo.

## 7. Fora do escopo

Armazenamento de dados, login, testes de estímulo de GH, IGF-1, idade óssea, critérios de exclusão, exportação para PDF, peso e IMC.

## 8. Pendências para o plano

- Confirmar licença de uso das tabelas OMS no repositório e escolher a fonte (XLSX da OMS ou TXT dos repositórios anthro/anthroplus).
- Confirmar no documento de métodos da OMS 2009 a regra de aplicação dos padrões de velocidade a intervalos observados diferentes dos nominais.
- Digitalizar Tanner com validação contra a Tabela I e registrar o erro.
- Definir limites de plausibilidade da estatura.
