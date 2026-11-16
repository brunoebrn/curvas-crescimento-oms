# curvas-crescimento-oms

Ferramenta web estática (GitHub Pages) para plotar estatura e velocidade de crescimento (OMS e referências de VC) e verificar os critérios auxológicos do PCDT de deficiência de GH (CEAF, SESAU/AL). Nada de dado de paciente é armazenado ou transmitido.

## Regras do repositório

- Idioma: português do Brasil em interface, código comentado, docs e commits. Usar en dash (–), nunca em dash.
- Não afirmar nada sem fonte verificável; não inventar referências. Na dúvida, perguntar ao Bruno em múltipla escolha.
- Repositório público: NUNCA versionar dados restritos (Kelly 2014, Tanner & Davies 1985, nem JSON derivados deles, nem os PDFs). Eles ficam no Drive e são carregados pelo usuário no navegador. `.gitignore` bloqueia `referencias-restritas/`.
- Sem etapa de build: HTML + JS puro (ES modules) + dados em `data/`. Módulos de cálculo puros, testados com Node.

## Onde está tudo

- Design aprovado: `docs/superpowers/specs/2026-11-15-curvas-crescimento-pcdt-gh-design.md` (fonte de verdade).
- Contexto, decisões, fontes e próximos passos: `docs/HANDOFF.md`.

## Próximo passo

Design aprovado em 15/11/2026. Próxima etapa: plano de implementação (skill `superpowers:writing-plans`), depois execução com TDD.
