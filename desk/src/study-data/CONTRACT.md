# Ferramentas de estudo — contrato de integração (estatísticas + Revisar hoje)

Documento de apoio ao integrador (`main.cjs`, `preload.cjs`, `src/main.mjs`).
Os módulos abaixo já estão implementados e testados. O que o pai JÁ ligou:
`core/build.mjs`, `core/PROOF.bend`, `preload.cjs` (chaves), `main.cjs`
(handlers) e `desk/src/study-data/services.cjs` (adapter). O que falta está em
"Pendências do integrador".

## Arquivos

| Arquivo | Papel |
|---|---|
| `core/studystats.bend` + `core/laws/studystats.bend` + `core/proofs/studystats.bend` | Regras de tempo ativo, dia/fuso, período, tokens, prompts e rótulos. |
| `core/reviewschedule.bend` + `core/laws/reviewschedule.bend` + `core/proofs/reviewschedule.bend` | Intervalo simples por resultado, próxima data, vencido, histórico, identidade e referência visível. |
| `desk/src/study-data/statistics.cjs` | Store `runtime/study-stats.json`: batimento, pergunta aceita, tokens, ciclo de vida, timer de sessão, resumo 7/30/tudo, reset. |
| `desk/src/study-data/review-schedule.cjs` | Store `runtime/review-schedule.json`: migração do caderno, id estável, agendamento, histórico, estado da referência. |
| `desk/src/study-data/services.cjs` (do integrador) | Adapter: resolve runtime/matéria/biblioteca e fixa o escopo. Não amplia acesso pelo payload. |
| `desk/src/study-stats.mjs` | Painel independente: `initStudyStats({state, host})` cria botão + `<dialog>` acessível; não toca no shell. |
| `desk/src/review.mjs` | Aba Caderno ganha o painel "Revisar hoje" dentro de `#review-view`, usando `studyReviewToday`/`studyReviewGrade`. |
| `desk/review.cjs` | `annotateVisibility(items, allowed, exists)` — troca o filtro por anotação. |

## Geração (já feita pelo pai)

`core/build.mjs` inclui `studystats.bend` e `reviewschedule.bend`;
`core/PROOF.bend` importa as duas provas; `desk/src/generated/studystats.core.js`
e `desk/src/generated/reviewschedule.core.js` estão gerados. Os host modules
aceitam `MESA_STUDYSTATS_CORE` / `MESA_REVIEWSCHEDULE_CORE` para builds
temporários (é o que os testes usam); sem nenhum dos dois, a primeira chamada
falha com mensagem clara.

## IPC (já no preload)

```
studyReviewToday()                        -> {items, summary}
studyReviewGrade({id, result})            -> {item, explain, nextDue, nextLabel}
studyStatsSummary({period, courseId})     -> statistics.summary(...)
studyStatsControl({action, courseId})     -> estado do timer
studyStatsReset({confirm:true})           -> reset consciente
```

`main.cjs` já registra `study-review-today`, `study-review-grade` e
`study-stats-*` via `createStudyServices(...)`. O renderer **não manda
caminho**: o adapter resolve `runtime`, `exists` e a biblioteca (`allowed`) do
host; payload nunca amplia acesso. Os nomes `studyStatsSummary` /
`studyStatsControl` / `studyStatsReset` / `studyReviewToday` /
`studyReviewGrade` são os que `study-stats.mjs` e `review.mjs` procuram.

## Pendências do integrador

### 1. Batimento e eventos (main.cjs)

`services.cjs` já expõe o que falta ligar:

```js
studyServices.beat(visible)               // batimento: liga o timer com a janela à vista (#70), salvo pausa do aluno
studyServices.lifecycle(kind)             // 'freeze'|'suspend'|'resume'|'hide'|'show'
studyServices.accepted({id,engine,model}) // mensagem do usuário ACEITA
studyServices.usage(payload)              // {id, input, output, cache, engine, model} do provedor
```

Sugestão de ligação no `main.cjs`:

```js
let heartbeat=0;
setInterval(()=>{
 heartbeat++;
 studyServices.beat(!!win&&win.isVisible()&&!win.isMinimized());
},30_000).unref?.();
powerMonitor.on('suspend',()=>studyServices.lifecycle('suspend'));
powerMonitor.on('resume',()=>studyServices.lifecycle('resume'));
powerMonitor.on('lock-screen',()=>studyServices.lifecycle('freeze'));
powerMonitor.on('unlock-screen',()=>studyServices.lifecycle('resume'));
win?.on('hide',()=>studyServices.lifecycle('hide'));
win?.on('show',()=>studyServices.lifecycle('show'));
```

`accepted` deve ser chamado no ponto em que a mensagem do usuário é ACEITA
(depois do aceite do transporte; recusa e reenvio duplicado ficam fora —
`statistics.cjs` já descarta por `addsPrompt` e pelo id). `usage` deve ser
chamado quando o provedor informar tokens; provedor que não informa não chama
nada e o painel mostra `indisponível`.

O renderer não manda visibilidade: o host sabe (janela, `powerMonitor`). Estudar
no Xournal++ com a janela da Mesa visível conta; esconder ou suspender não conta.

### 2. UI (src/main.mjs)

```js
import {initStudyStats} from './study-stats.mjs';
initStudyStats({state:S,host:window.desk});
```

O botão "Estatísticas" (canto inferior direito, 18 px da borda) aparece sozinho,
com painel acessível, período 7/30/tudo, filtro por matéria, gráfico simples com
legenda, controles de sessão e reset consciente. O painel "Revisar hoje" entra
na aba Caderno automaticamente quando `window.desk.studyReviewToday` existe (hoje
já existe): fica no topo de `#review-view`, com a fila do dia, os quatro
resultados, Semelhante/Tentar de novo (só preenchem o `#prompt`) e o histórico.

### 3. Referência fora da biblioteca (main.cjs)

`reviewPayload()` preserva todos os itens e anota o estado da referência:

```js
function reviewPayload(){
 return review.annotateVisibility(review.readItems(runtime,courseId),allowed);
}
```

O item fora da biblioteca continua na lista com `refState`; o Caderno e o painel Revisar hoje mostram o aviso. A regressão em `core.test.mjs` verifica preservação e edição desses itens.

## Regras de segurança

- O renderer nunca informa `runtime`, caminho de PDF, `exists` ou `allowed`.
  Toda string é cortada, todo número é inteiro ≥ 0.
- Evento retroativo sem `evidence` é recusado (`rejected:'retroactive-without-evidence'`).
- Reset exige `confirm:true`; resultado de revisão inválido é recusado no host.
- Escrita atômica (`tmp` + `rename`); leitura tolerante (arquivo corrompido vira
  store vazio). Nenhum módulo novo abre socket.

## Limites conhecidos

- Viagem de fuso: cada evento grava o dia local do momento; ler num fuso mais a
  oeste pode deixar o dia gravado "à frente" do dia local atual e fora das
  janelas 7/30/tudo até virar o dia. O caso normal (mesmo fuso) não tem esse
  efeito.

## Testes focados

```sh
cd desk
node --test tests/study-stats.test.mjs             # tempo, dedupe, fuso, tokens, reset
node --test tests/review-schedule.test.mjs         # migração, id estável, agenda, histórico
node --test tests/study-services.test.mjs          # adapter do host ponta a ponta
node --test tests/study-stats-ui.test.mjs          # painel, gráfico, timer, reset (DOM de mentira)
node --test tests/review-visibility.test.mjs       # item fora da biblioteca não some
node --test tests/study-history-retention.test.mjs # sessão >7 dias continua no Pi/Conversa/Mesa
node tests/hunt-review-today.mjs                   # "Revisar hoje" na janela real (barra de ferramentas)
node tests/hunt-study-stats.mjs                    # painel de estatísticas na janela real
node tests/hunt-review.mjs                         # Caderno existente intacto
```

Provas do núcleo (rodam no portão do pai):

```sh
cd core && BEND_NO_TELEMETRY=1 bend proofs/studystats.bend
cd core && BEND_NO_TELEMETRY=1 bend proofs/reviewschedule.bend
```
