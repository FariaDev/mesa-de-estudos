# Peças do lançamento v1.0.0 (#68)

As notas e as imagens estão fechadas (a #67 entrou em "Acessibilidade e desempenho").

| Arquivo | Tamanho | Uso |
|---|---|---|
| `notas.md` | | corpo do `gh release create v1.0.0` (tirar o comentário do topo antes) |
| `mesa-1.0-novidades.png` e `@2x` | 1600×1000 e 3200×2000 | imagem de novidades |
| `social-preview.png` | 1280×640 | prévia social do repositório público |
| `banner-readme.png` | 1600×400 | topo do README |
| `trio-logo-quadrado.png` | 1080×1080 | post |
| `revisao.html` | | todas as peças lado a lado, para aprovar ou pedir ajuste |

Cada imagem tem a versão em inglês com o sufixo `-en` (por exemplo `social-preview-en.png`), com o nome "Study Desk" do app em inglês.

## Fontes

Cada imagem é um HTML em `src/`, com `src/release.css`. Ele importa
`desk/src/fonts.css` (STIX Two Text) e `desk/src/trio.css`, e copia os tokens
do tema claro de `desk/style.css` com o acento violeta do ícone do pacote.

Os textos traduzíveis têm `data-t`; o inglês fica em `src/en.json`, com os nomes do catálogo do app (`desk/locales/en.json`). Texto novo numa peça pede a chave lá, ou o render falha.

O HTML só marca onde vai a arte (`data-logo` e `data-trio`). Quem desenha é
`src/render.cjs`, com o SVG real:

- logo G1 de `desk/scripts/app-icon-art.mjs` (`appIconSvg('violet')`);
- trio de `desk/src/trio-art.mjs` (`trioSvg`), com os humores pelo `trio.css`.
  A ∫ está em `lendo`, o Σ com o ✓ da soma (`mascote-tallying`) e o ∇ em
  `atento`, com o "!" da dica.

Aberto direto no navegador, o HTML mostra o texto sem a arte.

## Regenerar

Em `desk/`, com as dependências instaladas:

```sh
node_modules/.bin/electron ../docs/release-assets/v1.0.0/src/render.cjs
node_modules/.bin/electron ../docs/release-assets/v1.0.0/src/render.cjs novidades.html   # só uma peça
```

O script carrega cada HTML no Chromium do Electron, põe a arte, espera a STIX
(falha se ela não carregar) e tira o PNG pelo DevTools no tamanho exato. A
`@2x` sai da mesma página com escala 2. Nada é gerado por IA, e não há material
de curso, PDF real nem conversa nas peças.

Mudou a arte no app (logo, trio ou acento)? Rode o script de novo: as peças
pegam a versão atual de `desk/`.
