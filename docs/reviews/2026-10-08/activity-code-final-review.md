# Revisão independente final — atividades interativas (domínio + integração)

Data: 2026-10-08. **READ ONLY**: nenhum arquivo do produto/testes foi editado;
o único arquivo escrito foi este (ownership da revisão). Probes e logs próprios
em `/private/tmp/mesa-activity-final-probe/`; probe3 do revisor anterior
re-executado. Revisados os hashes de `activity-review-fixes.md`:
`activity-runtime.cjs d670afdc`, `activity-store.cjs 4cf5a28c`,
`activity-bridge.cjs d3f69ed8`, `activity-host.cjs a2edd4c8`,
`src/activity.mjs 8e323e8f`, `activity-call-gate.cjs cc81b9c3`,
`activity-tools.cjs 8a033d6e`, `mesa-activity/index.ts a00af900`,
`client.mjs a679cfd4`, `preload.cjs 3bf372ff`, `main.cjs 2b007268`,
`src/main.mjs 49524141` — todos conferidos no disco. Timeline/PDF/core fora do
escopo. Ambiente: Electron 44.2.0 / Chromium 152 / macOS, tudo sintético, sem
provedor autenticado, sem app pessoal, sem dados pessoais.

## Método (medido)

- `node --test` focado (store, runtime, bridge, call-gate, dual-SDK, host,
  process-guard, backup): **35/35**.
- Hunts do autor reexecutados: `hunt-activity-isolation` **PASS** (28 vetores,
  0 FAIL), `hunt-activity-watchdog` **PASS** (13 asserts), `hunt-activity-ui`
  **PASS** (51 asserts).
- Integrados: `native-activity-tool.mjs` PASS (SDK Pi real, sem inferência);
  `mesa-interactive-ui.mjs` PASS (main/preload/ponte reais, MRUV a4/24m,
  reload lazy restaura estado, laço + Parar, escopo antigo recusado);
  `mesa-claude-activity-ui.mjs` PASS (hook nativo, MCP oficial, quadros
  intercalados).
- Probes próprios com o wrapper/runtime reais: `probe-main` (16 vetores),
  `probe2` (sinks/revisões), `probe4` (egress do filho), `probe3-revision`
  (renderer real via harness ui-main), `probe-store`, `probe5-watchdog`
  (injeção de falha), `probe6-backup`. `probe3-main.cjs` do revisor anterior:
  `udp 0`, só host+artefato.

## Resultado por achado R4

1. **P1 WebRTC por `srcdoc` — NÃO FECHADO.** A rota original (28 vetores)
   está fechada: `probe3` anterior reexecutado dá UDP 0 e o hunt de isolamento
   passa. Porém uma **rota nova** reabre exatamente o mesmo impacto (ver novo
   achado P1 abaixo), com o `js` do modelo e sem ação do aluno.
2. **P1 watchdog com processo compartilhado — fechado no caminho pretendido,
   com ressalva P2.** Sem falha de enumeração, o kill só ocorre com todos os
   frames do pid confirmados travados; 3 atividades/1 OOPIF, laço, Parar →
   pid some, host/IPC responsivos, atividade nova monta (hunt reexecutado).
   Em injeção de falha na enumeração o guard fica **fail-open** (novo P2).
3. **P2 quota no Reiniciar — fechado.** `mount()` chama `stopFrame(ctl)` antes
   de `enforceMountBudget` (`src/activity.mjs` ~455); hunt 7e confirma 3 cards,
   Reiniciar no do meio e os outros dois iframes preservados.
4. **P2 envelope 16 KiB + 4 KiB — fechado.** `probe-store`: values 13.000 B +
   attempt 3.500 B (envelope ~16,5 KiB) grava e lê; >16 KiB/>4 KiB/>21 KiB
   rejeitam com `TOO_BIG`; estado legado com chaves fora do envelope continua
   legível; `probe6`: round-trip de backup preserva 13.000 B + 3.500 B. O
   renderer mostra erro visível em vez de `dirty=false` silencioso.
5. **P3 geração/`getScope` — fechado.** `refreshScope` prefere
   `desk.activityScope()` (geração + `scopeRef`) e só mescla o síncrono da
   MESMA conversa; `handleActivityEvent` revalida geração/`scopeRef`; o host
   revalida `scopeRef` em read/state. Hunt 10b (mesma conversa, geração
   antiga) passa.
6. **P3 `request-state`/`stop` — fechado.** `stop` é enviado antes de remover o
   frame (best-effort, `stopFrame`); `request-state` saiu dos guias; docs
   alinhadas (init/theme/stop host→artefato).
7. **P3 revisão `activityId` — fechado.** `probe3-revision` (11 asserts):
   v2 no MESMO id, v1 intacto (título/URL `/1/`/hash), runtime serve as duas,
   card v2 liga `/2/` com spec v2, estado por `id@v@hash` não se mistura,
   hash antigo dá `STALE`, id de outra conversa dá `MISSING`. Schemas Pi/Claude
   aceitam `activityId`; `pickPayload` inclui no `paramsHash`; gate recusa
   troca após a reserva (teste unitário).
8. **P3 dois payloads idênticos com IDs nativos distintos — fechado.**
   `activity-dual-sdk-gate.test.mjs` (executado): dois `tool_use_id` reais,
   payload idêntico, `callRef` do modelo substituído, dois itens com os IDs
   nativos corretos e dois documentos servíveis.

## Novos achados

### P1 — Declarative Shadow DOM por `setHTMLUnsafe`/`parseHTMLUnsafe` reabre o filho sem lockdown (UDP/STUN)

Repro (todos com o wrapper e o runtime REAIS, `probe-main`/`probe2`/`probe4`):
o `js` do modelo faz `elemento.setHTMLUnsafe('<div><template shadowrootmode=open><iframe srcdoc="…"></iframe></template></div>')`
(ou `Document.parseHTMLUnsafe`, ou `setHTMLUnsafe` em documento inerte de
`createHTMLDocument`/`ShadowRoot`). O sanitizador/`trustedTypes` default
**preserva** `shadowrootmode` e o `<iframe srcdoc>` (o `cleanTree` não desce em
`template.content`; `sanitizedDSD`: `hasShadow:true, hasIframe:true`), e o sink
reparseia criando um shadow root com iframe vivo. A inserção escapa do
`unsafeSubtree`, que não atravessa shadow roots. O filho `about:srcdoc` não
recebe o `LOCKDOWN_SCRIPT`: `typeof RTCPeerConnection === 'function'`,
`setLocalDescription` e **5 datagramas UDP** para STUN local por vetor
(`dsd-setHTMLUnsafe`, `dsd-shadowRoot-setHTMLUnsafe`,
`static-parseHTMLUnsafe`, `createHTMLDocument-setHTMLUnsafe`,
`setHTMLUnsafe-policy-kstring`). Controles fechados e com 0 UDP:
`srcdoc` por propriedade/`innerHTML`/`insertAdjacentHTML`, `setHTML` (sanitizer
embutido), `template.content`, e o positivo cru do host (5 UDP), que valida o
detector. HTTP do filho segue bloqueado por CSP herdada (`probe4`:
`childHttp {}`, fetch/XHR bloqueados; beacon devolve `true` mas 0 hits), então
o vetor concreto é RTC/UDP — o mesmo gate "zero saída" do R4 (viola Gate A).
Causa no código: `activity-runtime.cjs` não neutraliza `setHTMLUnsafe`,
`parseHTMLUnsafe` (estático de `Document`) nem `ShadowRoot.setHTMLUnsafe`;
`unsafeSubtree`/`cleanTree` (l.189–211) não percorrem `template.content` nem
shadow roots; só `srcdoc` é removido, nunca `shadowrootmode`.
Direção: bloquear/neutralizar esses sinks (não configuráveis), remover
`shadowrootmode`/`shadowrootdelegatesfocus`/`shadowrootclonable` no sanitizador
e recusar `template` com esses atributos em toda inserção; adicionar os cinco
vetores ao `hunt-activity-isolation` (o teste de 28 vetores não os cobre).

### P2 — Falha na enumeração de frames libera kill compartilhado (fail-open)

`framesOn` engole erro de enumeração (`activity-runtime.cjs:616 catch {continue}`,
sem retorno "desconhecido") e `terminateEntry` chama
`canTerminateActivityProcess(..., livePids: [])` (l.633), portanto `others=[]`
pula a exigência "todos travados" (l.635) e mata com motivo
`detached-unresponsive` mesmo havendo frame vivo. Repro `probe5` (fixture do
autor + injeção sintética de falha): A e B no mesmo OOPIF; `executeJavaScript`
falha só para B (frame parado, A saudável) → guard recusa o kill (controle:
pid vivo, 2 frames; nenhum evento `kill`); com `getAllWebContents` lançando
(simulando o "Render frame was disposed before WebFrameMain could be accessed"
que o próprio ambiente emitiu após o kill real) o tick mata o pid
`reason:detached-unresponsive`, com A saudável dentro; `mainPid` (90484) ≠ pid
morto (90486) e host responsivo — o dano é a atividade saudável, não o host.
O erro real de enumeração aparece naturalmente após SIGKILL
(`framesInSubtree` lança) e o código o engole. Direção: enumerar é obrigatório
para decidir; qualquer exceção ⇒ recusar (fail closed) e não passar
`livePids: []`; opcionalmente registrar `kill-failed` também no caminho vivo
(hoje só o destacado loga, então uma recusa é invisível).

### P3 — `onWatchdog` não ligado ao renderer

`main.cjs:705` cria o runtime sem callback (`createActivityRuntime({store})`);
o R5 já registrava que vizinhos de um kill compartilhado ficam em erro até
Reabrir/Reiniciar. Confirmado por leitura; a clareza para o aluno ("Parar" nas
outras atividades) depende de encaminhar o evento. Cosmético/UX, sem risco de
segurança.

## Itens pedidos pelo root

- **Revisão v1/v2/card/tools**: coberto no resultado 7; o card v1 conserva
  hash/runtime e o v2 nasce novo. Backup/restore com os tetos: coberto no 4.
- **ID nativo duplicado**: prova exata no teste dual (resultado 8) + integrado
  Claude (hook ID nativo).
- **Offline/isolamento**: 0 HTTP em todos os probes; zero UDP exceto pela rota
  DSD (P1); KaTeX offline no integrado; sandbox só `allow-scripts`;
  `trustedMainSender` exige `senderFrame === mainFrame` (artefato não fala
  IPC); `frame-src mesa-activity:` no index; protocolo só serve publicado e
  KaTeX por lista fixa.
- **Capacidade livre preservada**: DOM/SVG/canvas/template/`insertAdjacentHTML`
  legítimos passam; breakout de `</script>`/CSS não ocorre (literal 9,
  CSS aplicado, sem `cssBroke`).

## Limites honestos

- Só macOS/Electron 44.2/Chromium 152, servidores UDP/HTTP locais sintéticos;
  Windows/Linux não medidos (o vetor DSD+RTC é comportamento de plataforma web
  do Chromium, provável em Windows, mas não foi medido lá).
- O P2 usa injeção de falha sintética determinística (throw por frame e throw
  na enumeração); não foi observado em uso real — o texto do erro de enumeração
  apareceu naturalmente só depois do kill.
- O contador TCP de `preconnect` não teve controle positivo válido (host não
  preconnectou), então "0 conexões" do artefato é inconclusivo e não virou
  achado; a matriz HTTP tem positivo (`/host-positive`) e zerou.
- Não rodei a suite completa (instrução: mutações em voo; havia artefatos de
  timeline de outro agente no repo). Foco nos testes acima + adversariais.
  O root ainda deve rodar a suite geral depois de congelar os arquivos.
- Nada disso prova inferência real, app instalado ou correção pedagógica.

## Veredito

**Gate A (zero egress/superfície inline) FALHA hoje** por causa do P1 de DSD:
o R5 fechou os 28 vetores que testou, mas não a classe do achado original —
um filho sem lockdown ainda é criável e emite UDP/STUN, agora por sinks que o
autor não neutralizou. É correção pequena e verificável (bloquear os sinks +
travar `shadowrootmode` + percorrer `template.content`/shadow roots), com os
cinco vetores novos no hunt. Os demais achados R4 estão fechados; restam o
fail-open P2 do watchdog e a UX P3. Recomendo não fechar a entrega de atividade
executável antes desses dois primeiros. Ownership desta revisão liberado.
