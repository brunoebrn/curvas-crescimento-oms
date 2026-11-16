# Curvas de crescimento e critérios auxológicos do PCDT de deficiência de GH

Página estática para plotar estatura para idade (OMS 2006/2007) e velocidade de crescimento, e verificar os critérios auxológicos de investigação do PCDT de deficiência de GH (Portaria Conjunta SAS/SCTIE nº 28, de 30/11/2018, item 3.1). Uso: avaliação no CEAF (SESAU/AL).

Página: https://brunoebrn.github.io/curvas-crescimento-oms/

## Privacidade

Nenhum dado de paciente é armazenado ou transmitido. Tudo roda no navegador, o estado fica só em memória e some ao fechar ou recarregar a página. Não há `localStorage`, cookies nem chamadas a outros servidores.

## Referências de velocidade

Todas vêm embutidas e carregam sozinhas; o usuário não anexa nada.

- Antes dos 2 anos: OMS 2009.
- A partir de 5,5 anos: Kelly et al. 2014 (Tabelas Suplementares S2a e S2b), incluído com autorização declarada pelo mantenedor.
- De 2 a 5,5 anos: Tanner & Davies 1985, ainda não incluído (falta digitalizar as curvas). Nessa faixa o critério de VC fica "não avaliável" no automático e pode ser classificado manualmente.

## Rodar e testar localmente

```bash
python3 -m http.server 8000
```

Abrir http://localhost:8000/. Não há etapa de build.

```bash
npm test
```

```bash
python3 -m unittest discover -s tests/scripts -v
```

```bash
node tests/e2e/verificar.mjs
```

O primeiro comando testa os módulos de cálculo (Node 20 ou mais recente, sem dependências). O segundo testa os scripts de dados. O terceiro abre a página num Chromium headless e exige o pacote `playwright` instalado no ambiente.

## Licenças dos dados

Ver `data/README.md`. As tabelas de estatura vêm dos pacotes `anthro` e `anthroplus` da OMS (GPL-3). As tabelas de velocidade de 2009 são © World Health Organization, reproduzidas com atribuição para uso educacional não comercial. As tabelas de Kelly 2014 são copyright da Endocrine Society. A OMS não endossa esta ferramenta. uPlot (em `vendor/`) é MIT.

## Aviso

Ferramenta de apoio. Atender a um critério auxológico indica investigação, não inclusão. Não substitui o julgamento clínico nem a leitura do PCDT.
