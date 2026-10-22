# Correções residuais da timeline (N1/N2/N3) — 2026-10-08

- **Revisão corrigida**: [timeline-code-final-review.md](timeline-code-final-review.md)
  (N1 P2 bloqueador; N2/N3 P3). A e C confirmados pelo revisor NÃO foram
  tocados: `contentIndexes?.[i]??i`, a chave de delta por `ame.messageId` e a
  limpeza do código morto seguem de pé.
- **Escopo desta rodada**: `desk/rpc.cjs`, `desk/src/chat.mjs`, novo helper
  `desk/src/turn-identity.cjs`, testes `desk/tests/{timeline-pi.mjs,
  timeline-late.mjs,turn-identity.test.mjs,rpc.test.mjs}` e o ajuste mínimo em
  `desk/tests/snapshot.test.mjs` (o snapshot público precisa copiar o helper).
- **Não tocados**: `main.cjs` (nenhuma mudança de pi-event/pi-prompt/pi-abort foi
  necessária), `activity-*`, renderer de atividades, runtime/store/preload, PDF,
  núcleo Bend, `claude-adapter/service/history`, `chat/rpc.cjs`.
- **Estado**: correções implementadas e provadas localmente. Nada commitado,
  instalado, publicado ou aberto no app pessoal; nenhum provedor real, nenhum
  dado pessoal; baseline sujo preservado.

## N1 — P2 (fechado) — atraso do turno parado pintava/fechava o turno novo

**Contrato do Pi investigado** (`docs/rpc.md`, `docs/json.md`, fonte instalada):
- o RPC do Pi não manda `runId`/`message.id` por evento de sessão;
  `toJsonEvent` remove o `message` cumulativo dos `message_update`;
- `abort` só responde depois de `session.abort()` → `waitForIdle()`: no
  contrato, o turno abortado termina (`agent_end`/`agent_settled`) antes da
  resposta de abort;
- no abort o agente emite o `message_end` do parcial antes de
  `turn_end`/`agent_end`.

**Correção** (`desk/src/turn-identity.cjs` + `desk/rpc.cjs` + `desk/src/chat.mjs`):
- a ponte abre a corrida em `agent_start` (`host-run-N`), fecha em
  `agent_settled` e **aposenta** os ids de ferramenta conhecidos
  (declaração/execução/`message_end`);
- pintura sem corrida aberta é atraso e **não é reencaminhada** (drain);
- pintura com id aposentado sai marcada `stale` (o renderer não pinta);
- o renderer usa `e.runId??e.hostRun` na guarda de geração e mantém uma segunda
  aposentadoria local dos ids do turno recolhido (`retiredTurnTools`);
- `message_end` atrasado com id aposentado LIMPA o bloco do delta atrasado
  quando o texto bate exato ou é sufixo — o fluxo novo não concatena;
- o delta sem id continua sendo o limite honesto do fio (não há o que atribuir):
  ele é reconciliado pelo `text_start` do host documentado ou pelo
  `message_end` atrasado acima. Não há carimbo ingênuo “corrida de agora” na
  chegada: sem corrida aberta o evento cai, e id aposentado é reconhecido.

**Evidência (Electron real, fixture sintética):**
- `/private/tmp/timeline-final-review/probe-variants.mjs` (probe do revisor,
  rerodado): `A lateLeakInTurn2: false`, `A deltaWindowLastText: "Fala da
  rodada 2."`, `A late1Slot: stopped`; `pageerrors: []`.
- `node tests/timeline-late.mjs`: 3 variações do N1 (com `text_start`; sem
  início, forma crua do probe; fala da 2 antes do delta atrasado) — slot da 1
  `stopped`, sem sobrescrita/fechamento da fala da 2, sem montagem de artefato
  atrasado, vivo×reload da última rodada iguais.
- `node tests/rpc.test.mjs` (caso novo): a ponte aposenta `t1` no settle e marca
  `message_end`/`tool_execution_end` atrasados como `stale`; só o delta sem id
  segue adiante (limite documentado).
- `node tests/turn-identity.test.mjs`: cercamentos, aposentadoria, drain, host
  legado sem `agent_start` e eventos de sessão intocados.

## N2 — P3 (fechado) — sem `contentIndex`, texto→ferramenta→texto duplicava

`assistantLoose` é uma fila FIFO dos balões abertos por delta SEM chave; o
`message_end` casa cada parte de texto com o balão certo na ORDEM (o primeiro
texto não cria uma segunda bolha; o segundo não adota a primeira). O contrato
com índice continua idêntico.

**Evidência**: `timeline-late` N2/N3 (vivo×reload) e o probe do revisor —
`B live texts: ["Fala da rodada 2.","Antes sem índice.","Depois sem índice."]`
(antes: `["Antes sem índice.","Antes sem índice.","Depois sem índice."]`).

## N3 — P3 (fechado) — dois `message_end` sem `message_start`

`message_end` sem id explícito rotaciona a identidade sintética quando a
anterior já terminou (`messageEnded`); id explícito (Claude) permanece
estável/deduplicado. Dois finais isolados ganham bolhas próprias e vivo×reload
coincidem.

**Evidência**: `timeline-late` N2/N3; probe do revisor —
`C live texts: [...,"Final isolado um.","Final isolado dois."]`.

## Verificação executada (tudo nesta rodada)

- `node tests/timeline-late.mjs` → **4 blocos PASS** (N1×3 + N2/N3).
- `node tests/timeline-noid.mjs` → **PASS**.
- `node tests/hunt-timeline.mjs` → `order` e `mixed` **PASSED**.
- `HUNT=worklog-history,worklog-live,worklog-live-text,abort,diary-error,
  diary-stop,thinking-open,quiz-edge,dialog-ui,history-images,diary-touched,
  quiz-focus,markdown node tests/hunt-chat.mjs` → **13 PASSED**.
- `node tests/hunt-shell.mjs pidialog` → **PASS** (host legado sem `agent_start`).
- `node tests/mesa-claude-activity-ui.mjs` → **PASS**;
  `node tests/worklog-parity.mjs` → exit 0.
- `node --test tests/timeline.test.mjs tests/timeline-adapter.test.mjs
  tests/worklog.test.mjs tests/worklog-view.test.mjs tests/claude-adapter.test.mjs
  tests/agent-history.test.mjs tests/agent-service.test.mjs
  tests/rpc-settled.test.mjs` → **126 pass / 0 fail**.
- `node --test tests/*.test.mjs` → **1195 pass / 0 fail**.
- `node tests/syntax-check.mjs` → 333 arquivos ok.
- Probe do revisor rerodado (acima; `pageerrors: []`). Nada de provedor real ou
  app instalado: runtime/fixture sintéticos e Electron.

## Limites honestos

- O delta atrasado SEM id continua não atribuível no fio quando chega depois do
  novo `agent_start`; o fecho vem do `text_start` (contrato) ou do `message_end`
  atrasado que cita a ferramenta aposentada. Isso não é carimbo ingênuo: a
  corrida fecha na fronteira e a identidade conhecida invalida.
- Se o atraso chegasse DEPOIS da mensagem nova E o `message_end` atrasado nunca
  chegasse, o sufixo ficaria até o `message_end` autoritativo do turno novo.
  Não é reproduzível no contrato (o abort emite o `message_end` do parcial).
- A prova é Electron real com runtime sintético: não prova inferência de
  provedor real nem o app instalado.

## Handoff

- Ownership liberado: `desk/rpc.cjs`, `desk/src/chat.mjs`,
  `desk/src/turn-identity.cjs` e os testes da timeline/rpc.
- `main.cjs` não foi alterado nesta rodada: a decisão de identidade ficou toda
  em `rpc.cjs`, sem precisar de pi-event/pi-prompt/pi-abort.
- Próximo passo: revisão independente nova sobre este diff, com foco em
  identidade/reconciliação sem `message.id`, no clear do `message_end` atrasado
  e no snapshot público.
