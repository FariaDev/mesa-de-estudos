# #65 — ícone do app: G2 (folha com a ∫ e o visto)

## O que mudou

- `desk/scripts/app-icon-art.mjs`: o `checklist` (F1) saiu; entram `integral()` (∫ em traço de pincel, cor `mixOklab(acento, 70, '#1a1033')`, largura 54) e o visto âmbar (`M556 700l30 30 64-74`, largura 34). Fundo, sombra, dobra, giro de -4°, os seis acentos, o violeta do pacote e a grade do macOS ficaram iguais. O comentário do topo cita a #65.
- Pincel: `feTurbulence` + `feDisplacementMap` (filtro `brush`, dentro do `<defs>` de `background`). O Chromium do Electron rasteriza igual ao protótipo, então não foi preciso desenhar a borda no path.
- `desk/tests/app-icon-art.test.mjs`: o SVG tem a ∫ (com o filtro), o visto e a cor derivada do acento, e não tem mais o cinza da lista (`#c9c1ad`). O caso do acento desconhecido continua.
- `docs/design/identidade/decisoes.md`: linha 2 da tabela atualizada para G2; nota acrescentada no fim.
- `desk/app-icon-host.cjs` e `config.cjs` não foram tocados.

## Assets regenerados (`node_modules/.bin/electron scripts/app-icons.cjs`, em `desk/`)

- `desk/assets/mesa.svg`, `mesa-dock.svg`, `mesa-1024.png`, `mesa.icns`, `mesa.ico`
- `desk/assets/app-icon/mesa-<acento>.svg`, `mesa-<acento>-dock.png`, `mesa-<acento>-256.png` (blue, violet, green, orange, pink, graphite)

## Portões

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | ok: 68 artefatos reproduzíveis, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | 1971 de 1971 passam |
| `npm run ui -- accent,topbar,tutor-header,about` | 4 janelas ok, 0 falhas (about, accent, tutor-header, topbar) |

## Notas

- Conferido a olho: `mesa-1024.png` e versões de 16 e 32 px (reduzidas do `-256.png` e ampliadas). Em 32 px a ∫ e o visto aparecem, com o visto pequeno. Em 16 px a ∫ vira uma barra escura e o visto, um ponto âmbar; a folha creme ainda se lê, mas a ∫ já não. É a limitação esperada da G2 nesse tamanho.
- Não conferido: 64 px, Dock claro e escuro.
- Rodei `npm ci` no worktree (não havia `node_modules`). Nada commitado, nada enviado. A issue segue aberta.
