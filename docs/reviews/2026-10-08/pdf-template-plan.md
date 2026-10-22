# Template de PDF limpo (A4 + KaTeX) e contrato do tutor

- **Data**: 2026-10-08
- **Autor**: sub-agente de pesquisa (rodada de investigação/planejamento)
- **Escopo**: template de PDF da Mesa (aba Livre e matéria) e contrato do tutor que
  prepara o conteúdo; insumo para o dono do domínio antes de qualquer implementação.
- **Estado**: nenhuma linha de código foi alterada nesta rodada. O documento é a
  única entrega. Não houve commit, instalação, abertura do app do usuário,
  chamada a modelo, leitura de dados pessoais ou release.
- **Insumo**: `docs/PLANO-UI-INTERATIVA-PDF-TIMELINE-2026-10-08.md` (item 4 do
  plano e critério "PDF de resolução e PDF de resumo seguem o mesmo template").

## TL;DR (recomendação)

1. **Manter o caminho atual KaTeX + `printToPDF` do Chromium** e evoluí-lo para um
   **template único compartilhado** entre a prévia do diálogo e a página de
   impressão. Não instalar engine TeX (Tectonic/TeX Live): o requisito "sem
   instalar engine" está atendido e o custo de distribuir/atualizar um binário de
   ~100–300 MB num app Electron offline não se paga para o resultado pedido.
2. **Um renderizador de material, duas saídas**: `prepareMaterialMarkdown`
   (título/dedupe/hierarquia, puro e testável em Node) + `renderMaterialHtml`
   (o `markup` existente) usados pela página de impressão **e** pela prévia. A
   prévia deixa de ser uma aproximação de tela e passa a ser o mesmo documento
   em A4 simulado; paginação exata vira fase opcional ("Ver prévia real").
3. **Título como H1 do template com deduplicação** do `# Título` que o modelo
   repete no começo do Markdown, e deslocamento dos headings do conteúdo
   (h1→h2, …) para existir **um** H1 e um sumário (`generateDocumentOutline`) útil.
4. **Validação de matemática antes de salvar**: hoje `throwOnError:false` faz
   erro de parsing virar texto vermelho (fácil de perder). A prévia lista os
   erros, bloqueia o save por padrão e o tutor recebe a lista para corrigir na
   mesma rodada. A validação correta é `throwOnError:true` + `strict:'error'`
   (pega comando indefinido, ambiente inexistente, `\\` no display e Unicode
   solto em math).
5. **Fórmula larga**: passe de *shrink-to-fit* (piso 0,72) na página de
   impressão e na prévia; o que ainda não couber vira aviso visível pré-save, não
   corte silencioso.
6. **Variantes mínimas** resumo/resolução/lista = mesmo template visual + um campo
   `kind` que define o *scaffold* de seções esperado (o conteúdo continua Markdown
   livre). Não criar três CSS.
7. **Estimativa MVP** (F1–F6): ~12–18 dias-dev; com prévia real paginada
   (F7, opcional): ~15–21 dias-dev, antes de buffer de revisão.

---

## 1. Como o pipeline funciona hoje (referências)

### 1.1 Serviço de PDF (main)

`desk/material-pdf.cjs`:

- `renderPdf` (linha 126) cria uma `BrowserWindow` oculta 794×1123, sandbox,
  `contextIsolation`, partição própria, `lockSession` (linhas 102–125) que só
  permite `file:` sob `desk/src/materials`, `desk/src`, `desk/node_modules` e o
  arquivo solto `desk/highlight.mjs`; nenhuma URL http(s) sai da máquina.
- Envia `{token, title, markdown}` por IPC (linha 234) e espera a página sinalizar
  `ok` antes de chamar `printToPDF` (linhas 250–256) com `preferCSSPageSize:true`,
  `pageSize:'A4'`, margens 0 (as margens reais vêm do `@page` do CSS),
  `generateTaggedPDF:true`, `generateDocumentOutline:true`.
- Teto de conteúdo: `MAX_MARKDOWN_CHARS = core.maxDraftChars()` = 262 144
  (linha 43); título: `MAX_TITLE_CHARS = core.maxTitle()` = **120** (linha 45,
  `core/freeworkspaces.bend:25-26`).
- `savePdf` (linha 358) grava com nome único (`candidateName`, sem sobrescrever),
  fsync, sha256 conferido; `sanitizeStem` (linha 286) limpa o nome.

### 1.2 Página de impressão

`desk/src/materials/print.html` (CSP fechada, linha 8; KaTeX local, linha 10) +
`print.mjs` + `print.css`.

- `print.mjs:54-57`: `document.title = title`, `doc.innerHTML = markup(markdown,
  false)`, `settleFonts(doc)` e `report(true)`. **O título do diálogo não aparece
  no corpo do documento** — só vira metadado/nome do arquivo.
- `print.css:18-26`: `@page { size:A4; margin:18mm 16mm 20mm }` → área de
  conteúdo de 178 mm × 259 mm. `print.css:28`: corpo **sans-serif** (11,5 pt/1,55).
  KaTeX tem fonte própria serifada (Computer Modern) e é o único lugar com serifa.
- Fórmulas: `.katex-display{overflow:visible; break-inside:avoid}` (linhas 98–104)
  — não há encolhimento nem aviso; fórmula mais larga que a coluna depende do
  comportamento do Chromium.
- Tabelas: `break-inside:avoid` (linhas 86–96) — tabela maior que uma página não
  pode ser dividida pelo navegador (risco de corte/salto).

### 1.3 Markdown + KaTeX compartilhado

`desk/src/markdown.mjs:24-39`: `markup` extrai `$$…$$`, `\[…\]`, `\(…\)`, `$…$`
com uma regex única (linha 26), renderiza KaTeX com `throwOnError:false` e injeta
`data-tex="…"` no primeiro `<span>` do resultado; `marked` com `breaks:true`;
DOMPurify no fim. O mesmo `markup` serve o chat e o PDF (`allowAssets=false` no
PDF). **É proibido mudar o comportamento do chat** ao mexer nisso (§6.4).

### 1.4 Diálogo e prévia (renderer)

`desk/index.html:440-462`: diálogo `#free-pdf-dialog` com título (maxlength 160),
textarea e `#free-pdf-preview` (`aria-label="Prévia do PDF"`, linha 457).
`desk/src/free-study.mjs`:

- `updatePdfPreview` (287–299): `renderInto(box, htmlNode(markup(text,false)))` +
  `decorateCode`. A prévia usa o CSS do app (`desk/style.css:699-704`: caixa
  tracejada, `max-height:220px`), **sem** largura A4, sem título, sem `@page`,
  sem paginação — não corresponde ao PDF.
- `openPdfDialog` (301) preenche a partir de rascunho do tutor ou de respostas;
  `savePdf` (348) só chama o host depois de `flushState`; o rascunho do tutor é
  limpo no sucesso (`desk/main.cjs:1850-1852`).

### 1.5 Tutor (Pi e Claude) e rascunhos

- Ferramenta Pi: `desk/src/extensions/tutor-pdf/index.ts` — `mesa_criar_pdf`,
  parâmetros `{title (1..160), markdown (1..262144)}` (linha 10); cliente HTTP
  `desk/src/extensions/tutor-pdf/client.mjs` → ponte local com token.
- Ferramenta Claude SDK: `desk/src/agents/tutor-pdf.cjs:7` — mesmos parâmetros
  (`max(160)`), nome MCP `mcp__mesa__criar_pdf`.
- Prompt fixado (uma frase): `desk/main.cjs:54` (`TUTOR_PDF_PROMPT`).
- Ponte → `prepareTutorMaterial` (`desk/main.cjs:691-705`): grava o rascunho
  (`{id,title,markdown}`) e emite `tutor-material` com `status:'prepared'`;
  o PDF **não** é gerado.
- Rascunho Livre: `desk/free-workspaces.cjs:214-217` (`normalizePdfDraft`) e
  matéria: `desk/src/study-data/course-materials.cjs:35-39` (`prepareDraft`,
  `pdf-drafts.json`). Save: `desk/free-workspaces.cjs:666-690` e
  `desk/main.cjs:1866` (matéria), ambos com `materialPdf.savePdf`.
- Preload/IPC: `desk/preload.cjs:5` (`MAX_FREE_TITLE=120`), `:283` e `:285`
  (`courseSaveMaterial`/`freeSaveMaterial`).

### 1.6 Testes existentes que já protegem o caminho

`desk/tests/free-material-pdf.test.mjs`: payload inválido (78), PDF real
multipágina com KaTeX embutido e texto extraível (86), zero rede (112), radical
vetorial (121), cancelamento (131), falha de escrita (141), nomes únicos (150),
rollback de metadata (159). `desk/tests/tutor-pdf-ui.mjs` e
`desk/tests/course-pdf-ui.mjs` exercitam o fluxo tutor → prévia → revisão → save.
Qualquer mudança do template precisa continuar verde nesses cenários.

---

## 2. Fatos medidos nesta rodada (probes isolados, sem abrir o app)

Comandos Node isolados contra `desk/node_modules/katex` (0.18.5) e leitura do PDF
sintético já versionado em `docs/reviews/2026-10-07/tutor-pdf-ui/Teorema de
Pitágoras.pdf`. **Nenhum teste do app foi executado nesta rodada.**

| Sonda | Resultado medido | Implicação |
|---|---|---|
| `\begin{aligned}`, `align`, `alignat`, `gather`, `equation`, `cases`, matrizes, `array`, `\tag`, `\text{}`, `\vec`, `\mathbb`, `\le/\ge/\neq`, `\left(\right)` | OK (HTML visível + MathML, sem erro) | o subconjunto útil de LaTeX de estudo está coberto pelo KaTeX 0.18.5 |
| `\frac{1}{` (sintaxe inválida) | `katex-error` + `title="ParseError…"` + `style="color:#cc0000"`; `throwOnError:true` lança | detecção de erro de parsing é viável |
| `\label`, `\ref`, `\ce`, `\SI`, `\qty`, `\vspace`, `\foo` | `throwOnError:true` **lança** (`Undefined control sequence`) | validação com `throwOnError:true` pega |
| `\begin{theorem}`, `\begin{foo}` | `throwOnError:true` **lança** (`No such environment`) | não precisa de allowlist manual: ambiente inexistente é erro |
| `\hspace`/`\hspace*` | OK (espaço aplicado; sem literal) | permitido; `\vspace` não existe |
| `\\` no nível de display | só *warning* (`newLineInDisplayMode`), renderiza **sem quebra**; com `strict:'error'` vira erro | validar com `strict:'error'` e exigir `aligned` para múltiplas linhas |
| Unicode acentuado fora de `\text{}` | *warning* (`unicodeTextInMathMode`); com `strict:'error'` vira erro | validação pega; contrato exige `\text{}` |
| `markup` em Node puro | falha em `DOMPurify.sanitize is not a function` (importa, mas não roda sem DOM) | a parte pura do template tem de ficar fora do `markup` para ser testável em Node |
| `$5 … $10` (cifrão) | extraído como math `$5 e o desconto é $`; com `strict:'error'` vira erro (Unicode em math) | contrato: `\$` para cifrão; erro pré-save ensina o escape |
| PDF sintético atual (Skia/Chromium) | `pdfinfo`: Tagged yes, Title = "Teorema de Pitágoras", A4, 1 página; bytes contêm `/StructTreeRoot` e `/Outlines`; `pdffonts`: SFNS (sans, Tipo 3) + KaTeX_Main/Math; `pdftotext`: título aparece 1× | acessibilidade básica já existe; template com H1 único a preserva |

**Correção metodológica importante**: uma primeira leitura binária do HTML do
KaTeX (procurando `\begin{…}` no texto) sugeriu que `\begin{align}` e
`\begin{equation}` viravam literal. Era **falso positivo**: o texto estava no
`<annotation encoding="application/x-tex">` do bloco MathML (invisível na
página e no PDF). Removendo o bloco `katex-mathml` antes de inspecionar, todos os
ambientes suportados renderizam corretamente e os desconhecidos **lançam**. A
validação não precisa de allowlist; precisa de `throwOnError:true` +
`strict:'error'`.

Observação: o PDF atual embute texto com fontes **Tipo 3** (comportamento do
Skia/Chromium). Isso é limitação do motor de impressão, não do template; aparece
como risco em §12 e não é corrigível sem trocar de engine.

---

## 3. Problemas concretos (estado atual)

- **P1 — prévia não é o PDF.** `free-study.mjs:287-299` usa o CSS do app; o
  template nem existe no corpo do PDF. Tamanho de linha, fonte, cor de papel,
  margem e quebra não correspondem. É o maior risco de "prévia fiel".
- **P2 — título não aparece no corpo.** `print.mjs:54` só seta `document.title`;
  o H1 vem do Markdown quando o modelo escreve `# Título`. Se o template passar a
  renderizar o título, sem dedupe o PDF sai com título duplicado.
- **P3 — erro de matemática invisível.** `markup` usa `throwOnError:false`;
  parsing inválido vira texto vermelho no meio do conteúdo (fácil de não notar;
  em tema escuro da prévia o `#cc0000` fica pior). Não há lista de erros nem
  portão pré-save.
- **P4 — fórmula larga sem tratamento.** `print.css:98-104` mantém
  `overflow:visible` e sem escala; a coluna tem 178 mm e `\sum` longo/`aligned`
  largo passa da margem. "Sem conteúdo cortado" é critério do plano.
- **P5 — multipágina incompleta.** Tabela tem `break-inside:avoid` sem
  `thead{display:table-header-group}`; parágrafos sem `orphans/widows`; itens de
  lista longos com fórmula não são protegidos. Falta prova sintética de 3+ páginas
  com tabela cruzando página.
- **P6 — teto de título divergente.** Ferramentas anunciam 160
  (`index.ts:10`, `tutor-pdf.cjs:7`), mas o host recusa > 120
  (`free-workspaces.cjs:215` via `maxTitle()`; `course-materials.cjs:36` via
  `MAX_TITLE_CHARS`). Título de 121–160 chars vira `BAD_DRAFT`/erro genérico.
- **P7 — cifrão vira matemática.** Medido: `$5 … $10` vira math e, com
  `strict:'error'`, vira erro (Unicode acentuado em math). O contrato precisa
  exigir `\$` e a mensagem deve sugerir o escape.
- **P8 — texto sans com math serifada.** `print.css:28` corpo sans; KaTeX serif.
  O usuário pediu texto/math serifados; não há serifa offline garantida hoje além
  da própria KaTeX.
- **P9 — sem contrato de acessibilidade do erro/prévia.** `#free-pdf-preview` tem
  `aria-label` mas nada anuncia erros; não há checagem de contraste nem de H1
  único.
- **P10 — sem estrutura/variantes no contrato do tutor.** O prompt
  (`main.cjs:54`) é uma frase; nada pede ordem de seções, `aligned`, `\text`
  para unidades nem ausência de preâmbulo TeX.

---

## 4. KaTeX + print vs compilação TeX nativa

Duas coisas diferentes são frequentemente confundidas:

| | **KaTeX + `printToPDF` (atual)** | **Engine TeX nativa (Tectonic/LuaLaTeX)** |
|---|---|---|
| O que renderiza | *matemática* por fórmula (KaTeX) + *documento* pelo Chromium | página inteira pelo TeX (texto + matemática + quebra) |
| Entrada | Markdown + subconjunto TeX inline/display | `.tex` completo, preâmbulo, pacotes |
| Ambientes | subconjunto do KaTeX: `aligned`, `align`, `alignat`, `gather`, `equation`, `cases`, matrizes, `array`, `\tag`; o resto lança erro | `align`, `equation`, `gather`, `\label`/`\ref`, mhchem, `\cancel`, `siunitx`… |
| Estilo | escolhido por nós (CSS); math = Computer Modern | classe/pacote escolhe tudo; saída clássica |
| Quebra de página | heurística do Chromium; controle por CSS | controle fino (`\raggedbottom`, `\penalty`, ambientes) |
| Fonte de texto | sistema (Georgia etc.) ou futura embutida | Computer Modern/Latin Modern embutidas |
| Distribuição | já no `node_modules` (KaTeX) | binário + milhares de arquivos (100–300 MB), por SO/arch |
| Segurança | sem execução de TeX; sem rede (teste em `free-material-pdf.test.mjs:112`) | engine é superfície nova; `--shell-escape` proibido; sandbox |
| Fluxo | intacto: prévia, rascunho, nomes únicos, sha256 | precisaria gerar `.tex`, compilar, converter, tratar erros do log |
| Esforço | incremental (semanas) | projeto novo (meses) + empacotamento |
| Acessibilidade | Tagged PDF + outline do Chromium (medido) | depende de engine + `hyperref`/`tagpdf` (experimental) |

**Decisão recomendada: manter KaTeX + print.** Justificativa:

1. O pedido é "template limpo", não "qualidade tipográfica de editora"; A4,
   hierarquia, serifa, cores suaves, margens e multipágina razoável são
   alcançáveis com o que já existe.
2. Distribuição offline do app é requisito; cada SO/arch vira um problema de
   bundle, licença e atualização de engine.
3. O caminho atual já tem garantias testadas (nomes únicos, sha256, cancelamento,
   zero rede). Trocar de engine joga fora esses testes e boa parte do valor da
   rodada anterior.
4. A diferença que importa (`\label`/`\ref`, `mhchem`/`siunitx`, `\cancel`)
   resolve-se com **contrato do tutor** (unidades em `\text{}`, numeração
   manual em `\tag`) e **validação visível** — não com engine.

Consequências a documentar no contrato (§7.2): múltiplas linhas dentro de um
`$$…$$` podem usar `aligned`/`align` (ambos suportados); `\label`/`\ref` não
existem no KaTeX (numerar à mão com `\tag`); unidades em `\text{}` (sem
`siunitx`); `\vspace` não existe; preâmbulo TeX proibido (nada de
`\documentclass`, `\usepackage`).

---

## 5. Template de produto (especificação)

### 5.1 Página, margens e medida

- A4 retrato; `@page { size:A4; margin:18mm 16mm 20mm }` (manter — evita churn em
  PDFs/testes existentes). Área de conteúdo: **178 mm × 259 mm**.
- Tokens no CSS do template: `--page-w:178mm`, `--page-h:259mm`, para a prévia
  usar a mesma medida e não repetir número mágico.
- Sem `break-before:page` forçado pelo template; quebras são consequência do
  conteúdo (o tutor não decide página).

### 5.2 Tipografia (serifada)

- Corpo: `11pt/1.55` com pilha serifada offline:
  `Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Times New Roman',
  'Noto Serif', 'Source Serif 4', serif`.
- Títulos: mesma família, `font-weight:650`, `line-height:1.2`; h1 20pt,
  h2 14,5pt, h3 12,5pt, h4–h6 11pt. `break-after:avoid`.
- KaTeX continua `KaTeX_Main`/`KaTeX_Math` (serifadas) — combina com o corpo;
  não mexer no `katex.min.css`.
- Código: mono do sistema (mantém `print.css:63-77`), com realce suave.
- `font-variant-numeric: lining-nums` no corpo (números de linha de tabela e
  unidades alinham melhor).

### 5.3 Cores suaves (tokens + contraste)

| Token | Valor | Uso | Contraste sobre branco |
|---|---|---|---|
| `--ink` | `#1f2328` | texto | ~15:1 |
| `--ink-soft` | `#3d444d` | títulos/negrito | ~10:1 |
| `--muted` | `#5c6670` | legendas, citações | ~6:1 |
| `--rule` | `#dfe3e8` | filetes, bordas | decorativo |
| `--panel` | `#f6f8fa` | cabeçalho de tabela, código | — |
| `--accent` | `#8a5a44` (terracota suave) ou `#2f5d50` | filete de seção, destaque de "Resposta" | ≥4,5:1 |
| `--error` | `#b3261e` | erro de matemática | ~6:1 |

Manter `-webkit-print-color-adjust:exact` (`print.css:29-30`). Rebaixar
`--comment` do realce de código de `#78716c` (~4,4:1) para `#57606a` (≥4,5:1).
Sem cor como único portador de significado (erro também tem ícone/rótulo).

### 5.4 Título e hierarquia (dedupe)

Regra do template:

1. O template sempre renderiza o **título como único H1** (texto puro escapado,
   sem Markdown/LaTeX).
2. `prepareMaterialMarkdown(markdown, title)` remove o **primeiro heading ATX**
   do corpo quando seu texto normalizado (trim, espaços colapsados,
   case-insensitive) é igual ao título. Só o primeiro bloco de heading, só se for
   o primeiro conteúdo não vazio.
3. Os headings restantes do corpo são **deslocados +1** (h1→h2 … h5→h6; h6 fica
   h6): um único H1, hierarquia e outline coerentes. A transformação é feita no
   **Markdown fonte** (linha a linha, ignorando blocos de código cercados e
   blocos `$$…$$`), não no HTML — evita regex de HTML e mantém o `markup` do chat
   intocado.
4. Setext (`Título\n=====`) fica fora do contrato; a validação pode avisar
   (heurística) sem reescrever.
5. Kicker opcional: uma linha `Resumo` / `Resolução` / `Lista de exercícios`
   acima do H1 **só quando `kind` for informado** pelo tutor (determinismo em
   teste; no "Montar PDF" manual não aparece).

Isso resolve P2 e a duplicação sem tocar em PDFs já salvos (o rascunho é
re-renderizado; o arquivo salvo é imutável).

### 5.5 Elementos

- **Listas**: `ul/ol` com recuo 1,4em; `li` com `break-inside:avoid` quando
  contém display math (`li:has(.katex-display)`), `ol > li::marker` com peso 600.
- **Tabelas**: `border-collapse`, cabeçalho `--panel`, filetes `--rule`;
  `thead{display:table-header-group}` (repete o cabeçalho em toda página),
  `table{break-inside:auto}`, `tr{break-inside:avoid}`, `word-break:break-word`.
- **Blocos**: `blockquote` com filete `--rule` e texto `--muted` (bom para
  "Enunciado" da variante resolução); `pre/code` como hoje; `hr` como filete.
- **Task lists**: o CSS atual esconde o `<input>` (`print.css:111-112`), o que
  deixa um item sem marcador; trocar por `::before` com `□`/`■` (ou remover o
  suporte a task list do contrato).
- **Links**: `text-decoration:underline; text-underline-offset:2px` (print.css
  já faz); sem cor de tela.

### 5.6 Matemática

- Inline `$…$`; display `$$…$$` (ou `\[…\]`).
- Ambientes homologados (todos verificados): `aligned`, `alignedat`, `gathered`,
  `split`, `cases`, `rcases`, `dcases`, `matrix`/`pmatrix`/`bmatrix`/`Bmatrix`/
  `vmatrix`/`Vmatrix`, `array`, `darray`, `smallmatrix`, `subarray`, `align`,
  `alignat`, `gather`, `equation`; `\tag` permitido em display. Comando fora
  dessa lista e ambiente inexistente **lança** — viram erro pré-save.
- Unidades sempre em `\text{}` (`5\ \text{cm/s}`); vírgula decimal no texto, não
  na fórmula (contrato de redação).
- Erros (§5.7/§7) listados com o trecho exato e a mensagem do KaTeX.
- Refinamento de CSS: `.katex{font-size:1.03em}` (manter); `.katex-display`
  centralizado, margem vertical 0,9em; nunca `overflow:hidden`.

### 5.7 Fórmula larga (fórmula mais larga que a coluna)

Na página de impressão, **depois** de `settleFonts` e **antes** de `report`:

```text
fitWideDisplays(doc):
  para cada .katex-display:
    resetar font-size; medir largura natural (filho) vs. coluna
    se natural > coluna: font-size = max(0,72, coluna/natural) × 1em
    remedir; se ainda > coluna: marcar data-overflow="1"
```

- Piso 0,72 (abaixo disso a fórmula fica ilegível; é melhor avisar).
- O aviso é visível **pré-save** na prévia (mesma medição no contêiner de
  178 mm) e confirmado no `done` da página de impressão.
- Bloqueio padrão do save com `data-overflow`; liberar com confirmação explícita
  ("Salvar mesmo assim") — mesma política dos erros de matemática.
- Alternativa descartada: quebrar a fórmula automaticamente (transformar em
  `aligned` com pontos escolhidos é adivinhação; o tutor deve quebrar).

### 5.8 Multi-página (sem conteúdo cortado)

- `h1..h6{break-after:avoid}` + `p{orphans:3;widows:3}`.
- `blockquote, pre, .katex-display, figure {break-inside:avoid}`
  (mantém o que existe).
- Tabelas: como em §5.5 (auto + `thead` repetido + `tr` evitado).
- `li` com display math: evitar quebra.
- Fórmula alta (`cases` com muitas linhas) com `break-inside:avoid`: se maior
  que a página, o Chromium pode cortar — a medição da §5.7 detecta altura
  (`scrollHeight` vs. `--page-h`) e transforma em aviso pré-save.
- Teste sintético de 3+ páginas com tabela cruzando página (§11).

### 5.9 Fontes offline

- KaTeX: já empacotado em `desk/node_modules/katex/dist/fonts` (60 arquivos,
  carregados pelo `katex.min.css` local); a sessão de impressão já libera
  `desk/node_modules` (`material-pdf.cjs:102-125`) e o teste de rede garante
  zero requisições.
- Texto serifado: **pilha do sistema** (nenhum arquivo novo, nenhuma licença
  nova). Limitação: a serifa exata varia por SO (na macOS, Georgia; no Windows,
  Georgia/Times). Se um dia for necessária fidelidade absoluta, embutir uma
  serifada OFL (ex.: Source Serif 4) em `desk/src/materials/fonts/` com
  `@font-face` — fora deste escopo, e exige ampliar `lockSession` (que já libera
  `PRINT_DIR`) e checar o peso do bundle.
- A espera de `document.fonts` de `print.mjs:26-44` já cobre as faces KaTeX.

### 5.10 Acessibilidade

- Um único H1 (título) + headings deslocados → outline (`/Outlines`) começa no
  título; `document.title` já vira metadado (`pdfinfo Title`, medido).
- `lang="pt-BR"` no `print.html` (já existe) e `generateTaggedPDF:true`
  (medido: Tagged yes, `/StructTreeRoot` presente).
- MathML do KaTeX existe no DOM da prévia; o PDF tagueado carrega o texto
  renderizado, **não** semântica MathML. Mitigação de produto: contrato exige
  uma frase de explicação/unidades por fórmula essencial (pedagogia + leitura
  assistida).
- Lista de erros com `role="alert"` e foco/aria para leitor de tela; a prévia não
  é `aria-live` (evita tagarelice a cada tecla) — um resumo "N erros" perto do
  botão é anunciado quando muda.
- Contraste dos tokens em §5.3; nenhuma cor é o único sinal.
- Texto Tipo 3 do Skia: registrar como limitação conhecida (não bloqueia
  tagged/outline, mas leitores de tela variam).

---

## 6. Arquitetura concreta

### 6.1 Novos módulos

| Arquivo | Papel | Consumer |
|---|---|---|
| `desk/src/materials/tex.mjs` | regex única de extração de math + `checkMath(markdown)` (KaTeX `throwOnError:true` + `strict:'error'`) | `markdown.mjs`, `template.mjs`, `print.mjs`, `free-study.mjs`, main (dynamic import) |
| `desk/src/materials/template.mjs` | `MATERIAL_KINDS`, `normalizeKind`, `prepareMaterialMarkdown` (puro), `renderMaterialHtml` (usa `markup`), `materialDiagnostics` (DOM) | `print.mjs`, `free-study.mjs`, main (dynamic import do que for puro) |
| `desk/src/materials/pdf-template.css` | tipografia/tokens/elementos A4 (escopo `.pdf-doc`) | `print.css` (`@import`) e `index.html` |
| `desk/src/materials/preview.mjs` (opcional) | escalador da prévia (transform + altura) | `free-study.mjs` |

`markdown.mjs` passa a importar a regex de `tex.mjs` (uma fonte de verdade para
a extração), **sem mudar o comportamento**: nenhuma transformação de
título/heading entra no `markup` compartilhado com o chat. Teste de paridade do
chat deve continuar verde (§11).

### 6.2 Fluxo

```text
preview (renderer)                print page (main)              main/IPC
─────────────────                 ─────────────────             ─────────
markdown ─► prepareMaterialMarkdown(title, kind) ──────────────► mesmo código
         ─► renderMaterialHtml ─► HTML sanitizado
         ─► #free-pdf-preview .pdf-doc (178mm, escala)
         ─► checkMath ─► lista de erros (role=alert)
save ─────────────────────────────────────────────► renderPdf({strict:false})
                                                    ├─ pág. mede/fit/checkMath
                                                    ├─ done({ok, diagnostics})
                                                    └─ {buffer, diagnostics}
         ◄──── materialPreview (fase 2) ─────────────┘ (bytes, sem salvar)
```

### 6.3 Contrato de diagnósticos (aditivo, sem quebrar códigos atuais)

`renderPdf` passa a devolver `diagnostics`:

```js
{
  buffer, bytes, sha256,
  diagnostics: {
    mathErrors: [{source, message, index}],
    overflows: [{source, scale}],
    pages: 0,              // preenchido depois do print (pdfjs não; só estimativa)
  }
}
```

`savePdf({..., acknowledge:false})` mantém o comportamento atual por padrão;
com `acknowledge:false` e diagnóstico bloqueante, falha com `MATH` ou
`OVERFLOW` e `details.diagnostics`. Os handlers IPC
(`free-save-material`/`course-save-material`) recebem `acknowledge` do diálogo
(só true após o usuário confirmar o aviso) e repassam. Nenhum código de erro
existente muda de nome; `MATH`/`OVERFLOW` são novos.

### 6.4 Invariantes (o que não pode mudar)

- `markup(text, allowAssets)` continua produzindo exatamente o mesmo HTML para o
  chat; nenhuma transformação de material dentro dele.
- `allowAssets=false` no PDF (figuras/assets seguem desabilitados).
- Zero rede, zero eval, zero caminho escolhido pelo conteúdo; `lockSession`
  inalterado (ou ampliado só se fontes forem embutidas).
- Nomes únicos, fsync, sha256, cancelamento, timeout e rollback de metadata
  intactos.
- Rascunho nunca gera arquivo antes do clique de salvar (testes de UI já provam).

### 6.5 O que muda por arquivo (mapa de implementação)

- `desk/src/materials/print.html`: link do `pdf-template.css` (e nada de CSP
  nova).
- `desk/src/materials/print.mjs`: `renderMaterialHtml`, `fitWideDisplays`,
  `checkMath`, `report(true, {diagnostics})`, kicker/título (`document.title`
  permanece).
- `desk/src/materials/print.css`: passa a conter só `@page`, `html/body`, regras
  de impressão (`break-*`) e `@import` do template; tipografia sai para o
  template.
- `desk/src/free-study.mjs`: `updatePdfPreview` usa o template; lista de erros;
  botão bloqueado/confirmar; chip de `kind`; opcional "Ver prévia real".
- `desk/index.html`: `link` do template; `#free-pdf-preview` ganha casca de
  página; `#free-pdf-errors` (`role=alert`); (fase 2) área de prévia real.
- `desk/main.cjs`: `prepareTutorMaterial` chama `checkMath` e devolve
  diagnósticos; handlers de save repassam `acknowledge`; `TUTOR_PDF_PROMPT`
  ganha o contrato (§7.2).
- `desk/src/extensions/tutor-pdf/index.ts` e `desk/src/agents/tutor-pdf.cjs`:
  `kind`, título ≤120, descrição com o contrato; relatar erros no resultado.
- `desk/src/extensions/tutor-pdf/client.mjs` e ponte (`tutor-material`):
  carregar `kind`/diagnósticos; mensagem centralizada no `result.message` para
  Pi e Claude não divergirem.
- `desk/free-workspaces.cjs`, `desk/src/study-data/course-materials.cjs`,
  `desk/preload.cjs`: aceitar/persistir `kind` (opcional; ausente = `resumo`),
  `acknowledge` no save.
- `desk/style.css`: a prévia deixa de ser caixa tracejada e vira página (regras
  do template no escopo `.pdf-doc`; o resto fica no `pdf-template.css`).

---

## 7. Contrato do tutor

### 7.1 Ferramenta (parâmetros)

```text
mesa_criar_pdf / mcp__mesa__criar_pdf:
  title:   string 1..120  (texto puro, sem Markdown/LaTeX)   ← corrige P6
  kind:    'resumo' | 'resolucao' | 'lista' | 'livre'  (default 'resumo')
  markdown: string 1..262144
```

Resposta da ponte (para os dois hosts):

```js
{
  prepared: true, reviewRequired: true, title, kind,
  diagnostics: {mathErrors:[…], overflows:[…], warnings:[…]},
  message: 'Conteúdo pronto no diálogo de PDF. …'   // texto único, sem inventar
}
```

Regras: com `mathErrors`, a mensagem diz explicitamente que há N equações
inválidas e pede correção **sem** declarar sucesso; o modelo deve reenviar. O
rascunho **é persistido mesmo com erro** (o usuário vê a prévia com os erros
destacados e pode corrigir à mão) — evita beco sem saída se o modelo insistir.
O PDF continua não sendo salvo até o clique do usuário.

### 7.2 Prompt do tutor (resumo do texto novo)

Acrescentar ao `TUTOR_PDF_PROMPT` (`main.cjs:54`):

- título em texto puro; **não repetir** `# Título` no começo do Markdown;
- seções em ATX (`#`, `##`), nunca setext;
- matemática só em `$…$`/`$$…$$`; ambientes suportados (recomendado `aligned`
  para passo a passo e `cases`/matrizes); unidades em `\text{}`; **proibido**
  `\label`, `\ref`, `siunitx` (`\SI`/`\qty`), `\vspace`, preâmbulo
  TeX/`\usepackage` (o KaTeX lança nesses casos); Unicode acentuado fora de
  `\text{}` vira erro;
- passo a passo em `aligned`/lista numerada; resposta destacada com `>` ou
  "Resposta:"; toda fórmula essencial com uma frase de explicação;
- cifrão monetário escapado (`\$`);
- adaptar ao `kind` (scaffolds abaixo).

### 7.3 Variantes mínimas (julgamento)

Mesmo template visual; `kind` define o scaffold **esperado** (não imposto) e um
aviso suave se faltar:

| `kind` | Scaffold esperado | Marcas de estilo |
|---|---|---|
| `resumo` | Objetivo → Conceitos → Exemplo resolvido (opcional) → Exercícios (opcional) | kicker "Resumo" |
| `resolucao` | Enunciado (blockquote) → Resolução (passos numerados com `aligned`/display) → Resposta | kicker "Resolução"; "Resposta" com filete de destaque |
| `lista` | Orientações → Exercícios numerados → Gabarito (opcional, no fim) | kicker "Lista de exercícios"; `ol` com espaço entre itens |
| `livre` | nenhum scaffold (Montar PDF manual) | sem kicker |

Não criar CSS diferente por variante nem reordenar conteúdo automaticamente. A
validação de scaffold é **aviso** (não bloqueia): o tutor tem liberdade quando o
pedido do usuário não casa com o molde.

### 7.4 Fluxo revisão → save (Livre e matéria)

Idêntico ao atual (`prepare → tutor-material prepared → diálogo → salvar`),
agora com:

- `kind` no rascunho (`normalizePdfDraft` e `prepareDraft` aceitam o campo;
  ausente = `resumo`; valor inválido = `resumo` com aviso, nunca erro);
- diagnósticos exibidos no diálogo com trecho e contagem;
- botão "Salvar PDF e abrir" bloqueado enquanto houver erro/overflow, com
  "Salvar mesmo assim" (confirmação) que envia `acknowledge:true`;
- matéria e Livre usam o mesmo `material-*.cjs`/template (zero divergência);
- o rascunho continua por conversa, persiste no reload e é consumido no save.

---

## 8. Prévia fiel: alternativas e recomendação

| Opção | Como | Fidelidade | Custo | Riscos |
|---|---|---|---|---|
| **A. Mesmo renderizador + CSS compartilhado** (recomendada MVP) | `renderMaterialHtml` usado pela prévia e pela impressão; prévia em coluna de 178 mm escalada por `transform` | conteúdo, tipografia, quebras de linha, cores, título, erros: iguais por construção; **paginação aproximada** | baixo | escala/altura do wrapper; rolagem do diálogo |
| **B. Iframe com `print.html`** | embutir a própria página de impressão e medir `@page` por media query de impressão | alta (mesmo motor), paginação ainda não visual | médio | CSP/`file:` dentro do renderer, dois canais IPC; pior para editar/validar |
| **C. Prévia real paginada** (fase 2) | IPC `material-preview-render` → `renderPdf` (só bytes) → pdfjs desenha páginas em `<canvas>` no diálogo | **exata** (é o PDF); sem arquivo até salvar | médio-alto (2–3 d) | tempo de render; cancelar; memória; UI nova |
| **D. Prévia DOM sem CSS compartilhado** | manter e "ajustar cores" | baixa (é o problema atual) | — | não atende "prévia fiel" |

Recomendação: **A no MVP** + **C como fase opcional explícita** ("Ver prévia
real"), porque A já elimina a divergência de conteúdo/estilo e C é a única que
resolve paginação exata. Detalhes de A:

- casca: `viewport` (largura disponível) → `page` (210 mm) → `.pdf-doc`
  (178 mm de conteúdo, recuo `@page`); fundo branco fixo mesmo no tema escuro
  (é papel), com moldura neutra e sombra discreta;
- escala: `transform: scale(min(1, viewportW / 794px))` com
  `transform-origin:top left` e altura do wrapper recalculada no
  `ResizeObserver` (evita corte/sobreposição);
- rodapé da prévia: "≈ N páginas" calculado de
  `ceil(conteúdo / --page-h)` — rotulado como estimativa, sem desenhar quebras
  falsas;
- erros: `.katex-error` ganha destaque próprio (fundo `--error` suave + ícone);
  clicar na mensagem seleciona o trecho no textarea via `data-tex`.

---

## 9. Alternativas com julgamento (consolidado)

| Decisão | Opções | Escolha | Por quê |
|---|---|---|---|
| Motor | KaTeX+print × TeX nativo × MathJax | **KaTeX+print** | offline, testado, sem binário; `\label`/`siunitx`/`mhchem` resolvidos por contrato |
| Título | só metadado × H1 do template com dedupe | **H1 com dedupe + shift** | aparência limpa e um único H1; evita duplicação |
| Validação | aviso vermelho × lista + bloqueio | **lista visível, save bloqueado com confirmação** | erro de matemática no material é grave; usuário mantém a saída |
| Prévia | CSS compartilhado × iframe × prévia real | **A (MVP) + C (fase 2)** | fidelidade por construção sem o custo do iframe; C quando paginação exata for exigida |
| Serifa | sistema × embutir fonte | **sistema agora**, embutir só se houver demanda | zero licença/bundle; KaTeX já garante a math |
| Variantes | 3 CSS × 1 CSS + `kind` | **1 CSS + scaffolds** | manutenção e coerência; conteúdo continua livre |
| Strain de fórmula | cortar × encolher × avisar | **encolher até 0,72 → avisar** | legibilidade e nenhuma surpresa escondida |
| Diagnóstico no tutor | erro duro × rascunho com erros | **persistir + erros na resposta** | evita loop sem draft e dá ao usuário o controle |
| Onde mora a lógica | core Bend × ESM host | **ESM host com testes** | feature só da Mesa (sem paridade com o chat); string/linha é onde Bend é pior; a fronteira valida `kind` |

---

## 10. Critérios de aceitação

1. **A4/template**: PDF gerado é A4 com margens 18/16/20; título em H1 único; sem
   título duplicado quando o Markdown repete o título; headings do corpo
   deslocados; outline começa no título.
2. **Tipografia**: corpo serifado 11pt; math KaTeX serifada; paleta de §5.3 com
   contraste documentado; realce de código com `--comment` corrigido.
3. **Matemática**: `aligned`, `cases`, `pmatrix`, `array`, `\tag`, `\text{}`
   renderizam; fórmula mais larga que a coluna encolhe (≥0,72) ou vira aviso;
   nenhum recorte silencioso nos fixtures.
4. **Erros pré-save**: equação inválida aparece listada no diálogo com o trecho;
   save bloqueado por padrão; "Salvar mesmo assim" libera; o tutor recebe os
   erros e a mensagem não declara sucesso.
5. **Multipágina**: documento sintético de 3+ páginas sem cabeçalho órfão, com
   repetição de `thead` na tabela que cruza página e ordem de conteúdo preservada.
6. **Prévia**: `#free-pdf-preview .pdf-doc` usa o mesmo HTML/CSS da impressão para
   o fixture; estimativa "≈ N páginas" visível; (fase 2) "Ver prévia real" mostra
   páginas exatas sem criar arquivo.
7. **Matéria e Livre**: mesmo template e mesmas garantias nos dois fluxos;
   rascunho preserva `kind`; nada é gravado antes do clique.
8. **Acessibilidade**: `lang`, Tagged PDF + `/Outlines` + Title verificados no
   fixture; erro com `role="alert"`; contraste ok.
9. **Invariantes**: `markup` do chat inalterado (paridade verde); zero rede; sem
   eval; nomes únicos/sha256/cancelamento/rollback preservados.
10. **Teto de título**: ferramenta e host concordam em 120.

---

## 11. Testes sintéticos

### 11.1 Node puro (sem Electron) — novo `desk/tests/material-template.test.mjs`

- `prepareMaterialMarkdown`: título repetido removido; título diferente mantido;
  shift de níveis; heading dentro de cerca de código e dentro de `$$…$$` não é
  tocado; setext intacto (com aviso); markdown sem título.
- `checkMath`: `aligned/align/cases/pmatrix/array/gather/tag/text` = 0 erros;
  `\frac{1}{` = 1 erro; `\label`/`\ref`/`\begin{theorem}`/`\vspace` = erro;
  `$5 … $10` = erro com dica de `\$` (pin do comportamento).
- `normalizeKind`: valores válidos, inválido → default, ausente → default.
- Paridade da regex: `tex.mjs` e `markdown.mjs` extraem os mesmos spans para um
  fixture (evita drift da extração).

### 11.2 Electron runner — estender `desk/tests/free-pdf-runner.cjs` e
`free-material-pdf.test.mjs`

- `template`: título + seções + `aligned`/`cases`/matriz + tabela + lista +
  documento longo; com pdfjs: título 1×, ordem das seções, ≥3 páginas, nenhum
  `$$`/`\begin`, tabela com cabeçalho repetido, sem página final vazia.
- `wide`: fórmula larga; medir via `executeJavaScript` antes do print que
  `scrollWidth <= clientWidth` e/ou `data-overflow` presente; PDF gerado.
- `invalid`: markdown com erro; `renderPdf` devolve `diagnostics.mathErrors` ≥1;
  `savePdf` sem `acknowledge` falha `MATH`; com `acknowledge:true` grava.
- `title`: `# Título` igual ao campo; texto do PDF contém o título 1×.
- Reusar as garantias atuais (rede, radical, abort, writefail, unique, inject)
  sem mudança de expectativa.

### 11.3 UI (Playwright, harness atual)

- Prévia: digitar markdown com `# Título` e fórmula válida → `#free-pdf-preview
  .pdf-doc h1` único e `.katex` presente; sem arquivo criado.
- Erro: fórmula inválida → `#free-pdf-errors [role=alert]` visível; botão
  bloqueado; "Salvar mesmo assim" habilita; salvar gera PDF com o conteúdo.
- Escala: 900×650 sem rolagem horizontal na prévia; 1500×960 ok; margens do
  diálogo (os testes atuais já medem).
- Fluxos tutor (Pi simulado) em Livre e matéria: conteúdo completo, rascunho
  persiste no reload, `kind` sobrevive, PDF só após revisão (estender
  `tutor-pdf-ui.mjs` e `course-pdf-ui.mjs`).
- Acessibilidade de DOM: 1 H1, `role=alert`, `aria-label` da prévia.

### 11.4 Fixtures

- `tests/fixtures/material-ti.md` (resumo curto), `material-long.md` (3+ páginas
  com tabela), `material-wide.md`, `material-invalid.md`,
  `material-resolucao.md`, `material-lista.md` — todos sintéticos.

Comandos previstos (a rodar na implementação, não nesta rodada):

```sh
cd desk
node --test tests/material-template.test.mjs
node --test tests/free-material-pdf.test.mjs
node tests/tutor-pdf-ui.mjs && node tests/course-pdf-ui.mjs
npm run hunts
MESA_GATE_CACHE=0 npm test
```

---

## 12. Riscos e mitigação

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Divergência prévia × PDF com o tempo | média | alto | renderizador único + teste de estrutura do fixture; template CSS único |
| Ambientes/`strict` mal validados deixando erro passar | média | alto | `throwOnError:true` + `strict:'error'` em `checkMath` + erro visível pré-save; teste com `align`/`gather`/Unicode |
| Falso positivo de `$` monetário | alta | médio | contrato `\$` + mensagem que ensina; gate confirmável |
| Shrink-to-fit ilegível | média | médio | piso 0,72 + aviso; tutor instruído a quebrar |
| Tabela longa/fórmula alta cortada | média | alto | `thead` repetido + medição de altura + aviso pré-save |
| Chat estragado por refactor do `markup` | baixa | alto | não transformar material dentro do `markup`; testes de paridade |
| Fontes serifadas diferentes por SO | alta (limitação) | baixo/médio | pilha do sistema; embutir depois se for requisito |
| Texto Tipo 3 do Skia em leitores de tela | média (limitação) | baixo | documentar; tagged/outline já ok |
| Performance da prévia (layout + medição) | baixa | médio | rAF + debounce no input; prévia real só sob demanda |
| Cache/regressão no diálogo já estreito (900×650) | média | médio | testes de margem existentes + escala da prévia |
| Rascunhos antigos sem `kind` | certa | baixo | campo opcional, ausente = `resumo` |

---

## 13. Estimativa de complexidade

Dias-dev, uma pessoa familiarizada com o repo (antes de buffer de revisão):

| Fase | Entrega | Est. |
|---|---|---|
| F1 | `pdf-template.css` + tokens + tipografia/elementos A4 + serifa | 2–3 |
| F2 | `tex.mjs`/`template.mjs` (dedupe/shift/render) + prévia A4 escalada | 2–3 |
| F3 | `checkMath` + lista de erros no diálogo + gate do save + `acknowledge` | 2–3 |
| F4 | `fitWideDisplays` + multipágina (thead/orphans) + avisos | 1,5–2 |
| F5 | Contrato do tutor (`kind`, prompt, ferramentas Pi/Claude, rascunhos, mensagem única) | 2–3 |
| F6 | Testes (11.1–11.4) + fixtures + ajustes do que já existe | 3–4 |
| **MVP F1–F6** | | **12–18** |
| F7 (opcional) | Prévia real paginada (IPC render-only + pdfjs no diálogo) | 2–3 |
| **Com F7** | | **15–21** |

Buffer sugerido: +20% para revisão/regressão do gate. Dependências: nenhuma nova
lib; nenhum engine. A ordem F1→F2→F3 pode ir em paralelo com o contrato F5;
F6 fecha por último.

---

## 14. Perguntas abertas para o usuário

1. Erro de matemática deve **bloquear** o save por padrão (com "Salvar mesmo
   assim") ou apenas avisar? A recomendação é bloquear.
2. A prévia paginada **exata** ("Ver prévia real", F7) entra já no MVP ou fica
   para a rodada seguinte? A recomendação é MVP sem F7, com o botão marcado como
   opcional se a paginação for crítica.
3. Confirmar serifa no texto (Georgia do sistema) — hoje o corpo é sans e só a
   matemática é serifada.
4. O kicker de variante ("Resumo"/"Resolução"/"Lista") pode aparecer no PDF, ou
   prefere título seco?

---

## 15. Evidência desta rodada (o que foi feito e o que não foi)

**Lido (arquivos, com linhas citadas acima):** `desk/material-pdf.cjs`,
`desk/src/materials/{print.html,print.css,print.mjs,print-preload.cjs}`,
`desk/src/markdown.mjs`, `desk/src/free-study.mjs`,
`desk/src/extensions/tutor-pdf/{index.ts,client.mjs}`,
`desk/src/agents/tutor-pdf.cjs`, `desk/main.cjs`,
`desk/free-workspaces.cjs`, `desk/src/study-data/course-materials.cjs`,
`desk/preload.cjs`, `desk/index.html`, `desk/style.css`,
`desk/tests/{free-material-pdf.test.mjs,free-pdf-runner.cjs,tutor-pdf-ui.mjs,course-pdf-ui.mjs,free-study-ui.mjs,free-study-integration-ui.mjs}`,
`core/freeworkspaces.bend` (`maxTitle=120`), `AGENTS.md`,
`docs/PLANO-UI-INTERATIVA-PDF-TIMELINE-2026-10-08.md`,
`docs/reviews/2026-10-07/PDF-PELO-TUTOR.md`.

**Executado (somente sondas isoladas, sem abrir o app):**

- `node` + `katex@0.18.5` de `desk/node_modules` para os casos da §2
  (ambientes, erros, strict, cifrão).
- `node --input-type=module` importando `desk/src/markdown.mjs` para provar que
  `markup` não roda sem DOM (`DOMPurify.sanitize is not a function`).
- `pdfinfo`/`pdffonts`/`pdftotext` no PDF sintético
  `docs/reviews/2026-10-07/tutor-pdf-ui/Teorema de Pitágoras.pdf` (Tagged yes,
  A4, `/StructTreeRoot`, `/Outlines`, Title, fontes SFNS+KaTeX, título 1×).
- `grep`/leitura para as referências de arquivo:linha.

**Não executado:** nenhum teste do app (`npm test`, hunts, runners Electron, UI
Playwright), nenhuma geração de PDF nova, nenhuma chamada de modelo ou provedor,
nenhuma alteração de código/configuração, nenhum commit/push/release, nenhuma
leitura de dados pessoais ou sessões.
