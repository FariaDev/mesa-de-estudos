# Revisão final independente — PDF/template/prévia (rodada de fechamento) — 2026-10-08

**Escopo exercitado**: `desk/src/materials/**` (template.mjs/print), `desk/material-pdf.cjs`,
prévia PDF de `desk/src/free-study.mjs`, `main.cjs`/`preload.cjs` nas regiões PDF (sender/scope/cancel),
`material-preview-host.cjs`; testes e sondas sintéticas. Runtime/timeline/atividade ficaram fora.
**Ownership**: só este relatório. Nenhum arquivo de produto/teste foi editado; nenhum commit, instalação,
release, dados pessoais ou provedor. Sondas em `/tmp/mesa-final-probe` (nada versionado). **Nenhum P0.**

## Veredito por achado

| Achado | Resultado | Residência |
|---|---|---|
| P1-1 listas/citações | **Resolvido** nos casos originais e no caminho por árvore de tokens | Residual P2 no fallback heurístico com tab (abaixo) |
| P2-1 headings aninhados | **Resolvido** (ATX/setext, citação, lista, aninhados, CRLF) | Residual P2: `<h1>` cru em HTML não desce (abaixo) |
| P2-2 CRLF/CR | **Resolvido** (normalização, offsets, sem `heading-rewrite-skipped` por CRLF) | — |
| P2-3 placeholder em atributo | **Resolvido**; `setAttribute` pós-DOMPurify **não** reintroduz `javascript:` | Fallback sem DOM é latente (nota) |

## Provas executadas (independentes das do autor)

```sh
env -u ELECTRON_RUN_AS_NODE node --test tests/material-template.test.mjs                      # 22/22 (4 cenários Electron reais)
env -u ELECTRON_RUN_AS_NODE node --test tests/free-material-pdf.test.mjs \
  tests/tutor-materials.test.mjs tests/material-preview-host.test.mjs tests/free-host-ipc.test.mjs  # 23/23
node tests/material-preview-ui.mjs tests/material-template-dialog-ui.mjs tests/course-pdf-ui.mjs   # PASS (inclui edição DURANTE o desenho)
node tests/native-tutor-pdf.mjs tests/free-study-integration-ui.mjs                                # PASS
node tests/free-study-ui.mjs   # falha na linha 93 (#support-bar visível no vazio) — fora do PDF, ver objeções
```

Sondas próprias (casos novos, não os fixtures do autor): ~60 casos de tokenizer/headings/CRLF
(`node-probe.mjs`), confronto `marked.lexer` × `tokenizeMaterial` (`probe2.mjs`) e 17 documentos no
render de impressão Electron real com inspeção do DOM antes do `printToPDF` (`electron-probe.cjs`;
PDFs em `/tmp/mesa-final-probe/out`, conferidos com `pdftotext`).

### P1-1 — confirmado resolvido + residual P2 (fallback com tab)

- Original 1a `- item\n\n    $x+1$ continuação\n` → math `["x+1"]`; no PDF real há `.katex` no `<li>`
  (`liKatex=1`) e o texto extraído traz a fórmula como glifos, não literal (`fix-original.pdf`).
- Original 1b `> Exemplo de código:\n>\n>     $\frac{1}{$\n` → nenhum math; `checkMaterialMath` errors 0;
  o PDF mantém `$\frac{1}{$` literal como código (`pdftotext`).
- Variações independentes OK: cerca `~~~`/4 crases em citação/lista, citação dentro de lista e vice-versa,
  listas aninhadas, lista ordenada (4 = parágrafo, 8 = código), tabela (`$x$` acha, `` `$y$` `` protege),
  dinheiro/escape, lazy de citação, citação com 2 espaços (parágrafo) × 4 (código), math após fence.
- **Residual P2 reproduzido (fallback)**: `- item\n\n\t$x+1$ continuação\n`. O `marked` normaliza o tab do
  item para espaços no `raw` (`"  $x+1$ continuação"`), o `locateRaw` não casa com a fonte (`\t`),
  `protectedRanges`/`prepareMaterialMarkdown` caem no fallback heurístico, que protege `/^(?: {4}|\t)/` —
  o math não é tokenizado. Evidência: `checkMaterial` → `[]` de diagnósticos com título vazio e
  `heading-rewrite-skipped/warning` com título; PDF real imprime `$x+1$` literal, `katex=0`.
  Um tab em qualquer filho de contêiner derruba a árvore **do documento inteiro**, não só do item.
  É o limite já declarado na r5 (“protege mais, podendo marcar continuação de lista como código”), mas o
  caminho silencioso (título vazio, zero diagnóstico) e a amplitude global não estavam explicitados.

### P2-1 — confirmado resolvido + residual P2 (HTML cru)

- Original: `# Limites\n\n> # Sub bloco\n\n## Depois\n` → `\n\n> ## Sub bloco\n\n### Depois\n`; DOM com 1 `<h1>`.
- Variações OK: CRLF, lista aninhada profunda (`        ## Deep`), setext citado (`> Sub\n> ===` → `> ## Sub`),
  setext em lista (`    ## Sub`), heading em lista-em-citação e citação-em-lista, `**ênfase** #`,
  tab dentro de citação, `###` vazio, título dedupe setext, texto igual ao título em citação (rebaixa, não some).
- **Residual P2 reproduzido**: `<h1>Outro H1</h1>` em HTML cru não passa pela reescrita (só headings Markdown);
  DOMPurify mantém `h1` → DOM/PDF com dois H1 (`["Limites","Outro H1"]`). O contrato do plano é “título único”;
  impacto de outline/cosmético, exige HTML cru do usuário. Novo, não estava no r4/r5.

### P2-2 — confirmado resolvido

`# Limites\r\n\r\nTexto.\r\n` → `\n\nTexto.\n` com `title-deduped` e sem `heading-rewrite-skipped`; `\r` solto,
misto, citação/lista/fence com CRLF, offsets (`index 14`, linha 2) e o documento CRLF completo no Electron
(h1 único, `liKatex=1`) conferem. Nenhum resíduo.

### P2-3 — confirmado resolvido e sem reintrodução de `javascript:`

- `[link]($a$)` → `href="$a$"`; `<div title="$b$">` → `title="$b$"`; `data-x="$c$"`; `innerHTML` sem
  `MATHPLACEHOLDER`/`CODEPLACEHOLDER`; nenhum atributo com HTML do KaTeX.
- Vetores de reintrodução no render real: `href` `javascript:` plano, com espaço inicial, com tab,
  com `&#58;`, `vbscript:`, `data:text/html`, `xlink:href` em `<svg>` — **todos removidos pelo DOMPurify**;
  clique real nos `<a>` sobreviventes não definiu `window.clicked`/`window.pwned`. O DOMPurify 3.4.16 remove
  C0/espaços antes do teste de URI (`purify.es.mjs:2082`), e a substituição insere `$tex$`, nunca um prefixo
  `javascript:`. Único caso com `javascript:` textual pós-sanitize foi `title`/`style` (inerte; CSS `url(javascript:)`
  não executa no Chromium). `href` relativo sobrevive corretamente (`pasta/$a$`).
- Nota: sem `document` (só import em Node), `materialMathNodes` mantém a troca global em string antiga — o
  defeito do P2-3 continuaria nesse caminho. Nenhum chamador de produto roda `renderMaterialHtml` sem DOM
  (só `print.mjs` e `free-study.mjs`, ambos renderer); é fallback latente, não achado.

## Escopo, cancelamento e integração do root (reexecutados)

- `material-preview-host.test.mjs` (23/23 com o lote) cobre remetente não confiável e substituição/cancelamento;
  o host recheca `scopeIsCurrent` depois do await e antes de devolver; `main.cjs` usa `trustedMainSender`
  (`event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame`).
- `material-preview-ui.mjs` PASS: bytes reais, nada salvo, cancelamento e **edição durante o desenho** sem publicar
  fragmento fora da revisão; `free-study.mjs` invalida/cancela em `input`/`close`, confere `requestId`/`revision`/
  `templateHash` ecoados e nunca reusa bytes da prévia no save (o save re-renderiza no host);
  `stopBridge` e `before-quit` cancelam a prévia.
- `course-pdf-ui.mjs` PASS (tutor→diálogo→salvar real) e `native-tutor-pdf.mjs` PASS (extensão Pi real).
  `prepareTutorMaterial` persiste o rascunho mesmo com `blocking` e devolve diagnósticos ao tutor (draft intacto).

## Objeções restantes (tratamento)

1. **Fallback heurístico explicitado** — documentado na r5 e agora reproduzido com gatilho concreto (tab; acima).
   Aceito como limite de projeto; sugerir citar o caso tab e o silêncio com título vazio na documentação.
2. **Pasta “Materiais da Mesa” vazia após bloqueio MATH** — confirmado por código, não re-corrigido:
   `main.cjs:1904` avalia `courseMaterials.materialDirectory(target)` (que faz `mkdirSync`, `course-materials.cjs:17-21`)
   antes de `savePdf` bloquear. Cosmético e fora do ownership desta rodada, como declarado.
3. **`free-study-ui.mjs:93`** — falha reproduzida (`#support-bar` visível no vazio). A região `setEmpty`/`isFree`
   não tem diff no `free-study.mjs` (o diff começa nos imports e retoma depois), o caminho não envolve PDF/CSS do
   template e `free-study-integration-ui.mjs` passa; é trabalho concorrente de suporte/atividade, fora deste escopo.
4. **Documentação**: a r5 afirma cobertura de “setext citado” nos testes, mas `material-template.test.mjs` só tem
   setext simples; o comportamento foi verificado independentemente e funciona. `material-pdf.cjs` e o comentário
   de `lockSession` já descrevem o renderizador novo (sem “markup do chat”).

## Limites desta revisão

Provas sintéticas (sem inferência real, PDF pessoal, app instalado ou inspeção visual humana nova); não rodei
`npm test` completo nem o portão Bend (mudança host-pura, sem lei core nova). HTML cru `<pre>$x$</pre>` renderiza a
fórmula como KaTeX em vez de literal (pré-existente, não é um dos achados). `renderMaterialHtml` sem DOM é latente.
O residual de tab depende de o `marked` normalizar recuo de item; não é uma reconstrução byte a byte.

**Conclusão de aceite**: os quatro achados estão resolvidos nos casos originais e nas variações testadas; não há P0
nem P1 aberto. Os dois residuais P2 (fallback com tab; `<h1>` cru) e as três objeções restantes ficam registrados,
sem bloquear o fechamento desta rodada dentro do escopo.
