# Pesquisa de API (follow-up) — Mesa como mod: recomposição multi-`Svg`, `$.process` no Desktop e contrato de prévia

- **Data:** 2026-10-05
- **Autor:** sub-agente de pesquisa (OpenCode / DeepSeek V4.1 Flash), a pedido do agente raiz
- **Contexto:** continuação de `docs/reviews/mesa-mod-api-20261005.md` (lido integralmente como contrato original)
- **Objetivo desta rodada:**
  1. verificar se **Box vertical/horizontal com vários `Svg` recortados recompõe a página sem perder fidelidade** — e se existe teto **por árvore total** ou do **host renderer** (a observação do root: "PDF fiel não é possível" era mais forte do que a prova de que **um** SVG excede o teto);
  2. prioridade máxima 2: **`$.process.run` está disponível no Desktop?** com níveis de evidência, fontes oficiais e **fallback seguro** quando incompatível;
  3. procurar **caminho oficial para abrir PDF externo no Desktop via Mods API** (sem aplicar);
  4. testar a alternativa "**fonttype/text**" para reduzir o SVG (sem implementar extração lossy como página fiel);
  5. recomendar o contrato `{ svg: string | null, previewWarning?, snapshotPath, ... }` que **não falha a análise quando só o SVG é grande**.
- **Regras seguidas:** sem conta real, sem login, sem inferência autenticada, sem instalar/atualizar Claude ou Desktop, sem carregar o mod no app, sem materiais de curso (apenas PDF sintético gerado localmente), sem tocar em `desk/`, `core/`, `chat/` nem nos scaffolds de `claude-mod/` (somente leitura). **Único arquivo escrito no repositório: este documento.** Nada foi implementado. Nenhum commit/push.
- **Artefatos de apoio (públicos/temporários):** `/tmp/mesa-mod-api-followup/` (ver Anexo B).

**Legenda de evidência** usada nas tabelas e conclusões:

| Grau | Significado |
|---|---|
| **A — build alvo** | Tipos gerados + teste runtime na build real do Desktop (2.1.286+). **Não obtido nesta rodada** (exigiria sessão local no app; não autorizado). |
| **B — docs/tipos públicos** | Documentação oficial atual (`code.claude.com/docs/en/plugins/mods/*`, referência "as of v2.1.289"), `claude-code.d.ts` público do `main` ("Written by Claude Code 2.1.277", sha256 `8ae1244d…b0b46c`), CHANGELOG público (2.1.290 no topo). |
| **C — medição local** | Poppler/pdftocairo 26.10.0 + Python sobre PDF **sintético**; nenhuma validação de host. |
| **D — renderizador de referência** | Chrome headless (Blink) recompondo as bandas para comparar com a página inteira; valida a matemática do recorte, **não** o renderizador do mod. |
| **E — host real** | Carregar o mod no Desktop e olhar o pane. **Ausente**; tudo que depende disso fica "não verificado". |

---

## 1. Veredito rápido

| Pergunta | Veredito | Grau |
|---|---|---|
| O teto do `Svg` é por elemento ou por árvore? | **Por elemento** (131.072 chars). **Nenhum teto de árvore documentado** para panes. Os tetos de 20.000 nós / 32 de profundidade / 100.000 chars serializados são **só do `Client`** — e a tabela `ClientElements` nem inclui `Svg`. | B |
| Box vertical com vários `Svg` recortados recompõe a página? | **Em princípio sim para páginas de texto simples.** Medido: a página sintética (315.581 chars em um SVG) vira **4 bandas ≤112.857** (ou 3 bandas ≤130.918 com fronteiras ajustadas); a recomposição no renderizador de referência difere da página inteira em **0,14% dos pixels** (só antialiasing nas emendas). **Não é geral** (vetor denso e raster falham) e **não foi validado no host**. | C+D; host E ausente |
| A conclusão anterior ("PDF fiel não é possível") se sustenta? | **Não como universal.** Ela era prova para **um único `Svg`**; a árvore comporta vários. O correto: "um `Svg` não carrega uma página típica; recomposição multi-`Svg` é **candidata limitada**, não promessa". A frase forte deve ser rebaixada. | Correção B+C |
| Box **horizontal** (colunas) também recompõe? | **Não para texto.** Recortes em coluna incluem a linha de texto inteira (runs atravessam a largura): N=4 colunas = 139.854–226.235 chars, todas acima do teto. O eixo viável é **empilhar bandas horizontais na vertical** (Box `flexDirection: 'column'`). | C |
| `$.process.run` no Desktop? | **Provável, não provado.** Docs atuais: mods rodam no Code tab do Desktop e "podem iniciar processos"; o comentário do tipo público diz **"CLI only"** (ambíguo e anterior ao piso de mods no Desktop). Exige sonda na build real; fallback obrigatório até lá. | B, conflito |
| Caminho oficial para abrir PDF externo no Desktop via Mods API? | **Não existe API dedicada.** `Link` proíbe `file:`; `Markdown` aceita `file:` (candidato **não verificado**, o que o Desktop faz no clique não é documentado); `$.process.run(['open', …])` é OS-level e depende de `process`. | B |
| Alternativa "fonttype/text" para reduzir o SVG? | **Não existe no pdftocairo 26.10** (essas flags são do `pdftops`). O SVG do pdftocairo usa `<defs>` de glifos + `<use>` (sem `<text>`); trocar por texto exigiria conversor próprio e fontes do host — risco de substituição de fonte. Minificação economiza só 1,3–1,7%. **Não usar como página fiel.** | C |
| Contrato recomendado | `{ svg: string \| null, previewWarning?, preview?, snapshotPath, ... }` — **o PNG/snapshot é sempre gerado**; SVG acima do teto vira `null` + aviso claro, sem falhar a análise. | Recomendação |

---

## 2. A observação do root: multi-`Svg` recompõe a página?

### 2.1 O que os limites dizem (e onde a conclusão anterior exagerou)

Fontes e trechos exatos:

- `claude-code.d.ts` (main, 2.1.277), `SvgProps` em `:9594-9632`: *"The SVG document, `<svg …>…</svg>`, at most 131072 characters."* — o teto é do **source de um elemento**.
- Docs reference (`reference#elements`, "as of v2.1.289"): linha `| Svg | An SVG document, up to 131,072 characters | | ✓ |` — idem, por elemento; a coluna marca Desktop.
- Teto de árvore no d.ts existe **só** para `Client`: `:1106-1107` — *"A tree of them keeps every tree's bounds (20,000 nodes, 32 deep, 100,000 characters serialized) or the instance unmounts."*; `:1302` — idem para `surface.post`. E `ClientElements = Omit<Elements['terminal'], 'Client' | 'Raster' | 'Image'>` (`:1109`) — **sem `Svg`**; esses limites não se aplicam a uma árvore de pane.
- A tabela de Limits dos docs (reference) lista tempo de hook, `$.process.run`, `$.fs`, `$.store`, `Text`, `Markdown`, `Raster`, throttle de `invalidate` etc. — **não há linha de "teto total da árvore de render"**.
- Não há, em tipos ou docs, limite documentado para **quantidade de elementos `Svg`** numa árvore de pane.

**Contradição 1 (principal):** a conclusão anterior ("não há caminho para uma página PDF fiel") foi derivada de *um* `Svg` estourar o teto. Isso prova "não cabe em um `Svg`", não "não cabe numa árvore". A ausência de teto de árvore documentado **não é prova de que a recomposição funciona** — é apenas ausência de proibição. É exatamente o ponto do root: não elevar a tese a validação.

### 2.2 Método e correção do recorte (o erro de medição anterior)

Os números do relatório anterior (1/4 = 136.380; 1/6 = 99.024; 1/9 = 81.925) foram gerados com `pdftocairo -svg -x/-y/-W/-H` **sem `-nocenter`**. O pdftocairo, por padrão, **centraliza a página na área de recorte** — ou seja, aqueles arquivos eram **janelas centradas**, não bandas ancoradas no topo. Prova (sweep, PDF sintético, `-r 72`, 1 px = 1 pt):

| Comando | Conteúdo resultante (eixo y, em pt) |
|---|---|
| `-y 0 -H 100` (sem `-nocenter`) | 374,7–446,7 (meio da página) |
| `-y 100 -H 100` (sem `-nocenter`) | 346,7–454,7 (meio da página) |
| `-y 692 -H 100` (sem `-nocenter`) | 354,7–414,7 (meio da página) |
| `-y 0 -H 100 -nocenter` | **28,7–100,7 (topo, correto)** |
| `-y 692 -H 100 -nocenter` | **8,7–68,7 (conteúdo de 692–792 pt traduzido para a origem)** |

Com `-nocenter`, o recorte ancora em `-y`, o conteúdo é **traduzido por `-y0`** e o documento mantém `width/height/viewBox` da página inteira. Para virar uma banda utilizável, o host precisa reescrever o cabeçalho do SVG:

```
de:   width="612pt" height="792pt" viewBox="0 0 612 792"
para: width="612pt" height="198pt" viewBox="0 0 612 198"   (exemplo: banda de 198 pt)
```

Isso é uma substituição de string determinística (o conteúdo já está em coordenadas locais da banda). `-origpagesizes` **não** muda esse comportamento (testado: mesmo cabeçalho e mesmo tamanho).

**Contradição 2 (metodológica):** os números antigos subestimavam a viabilidade: para essa página, a correção muda "1/4 não cabe (136.380)" para "**1/4 cabe (máx. 112.857)**".

### 2.3 Resultados medidos (PDF sintético: 55 linhas de texto, 1 página, 612×792 pt)

Bandas horizontais, topo ancorado (`-nocenter -x 0 -y k·H -W 612 -H H`), tamanho em **chars** (= bytes; o SVG é 100% ASCII, então `length` JS = bytes):

| Divisão | Altura da banda | Tamanhos por banda | Máx. | Cabe (≤131.072)? |
|---|---|---|---|---|
| N=2 | 396 pt | 177.762 / 173.827 | 177.762 | **não** |
| N=3 | 264 pt | 127.904 / 136.803 / 123.538 | 136.803 | **não** (por 4,4%) |
| **N=3 ajustado** | 271 / 241 / 280 pt | 127.596 / 130.918 / 128.127 | **130.918** | **sim** (por 154 chars!) |
| **N=4** | 198 pt | 99.089 / 112.857 / 108.093 / 100.707 | **112.857** | **sim** |
| N=6 | 132 pt | 71.759 / 86.225 / 82.072 / 85.286 / 82.442 / 70.588 | 86.225 | sim |
| N=9 | 88 pt | 49.678–71.991 | 71.991 | sim |
| Página inteira | — | 315.581 | — | **não** (2,4×) |

- **Mínimo prático para essa página:** 4 bandas iguais (folga confortável) ou 3 com fronteiras ajustadas (folga de 0,1% — frágil).
- **Direção importa:** colunas (recortes verticais, `-W` estreito e `-H 792`) **não** funcionam para texto — cada coluna inclui a linha inteira: N=2 = 237.684/218.570; N=3 máx. 241.387; N=4 máx. 226.235. Ou seja, **empilhar bandas horizontais na vertical**; não fatiar em colunas.
- A soma das bandas é maior que a página (defs de glifos e linhas de fronteira duplicadas) — irrelevante, pois o teto é por elemento.
- **Minificação** (remover `\n` + indentação): página inteira 315.581 → 310.244 (−1,69%); banda 86.225 → 85.076 (−1,33%). Não muda o veredito de "um `Svg` não cabe".

### 2.4 Fidelidade da recomposição (renderizador de referência)

Para checar a matemática do recorte (não o host):

1. bandas N=4 geradas com `-nocenter`, cabeçalho reescrito para `viewBox="0 0 612 198"`;
2. cada banda renderizada no **Chrome headless** a 816×264 px (2 px/pt), empilhadas na vertical;
3. comparação pixel a pixel com o render da página inteira (`p1.svg`, 816×1056).

| Comparação | Pixels diferentes | Máx. dif. de canal | >32 |
|---|---|---|---|
| N=4 empilhado × página inteira | **1.210 / 861.696 (0,14%)** | 35/255 | 1 pixel |
| N=6 empilhado × página inteira | 2.824 (0,33%) | 35/255 | 1 pixel |
| Chrome × Poppler (mesma página, renderizadores diferentes) | — (média 1,77; 7.089 pixels >32) | 70 | — |

As diferenças se concentram nas **linhas de emenda** (antialiasing na borda do viewport de cada banda). A divergência entre dois renderizadores de referência é **maior** que o efeito da recomposição — o que dá contexto, mas **não** valida o host.

### 2.5 Contraexemplos que derrubam qualquer promessa universal

Mesmo com bandas corretas, **nem toda página se deixa particionar**:

| Página sintética | SVG inteiro | N=4 (máx.) | N=8 (máx.) | Resultado |
|---|---|---|---|---|
| Texto (55 linhas) | 315.581 | 112.857 | 77.180 | **cabe** |
| Vetor denso (1 linha de 20.000 pontos + 4.000 marcadores, matplotlib) | 3.567.270 | 1.168.743 | 703.886 | **não cabe em nenhum N razoável** — paths que atravessam a página são duplicados em cada banda |
| Raster (página "escaneada", PNG 1275×1650 vira PDF) | 525.272 | 525.414–525.417 | 525.412–525.415 | **não cabe nem uma banda** — a imagem inteira é repetida com clip em cada banda |

- **Scans:** uma página rasterizada em 150 dpi já é ~4× o teto por si só; mesmo JPEG de baixa qualidade medido antes (q60 ≈ 402 mil chars) continua acima. Só resolução muito baixa caberia — e aí não é "fiel".
- **Figuras densas:** o teto é por elemento, mas o conteúdo é irredutível: o path gigante entra em toda banda que ele cruza.
- Conclusão: a recomposição é uma **candidata para páginas cujo conteúdo é localizado** (texto, figuras pequenas), não um caminho geral.

### 2.6 O que ainda falta provar no host (sonda necessária — grau E)

Nada do que foi medido toca o renderizador do Desktop. Antes de qualquer promessa, uma sonda mínima no pane real deve responder:

1. **Suporte a features do SVG do pdftocairo:** `<defs>`, `<use xlink:href>`, `<clipPath>` — o texto do tipo diz que o `Svg` é desenhado "as an image" (ou frame sandbox sem scripts); não há declaração pública de qual subconjunto de SVG o renderizador cobre. Se `<use>` não funcionar, **nem uma banda** renderiza o texto.
2. **Empilhamento com emenda exata:** Box `flexDirection: 'column'`, `gap: 0`, `Svg` com `width`/`height` em CSS px (números; fracionários?). O host pode arredondar alturas (perda de 1 px por emenda) ou inserir espaçamento de célula. `position: 'absolute'` usa `top/left` em **células de caractere** (`BoxProps`, d.ts `:649-760`) — pior para alinhamento fino; evitar.
3. **Custo por frame:** várias bandas `Svg` no mesmo pane; `invalidate` é limitado a 10/s (30/s no pane visível). Sem número público.
4. **Teto oculto de árvore/nós:** não documentado; ausência não é prova. Sondar uma árvore com muitos filhos se for usar composição.
5. **Escala/qualidade do raster interno:** o renderizador pode rasterizar o SVG em resolução menor que o viewport — afeta nitidez, não o encaixe.

Sugestão de sonda (quando o usuário autorizar uma sessão local): um SVG de teste com `<defs>`/`<use>`/`<clipPath>` e duas bandas de meia página; comparar visualmente com o PNG. **Não implementar antes disso.**

### 2.7 Veredito qualificado e impacto na conclusão anterior

- **O que cai:** "render fiel de PDF é impossível no Desktop" como afirmação universal. O limite é **por `Svg`**; a árvore não tem teto documentado; para páginas simples a recomposição foi medida e ficou visualmente quase exata em renderizador de referência.
- **O que fica:** (a) **um** `Svg` não carrega uma página típica; (b) a recomposição **não é geral** (denso/raster falham); (c) a recomposição **não foi validada no host** — features, emendas e custo são desconhecidos; (d) mesmo quando funciona, exige N recortes por página, re-render a cada navegação e um caminho de pós-processamento do cabeçalho SVG.
- **Recomendação de postura:** tratar "prévia fiel por multi-`Svg`" como **experimento de sonda**, não como feature do protótipo; manter a página fiel onde já funciona (Mesa Electron/Xournal++) e o PNG como artefato de análise.

---

## 3. `$.process.run` no Desktop (prioridade 2)

### 3.1 Evidência a favor (grau B)

- Docs overview: *"Mods work in the Claude Code CLI and in the Code tab of the Claude Desktop app."* (`overview` linha 25) e a tabela **Where mods run**: Code tab do Desktop (exceto sessão WSL) → **Hooks run: Yes**; desenho: sim, exceto elementos terminal-only (`overview:191-197`).
- Docs overview (`:79`): *"Mods aren't sandboxed. If you turn on sandboxing, the sandbox isolates the Bash commands Claude runs, and **a process that a mod starts runs outside it**."*
- Docs overview (`:185`): *"To do anything outside its own code, such as draw, add a command, call a model, read a file, **start a process**, or make a network request, a hook calls the mods API."*
- Docs api, seção **"Reach files, processes, and the network"**: *"A mod reaches the file system, processes, and the network through the mods API, with the same permissions as the user running Claude Code."* Tabela: `$.process` → `run(['git','status'])`… e bullet: *"`$.process.run`: takes an argument list and uses no shell… rejects if the program can't start or is still running at the timeout, which is 30 seconds by default, so wrap it in `try` and `catch`."*
- Docs reference (limites): linha `| $.process.run timeout | 30 seconds by default, 10 minutes at most |` — **sem ressalva de superfície**.
- CHANGELOG público: `2.1.287` *"Added Claude Mods…"*; `2.1.290` *"Changed what a mod's `$.process.spawn` rejects with when another mod denies it after the child ran…"* — o CHANGELOG trata as APIs de processo como gerais, sem nota de Desktop.

### 3.2 Evidência conflitante (o que impede "sim" hoje)

- Tipos públicos do `main` (mesmo arquivo do relatório anterior; sha256 `8ae1244d…b0b46c`, "Written by Claude Code **2.1.277**"), comentário do namespace `process` (`:2955-2961`): *"Commands on the host, run as the user the session runs as. **CLI only.** Local execution, not a network path: what a command of its own reaches is its own, as for the Bash tool and a settings `command` hook."*
  - **Interpretação 1 (provável):** "CLI only" = **execução local no host do CLI** (por oposição a cloud/remoto); a frase seguinte ("Local execution, not a network path") sustenta isso. O Desktop embute o Claude Code; o Code tab roda uma sessão **local**.
  - **Interpretação 2 (não descartável):** "CLI only" = literalmente **só a superfície terminal**, indisponível no Desktop.
- Os tipos são de **2.1.277**, anteriores ao piso de mods no Desktop (**2.1.286**); podem estar desatualizados nesse ponto. Nenhuma linha dos docs atuais repete "CLI only" — e nenhuma linha afirma explicitamente "`$.process` funciona no Desktop". As duas fontes **não se contradizem frontalmente, mas não se cobrem**.
- **Denial path:** cada chamada `$.process.run` é um **evento** (`process.run`) que outro mod/política pode observar, reescrever ou recusar (docs test mostram um mod de política recusando `process.run`; CHANGELOG 2.1.290 descreve o comportamento de recusa do `spawn`). Portanto "indisponível" tem três formas: namespace ausente, chamada recusada, ou falha/timeout.
- Deriva de versão: `$.process.spawn` existe nos docs (2.1.289/2.1.290) e **não existe** nos tipos 2.1.277 — usar **apenas `run`** no protótipo e não contar com `spawn`.

### 3.3 Fallback seguro (desenho recomendado — UI/calculadora nunca quebram)

Regra: **`$.process` é capacidade opcional detectada em runtime**, não pré-requisito de render.

```ts
// nunca no topo do módulo (o $ só existe dentro de hooks)
function processCapability($: EngineInterface): 'available' | 'missing' {
  try {
    return typeof $.process?.run === 'function' ? 'available' : 'missing';
  } catch {
    return 'missing';
  }
}

async function runTool($, argv, init) {
  if (processCapability($) === 'missing') {
    return { ok: false, code: 'PROCESS_UNAVAILABLE', message: 'Conversão local indisponível nesta superfície.' };
  }
  try {
    const r = await $.process.run(argv, init);      // recusa de outro mod/política cai aqui
    return { ok: true, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
  } catch (error) {
    return { ok: false, code: 'PROCESS_REFUSED_OR_FAILED', message: String(error?.message ?? error) };
  }
}
```

Comportamento por operação quando `process` não está disponível (ou é recusado):

| Operação | Sem `$.process` |
|---|---|
| `/mesa`, pane, abas | **Funcionam** (render não pode depender de processo). |
| Calculadora, notas, navegação lógica, estado | **Funcionam** (JS puro + `$.store`/`$.fs`). |
| Prévia de página nova / captura nova | **Indisponível com aviso claro** no pane (uma linha `Text`/`Markdown`); botões desabilitados explicando o motivo. |
| Análise de página/captura já existente | **Funciona** se houver `snapshotPath`/PNG em cache (o `Read` da imagem não passa por `process`). |
| Pedido de análise ao modelo | Funciona (é `$.prompt.submit` textual apontando o PNG). |

Regras adicionais: nunca lançar de dentro de um `ui.render` por causa de capacidade; distinguir no aviso "ferramenta ausente" × "chamada recusada por política" × "timeout"; registrar a capacidade 1× por sessão em `session.start` (com `try/catch`) para a UI saber o que mostrar; nos testes, stubar `process.run` com sucesso/recusa/ausência (o kit de testes documenta o stub de `process.run` e `$.ui.mount({ surface: 'desktop' })` para validar a árvore sem o app).

### 3.4 Sonda runtime (grau A) — quando autorizada

Na build alvo (Desktop, sessão local, **após autorização explícita**): em `session.start`, `try { await $.process.run(['/usr/bin/true']) } catch {}` e `$.ui.log` do resultado; conferir também o `.claude-plugin/types/claude-code/index.d.ts` **gerado pela própria build** (é a fonte que os docs mandam confiar quando divergem do GitHub). **Não executar agora** — o usuário não autorizou sessão no app nesta rodada.

---

## 4. Abrir PDF externo no Desktop via Mods API

### 4.1 O que não existe

Varredura dos namespaces do `$` no d.ts (`CoreEngineInterface`): `plugin`, `ui`, `model`, `mcp`, `session`, `turn`, `prompt`, `command`, `agent`, `fs`, `store`, `clock`, `http`, `process`, `settings`, `env`. **Nenhum** método de "abrir arquivo", "revelar no Finder", "abrir no app padrão" ou "abrir externo".

### 4.2 Candidatos (todos não verificados; **não aplicar**)

| Caminho | O que os tipos/docs dizem | Limite |
|---|---|---|
| `Link` com `file:` | **Proibido**: `LinkProps.href` aceita só `https:` (ou `http://localhost`), ≤2048 chars; "anything else refuses the tree the Link is in" (d.ts `:4744-4748`). | Não abre arquivo local. |
| `Markdown` com link `file:` | `MarkdownProps` (`:4807`): *"a link whose scheme is not `https:`, `http:` or `file:` draws as text, never clickable"* → sugere que `file:` é desenhado clicável; `PressedLink` carrega só `href`. **O que o Desktop faz no clique não é documentado** (abre no app padrão? navegador? nada?). | Candidato; comportamento desconhecido; clique é ação do usuário. |
| `$.process.run(['open', '-a', 'Preview', pdf])` (macOS) | Execução OS-level; nada no contrato de mods promete isso; depende de `process` (§3) e roda como o usuário. | Não é API; só depois de sonda; ação explícita. |
| `$.prompt.submit({ text: 'Leia <path>' })` | O modelo chama `Read`; a imagem/PDF entra como resultado de ferramenta. | Não é "abrir no Desktop"; é análise. |
| Usuário abre manualmente / Mesa Electron / Xournal++ | Fora do mod. | É o caminho honesto hoje. |

**Veredito:** não há caminho **oficial** de "abrir PDF externo" via Mods API. O máximo documentável é o candidato `Markdown` + `file:` (não verificado) e o fallback OS-level via `process` (não verificado). Não usar nenhum dos dois como promessa.

---

## 5. Alternativa de fonte no SVG (`fonttype`/`text`)

### 5.1 Flags

`pdftocairo` 26.10.0 **não tem** `-origfont`, `-noembedfont` nem `-fonttype` — passá-las imprime o usage e sai com erro. Essas flags existem no **`pdftops`** (`-noembt1`, `-noembtt`, `-noembcidps`, `-noembcidtt`, `-passfonts`), cuja saída é PostScript, não SVG. Não há como pedir ao pdftocairo "texto com fonte" no lugar de glifos vetoriais.

### 5.2 Estrutura real do SVG do pdftocairo

PDF sintético → `pdftocairo -svg`:

- `<defs>` com **40 glifos** (`<g id="glyph-0-N"><path d="…"/></g>`) — as fontes viram **contornos vetoriais**;
- corpo com **4.960 `<use xlink:href="#glyph-0-N" x=… y=…/>`** — o tamanho é dominado pelas instâncias, não pelos defs;
- **zero `<text>`**, zero `@font-face`.

Ou seja, a alternativa "trocar defs por texto" não é um flag; seria um **conversor próprio** que reemite `<text font-family=…>` — e aí a fidelidade passa a depender das **fontes instaladas no host** e das métricas. `pdftohtml -s` (texto) referencia famílias de subconjunto (`font-family:AAAAAB+Monaco`) **sem** `@font-face` nem arquivos de fonte no diretório — renderizar dependeria de substituição de fonte. **Não implementar extração lossy como página fiel.**

### 5.3 Minificação

Remover quebras de linha/indentação é seguro e barato, mas rende pouco: página inteira 315.581 → 310.244 (−1,69%); banda 86.225 → 85.076 (−1,33%). Encurtar ids de glifos é teórico (alguns %) e mexe no XML; não tira um `Svg` de 315 mil chars do teto. **Não muda o veredito.**

---

## 6. Contrato recomendado para a operação `page`

### 6.1 Problema no contrato atual (observação — **não** alterei o código)

No host atual (`claude-mod/mesa-study/host/page.mjs`, somente leitura), `readBoundedSvg` **lança `SVG_TOO_LARGE`** e isso acontece **antes** da conversão para PNG — ou seja, hoje uma página com SVG grande **perde também o PNG/análise**. É o oposto do mínimo útil pedido pelo root.

### 6.2 Forma recomendada (variação compatível)

```jsonc
{
  "ok": true,
  "kind": "page",
  "document": { "path": "/…/materia.pdf", "name": "materia.pdf" },
  "page": 3,
  "numPages": 55,

  // Prévia vetorial: só quando cabe. NUNCA truncar.
  "svg": null,                      // ou "<svg…>…</svg>" quando length ≤ 131072
  "previewWarning": "Prévia vetorial indisponível: o SVG desta página tem 315.581 caracteres (limite 131.072). A imagem PNG foi gerada e a análise continua disponível.",
  "preview": { "chars": 315581, "limit": 131072, "reason": "SVG_TOO_LARGE" },
  // quando cabe: "preview": { "chars": 86225, "limit": 131072 }

  // Análise: sempre presente, independente do SVG.
  "snapshotPath": "/…/mesa-study-XXXX/snapshot.png",
  "mimeType": "image/png"
}
```

### 6.3 Regras

1. **Gerar o PNG primeiro (ou sempre)**, com validação; o snapshot é o artefato de análise (`Read`) e não pode depender do tamanho do SVG.
2. `svg` grande → `null` + `previewWarning` + `preview.reason`; **nunca truncar**, nunca substituir por recorte lossy apresentado como página.
3. `SVG_TOO_LARGE` deixa de ser erro fatal da operação `page`; permanece um **código de aviso** para UI/testes/telemetria. Erros fatais seguem sendo `CONVERT_FAILED`/`PNG_INVALID` (e os de validação de caminho/página).
4. A UI: quando `svg === null`, mostrar a mensagem no lugar da prévia (área reservada, sem parecer quebrada) e **manter** navegação de página, botão de análise e demais funções; o PNG da página continua sendo o que o modelo lê.
5. Testes a acrescentar (quando o agente do host retomar): SVG acima do teto → `ok: true`, `svg: null`, `previewWarning` presente **e** `snapshotPath` existente/validado; SVG dentro do teto → `svg` presente.
6. **Extensão futura (não agora):** se a sonda do host validar a recomposição, o campo pode evoluir para `svgParts?: string[]` (cada parte ≤131.072) sem quebrar o consumidor atual (`svg` continua sendo a prévia de um elemento). Não prometer isso antes da sonda.

---

## 7. O que não prometer / perguntas abertas

**Não prometer (sem grau A):**

1. Que o mod **substitui a Mesa** Electron/Xournal++ — nada aqui valida o host; a Mesa segue como superfície fiel.
2. Página PDF fiel no pane por multi-`Svg` — candidato limitado (texto simples), não geral, não validado no host.
3. Que `$.process.run` funciona no Desktop — provável, não provado; a UI precisa degradar.
4. Abrir PDF externo pelo mod — não há API; só candidatos não verificados.
5. Que o `Svg` do pdftocairo (defs+use) renderiza no host — feature support não documentado.

**Perguntas abertas (ordem de resposta):**

1. A build real do Desktop (≥2.1.286) tem `$.process.run`? (tipos gerados + sonda; grau A).
2. O renderizador de `Svg` do Desktop cobre `<use>/<defs>/<clipPath>`? Empilha bandas sem emenda? (sonda visual; grau A).
3. Existe teto oculto de árvore/nós no pane? (sonda com muitos elementos; grau A).
4. O Desktop abre links `file:` de `Markdown`? Em quê? (sonda; grau A).
5. Vale a pena a recomposição se a sonda 2 falhar parcialmente (ex.: sem `<use>`)? Provavelmente não — aí a prévia fica no recorte de 1 banda ou só PNG.

---

## Anexo A — Assinaturas-chave

```ts
// Svg — claude-code.d.ts :9594-9632 (main, 2.1.277)
export type SvgProps = {
  source: string;          // "at most 131072 characters" — POR ELEMENTO
  alt: string;             // obrigatório
  width?: number;          // CSS px; ausente = largura do markup até o slot
  height?: number;         // CSS px; ausente = altura do markup na largura desenhada
  isInteractive?: boolean; // frame sandbox sem scripts; ausente = imagem
};

// Box — :649-760 (resumo do que importa para empilhar bandas)
export type BoxProps = {
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  gap?: number; columnGap?: number; rowGap?: number;
  width?: number | string; height?: number | string;
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  overflow?: 'visible' | 'hidden';
  position?: 'relative' | 'absolute';
  top?: number; left?: number; // EM CÉLULAS DE CARACTERE (evitar para alinhar SVG)
  // …
};

// process — :2955-2990 ("CLI only" no comentário; sem superfície nos docs)
process: {
  run: (argv: readonly string[], init?: ProcessRunInit) =>
    Promise<{ exitCode: number; stdout: string; stderr: string }>;
  // ProcessRunInit: { cwd?, env?, stdin?, timeoutMs? } — 30 s default, 10 min máx.
  // spawn existe nos docs 2.1.289/2.1.290; NÃO existe nos tipos 2.1.277.
};

// Client tree limits (NÃO se aplicam a panes; e ClientElements não tem Svg)
// :1106-1107 e :1302 — 20.000 nós / 32 de profundidade / 100.000 chars serializados

// Link — :4744-4748
href: string; // https: (ou http://localhost), ≤2048 chars ASCII imprimível; senão recusa a árvore

// Markdown — :4807
// "a link whose scheme is not https:, http: or file: draws as text, never clickable"
// PressedLink (:6436) = { href: string }

// Elementos por superfície — :3105-3168 / docs reference
// terminal: … Client Raster Image
// desktop:  Box Text Button Input Select Svg Link Code Markdown Client
// mobile:   Box Text Button Svg Link Code Markdown
// vscode:   Box Text Button Input Select Svg Link Code Markdown
```

## Anexo B — Fontes, links e artefatos locais

| Fonte | Onde | Uso |
|---|---|---|
| Tipos públicos do `main` | https://raw.githubusercontent.com/anthropics/claude-code/main/mods/types/claude-code.d.ts — sha256 `8ae1244d19d4b393261605fe72d517b66be0d7e1c214c378cdec5107e8b0b46c`, 13.186 linhas, "Written by Claude Code 2.1.277" | tetos, `SvgProps`, `BoxProps`, `process`, `Link`, `Markdown`, Client |
| Docs mods (markdown) | https://code.claude.com/docs/en/plugins/mods/overview.md · `reference.md` · `api.md` · `interface.md` · `test.md` · `troubleshoot.md` · `create.md` (referência "as of v2.1.289") | onde mods rodam, elementos, limites, processo, testes, link |
| CHANGELOG | https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md (topo 2.1.290) | `$.process.spawn` (2.1.290), mods (2.1.287), deriva de versão |
| Repo de mods oficiais | `anthropics/claude-code` `mods/` (clone `e8ae4518`) e `mods/README.md` | kit de teste, mods embutidos |
| Playground | `anthropics/claude-code-playground` (`569c5283`), mods `token-weather`, `blast-radius`, `replay-theater` | exemplos oficiais (uso de `$.process.run` em contexto CLI) |
| PDF sintético e conversões | `/tmp/mesa-mod-api-research-20261005/pdf-probe/` (page.pdf 21.207 B; p1.svg 315.581 chars) | medições |
| Artefatos desta rodada | `/tmp/mesa-mod-api-followup/` — `docs-mods-*.md` (docs em markdown), `current-claude-code.d.ts`, `CHANGELOG.md`, `bands/` (bandas N=2..12, colunas, 3-bandas ajustadas), `bands4/fixed/`, `renders/` (full, stitched, bandas), `synth/` (dense-vector.pdf, raster.pdf), `htmlout2/` (pdftohtml) | reprodução |

## Anexo C — Reprodução (comandos)

```sh
# 1) Página inteira e bandas topo-ancoradas (o -nocenter é essencial)
pdftocairo -svg -f 1 -l 1 page.pdf full.svg
pdftocairo -svg -f 1 -l 1 -nocenter -x 0 -y 198 -W 612 -H 198 page.pdf band1.svg
# 2) Cabeçalho da banda → viewBox local (substituição determinística)
#    width="612pt" height="792pt" viewBox="0 0 612 792"
# →  width="612pt" height="198pt" viewBox="0 0 612 198"
# 3) Confirmação do erro de centralização (sem -nocenter):
pdftocairo -svg -f 1 -l 1 -y 0 -H 100 -W 612 page.pdf centered.svg   # conteúdo no MEIO da página
# 4) Contraexemplos (geração: matplotlib para o vetor denso; Pillow PNG→PDF para o raster;
#    ver synth/ no Anexo B)
pdftocairo -svg -f 1 -l 1 synth/dense-vector.pdf dense-full.svg      # 3.567.270 chars
pdftocairo -svg -f 1 -l 1 synth/raster.pdf raster-full.svg           # 525.272 chars; toda banda ≈525k
# 5) Flags de fonte inexistentes no pdftocairo 26.10:
pdftocairo -origfont -svg page.pdf x.svg    # → usage (erro)
```

---

*Nada foi alterado em `desk/`, `core/`, `chat/` ou `claude-mod/`; nenhum login, instalação, atualização ou sessão no app foi executado. O único arquivo do repositório tocado é este documento.*
