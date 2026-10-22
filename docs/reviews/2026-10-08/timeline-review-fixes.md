# Correções da revisão independente da linha do tempo — 2026-10-08

- **Revisão corrigida**: [timeline-code-independent-review.md](timeline-code-independent-review.md)
  (achados **B** e **C**; o achado **A** já tinha sido corrigido pelo root e foi
  preservado).
- **Escopo desta rodada**: `desk/src/chat.mjs`; novos testes
  `desk/tests/timeline-noid.mjs` e cenários sem `message.id` na fixture
  `desk/tests/timeline-pi.mjs`. **Não tocados**: `desk/src/agents/{claude-adapter,service,history}.cjs`,
  `main.cjs`, `preload.cjs`, renderer de atividades, PDF, núcleo Bend, config,
  fixtures integradas do root (`claude-sdk-activity-fake.mjs` etc.).
- **Estado**: correções implementadas e provadas localmente. Nada foi commitado,
  instalado, publicado, atualizado ou aberto no app pessoal; nenhum dado pessoal
  foi lido. Os probes da revisão foram rerodados **READ ONLY** a partir de
  `/private/tmp/timeline-review/`.
- **Achado A (root) preservado**: `contentIndex=e.message.contentIndexes?.[i]??i`
  (`chat.mjs`, laço do `message_end`) e `blockMessageId=ame.messageId??…`
  (chave dos deltas) continuam sendo a base; a rodada só acrescentou o fallback
  de identidade e a âncora de posição.

## Resposta por achado

### B — P2 — Pi sem `message.id`: identidade sintética e reconciliação (corrigido)

**Causa (dois defeitos somados).**

1. Sem `message.id`, `assistantId` ficava `null`; a chave dos blocos virava
   `''` e o `message_end` liquidava **todos** os blocos de texto finais na
   bolha corrente — a fala anterior era sobrescrita (“Antes…” sumia) e o que
   restava caía depois do slot da ferramenta.
2. Mesmo com chave, o `settleAssistantBlock` criava o balão no **fim** do
   `#messages`: um texto cujo `contentIndex` é **anterior** a uma ferramenta já
   declarada (texto só chega no `message_end`) nascia depois do `article.work`
   e do slot.

**Correção em `desk/src/chat.mjs`.**

- `nextAssistantId()` cria a identidade sintética por **sequência de
  `message_start`** (`host-msg-N`), como decidido no plano; `ensureAssistantId()`
  cobre o caminho em que o `message_start` nem chega (ex.: `message_end`
  isolado, como no probe da revisão). O flag novo `messageEnded` marca o fim da
  mensagem no `message_end` — e, diferente de `assistantEnded`, **não** é
  resetado quando a declaração/execução de ferramenta fecha a bolha. Uma
  mensagem ainda aberta conserva a identidade (re-stream não duplica fala);
  a próxima mensagem sem id abre a identidade seguinte.
- A chave dos blocos continua `(id, contentIndex)` para deltas, `text_end` e
  para **todos** os blocos `text` do `message_end` — sem perder nem fundir
  falas separadas por pensamento/ferramenta.
- `settleAssistantBlock(key,text,images,anchor)` agora: reusa o bloco da chave;
  sem chave, **adota** a bolha corrente sem identidade (deltas sem
  `contentIndex`, o caminho do `fake-pi.mjs`); e, ao criar, insere no ponto
  lógico do `anchor`.
- `assistantAnchors` (id da chamada → `{index,el}`) é gravado no `toolcall_end`
  com o `contentIndex` do bloco e reconstruído no `message_end` a partir do
  `content` (quadros parciais do Claude, cujo `tool_start` não expõe o índice).
  O texto de índice menor nasce **antes** do `article.work`; como o slot é um
  irmão ancorado depois do work, ele não se move.
- Helpers novos: `rememberToolAnchors` e `assistantAnchorAfter`.

**Antes × depois** (mesmos probes da revisão, rerodados só-leitura):

```text
# /private/tmp/timeline-review/probe-noid.mjs — roteiro "sem streaming"
antes: [user, work, activity-slot, assistant]            texts ['Depois sem stream.']
depois: [user, assistant, work, activity-slot, assistant] texts ['Antes sem stream.','Depois sem stream.']

# /private/tmp/timeline-review/probe-noid.mjs — roteiro "pensamento no meio"
antes: [user, assistant, work]              texts ['Segunda fala.']
depois: [user, assistant, work, assistant]  texts ['Primeira fala.','Segunda fala.']
```

O cenário “só ends” e o “com deltas” (texto→ferramenta→texto) já fechavam
corretos e continuam iguais (`[user, work, assistant, work, activity-slot,
assistant]`, textos `['Antes.','Depois.']`).

### C — P2 — código morto introduzido pelo diff (corrigido)

Removidos de `desk/src/chat.mjs`:

- `turnGen` (declaração e a escrita `turnGen+=1` no `agent_start`);
- `assistantKeyFor` (nunca chamado);
- `trackStep` (nunca chamado).

Verificação direta (sem saída = remoção completa):

```sh
grep -n "turnGen\|assistantKeyFor\|trackStep" desk/src/chat.mjs   # → exit 1, nenhuma linha
```

## Verificação (tudo executado nesta rodada)

- `node --test tests/timeline.test.mjs tests/timeline-adapter.test.mjs tests/worklog.test.mjs tests/worklog-view.test.mjs tests/claude-adapter.test.mjs tests/agent-history.test.mjs tests/agent-service.test.mjs`
  → **124 pass / 0 fail**.
- `node --test tests/*.test.mjs` → **1181 pass / 0 fail** (inclui o bloco
  Claude do achado A e os testes de worklog/timeline).
- `node tests/timeline-noid.mjs` → **PASS**. Electron real com fixture sintética
  sem `message.id`; cobre: (1) deltas texto→ferramenta→texto; (2) texto só no
  `message_end` com a ferramenta já declarada — a primeira fala nasce antes do
  work/slot e o slot é o MESMO nó da declaração (mesmo passo, conectado, fala
  anterior antes do work, fala posterior depois do slot); (3) `message_end` sem
  `message_start`; (4) texto→pensamento→texto (deltas + final); (5) duas
  mensagens sem id na mesma rodada (identidade da segunda não sobrescreve a
  primeira). No fim, **vivo × reload** têm a mesma ordem de grupos, os mesmos
  textos e os mesmos slots/estados.
- `node tests/hunt-timeline.mjs` → blocos `order` e `mixed` **PASSED**
  (slot é o MESMO nó da declaração, `slotNext` é a fala, reload idêntico;
  concorrência, retry, quiz, Parar e adoção de conversa sem regressão).
- `node tests/mesa-claude-activity-ui.mjs` → **PASS** (quadros parciais com o
  mesmo `message.id`, duas falas de cada, slot no lugar — a correção do root
  para o achado A segue de pé).
- `node tests/worklog-parity.mjs` → exit 0.
- `HUNT=worklog-history,worklog-live,worklog-live-text,abort,diary-error,diary-stop,thinking-open,quiz-edge,dialog-ui,history-images,diary-touched,quiz-focus,markdown node tests/hunt-chat.mjs`
  → 13 blocos PASSED.
- Probes da revisão rerodados só-leitura: `/private/tmp/timeline-review/probe-noid.mjs`
  (resultados acima; `pageerrors: []`) e `probe-adapter-indexes.mjs`
  (`contentIndexes: [[0,1],[2,3]]` — o mapa global do adapter não foi tocado).

## Limites desta rodada

- Sem provedor real e sem app instalado; a prova é o Electron real com
  runtimes sintéticos. Nenhuma asserção sobre inferência de modelo.
- O ajuste é de reconciliação/identidade no renderer; `contentIndexes`,
  `messageId` e o mapa de blocos do adapter (achado A) não foram alterados.
- Não revisados: renderer de atividades, PDF, núcleo Bend e agentes fora da
  timeline.

## Handoff

- `desk/src/chat.mjs` está **liberado**: nenhuma edição pendente desta rodada.
  Símbolos tocados: variáveis `assistant*`/`messageEnded`, `assistantBlocks`,
  `assistantAnchors`, `assistantSeq`, `resetAssistantBuffers`,
  `nextAssistantId`/`ensureAssistantId`, `openAssistantBlock`,
  `settleAssistantBlock`, `rememberToolAnchors`, `assistantAnchorAfter`,
  `declareTool` (assinatura ganhou `contentIndex`), `message_start`/`message_update`/
  `message_end` e o `agent_start` (limpeza de `turnGen`).
- Fixture da rodada: `desk/tests/timeline-pi.mjs` ganhou os roteiros
  `sem id com deltas`, `sem id só final`, `sem id sem início`,
  `sem id pensamento` e `sem id duas mensagens`; o teste de regressão é
  `desk/tests/timeline-noid.mjs` (rodar direto; não entra no glob de hunts).
- Próximo passo: revisão independente nova sobre este diff, com foco em
  identidade sintética/reconciliação de finais e nos caminhos sem `message.id`.
