# Revisão dos residuais r6/r7 — PDF/template/prévia (v3) — 2026-10-08

**Escopo**: `desk/src/materials/template.mjs` (v3), `print.mjs`/`print.html`/`print.css`/`pdf-template.css`,
`material-pdf.cjs`, prévia de `free-study.mjs`, regiões PDF de `main.cjs`/`preload.cjs` e
`material-preview-host.cjs`. Timeline/atividade/núcleo ficaram fora (trabalho concorrente). **Somente leitura no
produto; nenhum arquivo de produto/teste foi editado, nada commitado/instalado/publicado.** Sondas em
`/private/tmp/mesa-residual-review-r7`; PDFs sintéticos preservados em `/private/tmp/mesa-pdf-v3-visual-proof`.

**Revisão fixada** (sha256 no momento das provas): `template.mjs`
`4c3f2d9b…946b690` · `material-pdf.cjs` `810467b3…e59125` · `print.mjs` `4c7b3097…89b3bd` ·
`pdf-template.css` `c349d3d7…b75ff61`.

## Veredito por achado

| Achado original (r4/r5/r6) | Veredito r7 | Evidência/observação |
|---|---|---|
| **P1-1** listas/citações: fórmula de continuação sumia; código citado virava math | **Resolvido** nos originais e em variações próprias | `checkMaterialMath`/`tokenizeMaterial`: `- item\n\n    $x+1$…` e `> …\n>\n>     $\frac{1}{$` corretos |
| **P2-1** headings aninhados não desciam (2× H1) | **Resolvido** (ATX/setext, citação, lista, aninhado, CRLF) | `prepareMaterialMarkdown` edita por offsets preservando `>`/recuo |
| **P2-2** CRLF/CR pulavam a reescrita | **Resolvido** | `normalizeLineEndings` em entry; CRLF+tab reescrito sem `heading-rewrite-skipped` |
| **P2-3** placeholder de math em atributo | **Resolvido** | `href="$a$"`, `title="$b$"`, sem HTML do KaTeX, sem placeholder vazado (DOM real) |
| **R6 residual 1** — tab no recuo caía no fallback global, math literal **sem aviso** com título vazio | **Resolvido** | `matchSourceLine`/`locateRaw` casam fonte real; guarda `code-protection-fallback` (warning) emitida por `checkMaterialMath` **e** `renderMaterialHtml` com ou sem título |
| **R6 residual 2** — `<h1>` cru do conteúdo gerava 2 H1 | **Resolvido** | `demoteContentHeadings` pós-DOMPurify, pré-título confiável: H1 único, atributos/filhos seguros mantidos, `onclick` removido |

Nenhum P0/P1/P2 novo. Limites herdados (não bloqueiam): fallback heurístico genuíno ainda sai literal — agora
com warning explícito; `renderMaterialHtml` sem DOM é caminho latente sem chamador de produto; fórmula larga
ajustada fica no piso legível (escala registrada).

## Sondas independentes do revisor (casos próprios, não fixtures do autor)

**Node puro — 39/39 em `/private/tmp/mesa-residual-review-r7/node-probe-result.json`:**

- `- item\n\n\t$x+1$ continuação\n` → math `['x+1']`, offsets reais (`source.slice(start,end) === '$x+1$'`),
  **sem** `code-protection-fallback`; idem `1)` / ordenada aninhada / citação / lista-em-citação / item com 2 espaços.
- Casos de prefixo (citação+tab, `1.`/`1)`, cerca `~~~` com tab, lista dentro de citação, 4 espaços × tab):
  math esperado com offsets na fonte; código com tab (1 e 2 tabs, cerca em lista/citação) permanece protegido.
- Dois blocos com tab → `['x','y']` com offsets distintos (não engoliu um ao outro); math em bloco normal
  (`Outra $z+1$`) **não** é afetada pelo tab/fallback.
- Fallback genuíno (`- item\n\n\t$x+1$…\n- ` com marcador pendente): `code-protection-fallback`
  `severity:'warning'` em `checkMaterialMath` e em `materialPdf.checkMaterial` **com título `''` e com título `T`**;
  `blocking.length===0` (aviso não bloqueia); caso corrigido não emite a guarda.
- Headings com tab: `- item\n\n\t# Sub\n` → `\t## Sub` (lead da fonte, sem `heading-rewrite-skipped`), aninhado
  `1. …\n\t1. sub\n\n\t\t# Deep` → `\t\t## Deep`, CRLF+tab idem; `> ## Já desceu` → `> ### Já desceu` (sem duplo shift).
- `MATERIAL_TEMPLATE_VERSION === 'material-2026-10-08.3'`.

**Electron real (renderer com DOM) — `/private/tmp/mesa-residual-review-r7/electron-probe-result3.json`:**

- `renderMaterialHtml({title:'', markdown: fallback})` → diagnóstico `code-protection-fallback` (warning),
  HTML sem KaTeX e com `$x+1$` literal; paridade com `checkMaterialMath`.
- `<h1 id="raw-h1-revisor" class="extra" data-keep="1" onclick="window.__pwned=true">Outro <em>H1</em> cru</h1>`:
  `h1Count===1` (só o título do campo), heading rebaixado para `H2` com `id/class/data-keep/<em>` preservados,
  `onclick===null`, `window.__pwned===null`; `href="$a$"`, `title="$b$"`, sem placeholder vazado.
- Documento longo real (`template-long` próprio): `h1Count=1`, título único, `listKatex=2`, `quoteKatex=1`,
  `literalTab=false` (t/n/q+1 viraram math), cerca com tab literal, `pwned=false`, fontes `loaded`.

## PDF real preservado para inspeção visual do root

Diretório **`/private/tmp/mesa-pdf-v3-visual-proof/`** (não será removido nesta rodada):

- `material-v3-longo.pdf` — 6 páginas A4, 229 023 B, sha256
  `c851f9f50cb83723b070997ee2936abdca32cde397af14d91be92eb3c131bbde`. Diagnósticos do host:
  `title-deduped`, `headings-shifted` (nenhum erro/fallback). `pdftotext`: título **1×**, `FIM-SONDA-V3`,
  `t + 1`/`n + 1`/`q + 1` como glifos, `$nao_e_math_tab$` literal, `<h1>` cru presente como “Outro H1 cru”,
  nenhum `$$`/`\frac` vazado.
- `material-v3-formula-larga.pdf` — 1 página A4, 38 265 B, sha256
  `0cb012c368a6171cf177a06a396e617b1638aa81e18f2ab07a2441ea8ad90212`. Diagnóstico `math-scaled`
  `scale=0.878` (warning), `overflows:[]`, 20 frações completas sem recorte. PNGs de conferência
  `preview-longo-p1-1.png`/`preview-larga-1.png` e textos `longo.txt`/`larga.txt` ao lado.

## Testes reexecutados nesta máquina (só domínio PDF, tudo sintético)

```sh
cd desk
env -u ELECTRON_RUN_AS_NODE node --test tests/material-template.test.mjs        # 25/25 (inclui 4 Electron reais)
env -u ELECTRON_RUN_AS_NODE node --test tests/free-material-pdf.test.mjs \
  tests/tutor-materials.test.mjs tests/material-preview-host.test.mjs tests/free-host-ipc.test.mjs  # 23/23
env -u ELECTRON_RUN_AS_NODE node tests/material-template-dialog-ui.mjs          # PASS
env -u ELECTRON_RUN_AS_NODE node tests/material-preview-ui.mjs                  # PASS
node tests/syntax-check.mjs                                                     # 327 arquivos ok
```

## Limites desta revisão

- Sem `npm test`/portão Bend completo (escopo PDF e working tree com trabalho concorrente de outros donos).
- Prova sintética: sem inferência real, PDF/material pessoal, app instalado ou provedor; `course-pdf-ui.mjs` e
  `native-tutor-pdf.mjs` não foram reexecutados nesta rodada (seguem cobertos pela revisão final r5).
- Extração de texto de subscritos do KaTeX pelo Poppler é aproximada (`a21` para `a_1^2`), artefato de extração,
  não de recorte; a conferência visual (PNG) mostra a fórmula inteira.
- O fallback heurístico genuíno continua literal por desenho — agora com `code-protection-fallback` explícito.

## Arquivos liberados (escopo PDF)

`desk/src/materials/template.mjs` · `desk/src/materials/print.mjs` · `desk/src/materials/print.html` ·
`desk/src/materials/print.css` · `desk/src/materials/pdf-template.css` · `desk/material-pdf.cjs` ·
`desk/src/free-study.mjs` (regiões de prévia/Ver PDF) · `desk/main.cjs`/`desk/preload.cjs` (regiões PDF) ·
`desk/material-preview-host.cjs` · testes `material-template*`, `free-material-pdf`, `tutor-materials`,
`material-preview-host`, `free-host-ipc`, `material-preview-ui`. Nada pendente de correção no escopo r6/r7;
a suíte final fica com o root após o congelamento dos trabalhos concorrentes.
