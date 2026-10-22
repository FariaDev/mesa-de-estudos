# Correções dos residuais P2 — revisão final de PDF/template — 2026-10-08

- **Revisão corrigida**: [pdf-code-final-review.md](pdf-code-final-review.md), residuais P2 (tab no
  fallback de `locateRaw`; `<h1>` cru no conteúdo) + exigência de diagnóstico explícito no fallback.
- **Escopo/ownership**: só `desk/src/materials/template.mjs` e `desk/tests/material-template*.mjs`
  (`material-template.test.mjs`, `material-template-ui.mjs`, `material-template-dialog-ui.mjs`).
  `main.cjs`, `preload.cjs`, `free-study.mjs`, `material-pdf.cjs`, núcleo/config, timeline, atividade
  e demais testes **não** foram tocados.
- **Estado**: implementado e provado localmente. Nada commitado, instalado, atualizado, publicado ou
  aberto no app pessoal; nenhum dado pessoal, PDF de curso, provedor ou inferência real.
- **Versão do template**: `material-2026-10-08.2` → `material-2026-10-08.3` (muda a saída; prévias
  antigas são descartadas pelo contrato de `materialRevision`/`templateHash`).

## Residual 1 — tab no recuo de contêiner: árvore caía e a fórmula sumia (resolvido)

**Causa**: o `marked` expande o tab do recuo no `raw` dos filhos (`\t$x+1$` vira `  $x+1$`); o
`locateRaw` só casava a fonte byte a byte (com prefixos `>`/espaço/tab antes do conteúdo), então a
árvore inteira falhava, a proteção caía em `heuristicProtectedRanges` (que protege `/^(?: {4}|\t)/`) e
a fórmula em continuação virava literal — com título vazio, sem nenhum diagnóstico.

**Correção em `template.mjs`:**

- `matchSourceLine` compara uma linha do `raw` com a fonte tolerando que uma sequência de espaços/tabs
  do raw corresponda a outra sequência de espaços/tabs na fonte (nada além disso), devolvendo o fim
  real na **fonte original** — nenhuma normalização do corpo, os offsets continuam os da entrada.
- `locateRaw` tenta o casamento exato por linha primeiro (offsets históricos preservados) e só então o
  tolerante; o avanço passou a usar o fim real (`at = end`), não `found + raw.length`.
- `prepareMaterialMarkdown` agora tira o `lead` do heading da **fonte** (`source.slice(start)`), não do
  raw expandido: heading com tab desce preservando o recuo/tab e continua dentro da lista/citação.
- `protectedRanges` virou `protectedScan`, devolvendo `{ranges, fallback}`. Quando a árvore não
  reconstrói a fonte (caso realmente inlocalizável), `checkMaterialMath` **e** `renderMaterialHtml`
  emitem `{kind:'code-guard', severity:'warning', code:'code-protection-fallback', message:…}` via
  `codeProtectionDiagnostic` — explícito, independente do título, no lugar do silêncio.

**Provas (Node puro, inline, nada versionado):**

```sh
node --input-type=module -e 'import{tokenizeMaterial,checkMaterialMath,prepareMaterialMarkdown}from"./src/materials/template.mjs"; …'
# tab lista:                ["x+1"]        (- item\n\n\t$x+1$ continuação\n)
# tab ordenada aninhada:    ["v+1"]        (1. primeiro\n\t1. sub\n\n\t\t$v+1$ dentro\n)
# tab citação:              ["q+1"]        (> c:\n>\n>\t$q+1$ citada\n)
# tab cerca protegida:      []             (fence com tab: $nao_e_math_tab$ não vira math)
# dois blocos com tab:      ["x","w"]      (o fallback não engole o documento inteiro)
# caso corrigido diag.:     []             (sem code-protection-fallback)
# fallback vazio-título:    [{"code":"code-protection-fallback","severity":"warning"}]  (- ", caso inlocalizável)
# heading tab:              {"markdown":"- item\n\n\t## Sub\n","diagnostics":[…headings-shifted]}
```

```sh
node --input-type=module -e 'import m from "./material-pdf.cjs"; … await m.checkMaterial({title:"", markdown:"- item\n\n\t$x+1$ continuação\n- "})'
# {"title":""}   => [{"code":"code-protection-fallback","severity":"warning"}]
# {"title":"T"}  => [heading-rewrite-skipped, code-protection-fallback]
# {"title":"", markdown sem o "- " final} => []   (árvore reconstrói; nada a avisar)
```

Testes: `tokenizador entende recuo com tab…`, `heading com recuo por tab…` e
`fallback da proteção de código avisa independente do título` em `material-template.test.mjs` cobrem
lista/ordenada/citação/cerca, dois blocos com tab e o aviso sem título.

## Residual 2 — `<h1>` cru no conteúdo gerava dois H1 (resolvido)

**Causa**: `prepareMaterialMarkdown` reescreve só headings Markdown; `<h1>…</h1>` cru atravessa o
DOMPurify como está e o DOM/PDF ficava com dois H1 (contrato de título único + outline quebrados).

**Correção em `template.mjs`:** `demoteContentHeadings` roda **depois** do DOMPurify (e antes do
título confiável ser anexado) e, por travessia de DOM, rebaixa cada `<h1>` do corpo para `<h2>`
recriando o elemento com os mesmos atributos e movendo os filhos — nada além do H1 muda, headings
Markdown já rebaixados não sofrem duplo shift, e a config do DOMPurify ficou intacta (nem mais
permissiva, nem mais restrita). Sem DOM, `renderMaterialHtml` já não funciona (DOMPurify exige DOM);
o caminho latente continua igual à nota da r5.

**Provas (cenário Electron real `template-long` + prévia do diálogo):** documento com
`<h1 id="raw-title" class="extra" onclick="window.__pwned=true">Outro <em>H1</em></h1>`:

```text
inspected.h1Count = 1  (só o título do campo)
rawTitle = {tag:"H2", html:'<h2 id="raw-title" class="extra">Outro <em>H1</em></h2>'}
# id/class/<em> preservados; onclick removido pelo DOMPurify antes do rebaixe
headings inclui "H2:Outro H1"; PDF: "Outro H1" presente, título do campo aparece 1×
prévia do diálogo: h1=1, rawTag=H2, id/class/<em> preservados
```

## Preservação exigida

- **Raw/offsets**: nenhuma normalização do corpo; só comparação tolerante + edição por offsets
  (headings). Código real continua protegido: `- item\n\n\t\t$code$`, fence com tab em lista e em
  citação não geram math; `texto\n\n    $$y$$` idem.
- **Diagnósticos**: mesmos códigos antigos (`title-deduped`, `headings-shifted`,
  `heading-rewrite-skipped`, `math-parse`, avisos KaTeX, `math-scaled`/`math-wide`/`math-tall`) +
  `code-protection-fallback` (warning, não bloqueia) só quando o fallback acontece.
- **Sanitização**: `FORBID_TAGS`/`FORBID_ATTR` intactos; a restauração de nós de texto/atributos de
  matemática (`materialMathNodes`) não foi tocada; `href="$a$"`, `title="$b$"`, sem placeholder vazado
  e sem `onclick` no H1 rebaixado continuam provados no Electron.
- **CRLF/CR e contêineres**: `normalizeLineEndings` e a árvore de citação/lista seguem como na r5
  (testes de CRLF, setext, aninhados e fence passam).

## Provas executadas nesta máquina (tudo sintético)

```sh
cd desk
env -u ELECTRON_RUN_AS_NODE node --test tests/material-template.test.mjs          # 25/25 (Node + 4 Electron reais)
env -u ELECTRON_RUN_AS_NODE node --test tests/free-material-pdf.test.mjs \
  tests/tutor-materials.test.mjs tests/material-preview-host.test.mjs \
  tests/free-host-ipc.test.mjs                                                     # 23/23
env -u ELECTRON_RUN_AS_NODE node tests/material-template-dialog-ui.mjs             # PASS
env -u ELECTRON_RUN_AS_NODE node tests/material-preview-ui.mjs                     # PASS
env -u ELECTRON_RUN_AS_NODE node tests/course-pdf-ui.mjs                           # PASS
env -u ELECTRON_RUN_AS_NODE node tests/native-tutor-pdf.mjs                        # PASS
node tests/syntax-check.mjs                                                        # 327 arquivos ok
```

## Limites honestos / fora de escopo

- Pasta vazia “Materiais da Mesa” após bloqueio MATH e `free-study-ui.mjs:93` (`#support-bar` no vazio)
  seguem **não corrigidos**, como pedido (cosmético/legado fora do ownership).
- Sem `npm test` completo nem portão Bend: mudança host-pura, sem lei de núcleo nova.
- Sondas estruturais/sintéticas; não certificam inferência real, material pessoal nem inspeção visual
  humana nova (DOM e texto extraído dos PDFs reais de impressão e da prévia foram inspecionados).
- Root fará a nova revisão final destes fixes.
