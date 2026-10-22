# Atividades — correções finais R6: declarative shadow DOM e watchdog fail-open

Data: 2026-10-08. Implementação local autorizada; sem commit/install/update/push,
sem credenciais, provedor real, dados pessoais ou app instalado. Ambiente:
Electron 44.2.0 / Chromium 152 / macOS, tudo sintético. Baseline dirty preservado:
somente os 7 arquivos de código/teste abaixo foram tocados (mtime conferido);
main/preload/renderer/store/gate/PDF/timeline/core intactos.

## Hashes (sha256) dos arquivos liberados

| Arquivo | sha256 |
|---|---|
| `desk/activity-runtime.cjs` | `30ed366185dfb536d063ee064773a5a44c0850d191b56b6dbc24d2f18e59e296` |
| `desk/tests/hunt-activity-isolation.mjs` | `db56b3bda1ac2159b151296ac5f4196f70ddf2d7e8f0c49b6c2df072369f7a1a` |
| `desk/tests/fixtures/activity/isolation-main.cjs` | `9f7a609499f95ebed335d825e2535419ad0e8636411690151868cf89cab706a0` |
| `desk/tests/hunt-activity-watchdog.mjs` | `8b6d43b9c051131c2ebd3f955641b348163f8d1010868e3d234800dec78c8067` |
| `desk/tests/fixtures/activity/watchdog-main.cjs` | `d3ae224231439ae882471191b7ba9d8a44c9caeb3e11e2b730b2f4ad6f7fe9f4` |
| `desk/tests/activity-runtime.test.mjs` | `4281b574a9aa990856b33f67a43762461d344ecec479af629e38fd2ef4abdb7d` |
| `desk/tests/activity-process-guard.test.mjs` | `be402a08661b6e4c7493f37b6b064b5129d769e84e4ce1d6165de22bce1a6653` |

## P1 (R6) — Declarative Shadow DOM reabria filho sem lockdown

Causa confirmada pelos probes do revisor: o sanitizador preservava `shadowrootmode`
e `<iframe srcdoc>` (não descia `template.content` nem shadow roots) e os sinks
nativos `Element/ShadowRoot.setHTMLUnsafe`, `Document.parseHTMLUnsafe` (estático),
`createHTMLDocument` + `setHTMLUnsafe` e a kstring da política Trusted Types
criavam shadow root (até `closed`) com filho `about:srcdoc` sem o prelude — 5 UDP
STUN por vetor.

Resposta (tudo não configurável, com referências originais capturadas antes do
código do modelo):

1. **Fábricas neutralizadas na origem**: `setHTMLUnsafe`/`setHTML` de
   `Element.prototype`/`ShadowRoot.prototype` e `Document.parseHTML`/
   `Document.parseHTMLUnsafe` (estáticos) agora passam pelo sanitizador do prelude
   (`replaceContents` → `parseFragment` → `cleanTree`). Como o parsing nativo de
   DSD não roda mais, shadow root `closed` não chega a nascer — sem depender de
   `MutationObserver`.
2. **`shadowroot*` sempre removido**: `stripAttr` tira `srcdoc` e qualquer
   atributo cujo nome (minúsculo) comece com `shadowroot` (modo/delegatesfocus/
   clonable/serializable e futuros), via `getAttributeNames`/`removeAttribute`
   capturados; vale no sanitizador e em toda inserção (guardas).
3. **Travessia real**: `unsafeSubtree`/`cleanTree` descem `template.content` e
   shadow roots acessíveis com os getters capturados (`content`, `shadowRoot`),
   então template/iframe escondido em shadow DOM não passa pela guarda.
4. **Legítimo preservado**: template normal e shadow DOM imperativo (`open` e
   `closed`) continuam funcionando (vetor `legit` do hunt).

Evidência medida (logs em `/private/tmp/mesa-activity-dsd-watchdog-fixes/`):

- `hunt-activity-isolation`: **41 vetores, 175 asserts PASS / 0 FAIL**,
  incluindo 13 da classe DSD (5 originais + closed/clonable/import/options/
  poisoned/DOMParser/contextual/parseHTML seguro). Log
  `hunt-isolation-after.log`.
- `probe-main` reexecutado: `udpTotal` **15 → 5**; o positivo cru
  (`raw-srcdoc-positive`) segue com **5 UDP** e filho (detector válido); os dois
  vetores DSD do probe-main (`dsd-setHTMLUnsafe`, `dsd-shadowRoot-setHTMLUnsafe`)
  → **0 UDP, 0 `about:srcdoc`** (antes 5 cada).
  `probe-main-before.json` / `probe-main-after.json`.
- `probe2` reexecutado: os outros três vetores DSD originais
  (`static-parseHTMLUnsafe`, `createHTMLDocument-setHTMLUnsafe`,
  `setHTMLUnsafe-policy-kstring`) → **0 UDP, 0 filho** (antes 5 cada);
  `defaultPolicy-sanitized-DSD` segue 0.
- `probe4` reexecutado: `childUdp 5 → 0`, `childHttp {}`, `childTcp 0`; só host +
  artefato na árvore (antes havia `about:srcdoc`).
- KaTeX offline, tema e DOM legítimo: `hunt-activity-ui` **51/51**;
  `mesa-interactive-ui`, `mesa-claude-activity-ui` e `native-activity-tool` PASS;
  `hunt-activity-spike` (Gate A do harness inline) PASSOU.
- **Sem alegação de Gate A nesta nota**: a medição 0 UDP do DSD original está
  feita, mas a próxima revisão independente é obrigatória antes de fechar.

## P2 (R6) — Watchdog fail-open na enumeração de frames

Causa: `framesOn` engolia exceção de `getAllWebContents`/`framesInSubtree`/
`osProcessId` e devolvia `[]`; `terminateEntry` lia `others=[]` como "nenhum outro
frame no pid" e matava com `detached-unresponsive` mesmo com frame saudável vivo.

Resposta:

- Novo `collectActivityFrames(pid, enumerate)` (exportado e testado): devolve
  `{complete, frames}`; **qualquer** exceção (getAllWebContents, isDestroyed,
  mainFrame, framesInSubtree) ou PID desconhecido (getter lançando, 0, negativo
  ou não numérico) → `complete:false`.
- `terminateEntry` checa a completude **antes** do kill e recusa com
  `reason:'enumeration'`; nunca reinterpreta falha como lista vazia.
- Guarda do root preservada: PID do SO + `creationTime` da métrica `Tab`,
  `mainPid` conhecido e diferente; caminho compartilhado continua exigindo
  **todos** os frames vivos do pid conhecidos e confirmados travados.

Evidência:

- `probe5` reexecutado (falha injetada em A saudável + B travado + throw em
  `getAllWebContents`): controle `kills:[]`, `framesAlive:2`, `pidAlive:true`;
  fail-open `kill:null`, `framesAfter:2`, `pidAlive:true`, `hostResponsive:true`
  — nenhum frame saudável morto (`probe5-after.json`).
- `hunt-activity-watchdog`: **27 asserts PASS / 0 FAIL**. Cena 2 injeta
  `getAllWebContents`, `framesInSubtree` e `osProcessId`: nenhum mata A saudável
  (pid vivo); sarada a enumeração, uma montagem nova religa o watchdog (a falha
  de `framesInSubtree` limpa `tracked` e para o timer por desenho) e o kill
  `shared-stalled` volta, com pid sumindo, IPC/beat OK e atividade nova montando.
  Log `hunt-watchdog-after4.log`.
- Unidade `activity-process-guard.test.mjs`: caminho completo, exceções de
  enumeração (inclusive "Render frame was disposed" no `framesInSubtree`) e
  PID desconhecido — todos negam.

## P3 (R6) — `onWatchdog` não ligado ao renderer

Cosmético/UX (vizinhos de kill compartilhado ficam em erro até Reabrir/Reiniciar).
Fora do escopo desta correção por instrução; sem mudança em `main.cjs`. O root
fecha a clareza depois, se quiser.

## Verificação executada (focada)

- `node --test tests/activity-*.test.mjs tests/mesa-activity-host.test.mjs
  tests/study-activity-backup.test.mjs` → **42/42**.
- `node tests/hunt-activity-isolation.mjs` → **175 PASS / 0 FAIL** (41 vetores;
  segunda execução independente: 175/0).
- `node tests/hunt-activity-watchdog.mjs` → **27 PASS / 0 FAIL** (segunda
  execução: 27/0).
- `node tests/hunt-activity-ui.mjs` → **51 PASS / 0 FAIL**.
- `hunt-activity-spike.mjs` (Gate A inline), `mesa-interactive-ui.mjs`,
  `mesa-claude-activity-ui.mjs`, `native-activity-tool.mjs` → PASS.
- `node tests/syntax-check.mjs` → 333 arquivos OK.

Limites honestos: só macOS/Electron 44.2/Chromium 152 sintético, sem provedor
autenticado, app instalado, Windows/Linux ou dados pessoais. Os probes reexecutados
são os do revisor (arquivos em `/private/tmp/mesa-activity-final-probe/`). A
suíte geral, o portão Bend, build e PDF/UI ficam com o root. Próxima revisão
independente obrigatória; nenhuma certificação de Gate A aqui.

## Arquivos liberados / não tocados

- Editados: `desk/activity-runtime.cjs`; testes/fixtures `activity-runtime.test.mjs`,
  `activity-process-guard.test.mjs`, `hunt-activity-isolation.mjs`,
  `hunt-activity-watchdog.mjs`, `fixtures/activity/isolation-main.cjs`,
  `fixtures/activity/watchdog-main.cjs`; este relatório.
- Não tocados: `main.cjs`, `preload.cjs`, renderer/`src/activity.mjs`, store,
  bridge, host, gate, PDF, timeline, `core/**`, `package.json` e o restante do
  baseline dirty.
