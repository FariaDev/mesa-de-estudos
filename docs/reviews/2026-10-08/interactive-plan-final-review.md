# Revisão independente do plano — UI interativa, PDF e timeline

Data: 2026-10-08
Escopo: revisão apenas do plano consolidado `docs/PLANO-UI-INTERATIVA-PDF-TIMELINE-2026-10-08.md` e das seções
relevantes de `docs/reviews/2026-10-08/{interactive-ui-plan,timeline-plan,pdf-template-plan}.md`.
Método: inspeção de código (grep/sed) e das tipagens instaladas do Electron 44, Pi e Claude Agent SDK. Nenhum teste foi
executado, nenhum app/PDF/sessão/config pessoal foi aberto, nenhuma outra doc ou código foi alterado. `git status`
confere as mudanças locais existentes preservadas.

## Veredito

A direção (runtime livre primeiro, gate medido, timeline por partes, PDF compartilhado) é implementável, mas o plano
**não está pronto para começar as etapas 3+ sem corrigir O1–O5**. A etapa 1 (spike de isolamento) e a etapa 2
(timeline/âncoras) podem começar já; a etapa 4 (PDF) pode começar depois de O6–O7. Nenhuma decisão do pai é reaberta:
não se propõe catálogo fixo, cópia cega da Conversa nem fusão dos apps.

## Objeções

### O1 — Bloqueante — O documento livre é argumento de ferramenta; o princípio "mensagem guarda a referência" não vale.
Prova: o contrato `{title, objective, alternativeMarkdown, html, css, js}` é o `input` da chamada; o Pi persiste os
argumentos da tool call no JSONL e o Claude guarda a mensagem nativa com o `tool_use`. Com cap de 512 KiB, o HTML é
re-enviado ao provedor a cada turno da conversa (custo/contexto) e pode estourar o teto de 8 MiB do
`normalizeHistory` (`desk/src/agents/claude-adapter.cjs:157`), que descarta mensagens inteiras ao truncar.
Correção mínima: escolher por escrito uma das duas políticas e testá-la — (a) redigir os argumentos antes de persistir,
provando por teste onde a redação ocorre (Pi: handler `tool_call` muta `event.input`; Claude: `_canUseTool` aceita
`updatedInput`) e guardar só o documento no store, ou (b) aceitar a duplicação no transcript, baixar o cap para um
valor medido e registrar a métrica no teste de reabertura/continuidade. Nos dois casos, dedupe por hash e uma cópia
canônica.

### O2 — Bloqueante — Correlação `toolCallId`: Pi provado; Claude não tem fonte provada.
Prova: `ToolDefinition.execute(toolCallId, params, signal, onUpdate, ctx)` nas tipagens instaladas do Pi prova a fonte
(hoje a extensão `tutor-pdf` ignora `_id`). No Claude, o handler MCP é `(args, extra: unknown)` sem `toolCallId`
(`sdk.d.ts:4334` e `tool()` em `:8182`); `createMaterial` é chamado em `claude-adapter.cjs:1953-1956` sem id; e
`rendererEvent` (`service.cjs:14-17`) só carrega `id` nos eventos `tool_execution_start/end`. "Store indexa por
toolCallId desde o primeiro dia" não é implementável como escrito no caminho Claude.
Correção mínima: provar uma amarração e testá-la com fake SDK incluindo duas chamadas — (a) serializar publicações de
atividade por conversa (1 em voo) e ligar o artefato ao `toolCallId` no `tool_execution_end`; ou (b) usar
`options.toolUseID` do `_canUseTool` (adapter ~`:2758`); ou (c) casar por digest dos argumentos com o bloco `tool_use`.
A extensão Pi deve devolver `details.activity.toolCallId`; o teste deve provar reabertura no Claude sem `details` no
cache.

### O3 — Alto — "Nega rede" não está provado para todos os canais; o spike não testa o que a CSP não cobre.
Prova: `default-src 'none'` cobre fetch/XHR/WS/beacon/img/font/object/frame, mas o plano não mede `RTCPeerConnection`
(com STUN), `WebTransport` nem `<a ping>`; o iframe inline não tem sessão própria (`lockSession` do material-pdf é por
BrowserWindow/partition; o `webRequest` do app é da sessão compartilhada). O fixture do spike §8.6 não inclui esses
casos.
Correção mínima: acrescentar as sondas ao spike e ao `hunt-artifact-isolation`; implementar `will-frame-navigate` para
subframes com mapa `frameRoutingId → artefato` (negar navegação entre artefatos e para fora), nunca apenas a checagem
de URL; e só usar "bloqueia rede" na aceitação com o resultado medido. Se algum canal passar, o inline não faz a
alegação e/ou a simulação passa a ser hospedada na superfície isolada.

### O4 — Alto — O gate de contenção não define a entrega no caminho de fallback.
O gate "laço/flood contido; processo encerrável" não diz o que é entrega se o spike reprovar o inline, ainda que o
plano admita pôster + WebContentsView ampliado.
Correção mínima: dois gates explícitos — A (inline): laço sintético encerrado sem congelar a Mesa, medido com pids;
B (fallback): a view ampliada é destruível sem perder a conversa e o cartão inline é pôster que **não** monta o
artefato. Registrar no doc do spike qual gate passou; ele é pré-requisito de merge da superfície.

### O5 — Médio-alto — Ordem e estado: âncora por declaração, histórico por `parts` e o iframe que recarrega ao mover.
Provas: (i) reparentar `<iframe>` cria novo contexto de navegação (o conteúdo recarrega); o `timeline-plan` §4.8
afirma que "mover preserva simulação/iframe" — isso induz a um erro de implementação. (ii) O fallback do
`interactive-ui-plan` §7.2 ancora o cartão depois do diário agregado do turno: com `work → text → work`, ele não
reproduz a ordem, e o gate exige "streaming e histórico têm a mesma sequência". (iii) O `interactive-ui-plan` §7.1
cria o placeholder em `tool_execution_start`, enquanto a decisão consolidada ancora a posição na declaração
(`toolcall_end`/`tool_use`).
Correção mínima: ampliar/re-render = nova montagem + `init` (nunca mover o nó); tornar `parts` com id de passo
(`slice(from,to)` ou ids explícitos — não `slice(from)`) dependência dura da renderização de atividade; alinhar o
placeholder à declaração, com estado pendente e nota de erro/parada se a execução não vier. Cobrir os três com testes
de ordem e de re-render.

### O6 — Médio — Tokenização de material x `markup` do chat: uma das duas promessas precisa ceder.
Prova: `markup` (`desk/src/markdown.mjs`) roda a regex de math no texto cru antes do `marked`, então `$5 … $10` e `$`
dentro de código inline/cercado viram math. O `pdf-template-plan` quer `markdown.mjs` importando a regex de `tex.mjs`
"sem mudar o comportamento" e ao mesmo tempo exige respeitar escape e código.
Correção mínima: manter `markup` byte-idêntico para o chat; fazer a tokenização só no caminho de material
(`tokenizeMath`/`checkMath` usados por `prepareMaterialMarkdown`/`renderMaterialHtml`) e adicionar teste de paridade do
chat mais fixtures com `\$`, código inline/cercado e delimitador incompleto.

### O7 — Médio — PDF: encolhimento silencioso, parsing de heading e corrida prévia/save.
Provas: `fitWideDisplays` planejado só marca `data-overflow` quando ainda passa — uma escala de 0,9 fica silenciosa,
contra "não reduzir silenciosamente / diagnóstico legível"; o parsing de heading pula cerca e `$$` mas não bloco
indentado por 4 espaços; "Ver PDF" (bytes temporários) e save podem correr juntos, e `renderPdf` hoje devolve só
buffer/bytes/sha256.
Correção mínima: diagnóstico para toda escala < 1 (trecho e escala), piso 0,72 bloqueante com confirmação; medir com
`scrollWidth/clientWidth` (não rects transformados) e tratar a prévia como aviso (a prova é a página de impressão);
pular também código indentado; capturar revisão imutável (título+markdown+kind+template) no clique, ignorar resultado
atrasado de outra revisão, e "Ver PDF" não gravar nada e cancelar ao fechar o diálogo.

### O8 — Baixo — Escopo de dados pessoais/backup.
Prova: `buildSources` percorre o runtime inteiro (`desk/src/study-data/backup.cjs:360`) e `activities/**` não casa
nenhuma negação — entra por omissão, como o `interactive-ui-plan` afirma.
Correção mínima: fixar no teste o caminho e o conteúdo (documento + tentativa + timestamps); documentar que tentativa é
dado pessoal incluído no backup da Mesa; `activityMarkdown`/export textual não inclui o script; poda por conversa
ausente não apaga versões ainda referenciadas (quarentena).

### O9 — Baixo — Texto stale que pode reabrir decisão.
"Ordem proposta" item 3 ainda manda "avaliar dois formatos ... selecionar MVP após avaliar expressividade", mas a seção
de decisão já fechou o formato (geração livre prioritária, presets como apoio). Reescrever o item para deixar a decisão
fechada, sem tocar no mérito.

## Pode começar já

- Etapa 1 (spike) com as sondas de O3 e os dois gates de O4.
- Etapa 2 (timeline/âncoras) com `parts`/ids e a proibição de `slice(from)` em segmento fechado.
- Etapa 4 (PDF) depois de O6/O7; etapa 3 (atividades no chat) depois de O1/O2/O5.

## Resumo

Plano consolidado fiel à prioridade livre e sem reabrir a decisão contra componentes. As pendências que impediriam uma
implementação correta são de amarração: transcript/contexto do documento livre, correlação de chamada no Claude, canais
de rede não medidos, gates do fallback e estado/ordem do artefato. Com as correções mínimas acima registradas no
próprio plano, as etapas podem seguir com testes sintéticos e sem provar uso real.
