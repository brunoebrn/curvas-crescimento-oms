# curvas-crescimento-oms

Ferramenta web estática (GitHub Pages) para plotar estatura e velocidade de crescimento (OMS e referências de VC) e verificar os critérios auxológicos do PCDT de deficiência de GH (CEAF, SESAU/AL). Nada de dado de paciente é armazenado ou transmitido.

## Regras do repositório

- Idioma: português do Brasil em interface, código comentado, docs e commits. Usar en dash (–), nunca em dash.
- Não afirmar nada sem fonte verificável; não inventar referências. Na dúvida, perguntar ao Bruno em múltipla escolha.
- Repositório público: NUNCA versionar dados restritos (Kelly 2014, Tanner & Davies 1985, nem JSON derivados deles, nem os PDFs, nem imagens ou CSV de pontos). Eles ficam no Drive e são carregados pelo usuário no navegador. `.gitignore` bloqueia `referencias-restritas/`. Testes usam só dados sintéticos (`tests/_sinteticos.js`).
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

Digitalizar Tanner & Davies 1985 (ver `docs/HANDOFF.md`, pendência 1).
