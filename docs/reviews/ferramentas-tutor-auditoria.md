# Ferramentas do tutor — auditoria e medição (Pi, Claude Code, OpenCode)

Data: 2026-10-30. Escopo: as ferramentas que a Mesa dá ao tutor nos três motores,
o texto fixo que elas custam por turno, o tamanho típico do que devolvem, os
erros que produzem e as lacunas de capacidade. **Nenhum código do app foi
alterado**; o único arquivo desta entrega é este relatório.

## Como foi medido

- `cd desk && node scripts/measure-prompts.mjs` e `--json` (Pi 1.4.0 instalado;
  Claude e OpenCode montados pelo mesmo código do app, sem inferência, login ou
  rede). O estimador local corta palavras em pedaços de até 4 bytes e erra ~15%
  no valor absoluto; os números servem para comparar com a mesma régua.
- O script **não mede** `ver_figura`, `geogebra`, `propor_revisao` no Claude,
  `mesa_geogebra` no Pi nem o motor OpenCode. Esses valores foram medidos à
  parte com o mesmo `estimateTokens` e o mesmo `tool-fields.mjs`, e entram nos
  totais abaixo; os demais valores vêm do `measure-prompts`.
- PDF: um PDF sintético de 40 páginas (~1.480 caracteres por página, gerado no
  `/tmp` com o mesmo formato dos helpers de teste), lido pelo `pdf.js` real. Não
  usei PDF de curso nem material do usuário. O tempo de leitura (1,9 s no total)
  não importa para esta auditoria; os tokens, sim.
- Imagens: quando o custo é estimado pela fórmula de visão (px/750), digo isso
  explicitamente. Base64 não vira token de contexto; o PNG vira.

## Resumo

- São **7 ferramentas da Mesa**: `ler_pdf`, `criar_pdf`, `criar_atividade`,
  `previsualizar_atividade`, `ver_figura`, `geogebra` e `propor_revisao`. O
  OpenCode tem **6**: não tem `criar_pdf` (#57).
- O texto fixo da Mesa por turno é **8.206 tokens** no Claude (matéria),
  **7.906** no Pi (adendo + ferramentas) e **6.139** no OpenCode (prompt +
  ferramentas). As ferramentas são **79% a 88%** desse total.
- `criar_pdf` + `criar_atividade` sozinhos são **4.001 tokens no Pi** e **3.943
  no Claude** (57–58% das ferramentas). `ver_figura` acrescenta 1.137 no Pi e
  1.129 no Claude.
- O maior ganho de tokens no Claude é potencial, não garantido: as ferramentas
  usam `alwaysLoad: true` e o adapter não liga o `ToolSearch` do SDK. Se o
  Claude Code aceito suportar a busca de ferramentas, dá para tirar até ~6,9 mil
  tokens do prefixo de todo turno; se não suportar, nada muda.
- O maior ganho de chamadas é uma ferramenta de **busca no material**: hoje
  "achar um exercício" custa 14 chamadas de `ler_pdf` e ~20 mil tokens numa aula
  de 40 páginas; a Mesa já tem o índice em `study-data/search.cjs`, mas ele não
  está exposto ao tutor.
- O segundo maior é a **paginação do `ler_pdf`**: pedir 10 páginas devolve 3 sem
  avisar. O modelo pode achar que leu 10.

## Inventário

Tokens = descrição + esquema que o modelo recebe em **todo turno** (não é o
custo da chamada). Saída = o que volta ao modelo numa chamada típica.

| Ferramenta | Pi | Claude | OpenCode | Saída típica |
|---|---:|---:|---:|---|
| `ler_pdf` / `mcp__mesa__ler_pdf` | 306 (`mesa_ler_pdf`) | 335 (`mcp__mesa__ler_pdf`) | 301 | 3 páginas de texto: ~4,5 mil car./~1,5 mil tokens. Aula de 40 páginas: ~60 mil car./~20,4 mil tokens em **14 chamadas**. Página visual devolve também um PNG. |
| `criar_pdf` / `mesa_criar_pdf` | 1.883 | 1.816 | — (fora do MCP, #57) | 178 car./58 tokens (frase do guia). |
| `criar_atividade` / `mesa_criar_atividade` | 2.118 | 2.127 | 2.088 | 195 car./71 tokens + o quadro na conversa. |
| `previsualizar_atividade` | 678 | 668 | 627 | PNG (largura padrão 360 px; altura 48–1.200 px) + texto do console (até 50 linhas; 50 mensagens ≈ 3,5 mil car./~980 tokens). |
| `ver_figura` / `mesa_ver_figura` | 1.137 | 1.129 | 1.081 | PNG (largura padrão 560 px) + 100–300 car. de avisos. |
| `geogebra` / `mesa_geogebra` | 540 | 542 | 501 | `run`/`state` com 0–80 objetos: 0,3–3,1 mil car. (151–1.726 tokens). `screenshot` devolve PNG do applet. |
| `propor_revisao` / `mesa_propor_revisao` | 288 | 318 | 284 | 10–200 car. conforme aprovado/editado/descartado/pendente. |
| **Total das ferramentas** | **6.950** | **6.935** | **4.882** | |
| Nativas (fora da Mesa) | `read` 223 + `bash` 174 + `edit` 367 + `write` 142 = **906**; o perfil real (`profiles.cjs`) soma `ask_user`, `obsidian-note`, `quiz` e `subagent_*`, não medidos | `Read`/`Glob`/`Grep`/`Bash`/`Edit`/`MultiEdit`/`Write`/`AskUserQuestion`; esquemas não medidos | próprias do OpenCode; esquemas não medidos | variável |

### Custo fixo por motor

| Motor / sessão | Sistema da Mesa | Ferramentas da Mesa | Total controlado pela Mesa | Fica de fora |
|---|---:|---:|---:|---|
| Claude, matéria | 1.271 | 6.935 | **8.206** | esquemas das ferramentas nativas do Claude Code |
| Claude, aba Livre | 820 | 6.935 | **7.755** | idem |
| Claude, chat lateral | 1.030 | 335 (só `ler_pdf`) | **1.365** | idem |
| Pi, matéria | 956 (adendo) | 6.950 | **7.906** | prompt do próprio Pi (886), `read/bash/edit/write` (906) e o perfil real (`ask_user`, `quiz`, `subagent_*`, `obsidian-note`) |
| Pi, chat lateral | 729 (adendo) | 306 (só `mesa_ler_pdf`) | **1.035** | idem |
| OpenCode, matéria | 1.257 | 4.882 | **6.139** | prompt e ferramentas próprias do OpenCode |
| OpenCode, chat lateral | 1.257 | 301 (só `ler_pdf`) | **1.558** | idem; o prompt é o da sessão principal (ver A4) |

O `measure-prompts` publicado hoje mostra 6.217 no Claude e 7.366 na parte da
Mesa do Pi (9.158 no prefixo total) porque não inclui `ver_figura`, `geogebra` e
`propor_revisao` no Claude, nem
`mesa_geogebra` no Pi. Os totais acima já corrigem isso (ver M5).

### O que mais pesa

- **Ferramentas, não sistema.** No Claude, 6.935 de 8.206 tokens (84,5%) são
  esquemas; no OpenCode, 4.882 de 6.139 (79,5%); no Pi, 6.950 de 7.906 (87,9%).
- **Duas descrições dominam.** `criar_atividade` (2.118) + `criar_pdf` (1.883)
  = 4.001 no Pi (3.943 no Claude: 2.127 + 1.816). No OpenCode, como não há `criar_pdf`, as duas
  maiores são `criar_atividade` (2.088) e `ver_figura` (1.081) = 3.169.
- **`FIGURE_RULES` aparece três vezes**: na base do sistema (216 tokens), na
  descrição de `ver_figura` (dentro de `FIGURE_CHOICE`) e dentro de
  `PDF_FIGURE_GUIDE`, que entra em `criar_pdf`. São 648 tokens, 432 deles
  repetidos. O teste `desk-prompts.test.mjs:118-150` autoriza a repetição de
  propósito; o custo é real.
- **`mainSessionPrompt`** (citação + "o que oferecer") custa 241 tokens no
  Claude. No OpenCode ele entra **também no chat lateral**, onde as ferramentas
  oferecidas não existem (A4).

## Achados priorizados

### Alto

#### A1. `ler_pdf` corta o pedido em 3 páginas sem dizer o que devolveu
**Onde:** `desk/pdf-page-text.cjs:15` (`MAX_PAGES = 3`), `:43-49` (`pageRange`
faz `Math.min(end, total, start + MAX_PAGES - 1)` sem devolver o pedido
original), `desk/src/extensions/mesa-mcp/pdf-tool.mjs:14-20` (descrição e campo
`ate`), `:28-43` (`pdfPagesText` só imprime as páginas devolvidas).
**Problema:** o modelo pede `pagina: 1, ate: 10`; recebe as páginas 1–3 e um
cabeçalho `Arquivo.pdf (40 páginas)`. Nada diz "devolvi 1–3 do pedido 1–10". O
modelo pode concluir que leu 10 páginas e resumir o que não viu. O mesmo vale
para `ate: 40` (devolve 1–3) e para `ate` maior que o total (corta em silêncio).
**Cenário concreto:** "resuma a aula de 40 páginas". O modelo chama
`ler_pdf {pagina: 1, ate: 40}`. Recebe 3 páginas. Sem aviso, escreve um resumo
de "toda a aula" baseado em 7,5% dela. Se for cuidadoso e pedir 1–3, 4–6…, são
**14 chamadas** e ~20,4 mil tokens de texto (medido no PDF sintético de ~1,5 mil
car./página; uma página real de 2–3 mil car. escala para 27–40 mil).
**Correção:** (1) devolver no resultado `pedido: [1, 40]`, `devolvido: [1, 3]` e
uma linha `(pedido até p. 40; devolvidas 1–3; o teto é 3 por chamada)`; (2)
acrescentar `proxima: 4` quando houver mais páginas; (3) aceitar uma faixa maior
(por exemplo 10 páginas) ou um campo `paginas: "1-12"` para cortar o número de
idas e voltas sem cortar o conteúdo. A descrição também deve dizer "peça sempre
o máximo e continue por `proxima`".
**Ganho:** evita o erro de cobertura (o mais caro: resposta errada sem o aluno
saber). Reduz de 14 para 4 chamadas com teto de 10 páginas; a economia de
tokens de conteúdo é zero (o texto é o mesmo), mas ~1,4 mil tokens de overhead
de 14 chamadas e 10 idas e voltas a menos.

#### A2. Não há busca no material; "achar um exercício" custa uma leitura inteira
**Onde:** a busca existe na interface (`desk/src/study-data/search.cjs:211`,
`desk/src/study-search.mjs`), mas **não há ferramenta** para o tutor em
`desk/src/extensions/mesa-mcp/tools.mjs:126-137` nem no MCP do Claude
(`desk/src/agents/study-tools.cjs:4-21`). O tutor só tem `ler_pdf` página a
página.
**Problema:** para responder "onde está o exercício 7b?" ou "em que página ele
define derivada implícita?", o modelo precisa varrer a aula com `ler_pdf` ou
adivinhar páginas. O índice já existe, é offline, devolve `fileName`, `page` e
`snippet` (`search.cjs:168-202`), e a UI já o usa.
**Cenário concreto:** o aluno pergunta "acha o exercício de limite fundamental
na apostila". O modelo lê 40 páginas (14 chamadas, ~20 mil tokens) para achar
uma página. Com uma ferramenta `buscar` restrita à matéria, seria 1 chamada e
~5 resultados de ~50 tokens = ~250 tokens. A economia é de ~20 mil tokens e 13
chamadas por pergunta desse tipo.
**Correção:** expor `buscar_material` (nome provisório) nas três engines, com
`consulta`, `limite` e escopo fixo na matéria atual + PDFs autorizados. O
resultado deve trazer `arquivo`, `p. N`, `trecho` e o id para abrir. A
autorização segue a lista do host (`options.courses`), como a UI.
**Ganho:** 14 → 1 chamada e ~20 mil → ~250 tokens nas perguntas de localização;
também melhora a citação (`Arquivo.pdf, p. N`) sem ler a página inteira.

#### A3. A prévia da atividade e a publicação enviam o mesmo conteúdo duas vezes
**Onde:** `desk/src/extensions/mesa-activity/guide.mjs:27` (fluxo "monte, rode a
prévia, corrija, depois mostre"), `:45-52` (`CONTENT_FIELDS`), `:53-60`
(`CREATE_FIELDS`), `desk/src/extensions/mesa-activity/guide.mjs:87` (a prévia
recebe os mesmos `html/css/js`), `desk/src/agents/activity-tools.cjs:39-46` e
`:56-66`.
**Problema:** o modelo monta o quadro, envia o payload inteiro para
`previsualizar_atividade`, recebe o PNG e o console, e depois envia **o payload
inteiro de novo** para `criar_atividade`. Se corrigir um rótulo depois da
prévia, repete o ciclo. Não há `previewId`/`draftId`; o `activityId` só serve
para revisar uma versão já publicada.
**Cenário concreto:** uma atividade de 6 KB (html+css+js) custa ~1,7 mil tokens
de payload; enviada duas vezes são ~3,4 mil tokens de entrada, mais o PNG da
prévia. No teto de 64 KiB (`activity-store.cjs:43`), o mesmo conteúdo custa
~18,2 mil tokens por envio; duas vezes são ~36,4 mil. O modelo também pode
publicar uma versão diferente da que pré-visualizou, porque os dois envios são
independentes.
**Correção:** a prévia devolve um `previewId` opaco (em memória, com prazo e
escopo da conversa) e `criar_atividade` aceita `previewId` em vez de
html/css/js; ou `criar_atividade` ganha `publicar: false` que só mede e devolve
o id para o `publicar: true` seguinte. O `alternativeMarkdown` pode continuar
sendo enviado na publicação, porque é o fallback textual e é pequeno.
**Ganho:** elimina um envio completo por atividade (1,7–18,2 mil tokens,
conforme o tamanho) e a classe de erro "publiquei o que não pré-visualizei".
Uma chamada a menos no caminho feliz.

#### A4. O chat lateral do OpenCode oferece ferramentas que ele não tem
**Onde:** `desk/src/agents/desk-prompts.cjs:185-187` (`openCodePrompt` sempre
usa `mainSessionPrompt({pdf:false})`, com `GEOGEBRA_OFFER`, `BOARD_OFFER`,
`CHAT_FIGURE_OFFER` e `REVIEW_OFFER`), `desk/tutor-engine-host.cjs:142-145`
(`prepareOpenCodeSide` usa o mesmo prompt), `desk/opencode-tutor-host.cjs:182`
(`pdfOnly: true`) e `desk/src/extensions/mesa-mcp/tools.mjs:134` (nesse modo só
existe `ler_pdf`).
**Problema:** no chat lateral do OpenCode o tutor é instruído a oferecer
GeoGebra, quadro, figura e revisão; nenhuma dessas ferramentas está no MCP
dele. O modelo pode prometer "vou montar um quadro", chamar uma ferramenta
inexistente e gastar o turno pedindo desculpa. O teste
`desk/tests/desk-prompts.test.mjs:20-31` não inclui "OpenCode chat lateral" no
mapa de variantes, então isso passa.
**Cenário concreto:** no chat lateral, o aluno pede um diagrama; o modelo
oferece o quadro e chama `criar_atividade`. O OpenCode responde "tool not
found"; o modelo tenta `ver_figura`, também não existe, e volta ao texto. Uma
ou duas chamadas perdidas por pedido e uma promessa quebrada.
**Correção:** `openCodePrompt({sidechat:true})` (ou um `tools:false` explícito)
com o mesmo texto lateral do Pi/Claude; `prepareOpenCodeSide` passa a opção.
Acrescentar "OpenCode chat lateral" a `variants` e a `desk-prompts.test.mjs`.
**Ganho:** ~250–300 tokens de ofertas a menos no lateral e, principalmente, zero
chamadas para ferramentas ausentes.

#### A5. `alwaysLoad` mantém ~6,9 mil tokens de esquema em todo turno do Claude
**Onde:** `alwaysLoad: true` em `desk/src/agents/tutor-pdf.cjs:12`,
`activity-tools.cjs:46,66`, `pdf-read-tool.cjs:28`, `figure-tool.cjs:28`,
`geogebra-tool.cjs:31` e `review-tool.cjs:28`. O SDK 0.3.314 documenta que
`alwaysLoad` é o oposto de `defer_loading` e que as ferramentas MCP são
adiadas **quando a busca de ferramentas está ligada**
(`desk/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:654-659,1222`).
`ToolSearch` está na lista de ferramentas nativas do SDK
(`sdk.d.ts:216`), mas **não** em `SDK_TOOLS`
(`desk/src/agents/claude-adapter-contract.cjs:38-46`). A auditoria do #40
manteve o `alwaysLoad` de propósito porque o adapter não liga o ToolSearch
(`docs/reviews/issue-40-auditoria.md:77-80`); o SDK 0.3.314 agora lista
`ToolSearch` entre as nativas, então a premissa pode ter mudado.
**Problema:** se o Claude Code aceito tiver a busca de ferramentas, o
`alwaysLoad` força as 7 ferramentas da Mesa — 6.935 tokens — no prompt de todo
turno, mesmo quando o aluno só quer conversar. Sem `alwaysLoad`, elas ficariam
adiadas e só entrariam quando o modelo as procurasse. O custo seria uma chamada
de busca quando a ferramenta for usada, e algum risco de o modelo não achar uma
ferramenta rara.
**Cenário concreto:** um turno só de explicação, sem PDF, quadro ou GeoGebra,
carrega 8.206 tokens de prefixo; 6.935 são esquemas que não serão usados. Em 20
turnos, são ~138 mil tokens de esquema no contexto (descontando cache; o
contexto e a janela continuam ocupados).
**Correção:** experimento controlado: acrescentar `ToolSearch` a `SDK_TOOLS`,
tirar `alwaysLoad` das ferramentas raras (manter em `ler_pdf` se a busca falhar)
e medir com `probe-tools.ts`/um turno real: o modelo acha `mcp__mesa__ler_pdf`,
`criar_atividade` e `geogebra` pela busca? Se sim, o ganho é de até 6,6 mil
tokens/turno; se não, reverter. Não dá para afirmar o ganho sem essa prova.
**Ganho:** potencial de até ~6.935 tokens por turno no Claude (84,5% do prefixo
da Mesa), ao custo de uma busca quando a ferramenta é usada. **Estimativa
condicionada** ao suporte do Claude Code aceito.

### Médio

#### M1. `criar_atividade` e `criar_pdf` são 57–58% das ferramentas; `callRef` é um campo interno exposto
**Onde:** `desk/src/extensions/mesa-activity/guide.mjs:73-83` (`CREATE_DESCRIPTION`
= 6.151 car./2.127 tokens), `:59` (`callRef` no esquema), `:35` ("O campo
callRef é preenchido pela Mesa; não use"); `desk/src/extensions/tutor-pdf/guide.mjs:47`
(`TOOL_DESCRIPTION` = 5.247 car./1.816 tokens); `desk/src/extensions/mesa-figure/guide.mjs:57`
(`FIGURE_DESCRIPTION` = 1.129 tokens).
**Problema:** duas descrições longas dominam o prefixo. Parte do texto é
referência estável (tokens `--mesa-*`, contrato `window.mesa`, lista de modelos
de PDF) que o modelo só precisa quando usa a ferramenta. `callRef` é pior: é um
parâmetro que o modelo não deve preencher, aparece no esquema e é ignorado no Pi
(`mesa-activity/index.ts` passa `toolCallId`, não `params.callRef`) e no OpenCode
(`activityTools` gera o próprio `callRef`); no Claude o hook o sobrescreve.
**Cenário concreto:** o modelo vê `callRef` sem descrição, inventa um valor e
recebe `err.activity.callRefInvalid`; ou gasta tokens lendo uma instrução que
só existe para dizer "não use". Nas descrições, o modelo relê a lista de tokens
e o contrato a cada turno mesmo quando só vai responder uma pergunta.
**Correção:** tirar `callRef` do esquema visível (o hook do Claude já injeta; o
Pi e o OpenCode não usam). Encurtar `CREATE_DESCRIPTION`: manter o "quando" e um
exemplo mínimo de 10–15 linhas; mover `PEDAGOGY`/`CONTRACT` para uma ferramenta
`guia_atividade` ou para um recurso carregado sob demanda. Em `criar_pdf`,
substituir `PDF_FIGURE_GUIDE` (382 tokens) por uma linha que aponta para
`ver_figura` + regras da base (as duas ferramentas coexistem em toda sessão que
tem `criar_pdf`).
**Ganho:** `callRef` ~20–30 tokens; `PDF_FIGURE_GUIDE` ~300 tokens; um corte de
20–30% em `criar_atividade` vale 400–600 tokens por turno. É menos que A5, mas
vale nos três motores, inclusive Pi/OpenCode, onde não há adiamento.

#### M2. O GeoGebra manda chamar `run` + `state`, mas `run` já devolve o estado
**Onde:** `desk/src/extensions/mesa-geogebra/guide.mjs:20` ("Prefira 'run' +
'state' para construir"), `desk/geogebra-host.cjs:136-140` (`ggbRun` devolve
`{...ok, state}`) e `guide.mjs:95-99` (`runText` imprime o estado).
**Problema:** cada comando de construção rende uma segunda chamada `state` que
devolve exatamente o mesmo texto que veio no `run`. Com 20 objetos, o estado é
~836 car./466 tokens; com 80, ~3.056 car./1.726 tokens. O guia também não avisa
que `ggbSummary` corta em 80 objetos (`geogebra-host.cjs:134`) e ignora o
`count` no texto (`guide.mjs:75-77`), então o modelo não sabe que há mais.
**Cenário concreto:** "construa a parábola e diga os pontos". O modelo roda
`f(x)=x^2`, recebe o estado; segue o guia e chama `state`, pagando o mesmo
estado de novo. Com 40 objetos, são ~2 × 1.000 tokens por comando.
**Correção:** escolher um dos dois: (a) `run` devolve só `{ok, error}` e o guia
mantém `run` + `state`; ou (b) `run` continua devolvendo o estado e o guia diz
"`run` já devolve os objetos; use `state` só para reler sem mudar". Acrescentar
ao texto `(mostrando 80 de N)` quando `count > 80`.
**Ganho:** uma chamada e ~0,5–1,7 mil tokens por comando; menos idas e voltas
numa construção de 5–10 comandos.

#### M3. Qualquer imagem na página dispara um PNG da página inteira
**Onde:** `desk/pdf-page-text.cjs:56-60` (`if (images > 0) return 'figure'`),
`:118-126` (renderiza a página inteira), `desk/pdf-render.html:18` (`LONG_EDGE =
1200`), `:33` (PNG) e `desk/pdf-page-text.cjs:19` (`MAX_IMAGE_CHARS =
1.800.000`).
**Problema:** um logo, uma tarja ou uma figura decorativa no rodapé classifica a
página como `figure` e manda um PNG de 848×1200 (ou 927×1200, conforme o
aspecto) junto do texto. Pela fórmula de visão (px/750), isso é ~1.360–1.480
tokens por página, mesmo quando o texto já basta. Numa apostila com uma imagem
por página, 40 páginas somam ~55–59 mil tokens de visão além dos ~20 mil de
texto.
**Cenário concreto:** uma aula de 40 páginas com o logo do curso em todas as
páginas. O modelo lê 14 chamadas e recebe 40 PNGs que não acrescentam nada.
**Correção:** campo `imagem: "auto" | "sim" | "nao"` (padrão `auto`); no `auto`,
renderizar só quando a página for `scan` (sem texto) ou `formula`, ou quando o
texto for muito curto; para `figure`, devolver o texto e uma linha "esta página
tem figura; peça `imagem: sim` se precisar". Alternativa mais simples: baixar o
`LONG_EDGE` para ~900 em páginas com texto (696×900 ≈ 835 tokens, −44%).
**Ganho:** até ~1,4 mil tokens por página decorativa; numa aula com imagem em
todas as páginas, dezenas de milhares de tokens. **Estimativa** pela fórmula de
visão, não medida com modelo real.

#### M4. Truncamentos silenciosos em três saídas
**Onde:** `desk/pdf-page-text.cjs:110` corta o texto da página em 12.000
caracteres sem marcador (testei uma página densa: voltou exatamente 12.000
caracteres, terminando no meio de uma palavra); `desk/geogebra-host.cjs:134`
corta o estado em 80 objetos e `guide.mjs:75-77` não mostra o `count`;
`desk/src/extensions/mesa-activity/guide.mjs:97` imprime só 50 mensagens de
console, embora `activity-preview.cjs:160` guarde até 200 e o texto diga
"Console (200)".
**Problema:** o modelo não sabe que falta conteúdo e pode concluir errado. No
PDF, uma página com 15 mil caracteres perde 3 mil; no GeoGebra, o 81º objeto
some; no console, os erros 51–200 não aparecem.
**Correção:** acrescentar ao texto `(texto cortado em 12.000 caracteres; a
página tem N)`; `(mostrando 80 de N objetos; peça state com filtro)`; e
`(mostrando 50 de N mensagens; as demais estão no console)`.
**Ganho:** evita repetição e erro de cobertura; não muda o custo feliz.

#### M5. O `measure-prompts` subconta o prefixo que ele mesmo publica
**Onde:** `desk/scripts/measure-prompts.mjs:55-68` monta só `criar_pdf`,
`criar_atividade`, `previsualizar_atividade` e `ler_pdf` no Claude; `:94` não
inclui `mesa-geogebra` no Pi; `:177-188` não mede o OpenCode.
**Problema:** o relatório gerado diz "Claude — prefixo da Mesa 6.217" e "Pi —
parte da Mesa 7.366", mas o Claude real tem **8.206** (+1.989: `ver_figura`
1.129 + `geogebra` 542 + `propor_revisao` 318) e o Pi real tem **7.906** (+540
de `mesa_geogebra`). O OpenCode (6.139) não aparece. Quem otimiza com essa
régua mede o alvo errado.
**Correção:** incluir as três ferramentas no `claudeTools`, `mesa-geogebra` no
`piRequest` (com uma ponte falsa) e uma seção OpenCode com `openCodePrompt` +
`mesaTools`. O teste de paridade já monta as sete; o medidor deveria usar a
mesma lista.
**Ganho:** baseline correto; sem ele, qualquer "economia" de 500 tokens pode ser
só a ferramenta que ficou fora da conta.

#### M6. As descrições e os resultados das ferramentas são só em português
**Onde:** `desk/src/extensions/mesa-mcp/pdf-tool.mjs:14-20`;
`desk/src/extensions/mesa-activity/guide.mjs:73-83`; `desk/src/extensions/mesa-figure/guide.mjs:57`;
`desk/src/extensions/mesa-review/guide.mjs:8-16`; `desk/src/extensions/tutor-pdf/guide.mjs:47`.
Só o GeoGebra tem `guideFor('pt-BR' | 'en')`
(`desk/src/extensions/mesa-geogebra/guide.mjs:63-74`). Os erros passam por
`toolErrorText` (`desk/src/agents/tool-error-text.cjs`), mas descrição e
resultado não.
**Problema:** com o tutor em inglês (#41), o modelo recebe instruções e
resultados em português ("O aluno já a vê: não a anuncie") enquanto o sistema
manda responder em inglês. O modelo costuma obedecer, mas o texto fica
inconsistente, e instruções longas em outra língua podem ser seguidas pela
metade.
**Cenário concreto:** aluno com tutor em inglês pede uma lista; o resultado do
`criar_pdf` diz "Material ... preparado ... o arquivo ainda não foi salvo" em
português. O modelo pode traduzir a mensagem para o aluno, mas perde a nuance de
"não diga que o PDF foi salvo".
**Correção:** levar `language` aos guias como já se faz no GeoGebra; no mínimo,
traduzir descrições e os resultados de uma frase. O teste de idioma
(`language-ui.mjs`) não cobre textos de ferramenta.
**Ganho:** menos erro de instrução no modo `en`; sem mudança de tokens no
`pt-BR`. Se a tradução for para inglês, o texto tende a custar 10–15% menos
tokens que o português na mesma régua (estimativa; o estimador conta bytes).

#### M7. A publicação mede o quadro, mas engole o erro da medição
**Onde:** `desk/activity-host.cjs:52` (`await measure(spec).catch(()=>undefined)`)
e `desk/src/agents/activity-tools.cjs:39-46` (o resultado é sempre
`publishedText`, sem erro).
**Problema:** se o HTML/JS tiver um erro que a medição detecta, a publicação
segue sem altura e o modelo recebe "Atividade ... mostrada na conversa". O aluno
vê um quadro quebrado; o tutor acha que deu certo. A prévia (`previsualizar`) é
quem mostraria o console, mas nada obriga o modelo a chamá-la antes.
**Cenário concreto:** um `ReferenceError` no `js`; o modelo publica direto (sem
prévia), o quadro nasce vazio, a ferramenta responde sucesso.
**Correção:** quando a medição falhar ou o console tiver `error`, devolver
`isError` (ou um aviso inequívoco) e não publicar; ou publicar com
`aviso: "o quadro tem N erros; o aluno pode vê-lo quebrado"`. O caminho da
prévia já tem o console; reutilize-o na publicação.
**Ganho:** evita um quadro quebrado por atividade; não é token, é qualidade.

#### M8. `ver_figura` aceita 8.000 caracteres, mas a cerca `plot` só aceita 4.000
**Onde:** `desk/src/extensions/mesa-figure/guide.mjs:60` (`source: max:
MAX_SVG_CHARS` = 8.000) e `:30` (a descrição diz "até 4.000" para `plot`);
`desk/src/figures/plot-spec.mjs:151` rejeita `plot` com mais de 4.000.
**Problema:** um `plot` de 5.000 caracteres passa no esquema e falha no parser.
O modelo só descobre depois de enviar; a mensagem do parser é boa, mas a calls
foi perdida.
**Cenário concreto:** um gráfico com muitas funções/rótulos chega a 4.500
caracteres; o esquema diz que cabe, a ferramenta devolve "até 4000 caracteres".
**Correção:** separar o limite por `kind` (`anyOf`/`oneOf` não é bem suportado
pelo TypeBox atual) ou baixar o `max` para 4.000 e deixar o SVG usar um campo
`svg` separado; ou validar no `figureTool` antes de chamar a ponte, com a mesma
mensagem do parser.
**Ganho:** uma chamada perdida por figura grande; baixo volume.

#### M9. Limites de esquema e paridade: soma da atividade e `criar_pdf` no OpenCode
**Onde:** `desk/src/extensions/mesa-activity/guide.mjs:46-48` (html 51.200 +
css 32.768 + js 32.768) e `:35` ("O total ... cabe em 64 KiB");
`desk/activity-store.cjs:40-43,101` (cada campo passa, o total de 65.536 bytes
falha). `desk/src/extensions/mesa-mcp/tools.mjs:7-10` deixa `criar_pdf` fora do
OpenCode e `desk/src/agents/desk-prompts.cjs:180,186` omite o PDF (`pdf:false`).
**Problema:** o zod/TypeBox aceita um payload de atividade que o store recusa,
então o modelo paga a geração e a prévia antes de receber
`err.activity.specTooBig`. No OpenCode, o tutor não monta lista/apostila; o
prompt está correto ao não oferecer, então é lacuna de produto, não erro.
**Correção:** reduzir os máximos para uma soma ≤ 64 KiB (html 40, css 12, js 12,
textos 8) ou validar a soma no handler; levar a ponte de material
(`tutor-materials.cjs`) ao OpenCode ou documentar a diferença na interface.
**Ganho:** uma chamada e uma prévia perdidas por atividade grande; paridade de
capacidade sem impacto nos outros motores.

### Baixo

#### B1. GeoGebra indisponível volta como sucesso, não como erro
**Onde:** `desk/src/agents/geogebra-tool.cjs:26-30` devolve
`guide.unavailableText(...)` em `content` sem `isError`; o mesmo em
`desk/src/extensions/mesa-mcp/tools.mjs:58-63` e
`desk/src/extensions/mesa-geogebra/index.ts:31-34`.
**Problema:** o resultado "GeoGebra indisponível (...). Diga ao aluno..." é
tratado como sucesso pelo protocolo. O modelo costuma seguir a frase, mas alguns
modelos repetem a chamada ou tentam `state` para "confirmar".
**Correção:** marcar `isError: true` quando a ponte estiver fechada ou o applet
não responder; manter texto normal para "comando recusado" (o comando rodou e
foi recusado, é informação).
**Ganho:** evita uma repetição em falha de ponte; baixo volume.

#### B2. `propor_revisao` é oferecido na aba Livre, onde não existe caderno
**Onde:** `desk/src/agents/desk-prompts.cjs:120` (oferta em toda sessão
principal) e `desk/review-proposal-host.cjs:107` (`canReview` falso na Livre
devolve `review.error.free`).
**Problema:** o modelo pode oferecer/propor revisão na Livre e receber "A aba
Livre não tem caderno de revisão."
**Correção:** omitir `REVIEW_OFFER` quando `courseId === FREE_ID` ou trocar a
fase da oferta por "só em matéria".
**Ganho:** uma chamada perdida ocasional; baixo.

#### B3. Erros menores de validação e mensagem
**Onde:** `desk/src/extensions/mesa-mcp/pdf-tool.mjs:79` (JSON inválido da ponte
vira "A Mesa não conseguiu ler o PDF"), `desk/src/agents/pdf-read-tool.cjs:26-29`
(fallback `err.pdf.pick` mesmo quando o problema foi a ponte),
`desk/material-pdf.cjs:195-196` (`err.pdf.tooBig` sem o teto) e
`desk/src/extensions/tool-fields.mjs:14-16` (`trim` só existe no zod do Claude;
`tutor-pdf/guide.mjs:55` e `mesa-review/guide.mjs:12` dependem dele).
**Problema:** o modelo não sabe se o caminho errou, se o PDF sumiu ou se a sessão
caiu, e pode repetir a chamada; no `tooBig`, não sabe quanto cortar; no Pi e no
OpenCode, um `title`/`question` de só espaços passa onde o Claude recusa.
**Correção:** incluir status e próximo passo no erro da ponte; passar
recebido/máximo no `tooBig`; aparar no handler comum ou declarar `trim` no
TypeBox.
**Ganho:** menos repetições e validação igual nos três motores; baixo volume.

## Lacunas

Busca no material (A2), sumário/faixa para aula longa (A1), exemplo mínimo de
atividade (M1) e `criar_pdf` no OpenCode (M9). Citar página já funciona pelos
blocos `--- p. N ---`; falta um atalho para trecho de figura/scan, que a busca
com snippet cobriria.

## Top 5

1. **Buscar no material (`buscar_material`)** — A2. Uma ferramenta sobre o
   índice que já existe transforma 14 chamadas/~20 mil tokens em 1 chamada/~250
   tokens para "achar um exercício" e "citar página". É o maior ganho de
   chamadas e o que mais aproxima o tutor do jeito como o aluno estuda.
2. **Paginação honesta do `ler_pdf`** — A1. Dizer `pedido`/`devolvido`,
   `proxima` e aceitar uma faixa maior (ou `paginas`) evita o resumo de 3 de 40
   páginas e corta 14 chamadas para ~4. Barato de implementar e mede-se com o
   PDF sintético desta auditoria.
3. **Reuso da prévia na publicação da atividade** — A3. `previewId`/`draftId`
   elimina o segundo envio do mesmo html/css/js (1,7–18,2 mil tokens por
   atividade) e a classe "publiquei o que não pré-visualizei".
4. **Adiar as ferramentas raras no Claude (`ToolSearch`)** — A5. Se o Claude
   Code aceito suportar, tira até ~6,9 mil tokens de esquema de todo turno
   (84,5% do prefixo da Mesa). É o maior ganho por turno, mas precisa da prova
   com o `probe-tools.ts`/um turno real; se não suportar, não muda nada.
5. **Corrigir o chat lateral do OpenCode e o `run`/`state` do GeoGebra** — A4 +
   M2. O lateral deixa de oferecer ferramentas ausentes (zero chamadas perdidas
   e ~300 tokens a menos) e o GeoGebra deixa de pagar o mesmo estado duas vezes
   por comando (~0,5–1,7 mil tokens e uma chamada por comando).

Menções honrosas: tirar `callRef` e enxugar `criar_atividade` (M1), `imagem:
auto` no `ler_pdf` (M3) e corrigir o `measure-prompts` (M5).

## Limites desta auditoria

Não houve inferência real nem modelo autenticado: descrição e esquema são exatos
pela régua local, mas o custo de visão dos PNGs é estimativa (px/750) e o
comportamento do modelo não foi observado. O PDF sintético tem ~1.480
caracteres/página; uma página real tem 2–3 mil, então a leitura de uma aula real
custa 1,3–2× os números acima. O Pi real carrega o perfil do usuário
(`ask_user`, `quiz`, `subagent_*`, `obsidian-note`, MCPs), fora do
`measure-prompts`: os 7.906 tokens são um piso. No OpenCode, os 6.139 tokens são
só a parte da Mesa; prompt e ferramentas próprios não entram.
