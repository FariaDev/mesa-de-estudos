# Correções finais de segurança/identidade da timeline (R1–R5) — 2026-10-08

- **Entradas**: revisão residual independente
  ([timeline-code-residual-review.md](timeline-code-residual-review.md), R1–R5) e
  decisão do root. READ ONLY em `core/`, PDF, atividades, `main.cjs` e `chat/`.
  Produto tocado só dentro do escopo: `desk/src/chat.mjs`, `desk/rpc.cjs`,
  `desk/src/turn-identity.cjs` + testes da timeline/rpc.
- **Estado**: implementado e provado localmente. Nada commitado, instalado,
  publicado nem aberto no app pessoal; nenhum provedor real, nenhum dado
  pessoal; baseline sujo preservado. Prova = Electron real + runtime/fixture
  sintéticos + fonte instalada do Pi 1.1.0.

## Decisão aplicada (o que mudou)

1. **Removido `clearLateEndText` e QUALQUER remoção por igualdade/sufixo de
   texto.** Identidade sozinha autoriza descartar evento conhecidamente
   aposentado; texto nunca prova posse. O end antigo é descartado sem tocar no
   bloco: fala nova igual/sufixo fica intacta.
2. **`turn-identity.cjs` ganhou `reset()`**: limpa corrida/ledger do processo
   que morreu SEM reiniciar o contador (`host-run-N` continua monotônico);
   `PiBridge.start()` chama o reset ao subir processo novo no MESMO bridge
   (queda/reconexão), então id nativo reusado não nasce `stale` por engano.
3. **Renderer**: `retiredHostRuns` (carimbo `hostRun`/`runId` conhecido morto é
   descartado, inclusive na janela entre Parar e `agent_start` novo) +
   `retiredTurnTools` (ids nativos). Os dois ledgers são zerados em troca real
   de conversa e em recarga de histórico (`showHistory`/`desk-conversation-changed`);
   Parar na MESMA conversa mantém a proteção (nada é limpo por turno novo).
4. **Barreira de abort no host**: NÃO implementada (exigiria `main.cjs`; sob o
   contrato do Pi `S.busy`/`isStreaming` já bastam). Evidência abaixo.

## Resposta R1 — heurístico apagava fala legítima (fechado)

Antes: `message_end` atrasado do turno 1 (id aposentado) limpava o bloco do
turno 2 quando o texto batia exato ou era sufixo; sem delta atrasado, apagava/
truncava fala legítima.

Agora: o end aposentado sai `stale` do host (`turn-identity.cjs`) e o renderer o
descarta por IDENTIDADE; nenhum texto é comparado. Probe independente do revisor
rerodado (`/private/tmp/timeline-residual-review/probe-residual.mjs`):

| variante | antes (revisor) | agora |
|---|---|---|
| `sem-delta-igual` | vivo `''` × reload fala | **vivo = reload = fala; `liveAltered:false`** |
| `sem-delta-sufixo` | vivo truncado × reload completo | **vivo = reload = completo; `liveAltered:false`** |
| `sem-delta-igual-cont` | vivo `" Mais texto."` × reload fala+texto | **vivo = reload = fala+texto; `liveAltered:false`** |

Teste do repo: bloco `timeline-residual {igual,sufixo,cont}` em
`tests/timeline-late.mjs` (fala nova igual/sufixo; end atrasado DEPOIS do fim
autoritativo; `cont` no meio do stream) — 3 PASS, vivo × reload iguais.

## Resposta R3 — ledger sobrevivia a reconnect e troca de conversa (fechado)

- Host: `identityAcrossCrash` (probe-identity rerodado) → reinício no MESMO
  bridge: `run2Stale:false`, `run2HostRun:"host-run-2"`, ledger do processo morto
  limpo. Teste `rpc.test.mjs` “reinício no MESMO bridge não herda ids
  aposentados (R3)” cobre queda real (`process.exit(9)`) + id `t1` reusado.
- Unit: `turn-identity.test.mjs` cobre `reset()` (ledger limpo, contador
  preservado) e retry DENTRO do mesmo turno (mesmo id não invalida; corte sim).
- Renderer: troca REAL de conversa (`#new-session`) reusa `duo-a`/`duo-b` na
  conversa B e os slots pintam (bloco `timeline-residual R3` em
  `timeline-late.mjs`); sem o reset o `retiredTurnTools` descartaria as
  declarações.

## Limites honestos (não fechados de propósito)

- **R2 (delta anônimo fora do contrato)**: um `message_update` de texto SEM id
  que chega depois do `agent_start` novo é indistinguível no fio; NÃO se
  reinventa heurística. O host carimba a corrida aberta (`hostRun`) e o texto se
  reconcilia no `text_start`/`message_end` autoritativos (contrato do Pi 1.1:
  parcial termina antes do settle; `isStreaming` segura a corrida nova; prompt é
  adiado). Fora do contrato o probe mostra o vazamento transitório:
  `controle/igual/sufixo/sem-end` com `liveAltered:true` (concatenação visível
  até o reload). Nada de verde artificial para o regime violado.
- **R4 (settle atrasado fecha a corrida ativa)**: sem id de corrida no
  `agent_settled`, o host não atribui um settle atrasado; probe-identity:
  `lateSettleClosesNewRun` = `{beforeRun:"host-run-2", settleRun:"host-run-2",
  afterRun:"dropped"}` — comportamento mantido e documentado (não alcançável no
  contrato do Pi).
- **R5 (identidade fora do núcleo Bend)**: `turn-identity.cjs` é host puro, sem
  lei/prova Bend (não se inventou portão verde); a mudança é global a todo
  `PiBridge`, inclusive `sidechat-engine.cjs`, que não consome `stale`/`hostRun`.
  Regressão verificada: sidechat 41 pass + `sidechat-ipc-smoke` SMOKE_OK.
- **Barreira de abort (opcional)**: o probe mostra `settledBeforeSend:true`,
  `abortRepliedBeforeSend:false` (settle 188 ms, prompt 227 ms, resposta do abort
  808 ms; `promptWhileAbortPending:true`); as linhas do RPC são concorrentes. Não
  se mexeu em `main.cjs`: sob o contrato atual `S.busy`/`isStreaming` bastam, e a
  barreira NÃO identificaria o delta anônimo sintético depois do abort completo.

## Preservado (revalidado)

- A (Claude `contentIndexes`), B (Pi sem `message.id`), C (código morto) e
  N2/N3: intactos.
- `timeline-noid.mjs` PASS; `timeline-late` N2/N3 PASS; `hunt-timeline` PASS;
  quiz, slots estáveis, ordem cronológica e vivo×reload das falas seguem.
- `mesa-claude-activity-ui.mjs` PASS (frames Claude interleaved + contentIndexes).
- `snapshot.test.mjs` PASS (o helper continua copiando `src/turn-identity.cjs`).

## Fatos de teste desta rodada

- `node --test tests/*.test.mjs` → **1198 pass / 0 fail** (antes 1195; +3 novos).
- `node tests/timeline-late.mjs` → N1×3 (contrato/sem início/fala cedo) +
  R1×3 + N2/N3 + R3 = **8 blocos PASS**. O N1 agora afirma o contrato
  parada→settle→envio novo ANTES da resposta do abort (fixture atrasa a resposta
  e marca `.abort-replied`) e os casos fora do contrato afirmam o limite
  (concatenação transitória + end autoritativo vence; nada de “limpeza”).
- `node tests/timeline-noid.mjs` PASS; `hunt-timeline` order/mixed PASSED;
  `hunt-shell.mjs pidialog` PASS.
- `HUNT=worklog-history,worklog-live,worklog-live-text,abort,diary-error,
  diary-stop,thinking-open,quiz-edge,dialog-ui,history-images,diary-touched,
  quiz-focus,markdown node tests/hunt-chat.mjs` → 13 PASSED.
- Suíte focada (timeline/worklog/claude/agents/rpc/turn-identity/rpc-settled) →
  141 pass / 0 fail; `worklog-parity` exit 0; `syntax-check` 333 ok.
- Probes do revisor rerodados: `probe-identity.mjs` (acima) e
  `probe-residual.mjs` (tabela R1 + R2 honesto; `errors:[]`).
- Sem provedor real/app instalado; runtime/fixture sintéticos. PDF, atividades,
  núcleo Bend, `main.cjs` e `chat/` não foram tocados.

## Handoff

- Ownership liberado: `chat.mjs`, `rpc.cjs`, `turn-identity.cjs` e testes da
  timeline/rpc.
- Pendente para o root: revisão independente de fechamento sobre este diff.
