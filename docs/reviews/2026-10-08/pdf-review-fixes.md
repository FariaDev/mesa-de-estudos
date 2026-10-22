# Correções da revisão independente de PDF/template — 2026-10-08

- **Revisão corrigida**: [pdf-code-independent-review.md](pdf-code-independent-review.md)
  (P1-1, P2-1, P2-2, P2-3 e notas menores de cabeçalho).
- **Escopo desta rodada**: `desk/src/materials/template.mjs` e testes
  `desk/tests/material-template*.mjs`; **somente comentários** em
  `desk/material-pdf.cjs`. `main.cjs`, `preload.cjs`, `free-study.mjs`,
  `chat/**`, `activity/**`, `timeline`, núcleo/config e demais testes não foram
  tocados (agentes concorrentes seguem donos dessas áreas).
- **Estado**: correções implementadas e provadas localmente. Nada foi commitado,
  instalado, publicado, atualizado ou aberto no app pessoal; nenhum dado pessoal
  ou PDF de curso foi lido.
- **Versão do template**: `material-2026-10-08.1` → `material-2026-10-08.2`.
  Mudança de saída de prévia/PDF invalida prévias antigas pelo contrato do
  `materialRevision` (a prévia real ecoa `templateHash` e descarta bytes fora
  da revisão).

## Resposta por achado

### P1-1 — `protectedRanges` ignorava contêineres Markdown (corrigido)

Causa: a proteção de código era heurística de linha, sem consultar a estrutura
que o `marked` produz (continuação de item de lista virava “código indentado”;
`>` de citação escondia o código real). O tokenizador alimenta prévia e PDF.

Correção em `template.mjs`:

- `protectedRanges` agora deriva as faixas da **árvore de tokens** do `marked`:
  percorre o bloco descendo em `blockquote`, `list` e `list_item` e protege todo
  token `code` (cercado ou indentado), onde estiver.
- `locateRaw` localiza o `raw` de cada filho dentro do `raw` do contêiner,
  tolerando os prefixos que o `marked` removeu (`>` de citação e recuos de item
  de lista). O casamento exato é tentado primeiro; a checagem de intervalo entre
  filhos (`fillerGap`) rejeita localização suspeita.
- A heurística de linha antiga virou `heuristicProtectedRanges` e só entra como
  fallback quando a árvore não reconstrói a fonte ou um filho não é localizável
  — exatamente a recomendação da revisão. Código nunca deixa de ser protegido no
  caminho normal.

Antes × depois (mesmo comando da revisão):

```sh
node --input-type=module -e 'import{tokenizeMaterial}from"./src/materials/template.mjs";console.log(JSON.stringify(tokenizeMaterial("- item\n\n    $x+1$ continuação\n").filter(s=>s.type==="math")))'
# antes: []            → PDF ok sem diagnóstico, com literal "$x+1$"
# agora: [{"type":"math","tex":"x+1",...}]
```

```sh
> Exemplo de código:
>
>     $\frac{1}{$
```

```text
antes: math ["\\frac{1}{"] e renderPdf rejeitava com MATH
agora: math [] e checkMaterialMath().errors === 0 (é código, não equação)
```

### P2-1 — headings aninhados não desciam (corrigido)

`prepareMaterialMarkdown` só olhava o primeiro nível. Agora a reescrita percorre
a mesma árvore de blocos (`blockquote`/`list`/`list_item`), localiza cada heading
na fonte por offsets e **edita o texto original** (substituindo só o intervalo do
heading, preservando `>`, recuos e o restante do conteúdo). O `lead` (espaços do
`raw`) é mantido para o heading continuar dentro do item de lista. Se algum
heading não for localizável, mantém a fonte normalizada inteira e emite
`heading-rewrite-skipped` (mesmo contrato de antes).

```text
entrada: título "Limites"; "# Limites\n\n> # Sub bloco\n\n## Depois\n"
antes:   "\n\n> # Sub bloco\n\n### Depois\n"      (dois H1 no DOM)
agora:   "\n\n> ## Sub bloco\n\n### Depois\n"      (um H1: o título)
```

Coberto também em lista (`- item\n\n    # Sub` → `    ## Sub`), setext citado
(`> Sub\n> ===` → `> ## Sub`) e heading citado com o mesmo texto do título (não é
removido; só o primeiro bloco de topo deduplica).

### P2-2 — CRLF/CR pulavam a reescrita (corrigido)

`normalizeLineEndings` (`\r\n?` → `\n`) entrou no início de
`prepareMaterialMarkdown`, `tokenizeMaterial` e `checkMaterialMath`; a fonte
normalizada é a usada na comparação com os `raw` dos tokens e nos offsets de
diagnóstico. Sem `heading-rewrite-skipped` por causa de CRLF.

```text
prepareMaterialMarkdown({title:'Limites',markdown:'# Limites\r\n\r\nTexto.\r\n'})
antes: inalterado + warning heading-rewrite-skipped
agora: "\n\nTexto.\n" + title-deduped
```

### P2-3 — placeholders de matemática dentro de atributos (corrigido)

A troca em string pós-DOMPurify atingia `href`/`title`, injetando HTML do KaTeX
no atributo. Agora `materialMathNodes` (novo, em `template.mjs`):

1. mantém os placeholders de texto no Markdown (o parse de `[texto](destino)`
   continua o mesmo);
2. depois do DOMPurify, substitui o fragmento de display que ocupa um `<p>`
   inteiro e depois os placeholders **somente em nós de texto** via DOM
   traversal, inserindo o HTML já gerado do KaTeX no lugar do texto;
3. placeholder remanescente em atributo (`href`, `title`, `data-*`…) vira o
   **texto matemático cru** (`$tex$`) via `setAttribute` — nunca o HTML do
   KaTeX; estrutura do elemento fica de pé e não há injeção de markup.

A config do DOMPurify não foi alterada (nem mais permissiva, nem mais restrita);
o KaTeX continua sendo injetado depois do sanitize, como antes, mas em nós do
DOM em vez de `String.replace` global.

```text
Sonda Electron real (documento de impressão), antes × depois:
  [link]($a$)                 href virava "<span class=..." quebrado
  agora                       href = "$a$"
  <div title="$b$">…</div>    title virava HTML do KaTeX
  agora                       title = "$b$"
  innerHTML                   sem MATHPLACEHOLDER/CODEPLACEHOLDER
```

### Notas menores

- **Cabeçalho desatualizado (`material-pdf.cjs:3-5` e comentário do
  `lockSession`)**: atualizados para descrever `src/materials/template.mjs`
  (marked + DOMPurify + KaTeX) no lugar de “MESMA função `markup` do chat” /
  `markdown.mjs`. Só comentários.
- **“Materiais da Mesa” vazia após bloqueio por `MATH`**: **não corrigido
  nesta rodada**. A pasta é criada por `courseMaterials.materialDirectory` antes
  do render, fora dos arquivos de propriedade desta rodada; é cosmético e
  exigiria mexer em `free-*`/`main` (agentes concorrentes). Fica registrado.
- **`tests/free-study-ui.mjs:93`**: falha pré-existente do working tree
  (`#support-bar` visível), fora deste domínio; não foi tocada.

## Preservação exigida

- **Conteúdo e raw Markdown**: nenhuma transformação além da normalização CRLF/CR
  (P2-2) e da reescrita de headings já existente; a fonte é editada por offsets,
  sem re-serializar o corpo.
- **Diagnósticos**: mesmos códigos e severidades (`title-deduped`,
  `headings-shifted`, `heading-rewrite-skipped`, `math-parse`, avisos do KaTeX,
  `math-scaled`/`math-wide`/`math-tall`); `headings-shifted` agora conta também
  os headings aninhados, que é o comportamento correto.
- **Sanitização sem regressão** (sonda Electron com `<script>`,
  `<img onerror>`, `<iframe>`, `javascript:` e matemática em atributo):
  `window.__pwned === null`, 0 script/iframe/img, `href` perigoso removido pelo
  DOMPurify, atributos de matemática com texto cru e nenhum placeholder vazado.
- **HTML permitido**: `FORBID_TAGS`/`FORBID_ATTR` intactos; nada foi estreitado
  nem afrouxado.

## Provas executadas nesta máquina

Tudo sintético, com runtime temporário; nenhum provedor/inferência real.

```sh
cd desk
env -u ELECTRON_RUN_AS_NODE node --test tests/material-template.test.mjs   # 22/22
env -u ELECTRON_RUN_AS_NODE node --test tests/free-material-pdf.test.mjs \
  tests/tutor-materials.test.mjs tests/material-preview-host.test.mjs \
  tests/free-host-ipc.test.mjs                                            # 23/23
env -u ELECTRON_RUN_AS_NODE node tests/material-template-dialog-ui.mjs     # PASS
env -u ELECTRON_RUN_AS_NODE node tests/material-preview-ui.mjs             # PASS
env -u ELECTRON_RUN_AS_NODE node tests/course-pdf-ui.mjs                   # PASS
env -u ELECTRON_RUN_AS_NODE node tests/native-tutor-pdf.mjs                # PASS
node tests/syntax-check.mjs                                                # ok
```

O que cada prova cobre:

- `material-template.test.mjs` (Node + Electron real): casos da revisão
  (lista/citação/fence aninhado, `$…$` em continuação, LaTeX inválido citado,
  CRLF), headings aninhados, e o documento longo com H1 único, `li .katex`
  renderizado, `href`/`title` com texto matemático, zero placeholder em
  `innerHTML`, PDF multipágina válido e o código citado literal no texto
  extraído.
- `material-template-dialog-ui.mjs` (Playwright + app): a prévia do diálogo
  mostra a fórmula da lista, heading de conteúdo rebaixado (H1 único) e
  `href="$a$"`/`title="$b$"` sem KaTeX no atributo; os fluxos anteriores
  (erro sem host, fit do host, edição invalidando a prévia) continuam passando.
- `material-preview-ui.mjs`/`course-pdf-ui.mjs`: prévia real e fluxo
  tutor→diálogo→salvar continuam idênticos com o template novo.
- `free-material-pdf`/`tutor-materials`/`material-preview-host`/`free-host-ipc`:
  contrato do serviço, limites de payload, escopo/cancelamento e captura do
  tutor preservados.

## Limites honestos

- O **fallback heurístico** continua sendo heurística: se o `marked` deixar de
  reconstruir a árvore num caso exótico, a proteção volta ao comportamento
  antigo (protege mais, podendo marcar continuação de lista como código). É a
  recomendação explícita da revisão (“manter a heurística só como fallback”);
  não há como decidir sem a árvore.
- A localização tolerante pode aceitar um prefixo a mais (espaços/`>`), mas a
  checagem de intervalo entre filhos e os testes de conteúdo cobrem os casos da
  revisão; não é uma reconstrução byte a byte do lexer.
- Não rodei `npm test` completo (nem o portão Bend) nesta rodada: o pedido era
  foco em testes do domínio e UI PDF sintéticos, e o working tree tem trabalho
  concorrente em UI/timeline sem relação com o template. O conjunto focado acima
  passou inteiro.
- As provas são estruturais/sintéticas; não certificam inferência real, PDF de
  material pessoal, app instalado nem inspeção visual humana nova (as prévias
  do diálogo e do documento de impressão foram inspecionadas por DOM e texto
  extraído).
- Não corrigi a pasta vazia “Materiais da Mesa” nem a falha pré-existente do
  `free-study-ui.mjs` — ambos fora dos arquivos desta rodada.
