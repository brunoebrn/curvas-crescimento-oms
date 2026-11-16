# curvas-crescimento-oms

Ferramenta web estática (GitHub Pages) para plotar estatura e velocidade de crescimento (OMS e referências de VC) e verificar os critérios auxológicos do PCDT de deficiência de GH (CEAF, SESAU/AL). Nada de dado de paciente é armazenado ou transmitido.

## Regras do repositório

- Idioma: português do Brasil em interface, código comentado, docs e commits. Usar en dash (–), nunca em dash.
- Não afirmar nada sem fonte verificável; não inventar referências. Na dúvida, perguntar ao Bruno em múltipla escolha.
- Referências de VC vêm embutidas (decisão do Bruno em 16/11/2026, que declarou ter autorização para versionar tudo): `data/kelly-2014.json` já está no repositório e `data/tanner-1985.json` entra quando for digitalizado; `data/referencias.json` diz à página quais existem. Os PDFs originais, imagens renderizadas e CSV de pontos continuam fora do git (`referencias-restritas/`). Testes unitários usam só dados sintéticos (`tests/_sinteticos.js`).
- Tela simples: o usuário preenche só sexo, nascimento (ou idades), estaturas e, se quiser, estatura dos pais. Nada de exigir upload ou escolha de referência no fluxo normal; ajustes raros ficam recolhidos.
- Sem etapa de build: `index.html` (CSS embutido) + ES modules em `js/` + dados em `data/` + uPlot em `vendor/`. Módulos de cálculo puros, testados com Node.
- Nada de `localStorage`, cookies ou rede além dos arquivos do próprio site.

## Onde está tudo

- Design aprovado: `docs/superpowers/specs/2026-11-15-curvas-crescimento-pcdt-gh-design.md` (fonte de verdade).
- Plano executado: `docs/superpowers/plans/2026-11-16-curvas-crescimento-pcdt-gh.md`.
- Estado, decisões, pendências e roteiro de teste: `docs/HANDOFF.md`.
- Cálculo: `js/normal.js`, `idade.js`, `oms.js`, `alvo.js`, `vc.js`, `referencias.js`, `validacao.js`, `criterios.js`, `modelo.js` (junta tudo). Tela: `js/ui.js`, `js/graficos.js`.

## Comandos

- `npm test` – módulos de cálculo (Node, sem dependências).
- `python3 -m unittest discover -s tests/scripts -v` – scripts de dados.
- `node tests/e2e/verificar.mjs` – ponta a ponta no Chromium (precisa de `playwright` no ambiente).
- `python3 -m http.server 8000` – servir localmente.

## Próximo passo

Digitalizar Tanner & Davies 1985 e incluí-lo em `data/` (ver `docs/HANDOFF.md`, pendência 1).
