# Implementação do template de PDF, matemática tokenizada e prévia real

- **Data**: 2026-10-08
- **Domínio**: `desk/material-pdf.cjs`, `desk/src/materials/**`,
  `desk/src/free-study.mjs`, `desk/src/extensions/tutor-pdf/**`,
  `desk/src/agents/tutor-pdf.cjs`, testes `material-template*`, fixtures.
- **Estado**: implementação local concluída no domínio; integração principal
  (main/preload/index) fora do domínio, conforme divisão do pai. Nada foi
  commitado, instalado, publicado ou aberto no app pessoal.

## O que foi entregue

1. **Renderer de material próprio** (`src/materials/template.mjs`, ESM
   importável em Node):
   - `tokenizeMaterial(markdown)` separa texto/matemática respeitando `\$`,
     código inline (crases), cercado (```/~~~) e indentado (4 espaços após linha
     em branco) e delimitador incompleto; `$5 e $10` fica texto (o `$` precedido
     de espaço não fecha).
   - `prepareMaterialMarkdown({title,markdown})` usa `marked.lexer` (estrutura
     Markdown, sem regex em código-fonte): remove o primeiro heading igual ao
     título e rebaixa os demais um nível (h1→h2…, h6 fica h6). Diagnósticos
     `title-deduped`/`headings-shifted`; se a reconstrução não fechar, mantém o
     original e avisa (`heading-rewrite-skipped`).
   - `checkMaterialMath(markdown)` usa KaTeX `throwOnError:true` + `trust:false`
     e `strict` devolvendo `'ignore'`: erro de parsing/comando é `severity:'error'`
     (bloqueia), aviso (`unicodeTextInMathMode`, `newLineInDisplayMode`) é
     `severity:'warning'` (não bloqueia unicode válido). Diagnóstico traz
     `source`, `index` e `line`.
   - `renderMaterialHtml({title,markdown,allowAssets:false})` renderiza com
     marked → DOMPurify (mídia removida) → realce local → KaTeX injetado fora do
     DOMPurify. Nunca passa raw pela regex do chat nem usa `markdown.mjs`.
   - `measureMaterialMath(root,{availableWidthPx,availableHeightPx,minFontPt:9})`
     mede depois das fontes via `scrollWidth` do `.katex` (bloco nowrap),
     encolhe até caber com piso de 9 pt e registra **todo** ajuste
     (`code:'math-scaled'`, `scale`, `needed`, `source`); o que não couber vira
     `math-wide`/`math-tall` (`severity:'error'`, `data-overflow="1"`).
   - `materialRevision({title,markdown})` (FNV-1a curto, síncrono no renderer) e
     `MATERIAL_TEMPLATE_VERSION='material-2026-10-08.1'`/`materialTemplateHash()`.
2. **CSS compartilhado** `src/materials/pdf-template.css` (escopado em
   `.pdf-doc`/`.pdf-page`): A4 210×297 com conteúdo 178 mm (margens 18/16/20 mm),
   serifa 11 pt, headings, listas, código, tabelas multipágina
   (`thead{display:table-header-group}`, `tr{break-inside:avoid}`), viúvas/órfãs,
   matemática e moldura de prévia. `print.css` ficou só com `@page`/reset;
   `print.html` linka o template e `print.mjs` usa o renderizador próprio.
3. **Serviço** `material-pdf.cjs`:
   - `checkMaterial({title,markdown})` (assíncrono, Node puro) → `{markdown,
     diagnostics:[...], blocking:[...], message, templateHash}`.
   - `renderPdf` valida a matemática **antes de abrir janela**: erro → rejeita
     `MaterialPdfError('MATH', …, {diagnostics, blocking})`; overflow medido na
     página → rejeita `'OVERFLOW'`, sem chamar `printToPDF`. Resultado agora é
     `{buffer, bytes, sha256, templateHash, diagnostics}` (diagnostics é **lista**).
   - `savePdf` inalterado em contrato; devolve `templateHash`/`diagnostics`
     adicionais. fsync/nome único/sha256/rollback/timeout/abort/rede/`lockSession`
     intactos.
4. **Prévia no diálogo** (`src/free-study.mjs`):
   - `updatePdfPreview` usa o mesmo HTML/CSS da impressão em `.pdf-page`
     escalado; caixa `#free-pdf-preview .katex` preservada para os testes
     existentes.
   - `#free-pdf-math-status[role=alert]` (criado no próprio módulo) lista erros
     com botão que seleciona o trecho no textarea; avisos aparecem sem bloquear.
   - Botão `#free-pdf-verify` ("Ver PDF", criado no módulo) chama
     `window.desk.materialPreview({title,markdown,revision,requestId})` do jeito
     do contrato do pai, confere **requestId/revision/templateHash ecoados** e a
     revisão ativa, desenha as páginas reais com pdf.js em `#free-pdf-pages` e
     nunca salva material. Editar/fechar suspense cancela
     (`materialPreviewCancel`) e limpa as páginas; salvar sempre re-renderiza no
     host (nunca reusa bytes da prévia). `maxlength` do título desce para 120.
   - CSS do template é injetado por `<link data-material-template>` se o index
     não tiver (funciona sem editar root).
5. **Ferramentas do tutor**: título `maxLength 120` no Pi (`index.ts`) e no
   Claude (`tutor-pdf.cjs`); quando `result.diagnostics` traz erros, os dois
   respondem a mesma frase de correção ("N equação(ões) com erro…"), sem
   declarar sucesso. Rascunhos/kind existentes não mudam (nenhum campo novo).

## Integração pendente do pai

- `prepareTutorMaterial` (`desk/main.cjs`): chamar
  `await materialPdf.checkMaterial({title, markdown})` e repassar
  `diagnostics`/`templateHash` no evento `status:'prepared'` e no retorno da
  ponte (é o que faz as ferramentas reportarem erro). O rascunho deve continuar
  sendo persistido mesmo com erro.
- `index.html`: opcional (o módulo já injeta) o `<link rel="stylesheet"
  href="src/materials/pdf-template.css">` e um `#free-pdf-verify` em
  `#free-pdf-form .dialog-actions`; `maxlength` 120 no `#free-pdf-title`.
- Nenhuma mudança de build/proof: **nenhuma lei core nova** (lógica host-pura de
  string/DOM com provas Node + Electron; sem paridade com o chat). Se o pai
  quiser lei Bend depois, o contrato puro está em `template.mjs`.
- Erros novos `MATH`/`OVERFLOW` já saem como mensagem pela rejeição do IPC;
  nenhum handler de save precisa mudar para bloquear.

## Prova executada nesta máquina (comandos reais)

```sh
cd desk
env -u ELECTRON_RUN_AS_NODE node --test tests/material-template.test.mjs      # 19/19
env -u ELECTRON_RUN_AS_NODE node --test tests/free-material-pdf.test.mjs      # 8/8
env -u ELECTRON_RUN_AS_NODE node --test tests/tutor-materials.test.mjs tests/material-preview-host.test.mjs tests/free-host-ipc.test.mjs  # 15/15
env -u ELECTRON_RUN_AS_NODE node --test tests/free-workspaces.test.mjs tests/course-materials.test.mjs  # 34/34
env -u ELECTRON_RUN_AS_NODE node tests/material-preview-ui.mjs                # PASS (bytes reais, nada salvo, cancelar)
env -u ELECTRON_RUN_AS_NODE node tests/material-template-dialog-ui.mjs        # PASS (erro sem host, fit, invalidar ao editar)
env -u ELECTRON_RUN_AS_NODE node tests/course-pdf-ui.mjs                      # PASS (tutor→prévia→salvar real)
node tests/native-tutor-pdf.mjs                                               # PASS (extensão Pi real, sem inferência)
```

- `material-template.test.mjs`: tokenizador/dinheiro/escape/código, títulos por
  estrutura, erros×avisos, revisão; no Electron: longo 3 páginas com cabeçalho
  de tabela repetido, H1 único, fontes KaTeX carregadas antes do print, fórmula
  larga ajustada (0,96) com diagnóstico, overflow e equação inválida bloqueados
  sem arquivo (inválida nem abre janela: 0 janelas).
- Revisão visual com Poppler (`pdftoppm -r 80`) nos PDFs sintéticos longo/largo:
  título, tabelas na quebra de página e fórmula reduzida legível, sem recorte.
- `node --check` ok nos 9 arquivos alterados. `node tests/syntax-check.mjs`
  acusa **somente** `src/activity.mjs` (domínio interativo concorrente), fora
  deste domínio.
- `free-study-ui.mjs` (linha 93) e `free-study-integration-ui.mjs` (linha 45)
  falham **também** com o `free-study.mjs` do HEAD (verificado restaurando o
  conteúdo do HEAD): regressão pré-existente do working tree, não desta rodada.

## Limites e não feitos

- Não houve snapshot de alterações do working tree, commit, push, release,
  instalação, abertura do app pessoal, leitura de PDF/sessão pessoal ou provedor.
- A medição de largura cobre matemática em display; matemática inline não é
  encolhida (o texto quebra a linha) — fica registrado como limite.
- Só provas sintéticas: não certificam inferência real nem o app instalado.
- `tests/material-template-ui.mjs` é o módulo de cenários ESM importado pelo
  `free-pdf-runner.cjs` (entry CJS; o Electron desta versão não resolve
  `import {app} from 'electron'`), **não** é um script Playwright. O script
  Playwright do diálogo é `tests/material-template-dialog-ui.mjs`.
