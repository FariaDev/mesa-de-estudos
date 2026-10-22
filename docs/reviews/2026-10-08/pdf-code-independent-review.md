# Revisão independente do código PDF/template/prévia — 2026-10-08

**Escopo**: `desk/material-pdf.cjs`, `desk/src/materials/**`, `desk/src/free-study.mjs` (prévia/“Ver PDF”),
`desk/src/extensions/tutor-pdf/**`, `desk/src/agents/tutor-pdf.cjs`, `desk/tutor-materials.cjs` e as regiões
PDF de `desk/material-preview-host.cjs`, `desk/main.cjs`, `desk/preload.cjs`, `desk/index.html`.
Runtime/timeline (elaboração concorrente) e o estado CORE preexistente ficaram fora. Nada de produto/testes
do outro agente foi alterado; baseline preservado em `/private/tmp/mesa-ui-20261008-baseline`.

**Método**: leitura do diff do working tree; sondas sintéticas em `/tmp/mesa-review-probe` (renderizador real,
`pdftotext`/pdf.js e Playwright, sem dados pessoais); testes do domínio reexecutados. **Nenhum P0.**

**Testes reexecutados (independentes)**: `material-template.test.mjs` 19/19 · `free-material-pdf.test.mjs` 8/8 ·
`material-preview-host.test.mjs` 4/4 · `tutor-materials.test.mjs`+`free-host-ipc.test.mjs` 11/11 ·
`material-preview-ui.mjs` PASS · `material-template-dialog-ui.mjs` PASS · `course-pdf-ui.mjs` PASS ·
`native-tutor-pdf.mjs` PASS.

**Correções do pai confirmadas**: `free-study.mjs:424` (`renderPreviewPages`) recheca `previewStillCurrent`
a cada `await` e só publica fragmento detached; `material-preview-ui.mjs` agora edita o rascunho dentro de
`getContext` do canvas e passa com 0 canvas; `material-pdf.cjs:230` filtra `event.sender`; `main.cjs:708`
exige `senderFrame` do frame principal; teto 120 consistente em `tutor-materials.cjs`, `tutor-pdf.cjs` e `index.ts`.

## P1

### P1-1 — `protectedRanges` ignora contêineres Markdown (lista e citação)

`desk/src/materials/template.mjs:50-97` decide “código indentado” por heurística de linha
(`if (previousBlank && /^(?: {4}|\t)/.test(line.content))`, linha 92) sem consultar a estrutura que o `marked`
vai produzir. O tokenizador alimenta `checkMaterialMath` e `renderMaterialHtml`, ou seja, vale para prévia e PDF.

**1a — fórmula em continuação de item de lista some sem diagnóstico (regressão).** Entrada válida:

```
- item

    $x+1$ continuação
```

`marked.lexer` classifica como `list > list_item > paragraph` (não é código) e o renderizador antigo
(`markup` do chat, usado pelo `print.mjs` do HEAD) renderizava a fórmula — verificado com sonda.
Hoje `tokenizeMaterial(...)` devolve `[]` e o PDF real sai `ok:true`, sem nenhum diagnóstico, com o literal:

```
$ pdftotext list.pdf -
Probe
item
$x+1$ continuação
```

Reprodução mínima:
`node --input-type=module -e 'import{tokenizeMaterial}from"./src/materials/template.mjs";console.log(JSON.stringify(tokenizeMaterial("- item\n\n    $x+1$ continuação\n").filter(s=>s.type==="math")))'` → `[]`.

**1b — código indentado dentro de citação vira matemática e bloqueia o PDF.**

```
> Exemplo de código:
>
>     $\frac{1}{$
```

`marked` renderiza `<pre><code>$\frac{1}{$</code></pre>`; o tokenizador extrai `\frac{1}{` como math e
`checkMaterialMath` devolve `KaTeX parse error…`. `renderPdf` rejeita com `MATH` antes de imprimir
(a própria página também recusaria via `.math-error`), embora o conteúdo seja código que o usuário quer mostrar.

**Recomendação**: derivar as faixas protegidas dos tokens do `marked` (spans de `code`/`codespan`, descendo em
`blockquote`/`list_item`), mantendo a heurística só como fallback quando a reconstrução de `raw` não fechar.
Fixtures novas: continuação de lista com `$` e bloco de código citado com LaTeX inválido.

## P2

### P2-1 — Headings aninhados não descem; mais de um H1

`prepareMaterialMarkdown` (`template.mjs:250-259`) só olha o primeiro nível (`tokens.find`/`tokens.map`).
Título `Limites` + `# Limites\n\n> # Sub bloco\n\n## Depois\n` produz `\n\n> # Sub bloco\n\n### Depois\n`;
o DOM final tem dois `<h1>` (`Limites` e `Sub bloco`). Mesmo efeito em heading dentro de `list_item`.
O contrato do domínio (“título único”) e `generateDocumentOutline` ficam inconsistentes.
**Recomendação**: percorrer tokens recursivamente (`marked.walkTokens` ou walk nos filhos de
`blockquote`/`list_item`) aplicando o mesmo shift; teste com heading citado/em lista.

### P2-2 — CRLF/CR fazem o rewrite de headings ser pulado

`template.mjs:243` compara `tokens.map(t=>t.raw).join('')` com a fonte crua; o `marked` normaliza `\r\n`
para `\n`, a comparação falha e `prepareMaterialMarkdown` devolve a fonte intacta com
`heading-rewrite-skipped` (só aviso): título duplicado e headings sem shift.
Reprodução: `prepareMaterialMarkdown({title:'Limites',markdown:'# Limites\r\n\r\nTexto.\r\n'})` → inalterado
+ diagnóstico. O impacto hoje é limitado porque o valor de `<textarea>` normaliza CRLF→LF antes de
prévia/salvar (verificado no Electron), mas `checkMaterial` recebe o markdown cru do tutor e a API pura
segue frágil.
**Recomendação**: normalizar `\r\n?`→`\n` no início de `prepareMaterialMarkdown` e usar a fonte normalizada
na comparação/reconstrução.

### P2-3 — Placeholder de matemática é substituído dentro de atributos

`renderMaterialHtml` troca os placeholders com `html.replace(new RegExp(key,'g'), rendered)` depois do
DOMPurify (`template.mjs:416-421`), alcançando valores de atributo. Com `[a fórmula]($a$)` o âncora fica
`href="<span class="` + markup do KaTeX (atributos/filhos quebrados); `<div title="$x$">` corrompe o
atributo do mesmo jeito. Não há execução de script (DOMPurify já limpou handlers; o HTML do KaTeX é gerado,
não vem do texto), é corrupção estrutural.
**Recomendação**: trocar por elemento-sentinela antes do sanitize (ex.: `<span class="math-slot" data-math="n">`)
e substituir os nós por DOM traversal/`outerHTML`; ou substituir somente em nós de texto.

## Notas menores

- `desk/material-pdf.cjs:3-5` e `:140` ainda descrevem o caminho antigo (“MESMA função `markup` do chat”,
  `markdown.mjs`); atualizar o cabeçalho para o renderizador do template.
- Salvar bloqueado por `MATH` deixa `Materiais da Mesa` criada e vazia na matéria
  (`courseMaterials.materialDirectory` roda antes do render); sem PDF, apenas cosmético.
- `tests/free-study-ui.mjs:93` falha no working tree atual (`#support-bar` visível na sessão livre vazia,
  `false !== true`). Reproduzido; não envolve o código desta revisão (`free-study-integration-ui.mjs` passa).

## Verificação do que já estava coberto

- **Escopo/abort**: `material-preview-host` cancela por `requestId`, troca de conversa e antes/depois dos
  awaits (`scopeIsCurrent`); remetente/frame filtrados no main.
- **Bytes salvos**: sonda nova (`/tmp/mesa-review-probe/stale-save-ui.mjs`) edita o rascunho durante o desenho
  da prévia e confirma que o PDF salvo contém o texto atual (`x=2`), nunca os bytes da prévia.
- **Erro do tutor preserva rascunho**: sonda nova (`tutor-error-ui.mjs`) com `$$\frac{1}{$$` no fluxo do tutor
  simulado: diálogo abre com o rascunho, erro visível, salvar bloqueado sem PDF e, após corrigir, o PDF real
  é gravado.
- **Sanitização**: sonda com `<script>`, `<img onerror>`, `<iframe>` e `javascript:` no markdown → 0
  script/iframe/img, `href` removido, `window.__pwned` falso.
- **Corrida da prévia**: `material-preview-ui.mjs` (edição durante o canvas) PASS com 0 canvas publicado.

Nenhum P0. O P1-1 é o único bloqueio de qualidade de conteúdo que pediria correção antes de PDF gerado por
tutor com listas e fórmulas; os P2 são correções pontuais com testes de regressão.
