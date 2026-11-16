# Dados de referência versionados

Gerados por `python3 scripts/gerar_dados_oms.py` em 16/11/2026. Cada JSON traz em `meta` a URL de origem, a data do download e o SHA-256 do arquivo original. Os valores não foram alterados: só mudou o formato (texto/XLSX para JSON).

| Arquivo | Conteúdo | Origem | Licença |
|---|---|---|---|
| `oms-estatura-2006.json` | Comprimento/estatura para idade, 0 a 1826 dias, M e S por dia e sexo (L = 1) | `data-raw/growthstandards/lenanthro.txt` do pacote R `anthro`, https://github.com/WorldHealthOrganization/anthro | GPL-3 (campo `License` do `DESCRIPTION` do pacote) |
| `oms-estatura-2007.json` | Estatura para idade, 60 a 228 meses, M e S por mês e sexo (L = 1) | `data-raw/growthstandards/hfawho2007.txt` do pacote R `anthroplus`, https://github.com/WorldHealthOrganization/anthroplus | GPL (>= 3) (campo `License` do `DESCRIPTION` do pacote) |
| `kelly-2014.json` | Velocidade de estatura anual, Tabelas Suplementares S2a e S2b: L, S, M e percentis impressos por idade, sexo e tempo de maturação | PDF suplementar de Kelly et al. 2014, extraído por `scripts/extrair_kelly.py` | Copyright Endocrine Society (ver abaixo) |
| `referencias.json` | Lista das referências de VC incluídas, lida pela página ao abrir | – | – |
| `oms-velocidade-2009.json` | Incrementos de comprimento em 2, 3, 4 e 6 meses, 0 a 24 meses, L, M e S por intervalo e sexo | Tabelas de z-score em XLSX de https://www.who.int/tools/child-growth-standards/standards/length-velocity | Sem licença aberta (ver abaixo) |

## Atribuição

- WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards: length/height-for-age, weight-for-age, weight-for-length, weight-for-height and body mass index-for-age: methods and development. Geneva: World Health Organization; 2006.
- de Onis M, Onyango AW, Borghi E, Siyam A, Nishida C, Siekmann J. Development of a WHO growth reference for school-aged children and adolescents. Bull World Health Organ. 2007;85:660–7.
- Kelly A, Winer KK, Kalkwarf H, et al. Age-based reference ranges for annual height velocity in US children. J Clin Endocrinol Metab. 2014;99(6):2104–12. doi 10.1210/jc.2013-4455.
- WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards: growth velocity based on weight, length and head circumference: methods and development. Geneva: World Health Organization; 2009. ISBN 978 92 4 154763 5.

## Ressalva sobre a velocidade (OMS 2009)

A publicação de 2009 traz "© World Health Organization 2009. All rights reserved" e pede que pedidos de reprodução sejam enviados à WHO Press (permissions@who.int). Os termos de uso do site da OMS (https://www.who.int/about/policies/terms-of-use) permitem reproduzir extratos para pesquisa ou estudo, sem fins comerciais, com indicação da OMS como fonte e da URL; reprodução de partes substanciais ou uso não educacional exigem autorização escrita.

Este repositório reproduz apenas os parâmetros L, M e S das tabelas de z-score de incremento de comprimento, com a fonte e a URL acima, para uso educacional e assistencial não comercial. Não há permissão explícita da OMS para esta reprodução; a decisão de versionar foi tomada em 16/11/2026 e está registrada em `docs/HANDOFF.md`. Se a OMS solicitar, o arquivo será removido e passará a ser carregado pelo usuário, como as referências restritas.

A OMS não endossa esta ferramenta. Os dados são fornecidos sem garantia de qualquer natureza.

## Kelly et al. 2014

O material suplementar é protegido por direito autoral (Endocrine Society). Ele foi incluído em 16/11/2026 por decisão do mantenedor do repositório (Bruno), que declarou ter autorização para versionar as referências. O documento de autorização não está neste repositório; quem reutilizar estes dados deve obter a própria permissão. No PDF, a coluna P90 impressa fica até 0,30 cm/ano acima do valor recalculado por LMS; a ferramenta calcula z e curvas por L, M e S.

## O que não está aqui

Tanner & Davies 1985 ainda não foi digitalizado. Quando for, o JSON entra aqui como `tanner-1985.json` e é ativado em `referencias.json`. Os PDFs originais, as imagens renderizadas e os CSV de pontos não são versionados. Ver `docs/HANDOFF.md`.
