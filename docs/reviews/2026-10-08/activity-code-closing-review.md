# Revisão de fechamento — atividades R6 (DSD + watchdog fail-open)

Data: 2026-10-08/09. **READ ONLY no produto**: o único arquivo escrito foi este.
Probes e logs próprios em `/private/tmp/mesa-activity-closing-review/`; antes do
R6 lido de `/private/tmp/mesa-activity-dsd-watchdog-fixes/probe2-before.json` e
`/private/tmp/mesa-activity-final-probe/result-dsd-confirmed.json`. Timeline,
PDF e core fora do escopo. Ambiente: macOS 27.0.1 (26A434, arm64), Electron
44.2.0 / Chromium 152.0.7977.76, tudo sintético, sem provedor/app instalado.

## Escopo de arquivos conferido

Os 7 hashes do handoff batem byte a byte no disco **antes e depois** dos testes:
`activity-runtime.cjs 30ed3661…e296`, `hunt-activity-isolation.mjs db56b3bd…7a1a`,
`isolation-main.cjs 9f7a6094…b706a0`, `hunt-activity-watchdog.mjs 8b6d43b9…c8067`,
`watchdog-main.cjs d3ae2242…fe9f4`, `activity-runtime.test.mjs 4281b574…db7d`,
`activity-process-guard.test.mjs be402a08…1a6653`. Mtimes: só esses 7 têm
mtime ≥ 23:49 (R6); store/bridge/host/`src/activity.mjs`/tools/preload/main e
demais testes seguem os da R4/R5 (22:2x). Nada mais do domínio foi tocado.

## Método executado (medido, não inferido)

- `node --test tests/activity-*.test.mjs tests/mesa-activity-host.test.mjs
  tests/study-activity-backup.test.mjs` → **42/42**.
- `node tests/hunt-activity-isolation.mjs` (execução independente) →
  **175 `[PASS]` / 0 FAIL**, rótulos idênticos aos do autor; classe DSD completa
  (5 originais + closed/clonable/import/options/poison/DOMParser/contextual/
  parseHTML).
- `node tests/hunt-activity-watchdog.mjs` → **27 `[PASS]` / 0 FAIL**, duas
  execuções independentes (run1/run2).
- `node tests/hunt-activity-ui.mjs` → **50 `[PASS]` / 0 FAIL** (o autor chama
  "51" contando a linha final; rótulos idênticos).
- `node tests/syntax-check.mjs` → 333 arquivos OK.
- Probes do revisor reexecutados por mim com cópia própria (só mudei caminhos de
  resultado): `probe-main`, `probe2`, `probe5`; sonda de variantes própria
  (nested/closed/case/poisoned), sonda KaTeX offline própria.

## P1 (R6) — DSD/sinks nomeados: **FECHADO**

Cinco vetores originais, reexecutados por mim no runtime atual (0 UDP / 0 filho)
contra o "antes" documentado (5 UDP e 1 filho `about:srcdoc` cada):

| Vetor | antes | meu depois |
|---|---|---|
| `dsd-setHTMLUnsafe` (probe-main) | 5 UDP, 1 filho | **0 UDP, 0 filho** |
| `dsd-shadowRoot-setHTMLUnsafe` (probe-main) | 5 UDP, 1 filho | **0 UDP, 0 filho** |
| `static-parseHTMLUnsafe` (probe2) | 5 UDP, 1 filho | **0 UDP, 0 filho** |
| `createHTMLDocument-setHTMLUnsafe` (probe2) | 5 UDP, 1 filho | **0 UDP, 0 filho** |
| `setHTMLUnsafe-policy-kstring` (probe2) | 5 UDP, 1 filho | **0 UDP, 0 filho** |

Controle positivo no mesmo processo/binário: `raw-srcdoc-positive` → **5 UDP,
20 B, de 127.0.0.1, filho `about:srcdoc` vivo**; o detector não está cego. O
`sanitizedDSD` do probe2 devolve `<div><template></template></div>`
(`hasShadow:false, hasIframe:false`). Os pontos de entrada usados pelos vetores
(`setHTMLUnsafe`/`setHTML` de `Element`/`ShadowRoot`, `Document.parseHTML`/
`parseHTMLUnsafe`) retornam sanitizado (probe `ok`), sem lançar.

Variantes de mesma classe além do hunt (sonda própria, runtime real): template
DSD aninhado open+closed, `setHTMLUnsafe` em `ShadowRoot` **closed**, `template`
+ `setHTMLUnsafe` + `content` no body, atributo com caixa mista
(`ShAdOwRoOtMoDe`) e `Document.parseHTMLUnsafe` com `Element`/`HTMLTemplateElement`/
`Document.prototype` envenenados (getAttributeNames/removeAttribute/content/
shadowRoot/createElement) → **todos 0 UDP, 0 filho, 0 `childRan`, host
responsivo**; o positivo da mesma sonda segue 5 UDP com filho. O hunt já cobre
fechado/clonável/opções/import/contextual/`Document.parseHTML`; medi a lista de
frames **com o artefato montado e antes do cleanup** (um filho escondido daria
frame extra/probe), não depois de desmontar.

Legítimo preservado: vetor `legit` do hunt (DOM, SVG, canvas, template,
`insertAdjacentHTML`, `innerHTML`, shadow open **e closed**) PASS; sonda KaTeX
própria renderiza `.katex`/`.katex-html` com `katex.render` empacotado,
`RTCPeerConnection`/`window.desk` indefinidos, **0 hits HTTP**, só a navegação do
artefato autorizada.

## P2 (R6) — Watchdog fail-open: **FECHADO**

- **Enum faults negam (fail closed).** `collectActivityFrames` devolve
  `{complete,frames}`; exceção em `getAllWebContents`/`isDestroyed`/`mainFrame`/
  `framesInSubtree`, ou PID 0/negativo/string/getter lançando → `complete:false`.
  `terminateEntry` checa `snapshot.complete` **antes** de interpretar `others`
  como vazio e recusa com `reason:'enumeration'`. Repro inline próprio:
  `happy complete:true 1 frame`; throw/disposed/unknownPid → `complete:false`
  (0 frames ou frames já lidos, nunca prova vazia). Unit tests cobrem
  `"Render frame was disposed"` explicitamente (documentado no código e no
  relatório do autor).
- **probe5 do revisor reexecutado por mim.** Controle A saudável + B travado:
  `stalled` emitido, `kills:[]`, `framesAlive:2`, `pidAlive:true` → **DENY**.
  Com `getAllWebContents` lançando: `kill:null`, `framesAfter:2`,
  `pidAlive:true`, `hostResponsive:true` → nenhum A saudável morto. O log mostra
  só `ensure`+`stalled`, sem `kill`/`about:srcdoc`.
- **Caminho normal continua matando.** Hunt cena 1 (3 atividades/1 OOPIF, laço):
  kill `shared-stalled`, pid some de `getAppMetrics`, IPC do renderer segue
  autorizado, mesa responsiva e atividade nova monta com pid próprio. Cena 2
  injeta `getAllWebContents`, `framesInSubtree` e `osProcessId`: nenhum mata A
  saudável; sarada a enumeração, o kill compartilhado volta com todos travados
  (duas execuções passaram; os 2 FAIL do autor em `after2/after3` são de
  fixture/hunt anteriores aos mtimes finais 00:03/00:07 — o hash liberado e as
  minhas 2 rodadas passam).
- **Guarda de identidade preservada** (leitura + `activity-process-guard.test.mjs`
  42/42): `osPid>0`, `mainPid>0` e diferente, métrica atual `Tab` com
  `pid+creationTime` iguais, `creationTime` obrigatório (`0`/reuso nega), nenhum
  frame desconhecido/ saudável/host no pid; compartilhado exige **todos** os
  outros frames confirmadamente travados; `livePids:[]` já não é fabricado por
  falha de enumeração.
- P3 (`onWatchdog` sem ligação no `main.cjs:705`): confirmado por leitura;
  cosmético/UX aceito, sem risco e sem bloqueio.

## Veredito

**R6 P1 fechado e R6 P2 fechado**, com evidência executada nesta máquina nos
hashes do handoff. Aceito o **Gate A inline** para o domínio fechado (zero
egress medido nos vetores RDSD/DSD, filho sem lockdown não nasce, legítimo
DOM/SVG/canvas/KaTeX e watchdog preservados), **dentro do medido**: Electron
44.2/Chromium 152/macOS atual. Isto não é certificação de segurança universal,
de outros navegadores/plataformas, de APIs futuras nem de inferência/provedor
real; a proteção de sinks depende de `lock` sobre descritores existentes e deve
ser re-medida em upgrade de Chromium. Sem achados concretos de bloqueio.

Limites/anotações: probes do revisor têm push duplo de relatório (cada vetor
executa 1×; `udpTotal 5` só do positivo prova); recusa por enumeração no caminho
vivo é silenciosa (observabilidade, não segurança); contadores TCP
`preconnect` sem positivo válido seguem inconclusivos, como já registrado.
Ownership desta revisão liberado.
