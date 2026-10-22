# Revisão independente residual — fechamento timeline/rpc (N1/N2/N3, objeções)

Data: 2026-10-08. READ ONLY no produto: nenhum arquivo/teste do produto foi
editado; nenhum commit/install/update, nenhum provedor real, nenhum dado pessoal,
nenhum app pessoal. O único artefato escrito é este relatório. Probes próprios em
`/private/tmp/timeline-residual-review/` (Electron real + `PiBridge` real com Pi
falso). Núcleo Bend, `chat/`, PDF e renderer de atividades NÃO foram revisados.

Escopo lido: `desk/src/chat.mjs`, `desk/rpc.cjs`, `desk/src/turn-identity.cjs`,
`desk/src/main.mjs` (leitura), `desk/main.cjs` (leitura), testes
`timeline-late/noid/hunt-timeline/mesa-claude-activity-ui`, `turn-identity.test.mjs`,
`rpc.test.mjs`, `rpc-settled.test.mjs`, `snapshot.test.mjs`, `worklog-parity`,
`hunt-chat` (13 blocos), `hunt-shell pidialog`, sidechat unit + ipc-smoke, e a
fonte instalada do Pi 1.1.0 (protocolo).

## Método (executado nesta rodada)

- Suíte focada: `timeline*`, `worklog*`, `claude-adapter`, `agent-history`,
  `agent-service`, `turn-identity`, `rpc`, `rpc-settled` → **138 pass / 0 fail**.
- Electron real: `timeline-late.mjs` (4 blocos PASS), `timeline-noid.mjs` PASS,
  `hunt-timeline.mjs` (order/mixed PASSED), `mesa-claude-activity-ui.mjs` PASS.
- `HUNT=worklog-history,worklog-live,worklog-live-text,abort,diary-error,diary-stop,
  thinking-open,quiz-edge,dialog-ui,history-images,diary-touched,quiz-focus,markdown
  node tests/hunt-chat.mjs` → todos PASSED. `hunt-shell pidialog` PASS.
- `worklog-parity` exit 0; `snapshot.test.mjs` PASS; `syntax-check` 333 ok;
  `sidechat*.test.mjs` 42 pass; `sidechat-ipc-smoke` SMOKE_OK.
- Probes originais rerodados: `probe-variants.mjs` (A `lateLeakInTurn2:false`,
  `duringLate.texts:[""]`, deltaWindow `"Fala da rodada 2."`; B/C coincidem vivo×reload
  no que a fixture não polui), `probe-noid.mjs` (4 cenários corretos),
  `probe-adapter-indexes.mjs` (`contentIndexes [[0,1],[2,3]]`).
- Probes próprios: `probe-residual.mjs` + fixture `pi-residual.mjs` (7 variações:
  janela do delta atrasado, texto igual/sufixo, sem end, sem delta, meio de stream,
  barreira `#stop`→settle→envio) e `probe-identity.mjs` (settle atrasado, retry vs
  novo `agent_start`, queda/reinício do filho, abort+p Prompt sem await).

## Veredito por achado

- **A (P1, root): confirmado.** `contentIndexes?.[i]??i` e a chave de delta por
  `ame.messageId` continuam de pé; integrado Claude e `timeline-adapter` passam.
- **B (Pi sem `message.id`): corrigido nos caminhos do contrato.** `timeline-noid`
  cobre deltas, só-final, end isolado, pensamento e duas mensagens; os probes
  originais mostram `['Primeira fala.','Segunda fala.']` e vivo×reload iguais.
- **C (código morto): resolvido.** `grep -n "turnGen\|assistantKeyFor\|trackStep"
  src/chat.mjs` → exit 1.
- **N2 (P3): corrigido nos caminhos testados.** texto→ferramenta→texto sem
  `contentIndex` reconcilia em ordem; `timeline-late` e probe original B
  (`Antes`/`Depois` sem duplicar) passam. Sem ressalva nova no contrato.
- **N3 (P3): corrigido.** Dois `message_end` sem `message_start` ganham bolhas
  próprias; vivo×reload iguais (probe C).
- **N1 (P2): fechado SOB O CONTRATO; ressalvas residuais com repro (R1–R4).**
  A proteção real não é o drain do host: é a fronteira `agent_settled` + o gate
  de `S.busy`. O Pi 1.1.0 emite o `message_end` do parcial antes do
  `agent_end`/`agent_settled` (`pi-agent-core/dist/agent-loop.js:142-150,325-332`;
  `core/agent-session.js:687-707,1909-1922`) e mantém `isStreaming` verdadeiro até
  o settle (`:1049-1054`); prompt durante a emissão do settle é adiado
  (`:1517-1519`). Logo, no contrato, nenhuma pintura antiga chega depois do
  `agent_start` novo. O `lateLeakInTurn2:false` do probe do autor é medido
  **depois** do `message_end` atrasado: o próprio probe registra
  `duringLate.texts:[""]` (bolha esvaziada) e a concatenação fica visível na
  janela anterior (medida própria ~0,5 s; ver R1/R2).

## Objeções do root

1. **Atribuição do delta anônimo à corrida nova / barreira real — procede como
   limite, não como bug de contrato.** O host não impede `pi-prompt` com `abort`
   pendente (`main.cjs:1649` é independente de `main.cjs:1569`; `#stop` em
   `src/main.mjs:223` despacha `desk-stop` e chama `abort` sem bloquear envio), e
   o RPC do Pi trata linhas de forma concorrente (`modes/rpc/rpc-mode.js:645`
   `void handleInputLine`; `case "abort"` em `:327` awaita `session.abort()`).
   Probe de barreira: `#send.disabled=true` logo após o Parar; settle em 197 ms,
   **prompt novo escrito em 237 ms, resposta do abort em 817 ms** (pedido normal
   `steer=followUp`). O que impede a corrida nova de nascer antes do settle não é
   o transporte: é o `isStreaming` do Pi (steer/followUp enfileira) + o defer do
   settle. O drain sozinho NÃO fecha o delta anônimo; sem `message_end` atrasado
   ele persiste (R2 `sem-end`). Correto documentar como garantia dependente da
   versão/contrato do Pi, não como ordenação do host.
2. **`clearLateEndText` apaga texto legítimo — reproduzido (R1).** Igualdade/
   sufixo de texto não é prova de identidade: com o `message_end` atrasado
   chegando sem o delta atrasado correspondente, o bloco do turno NOVO é apagado
   (`sem-delta-igual`: vivo `''` × reload com a fala) ou truncado
   (`sem-delta-sufixo`: vivo `"Introdução nova."` × reload completo), e no meio
   do stream o prefixo some (`sem-delta-igual-cont`: vivo `"Mais texto."` × reload
   `"Fala atrasada da rodada 1. Mais texto."`). Só alcançável no regime de
   protocolo violado (é exatamente o regime em que `clearLateEndText` roda —
   `chat.mjs:1181-1185`); no contrato o parcial chega antes do settle e cai em
   `turnClosed`. Ainda assim é risco real do fallback, com repro.
3. **`agent_settled` atrasado fecha a corrida ativa — comportamento do host
   confirmado, não alcançável no contrato.** Unidade: `agent_start` A, `agent_start`
   B, settle (da A) → settle sai carimbado com a corrida B e a pintura seguinte é
   descartada (`lateSettleClosesNewRun`). No Pi real isso não ocorre: o settle é
   o último evento da corrida e `_isAgentRunActive=false` só acontece nele, então
   a corrida nova só começa depois. Vale para host não conforme (fixtures, Pi
   antigo/terceiro).
4. **IDs aposentados: retry no mesmo turno ok; reuso após reinício é dropado
   (R3).** `auto_retry` sem novo `agent_start` não invalida (`retryStale:false`);
   steer/corte (novo `agent_start` sem settle) invalida (`afterNewStartStale:true`).
   Mas `identity` sobrevive a queda do filho: após o crash `{run:"host-run-1",
   open:true, retired:[]}`; no reinício no MESMO `PiBridge`, `agent_start` aposenta
   `t1` e a declaração nova de `t1` sai `stale:true` (renderer descarta). Mesmo
   padrão no renderer: `retiredTurnTools` (`chat.mjs:634,1014-1019`) nunca é
   limpo na troca de conversa (teto 256). Premissa de unicidade de id entre
   corridas — verdadeira nos provedores usuais, não garantida.
5. **Snapshot/núcleo: ok com ressalva de arquitetura.** `snapshot.test.mjs` copia
   `src/turn-identity.cjs` e PASS; `rpc-settled`/`worklog-parity` ok. A decisão de
   identidade mora em `src/turn-identity.cjs` (host puro, sem lei/prova Bend),
   embora `rpc.cjs` seja coberto por `core/rpcstate.bend`; e a mudança é global a
   todo `PiBridge` — `sidechat-engine.cjs:16,25` usa a mesma ponte, e
   `src/sidechat.mjs` não lê `stale`/`hostRun` (testes sidechat passam, mas o
   descarte/`stale` só é consumido pelo renderer do chat principal).

## Pontos novos do root (verificados)

- **Barreira `#stop`/abort:** confirmada a ausência de serialização host
  (`pi-abort` = `clear_queue` → `abort`, sem relação com `pi-prompt`); o gate é
  `S.busy` (`state.mjs:410` desabilita `#send`) + `chat.mjs:284`. O composer é
  liberado no `agent_settled`, que precede a resposta do abort (probe: 197 ms ×
  817 ms). O caminho ⌘⏎ steer pode escrever antes do `clear_queue`; no Pi isso
  enfileira (não inicia corrida), mas pode ser limpo pelo próprio `clear_queue` —
  nota pré-existente do `pi-abort`, fora deste diff, não reproduzida aqui.
- **`rpc.identity` sem reset em `start/fail/stop`:** procede como observação (R3).
  `stop()` na `main` descarta a ponte (`stopBridge` → `bridge=null`), então o
  caminho vivo é o crash (`ActExit` → `fail()`), que preserva `open/run/retired`.
  Sugestão de produto (não executada): resetar no `fail()`/spawn e limpar
  `retiredTurnTools` na troca de conversa, ou carimbar corrida no fio quando o Pi
  oferecer — hoje a fronteira é o contrato.

## Achados residuais (repro em `/private/tmp/timeline-residual-review/`)

- **R1 — P3 — `clearLateEndText` apaga/trunca fala legítima do turno novo.**
  `chat.mjs:725-746`; probas `sem-delta-igual`, `sem-delta-sufixo`,
  `sem-delta-igual-cont`. Só no regime não-contratual (stale end depois do novo
  turno), mas com perda visível e divergência vivo×reload.
- **R2 — P3 — delta anônimo pinta na corrida nova até o end atrasado.** Medido na
  forma do probe do autor: `"Fala da rodada 2.Fala atrasada da rodada 1."` visível
  de ~1476 ms a ~1951 ms; sem o end (`sem-end`), permanece até o reload. Contrato
  impede; o fallback depende do end.
- **R3 — P3 — ledger de ids aposentados sobrevive a reinício/crash e a troca de
  conversa; id reusado em corrida nova é descartado (`stale`).** `rpc.cjs:43,88`;
  `turn-identity.cjs:retire`; `chat.mjs:634`. Retry no mesmo turno não é afetado.
- **R4 — P3 — settle atrasado fecha a corrida ativa no host** (sem id de corrida
  no fio). `turn-identity.cjs` (agent_settled sempre fecha); não alcançável no
  contrato atual do Pi.
- **R5 — P3 — identidade fora do núcleo e efeito global na ponte.** Sem lei/prova
  Bend para o drain/stale; sidechat não consome os campos novos.

## Limites desta rodada

- Sem provedor real, sem app instalado e sem suíte completa (domínio de atividades
  em mutação). Prova = Electron real + runtime sintético + fonte instalada do Pi
  1.1.0; nada aqui prova inferência real nem o app empacotado.
- Não revisados: renderer de atividades, PDF, núcleo Bend, backup/exportação,
  `chat/` (app Conversa) e agentes fora da timeline.
- Rodar testes criou diretórios `.test-runtime-*`/artifacts ignorados; nenhum
  arquivo versionado do produto foi alterado.

## Handoff

Ownership liberado (`chat.mjs`, `rpc.cjs`, `turn-identity.cjs`, testes da timeline/rpc).
N1 fecha sob o contrato do Pi; R1–R5 ficam como risco residual não-contratual, sem
inventar portão verde para o regime de protocolo violado. Nenhuma edição de produto feita.
