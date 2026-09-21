# UI-PORT — porta da UI da Mesa para Bend

Escopo: `desk/` (Mesa de Estudos). `visual-check/` e o app irmão `chat/` ficam fora.
Alvo: mesmo `desk/index.html` e `desk/style.css` (ids/classes intactos), com a visão/estado vindo do Bend e o renderer virando aplicador fino.

Contrato lido:

- `desk/index.html` é a árvore fixa; `desk/style.css` é o visual fixo (inclusive os tokens `--chat`, `--calc`, `--pdf-left`, aviso em `desk/style.css:2-3`).
- `desk/tests/ui-smoke.mjs` é o contrato 1:1 (seletores, classes, `aria-*`, `dataset`); `desk/tests/smoke-x3.mjs:7-13` roda esse smoke 3× e `desk/tests/app-smoke.mjs:52` roda o mesmo smoke contra o bundle.
- `desk/renderer.mjs:1-10` é a lista de módulos que o aplicador fino substitui; `desk/main.mjs:179-184` é o boot (`window.desk.init()` → `loadCourse`).
- Núcleos Bend já existentes (não refazer): `core/README.md:32-60`; adaptadores em `desk/src/worklog.mjs:13`, `desk/src/pdf.mjs:5`, `desk/config.cjs:8`, `desk/courses.cjs:2`, `desk/study.cjs:2`, `desk/rpc.cjs:4`, `desk/wheel.mjs:4`. Regra “fatos como Bool”: `core/README.md:62-67`.

---

## Estado do port (ondas 1–5, fechado)

O inventário abaixo é o **plano original** (com referências ao Electron pré-rewrite); o que está no repo hoje é a fonte de verdade. Resumo do que foi portado:

- **Waves 1–2:** abas/menus (`tabsview`), diálogos (`dialogsview`), rodapé (`statusview`), diário (`worklogview`), toasts (`toastview`), conversa (`talkview`), chrome/busca do PDF (`pdfview`, `find`).
- **Wave 3:** calculadora (`calcview`), leitor de PDF parte 2 (`pdfpageview`), densidade/dica/avisos (`auxview`).
- **Wave 4:** editor de atalhos (`shortcutview`), slash (`slashview`), vazio (`welcomeview`) e limpeza do `state.mjs` — o caminho legado `renderTabs`/`cycleTab`/`goToTab` foi **removido** e o `#ctx-tip` passou a ser `statusview.ctxTip` aplicado num nó vivo.
- **Wave 5:** anexos (`attachview`, compartilhado com a Conversa), fiação de `statusDot`/`autoCompact`/`sessionSelect`/`ctxMeter` e flags (`deskflags`).

Ficam no host por contrato: markdown/KaTeX/realce, canvas/medição/scroll do PDF.js, clipboard, medição/posição de balões, relógios, IPC e os SVG de `icons.mjs`.

Decisões registradas: `core/fold.bend` fica **fora do build** (tabela Latin-1; o host usa `normalize("NFD")` completo); `core/wheel.bend`/`desk/wheel.mjs` nunca foram fiados no app (recurso de virar página por roda) — mantidos como referência provada.

Pendência de fiação resolvida (fase A, 2026-09-18): `core/state.bend` (draft/tema/refs/layout) é consumido pelo `desk/main.cjs` via `desk/state-adapter.cjs`, com paridade diferencial contra o JS antigo em `desk/tests/state-parity.mjs` (milhares de casos + bordas) exercitando o módulo real.

Consolidação (2026-09-18): caça adversarial (A1–A9) + onda de texto grande (loops tail nos núcleos, issue bendlang/bend#798) + política primeiro-vence nos atributos (`view.bend` + os dois `view-host.mjs`); portão estrito em `core/verify.mjs` (`npm run verify:bend`). Relatórios e repros ficam em `desk/tests/artifacts/` (não versionados).

---

## 1. Inventário de regiões/telas

### 1.1 Casca, marca e paleta (header)

- DOM: `header` `desk/index.html:12-37`; `.brand` + `.brand-icon` + `strong` `:13-16`; `.header-actions` `:17-36`.
- Comportamento: `applyDesk` troca o nome da marca (`desk/src/state.mjs:204`); `updateWindowTitle` monta `title` (`desk/src/state.mjs:57`).
- Testes: marca renderiza `desk/tests/design-check.mjs:4`; título com “Matéria B”/“p. 2” `desk/tests/ui-smoke.mjs:18,279,285-286`.

### 1.2 Abas de matéria + aba GeoGebra

- DOM: `#course-tabs[role=tablist]` `desk/index.html:18`; `#new-tab` `:19`.
- Render: `renderTabs` (botões `[role=tab][data-id]`, `.active`, `aria-selected`, `.tab-sep`, botão `.ggb-tab[data-id=geogebra]`) `desk/src/state.mjs:182-201`; `markCourseTab` `:176-181`; clique/atalhos `switchCourse`/`cycleTab`/`goToTab` `:266-286`.
- Testes: contagem/`aria-selected`/`data-id` `desk/tests/ui-smoke.mjs:221-226`; troca por clique/título/placeholders `:269-286`; `⌘1` `:283-285`; aba GeoGebra por último `:274-275`; isolação por matéria `desk/tests/subjects-ui.mjs:23-27`.

### 1.3 Menu Estudar / menu Mesa

- DOM: `#study-menu` (`#reference-toggle`, `#xournal`) `desk/index.html:20-26`; `#mesa-menu` (`#help`, `#settings`, `#theme-cycle`, `#about`) `:27-35`.
- Comportamento: abrir/fechar com animação `.closing` `desk/src/main.mjs:6-40`; rótulos com ícone `:93-106`; tema cicla em `:107-113`; `#reference-toggle` esconde painel 2 e grava `desk/src/main.mjs:53`; `#include-refs` alterna `desk/src/main.mjs:54`.
- Testes: `#study-menu .nav-trigger` + `#reference-toggle` `desk/tests/ui-smoke.mjs:149-151`; `#mesa-menu .nav-trigger` → Configurações `:216-219`; `#theme-cycle` aplica/persiste tema `:337-343`; flags escondem botões `:239-242`.

### 1.4 Leitores de PDF (1 ou 2) e divisores

- DOM: `#references` `desk/index.html:39`; `#pdf-grid` `:45`; `#divider` (largura do chat) `:47`; painéis são criados em `PdfPanel` `desk/src/pdf.mjs:35-97` (markup em `:39`): `.pdf-panel` → `.pdf-title` (`strong`, `select.pdf-select`, `.open`, `.find-toggle`, `.page-shot`, `.collapse`), `.pdf-tools` (`.prev`, `input.page-number`, `.page-total`, `.next`, `.out`, `.zoom-label`, `.in`, `.fit`, `.invert`), `.pdf-stage` (`.pdf-viewport` + `.pdf-foot`), `form.pdf-find` (`input`, `.find-count`, `button`).
- Layout/classes: `#pdf-grid.single`, `.pdf-panel.pinned`, `#pdf-grid.other-min/has-min/has-other-min`, `.pdf-panel.minimized` `desk/style.css:168-189`; split por `--pdf-left`/`--pdf-other` `desk/style.css:180-184`; `makePdfDivider` + `setPdfSplitPct`/`pdfSplitValue` `desk/src/pdf.mjs:175-188`.
- Testes: dois leitores/canvas `desk/tests/ui-smoke.mjs:13-15`; PDFs preferidos `:16`; próxima página + título `:17-19`; rolagem contínua `:152-153`; divisor presente/arrasto/teclado/persistência `:154-156,171-186`; minimizar/restaurar `:157-170`; inverter por arquivo `:207-215`; placeholder de matéria vazia `desk/tests/ui-smoke.mjs:280`; página salva restaurada `desk/tests/subjects-ui.mjs:27-28`; página/zoom restaurados no bundle instalado `desk/tests/installed-smoke.mjs:7-14`.

### 1.5 Busca no PDF

- DOM: `form.pdf-find` (criado em `desk/src/pdf.mjs:39`), classe `.closing` na saída `:98-118`, `.pdf-hl` no `textLayer` `:153-169`, `.find-count` `:150`.
- Decisão pura: `core/find.bend` via `findCore.cycleTarget`/`findCore.findCount` `desk/src/pdf.mjs:5,89-90,150` (paridade em `desk/tests/find-parity.mjs:17-25`).
- Testes: `⌘F` foca o painel ativo, `Esc` limpa e devolve o foco `desk/tests/ui-smoke.mjs:202-206`; varredura + contador `1/3` + ciclo preservando destaque `:308-318`; ajuda descreve a busca varrer todas as páginas `desk/index.html:205`.

### 1.6 Conversa (sidebar/chat)

- DOM: `#sidebar` `desk/index.html:48`; `#chat` `:49-92`.
- Cabeça: `.chat-head` (`#pi-label`, `#status-dot`, `#ctx-meter` com `.bar > i` e `em`, `#auto-compact`, `#ctx-tip`; `#session-select`, `#new-session`, `#export-chat`) `desk/index.html:50-57`.
- Modelo/esforço: `.pi-settings` (`#model-select`, `#thinking-select`) `:58-65`; render em `updateSettings` `desk/src/state.mjs:134`; troca `desk/src/main.mjs:92`.
- Contexto de estudo: `#study-context` (`#exercise-title`, `#pick-xopp`) `desk/index.html:66-69`; `applyStudy` `desk/src/state.mjs:130`; resumo `updateContextSummary` `desk/src/state.mjs:51-56`.
- Mensagens: `#messages[aria-live=polite]` + `#welcome`+`#connect` `desk/index.html:70-75`; `message`/`paintMessage`/`updateMessage` `desk/src/chat.mjs:62-78`; histórico `showHistory` `:79-102`; markup Markdown/LaTeX + realce `:18-34` (host).
- Composer: `#composer` (`#context-summary`, `#attachments`, `#prompt`, `#attach`, `#include-refs`, `#check`, `#end-day`, `#stop`, `#send`, `#attach-input`, dica de atalhos) `desk/index.html:77-91`; handlers `desk/src/main.mjs:41-46`; `send`/`conferir` `desk/src/chat.mjs:112-146`.
- Anexos/citação/imagens: `addAttachments`/drop/paste `desk/src/chat.mjs:163-231`; `#quote-btn` + seleção `:232-325`; diálogo de imagem `:508-557`.
- Quiz e diálogos do Pi: cartões `renderQuizCard`/`decorateQuizCard` `desk/src/chat.mjs:434-500`; `#pi-dialog` `desk/index.html:125-135` + fila `desk/src/chat.mjs:427-507`.
- Testes: tema/katex `desk/tests/ui-smoke.mjs:57-60`; medidor/`auto-compact`/`/compact` `:61-74`; citação (texto, LaTeX inline/display, PDF) `:76-110`; anexos/redução `:111-138`; contexto de estudo `:139-140`; encerrar por hoje `:141-148`; toasts em fila `:187-190`; collapse do chat `:191-200`; quiz (simples, múltipla, “Não sei”) `:33-56`; cópia de mensagem/código `desk/tests/ui-smoke.mjs:319-328`; Playwright `desk/tests/watchdog-ui.mjs:21-35`.

### 1.7 Diário de trabalho do turno

- DOM: nasce dinamicamente em `createWorkLogView` `desk/src/worklog-view.mjs:24-193`: `article.work[data-live][data-expanded]`, `button.work-head[aria-expanded]` (`.work-mark`, `.work-title`, `.work-meta`, `.pulse.work-dots`, `.work-chevron`), `.work-steps > .work-step[data-kind][data-status][data-detail] > button.step-toggle` (`.step-icon`, `.step-main > .step-line > .step-label/.step-time`, `.step-preview`, `.step-detail > .step-links + pre.step-text`, `.step-status`).
- Modelo: `desk/src/worklog.mjs` (adaptador do `core/worklog.bend`) — rótulos `:309-355`, resumo `:357-372`, turnos do histórico `:384-432`.
- Fiação dos eventos: `desk/src/chat.mjs:326-426` (`openTurnLog`, `paintLive`, `settleTurn`, `onEvent`).
- Testes: recolhe em “Trabalhou por…” e `.step-label` exatos `desk/tests/ui-smoke.mjs:500-511`; histórico reconstrói recolhido `:529-533`; unidade/paridade `desk/tests/worklog.test.mjs`, `desk/tests/worklog-parity.mjs`.

### 1.8 Calculadora

- DOM: `#calc-divider` `desk/index.html:93`; `#calculator` `:94-119`: `#calc-toggle[aria-expanded]` (`span` + `.calc-mode > #angle`), `#calc-body`, `#calc-form` (`#expression`, botão `=`), `#result`, `#calc-history`, `.calc-help`, `#calc-guide`.
- Comportamento: colapso distingue clique no `select` `desk/src/main.mjs:55`; avaliação `:56`; ícone do título `:177`; arrasto/teclado do divisor `:58`; altura em `--calc` `desk/src/state.mjs:46`.
- Avaliação (pura, hoje JS): `desk/calculator.mjs:2-19` (sem `eval`; `toPrecision(12)`).
- Testes: `sqrt(16)+sin(pi/2)=5` e `sin(30)` em GRAUS `=0.5` `desk/tests/ui-smoke.mjs:20-21`; `sin(pi/2)=1` + guia `desk/tests/subjects-ui.mjs:29`; `2^3^2=512` (potência associativa à direita) `desk/tests/installed-smoke.mjs:11`; toast repetido do erro `desk/tests/ui-smoke.mjs:187-190`.

### 1.9 GeoGebra

- DOM: `#ggb-bar` (`strong`, `#ggb-shot`, `small`) `desk/index.html:40-44`; `#references.ggb` esconde o `#pdf-grid` e os divisores `desk/style.css:130-131`; aba em `renderTabs` `desk/src/state.mjs:194-199`.
- Comportamento: `activateGeogebra`/`deactivateGeogebra`/`sendGgbRect` `desk/src/ggb.mjs:3-26`; ponte HTTP e `WebContentsView` no main `desk/main.cjs:590-704`; applet em `desk/ggb.html:19-57`.
- Testes: aba ativa/`#ggb-bar`/grid escondido `desk/tests/ui-smoke.mjs:346-348`; token/JSON da ponte `:350-355`; `⌘⇧G` `:356-360`; sair/voltar `:361-365`; `ggb-shot`/`#ggb-shot` `:366-374`; snapshot ao sair + `ggb/<id>.b64` `:375-386`.

### 1.10 Rodapé de status, densidade, avisos e tooltip

- Rodapé: `status-foot.mjs` cria `.side-foot > button#foot-status.foot-status` (`fs-item fs-model/fs-eff/fs-ctx`, `fs-sep`) `desk/src/status-foot.mjs:81-106`, estilo `desk/style.css:636-644`; lê os selects e o medidor `:14-26`.
- Densidade: `#density-mode` na seção “Avisos” `desk/index.html:267`; `body.dense` `desk/src/density.mjs:21-23`; CSS `desk/style.css:665-688`.
- Avisos: `#notify-mode`/`#notify-sound`/`#notify-desktop`/`#notify-focused` `desk/index.html:268-273`; som + notificação + selo `desk/src/notify.mjs:49-139`; IPC `notify`/`badge` `desk/main.cjs:377-388`.
- Toasts/atividade: `#toast` `desk/index.html:122` + `toast` `desk/src/state.mjs:8-17`; `#activity` `desk/index.html:76` + `activity`/`activityLive` `desk/src/state.mjs:18-33`.
- Tooltip próprio: `desk/src/tooltip.mjs:24-35,105-112` (troca `title` → `dataset.tip`); `#ctx-tip` tem vida própria e fica fora da delegação `desk/src/tooltip.mjs:6`.
- Testes: `#toast .toast-item` coexistem e saem `desk/tests/ui-smoke.mjs:187-190`; `toastWait` do harness `desk/tests/helpers.mjs:62-67`; tooltip do medidor `desk/tests/session-switch.mjs:30-45`.

### 1.11 Diálogos

- `#pi-dialog` `desk/index.html:125-135` (`#dialog-title`, `#dialog-message`, `#dialog-fields`, `#dialog-ok`); fila/quiz/`select|confirm|input|editor` `desk/src/chat.mjs:427-507`.
- `#end-day-dialog` `desk/index.html:136-144` (`#end-where`, `#end-next`, `#end-day-save`); `desk/src/main.mjs:45-46`.
- `#image-dialog` `desk/index.html:145-158` (`#image-title`, `#image-preview`, `#image-copy`, `#image-open`); `desk/src/chat.mjs:508-557`.
- `#help-dialog` `desk/index.html:159-228` (`#help-version`, tabela `.help-keys` com `tr[data-key]`, `#keys-customize`, `#help-*-li`); `openHelp` `desk/src/main.mjs:115`; tabela sincronizada com atalhos `desk/src/keys.mjs:289-313`.
- `#settings-dialog` `desk/index.html:229-282` (`#cfg-vault`, `#cfg-pi`, `#cfg-xournal`, `#cfg-courses`, `#cfg-add-course`, `#settings-save`); `openSettings`/`fillSettingsForm`/`readSettingsForm` `desk/src/main.mjs:121-176`.
- `#about-dialog` `desk/index.html:283-310`.
- `#keys-dialog` é criado em `desk/src/keys.mjs:416-483` (estilo `desk/style.css:611-634`).
- Testes: end-day (cancelar, salvar, JSONL) `desk/tests/ui-smoke.mjs:141-148`; Configurações abre/cancela `:216-219`; flags sobrevivem ao diálogo `:243-248`; guia da calculadora `desk/tests/subjects-ui.mjs:29`.

### 1.12 Painéis laterais e citação flutuante

- `#chat-restore` `desk/index.html:123` + colapso `desk/src/main.mjs:59-63`; `#quote-btn` `:124` + posição a partir da seleção `desk/src/chat.mjs:295-325`.
- Testes: chat recolhe/volta e o painel de PDFs alarga `desk/tests/ui-smoke.mjs:191-200`; `#quote-btn` visível/clique/limpa `:81-109`.

---

## 2. Estado e eventos por região

### 2.1 Estado global (`desk/src/state.mjs:7`)

`S` guarda: `supportsImages`, `switching`, `modelCatalog`, `library`, `panels`, `pdfDivider`, `connected`, `connecting`, `busy`, `busySince`, `busyStall`, `refVisible`, `saveTimer`, `currentSession`, `captureOk`, `includeRefs`, `appConfig`, `quizQueue`, `activeCourseName`, `currentTheme`, `ggbActive`, `currentCourseId`, `autoCompact`, `attachments`, `attachGen`, `deskVersion`.

Persistido (via `save()`/`layoutSnapshot()` `desk/src/state.mjs:45-49` → IPC `save-state` `desk/main.cjs:417-426`): `draft`, `study{title,xopp}`, `pdfs[]` (`path,page,zoom,scrollX,scrollY,invert,minimized`), `referenceVisible`, `chatWidth`, `calcHeight`, `pdfSplit`, `theme`. O main ainda grava `session`, `courseId`, `courseStates` (inclui `sessionStudies`, `sessions`, `pdfs`) e `bounds` `desk/main.cjs:129-140`.

Por região:

| Região | Estado | Onde | Persistência |
|---|---|---|---|
| Abas/matéria | `activeCourseName`, `currentCourseId`, `switching`, `ggbActive` | `state.mjs:7,183-184,266-280` | main (`courseId`, `courseStates`; `desk.json`) |
| Painéis PDF | cada `PdfPanel` guarda `page/zoom/scrollX/scrollY/invert/minimized/path/doc/findTerm/...` | `pdf.mjs:37` | `pdfs[]` no `desk.json`; `docMemo` por path `pdf.mjs:146` |
| Busca PDF | `findTerm/findPages/findTotal` + cache de texto `textPages` | `pdf.mjs:86-87,119-125` | não persiste |
| Chat | `busy`, `connecting`, `attachments`, `quizQueue`, `supportsImages`, `modelCatalog` | `state.mjs:7`; fila do quiz `chat.mjs:392-410` | não persiste (sessão JSONL é a fonte) |
| Turno | `turnLog/turnView/assistant/assistantText/stoppedTurn` | `chat.mjs:326-327` | não persiste |
| Estudo | `study.title/xopp` (DOM + snapshot) | `state.mjs:47,130` | `desk.json`, autorizado pelo main `study.cjs:14-18` |
| Calculadora | `collapsed` no DOM/`#calc-body.hidden`; `--calc` | `main.mjs:55,58` | `calcHeight` |
| Tema/densidade | `currentTheme` + `data-theme`; `body.dense` | `state.mjs:137-142`; `density.mjs:7,21-23` | tema no `desk.json`; densidade em `localStorage` `mesa.density` |
| Avisos | som/notificação/foco | `notify.mjs:4,15` | `localStorage` `mesa.notify` |
| Atalhos | overrides | `keys.mjs:10,221-252` | `localStorage` `mesa.keys` |
| Layout | `chatCollapsed` (local), `--chat` | `main.mjs:59-61,57` | `chatWidth`, `referenceVisible`, `pdfSplit` |
| GeoGebra | `ggbActive`, snapshot base64 | `ggb.mjs:3-19`; `main.cjs:41-55` | `desk.json`/`ggb/<id>.b64` |

### 2.2 IPC (preload `desk/preload.cjs:128-158` → handlers no main)

| API `window.desk.*` | Handler | Devolve/efeito |
|---|---|---|
| `init` | `main.cjs:257-277,375` | `library,state,course,courseId,courses,session,sessions,config,preferred,needsSetup,captureAvailable,detectedPi,platform,deskVersion` |
| `switchCourse` | `main.cjs:390-394` | troca matéria + `initialData()` |
| `save` | `main.cjs:417-426` | grava `desk.json` (sanitiza pdfs/study/tema) |
| `openPDF/readPDF` | `main.cjs:395,396-405` | diálogo + leitura de bytes (cache por mtime) |
| `readImage/openImage` | `main.cjs:406-416` | `dataUrl`/abre no Preview |
| `exportChat` | `main.cjs:427-461` | Markdown na pasta `Mesa de Estudos` |
| `getConfig/saveConfig/pickFolder/pickFile/pickXopp/detectPi` | `main.cjs:462-480,463-466` | config, diálogos, autorização do `.xopp` (`allowedXopp`) |
| `connect/health/prompt/abort/compact/autoCompaction/respond/newSession/openSession` | `main.cjs:482-560` | RPC do Pi (`rpc.cjs`) + sessões |
| `captureReady/openXournal` | `main.cjs:561-588` | captura da janela do Xournal++ (macOS) / abre o app |
| `ggbShow/ggbShot/ggbSnapshot` | `main.cjs:605-635` | `WebContentsView` sobreposto + PNG + base64 por matéria |
| `notify/badge` | `main.cjs:377-388` | notificação nativa / selo no Dock |
| `logError` | `main.cjs:389` | `desk.log` rotativo (`main.cjs:56-69`) |
| `testMode` | `main.cjs:376` | `DESK_TEST` |

Eventos main → renderer: `pi-event` (`main.cjs:220`; consumido em `chat.mjs:368-426` e `notify.mjs:150-162`), `menu-check|ggb|chat-toggle|stop|help|settings|about` (`main.cjs:332-338`; ligados em `main.mjs:47-50,119-120`), `mesa-key`/`setKeymap`/captura de tecla (`preload.cjs:105-126,135-150`).

### 2.3 Fluxos que importam para o porte

- Boot: `main.cjs:353` carrega `index.html` → `main.mjs:179-184` chama `init()` → `loadCourse` (`state.mjs:223-264`): aplica `applyDesk` (flags), recria painéis/divisor, aplica tema, `--chat`/`--calc`, e dispara `connect()`.
- Troca de matéria: clique na aba (`state.mjs:190`) ou `goToTab` (`state.mjs:281-286`) → `switchCourse` (`state.mjs:266-280`) salva layout, para o bridge, limpa chat (`showWelcome`) e `loadCourse`.
- Turno: `setBusy` (`state.mjs:132`) habilita/desabilita `#session-select,#model-select,#thinking-select,#attach,#send,#check` e mostra `#stop`; eventos do Pi alimentam o diário (`chat.mjs:368-426`); watchdog de 15 s destrava `busy` (`state.mjs:287-303`; teste `watchdog-ui.mjs:21-38`).

---

## 3. Fronteira: fato do host × puro

Fato do host (não portar para Bend; expor como Bool/valores):

| Fato | Onde | Quem consome |
|---|---|---|
| PDF.js (`getDocument/render/getTextContent/TextLayer`) | `desk/src/pdf.mjs:1,6,14-34,119-125,171-173` | viewport, busca, citação |
| Medição/scroll do viewport (`scrollTop`, `clientHeight`, `offsetTop`, `ResizeObserver`, `getBoundingClientRect`) | `pdf.mjs:64-67,96,144,147,170-172`; `ggb.mjs:22-25` | página atual, virtualização, split, GeoGebra |
| DOM de Markdown/KaTeX/DOMPurify/realce | `chat.mjs:1-3,18-34`; `highlight.mjs:27-34` | mensagens, citação |
| Foco/seleção (`getSelection`, `activeElement`, `Range`) | `chat.mjs:246-325`; `main.mjs:64,71-73,89-90`; `state.mjs:97-113` | citação, `⌘F`, `←/→` no PDF |
| Arquivos/bytes/`dataUrl` | `preload.cjs:129-131`; `main.cjs:395-416,427-461,561-588` | anexos, export, captura |
| Xournal++ (AppleScript/`screencapture`/permissão de tela) | `main.cjs:561-583` | botão Conferir (só macOS) |
| Clipboard/Notification/WebAudio/badge | `chat.mjs:508-534,553`; `notify.mjs:49-139`; `main.cjs:356-388` | cópia, avisos |
| Timers/rAF/`MutationObserver`/`transitionend` | `state.mjs:14-16,287-303`; `pdf.mjs:96,172`; `worklog-view.mjs:154-168`; `status-foot.mjs:100-104` | toasts, diário, rodapé |

Puro (decisão; candidato ao Bend/`core/view.bend`):

| Decisão | Onde hoje |
|---|---|
| Rótulos PT-BR × estado do turno | `worklog.mjs:309-355` (já via `core/worklog.bend`) |
| Contador/ciclo da busca | `pdf.mjs:89-90,150` (`core/find.bend`) |
| Escolha dos PDFs por painel | `config.cjs:123-152` (`core/library.bend`) |
| Merge/biblioteca de matérias, `cleanStudy` | `courses.cjs:12-74`, `study.cjs:7-18` (`core/courses.bend`, `core/study.bend`) |
| Framing JSON-RPC | `rpc.cjs:26` (`core/framing.bend`) |
| Decisão da roda do trackpad | `wheel.mjs:9-16` (`core/wheel.bend`) |
| Habilitação/títulos: `conferirEnabled`, `setBusy`, `updateSettings` (labels/níveis) | `state.mjs:131-135` |
| Flags do `desk`: `panels`, `refsToggle`, `endDay`, `studyContext`, `xournal`, `conferir`, `calculator` | `state.mjs:202-222` |
| Aba ativa/ordem/`aria-selected` | `state.mjs:176-201` |
| Tema (auto/light/dark) e próximo passo | `state.mjs:137-142`; `main.mjs:107-113` |
| Formatação de duração/contagens/resumos | `worklog.mjs:205-210,347-372` |
| Quais referências vão ao prompt | `state.mjs:50` |
| `reduced-motion`, densidade | `desk/style.css:715-718`; `density.mjs:21-23` |

A regra do repo para a fronteira: o núcleo recebe fatos já resolvidos (`Bool`) e devolve a tabela (`core/README.md:62-67`). Vale para toda decisão nova: medir no host, decidir no Bend.

---

## 4. Proposta de funções de view (assumindo `core/view.bend`)

Notação: nó = `tag/attrs { ... }`; `on:<evento> = Msg`; listas são funções puras de um estado. A Msg volta para o mesmo módulo (ou núcleo) que atualiza o estado e devolve a árvore. Texto entre `[]` é classe; `#x` é id.

### Ordem sugerida de porte

1. **Aquecimento: toast/atividade** — menor contrato testado do app.
2. **Piloto: diário de trabalho (`worklog-view.mjs`)** — o modelo já é Bend (`core/worklog.bend`), a visão é função pura do log, o smoke fixa classes/`dataset` exatos e não há fato de host além de relógio e “estou no fim?”.
3. **Calculadora** — pequena e muito testada, **bloqueada** até a decisão F32 × double (ver §5); a view pode entrar antes, a avaliação não.
4. Abas/matérias + flags do `desk` + `reference-toggle`/`include-refs`.
5. Leitor de PDF: título/tools/página/zoom/inverter/minimizar; depois busca; o viewport/render fica no host.
6. Conversa: cabeça/modelo, contexto de estudo, composer, anexos, quiz; o HTML de Markdown/LaTeX continua vindo do host.
7. Diálogos (end-day, settings, help/about, image, pi).
8. Barra GeoGebra + aba.
9. Rodapé de status/densidade/notify/tooltip (adaptadores finos; tooltip e tooltip do medidor são host).
10. Editor de atalhos (`keys.mjs`) — por último; o motor de remap vive no preload (`preload.cjs:105-122`).

### 4.1 Toast/atividade (aquecimento)

| Função | Estado | DOM |
|---|---|---|
| `View.toast(items, closing)` | lista de toasts (host controla timers) | `#toast[role=status]` → `.toast-item` (`.out`, `.closing`) `state.mjs:8-17` |
| `View.activity(text)` | texto simples | `#activity[role=status]` `state.mjs:18-33` |
| `View.activityLive(label)` | rótulo | `#activity` → `span.pulse[aria-hidden] + span.activity-label` `state.mjs:20-33` |

Eventos: entrada/saída por `transitionend` + timeouts (host) `state.mjs:14-16`; testes `ui-smoke.mjs:187-190`, `helpers.mjs:62-67`.

### 4.2 Diário de trabalho (piloto)

| Função | Entrada | DOM |
|---|---|---|
| `View.workLog(log, live, note, expanded, touched, now)` | log (formato `worklog.mjs:229-307`), `live`, `note`, flags | `article.work[data-live][data-expanded]` `worklog-view.mjs:24-41` |
| `View.workHead(log, live, note, now)` | rótulo/resumo | `button.work-head[aria-expanded]` + `.work-mark` + `.work-title` + `.work-meta` + `.pulse.work-dots` + `.work-chevron` `:29-49,138-152` |
| `View.workStep(step, open)` | passo, aberto? | `.work-step[data-kind][data-status][data-detail]` + `button.step-toggle[aria-expanded]` + `.step-icon/.step-main/.step-line/.step-label/.step-time/.step-preview/.step-detail/.step-links/pre.step-text/.step-status` `:55-136` |

Msgs: `ToggleWorkLog`, `ToggleStep(id)`. Puro: `headLine/stepLabel/liveLabel/stepDetail/stepPreview/formatDuration` (`worklog.mjs:205-355`). Host: `Date.now()`, `atBottom/followBottom`, `isConnected` (`worklog-view.mjs:154-168`).

### 4.3 Calculadora (view pronta; avaliação condicionada)

| Função | Estado | DOM |
|---|---|---|
| `View.calculator(visible, collapsed, angle, expression, result, history, guideOpen)` | flags/valores | `#calculator[hidden][class collapsed]` `index.html:94` |
| `View.calcToggle(collapsed, angle)` | | `#calc-toggle[aria-expanded]` → `span` + `.calc-mode > #angle[on:change=SetAngle]` `:95-103`; `on:click=ToggleCalc` (ignora clique no `select`, `main.mjs:55`) |
| `View.calcBody(expression, result, history)` | | `#calc-body[hidden]` → `#calc-form[on:submit=Eval]` (`#expression`, botão), `#result`, `#calc-history > button[on:click=Reuse]`, `.calc-help`, `#calc-guide` `:104-118`; `main.mjs:56` |

Testes `ui-smoke.mjs:20-21`; `subjects-ui.mjs:29`.

### 4.4 Abas e flags do `desk`

| Função | Estado | DOM |
|---|---|---|
| `View.courseTabs(courses, activeId, ggbActive, disabled)` | lista + ativa | `#course-tabs[role=tablist]` → `button[role=tab][data-id][aria-selected]` (`.active`), `span.tab-sep`, `button.ggb-tab[data-id=geogebra][aria-selected]` `state.mjs:182-201` |
| `View.deskFlags(desk)` | flags | `#reference-toggle` (`hidden`, rótulo com `specs[1].toggle`), `#include-refs[aria-pressed]`, `#end-day`, `#study-context`, `#xournal`, `#check`, `#calculator`, `#calc-divider`, `#help-study-li`, `#help-endday-li`, `#help-refs-li` `state.mjs:202-222` |
| `View.brandTitle(desk)` | | `.brand strong` `state.mjs:204`; `document.title` `state.mjs:57` |

Msgs: `SelectTab(id)`, `ToggleGeoGebra`, `ToggleReference`, `ToggleIncludeRefs`.

### 4.5 Leitor de PDF

| Função | Estado | DOM |
|---|---|---|
| `View.pdfPanel(panel, label, single/minimized/pinned)` | label, classes do grid | `section.pdf-panel[class minimized][tabindex=0][aria-label]` `pdf.mjs:38-39`; classes do grid `state.mjs:238,255`/`pdf.mjs:135-139` |
| `View.pdfTitle(panel)` | label, path, doc, findOpen | `.pdf-title` → `strong` + `select.pdf-select[on:change=Open]` + `.open/.find-toggle[aria-pressed]/.page-shot/.collapse[aria-pressed]` `pdf.mjs:39-45,98-118,127-142` |
| `View.pdfTools(panel)` | page, numPages, zoom | `.pdf-tools` → `.prev/.page-number[on:change=Goto]/.page-total/.next/.out/.zoom-label/.in/.fit/.invert[aria-pressed]` `pdf.mjs:39,62-63,126,143,149` |
| `View.pdfFind(panel)` | termo, contador (`findCore`) | `form.pdf-find[hidden][class closing]` → `input` + `span.find-count[hidden]` + `button` `pdf.mjs:39,68-95,150` |
| `View.pdfStage(panel)` | foot | `.pdf-stage > .pdf-viewport (host) + .pdf-foot` `pdf.mjs:39,149` |
| `View.pdfDivider(split)` | | `.pdf-divider[role=separator][tabindex=0]` `pdf.mjs:177-188` |
| `View.pdfPlaceholder()` | | `.pdf-placeholder` `pdf.mjs:39` (`ui-smoke.mjs:280`) |

Host: PDF.js, `textLayer`, `.pdf-hl` (DOM da busca), scroll/medição, `.pdf-document`/`.pdf-page` (`desk/style.css:216-240`). Testes: `ui-smoke.mjs:13-19,152-186,202-215,287-318`.

### 4.6 Conversa

| Função | Estado | DOM |
|---|---|---|
| `View.chatHead(label, dot, meter, autoCompact, session/sessions, connected)` | | `.chat-head` → `h2` (`#pi-label`, `#status-dot[class]`, `#ctx-meter[hidden][class warn/hot]` com `.bar > i` + `em`, `#auto-compact[aria-pressed][hidden]`), `#ctx-tip` `index.html:50-51`; `state.mjs:64-122` |
| `View.sessionControls(sessions, current, disabled)` | | `#session-select` + `#new-session` + `#export-chat` `index.html:52-56`; `fillSessions` `state.mjs:123-129` |
| `View.piSettings(models, current, levels, level, disabled)` | | `.pi-settings > #model-select` + `#thinking-select` `index.html:58-65`; `updateSettings` `state.mjs:134` |
| `View.studyContext(title, xopp, hidden)` | | `#study-context > #exercise-title + #pick-xopp[data-path]` `index.html:66-69`; `applyStudy` `state.mjs:130` |
| `View.contextSummary(parts)` | | `#context-summary[title]` `state.mjs:51-56` |
| `View.messages(turns)` | turnos | `#messages` → `article.message.user/assistant` com `.role/.body/.msg-copy` e figuras/código (HTML do host) `chat.mjs:62-78`; `#welcome` `index.html:70-75` |
| `View.composer(busy, refsOn, flags, attachments)` | | `#composer` → `#context-summary`, `#attachments[hidden]` (`.attachment > img + button.attachment-remove`), `#prompt`, `.composer-actions` (`#attach`, `#include-refs[aria-pressed]`, `#check`, `#end-day`, `#stop`, `#send`), `#attach-input` `index.html:77-91`; `chat.mjs:187-218` |
| `View.quizCard(quiz, answered, result)` | args/resultado | `article.message.assistant.quiz[data-tool]` → `.quiz-card > .quiz-question/.quiz-details/.quiz-options > button.quiz-option[role][aria-checked]/.quiz-actions > .quiz-send.primary/.quiz-skip`, e na correção `.quiz-verdict/.quiz-note/.quiz-explain/.quiz-mark/.correct/.wrong/.dim` `chat.mjs:434-500` |
| `View.piDialog(fields)` | título/mensagem/campos | `#pi-dialog > #dialog-title/#dialog-message/#dialog-fields > #dialog-value/#dialog-ok` `index.html:125-135`; `chat.mjs:501-507` |

Host: `marked`/KaTeX/DOMPurify/realce (`chat.mjs:18-34`), `hydrateAssets` (`:36-61`), clipboard/seleção/citação/diálogo de imagem (`:232-325,508-557`), atalhos `⌘Enter`, `Esc`, `⌘⇧C` (`main.mjs:41,65-91`).

### 4.7 Diálogos restantes

| Função | DOM | Fonte |
|---|---|---|
| `View.endDayDialog()` | `#end-day-dialog` (`#end-where`, `#end-next`, `#end-day-save`) | `index.html:136-144`; `main.mjs:45-46` |
| `View.imageDialog(src, title, hasFile)` | `#image-dialog` (`#image-title`, `#image-preview`, `#image-copy`, `#image-open`) | `index.html:145-158`; `chat.mjs:544-557` |
| `View.helpDialog(version, flags)` | `#help-dialog` (`#help-version`, `.help-keys tr[data-key]`, `#keys-customize`, `#help-*-li`) | `index.html:159-228`; `main.mjs:115`; `keys.mjs:289-313` |
| `View.settingsDialog(config, courses, platform, first)` | `#settings-dialog` (`#settings-title`, `#settings-lead`, `#cfg-vault`, `#cfg-pi`, `#cfg-xournal-wrap`, `#cfg-courses > .cfg-course` com `.cfg-name/.cfg-path/.cfg-browse/.cfg-remove`, `#cfg-add-course`, `#density-mode`, `#notify-mode`) | `index.html:229-282`; `main.mjs:121-162`; `density.mjs:43-81`; `notify.mjs:167-224` |
| `View.aboutDialog()` | `#about-dialog` | `index.html:283-310` |
| `View.keysDialog(catalog, overrides, capture)` | `#keys-dialog` → `.keys-groups > .keys-group > .keys-row[data-action]` (`.keys-label/.keys-kbd/.keys-rec/.keys-reset/.keys-note`), `.keys-status[data-kind]` | `keys.mjs:378-483` |

### 4.8 GeoGebra, rodapé e controles auxiliares

| Função | DOM | Fonte |
|---|---|---|
| `View.ggbBar(active, note)` | `#references.ggb`, `#ggb-bar[hidden] > strong + #ggb-shot + small` | `index.html:40-44`; `ggb.mjs:3-26` |
| `View.footStatus(model, level, context)` | `#sidebar > .side-foot > button#foot-status.foot-status` (`.fs-item`, `.fs-model/.fs-eff/.fs-ctx/.fs-sep`) | `status-foot.mjs:28-74,81-106` |
| `View.density(dense)` | `body.dense` | `density.mjs:21-23` |
| `View.notifyControls(settings)` | `#notify-mode` + 3 checkboxes | `notify.mjs:41-47,167-224` |
| `View.quoteButton(text, rect)` / `View.chatRestore(collapsed)` | `#quote-btn`, `#chat-restore` | `chat.mjs:295-325`; `main.mjs:59-63` |

Tooltip (`tooltip.mjs`) e o balão `#ctx-tip` (`state.mjs:77-105`) continuam host: eles dependem de posição/foco e mexem no `title` dos elementos.

---

## 5. Riscos e armadilhas

- **Medição/scroll do PDF é a maior fronteira.** O viewport decide página atual pelo centro (`pdf.mjs:170`), re-renderiza por interseção (`:172`), guarda `scrollX/scrollY` antes de qualquer mutação (`:144`), tem guarda `_layingOut` para o scroll que o próprio código provoca (`:66,171`), `ResizeObserver` com debounce de 120 ms (`:96`) e `requestAnimationFrame` (`:172`). O view em Bend não deve tentar calcular isso; precisa de uma API de fatos (`scrollTop`, `clientHeight`, `offsetTop`, `offsetWidth`, `dpr`) e de um evento “viewport mudou”. O `goto` depende de `offsetTop > 0` (`:147`) e o layout é refeito inteiro a cada zoom/resize (`:171`).
- **Dois painéis.** Classes de grid (`pinned`, `single`, `other-min`, `has-min`, `has-other-min`) são derivadas do estado dos dois painéis (`pdf.mjs:135-139`; `state.mjs:238,255`) e o CSS usa `--pdf-left`/`--pdf-other` (`style.css:180-184`). Minimizar restaura largura (teste `ui-smoke.mjs:157-170`) e `has-min` desliga o split (`style.css:183`). O estado “quem está minimizado” precisa vir junto na hora de decidir as classes.
- **Drag/redimensionamento.** Os três divisores usam `setPointerCapture` + pointers (`main.mjs:57`, `main.mjs:58`, `pdf.mjs:182-187`) e têm teclado (`divider`: ±20 px 310–650; `calc-divider`: ±20 px, limite 72–70% da lateral; `pdf-divider`: ±2%, clamps em `pdf.mjs:176`). O arrasto da calculadora ainda força `collapsed=false` (`main.mjs:58`). Nada disso é decisão pura: o host precisa dar ponteiro/medidas e o view decidir valores com clamps.
- **`[hidden]` e animações.** `[hidden]{display:none!important}` (`style.css:705`) convive com animações de entrada por keyframe quando o elemento reaparece (`style.css:646-663`) e com `.closing` controlado por JS (toast `state.mjs:16`; find `pdf.mjs:109-117`; menus `main.mjs:23-26`; diálogos com `@starting-style` `style.css:538-543`). Se o Bend só trocar atributos, sem aplicar/remover `.closing` e sem esperar `transitionend`, os testes de foco (`ui-smoke.mjs:202-206`) e de fila de toast (`:187-190`) quebram.
- **Tema.** `data-theme` no `<html>` + `color-scheme` (`style.css:63-64`), persistido no `desk.json` (`main.cjs:422-424`) e lido no boot (`state.mjs:232`); inverter é por arquivo (`pdf.mjs:126`, teste `ui-smoke.mjs:207-215`). O main troca a cor de fundo da janela (`main.cjs:424`).
- **KaTeX/marked/DOMPurify/realce devem continuar host.** O `markup` protege matemática/assets por placeholder, sanitiza e devolve HTML (`chat.mjs:18-34`); os botões “Copiar”/“cópia” e o clique na imagem são delegados no `#messages` (`chat.mjs:553-554`). O Bend deve receber a árvore de mensagens com o HTML já pronto (ou um nó “html”) e não reparsear.
- **LaTeX no quiz.** Pergunta, `details`, rótulo de cada opção, observação e explicação do quiz passam pelo mesmo `markup()`/`markupInline()` do host (correção 2026-09-17: antes o enunciado mostrava `\(\frac{d}{dx}\)` cru porque era `textContent`). A view do quiz fornece strings cruas e o host devolve o HTML com KaTeX — o mesmo vale para qualquer texto vindo do Pi (diálogos inclusive).
- **Calculadora — decisão pendente F32 × double JS.** A referência usa `Number`, `Math.*`, `%`, notação científica e `toPrecision(12)` (`calculator.mjs:3,10,17-18`); os testes exigem igualdade de string `5`, `0.5`, `1` (`ui-smoke.mjs:20-21`; `subjects-ui.mjs:29`) e `512` para `2^3^2` (potência associativa à direita, `installed-smoke.mjs:11`). Em F32, `sqrt(16)+sin(pi/2)`, `sin(30)` e `sin(pi/2)` podem divergir na 7ª casa e `toPrecision(12)` não esconde o erro. Isto é **observação/risco**, não tarefa: a view da calculadora pode ser portada, mas a função de avaliação só entra depois da decisão (se F32, o host deve formatar/arredondar de forma equivalente e os testes viram a definição).
- **`--chat`/`--calc` e o layout.** O grid do `main` e o colapso do chat dependem de custom properties escritas por JS (`main.mjs:57-58`; `state.mjs:252-253`; `style.css:166,262`); `layoutSnapshot` lê valores computados (`state.mjs:45-49`) e o main valida faixas (`main.cjs:419,423`).
- **Colagem de rolagem nas mensagens.** `atBottom` mede antes de mutar (`state.mjs:35-39`) e `followBottom` decide depois (`chat.mjs:64-73`; `worklog-view.mjs:156-168`). Um aplicador que recria `#messages` inteiro perde “o usuário estava no fim”.
- **Foco e seleção.** `⌘F` escolhe o painel pelo `activeElement` (`main.mjs:62`), `Esc` devolve o foco ao painel (`main.mjs:71-73`), `←/→` usam o painel focado (`main.mjs:90`), a citação depende de `getSelection`/`Range` (`chat.mjs:246-325`). Estados de foco não são serializáveis — o host precisa expor “painel focado”.
- **Xournal++/captura.** `Conferir` só existe no macOS (`main.cjs:561-583`; `state.mjs:131`) e anexa a captura da janela visível escolhida por `chooseXournal` (`main.cjs:574`; `lib.cjs:50`) na bandeja de anexos — o requisito de visão (`supportsImages`) só aparece no envio. É fato de host; o view só decide habilitar/título.
- **GeoGebra.** O applet não é DOM do renderer: é um `WebContentsView` posicionado por `getBoundingClientRect` (`ggb.mjs:20-25`; `main.cjs:600-616`), escondido por visibilidade e lembrado por matéria (`main.cjs:41-55,617-627`); qualquer re-layout precisa reenviar o retângulo, inclusive no `resize` (`ggb.mjs:26`).
- **Notificações/tooltip/status-foot.** `notify.mjs` usa WebAudio + `window.desk.notify`/`badge` e só escuta eventos fora do modo teste (`notify.mjs:226-236`); o `status-foot` hoje lê o DOM dos selects e do medidor (`status-foot.mjs:14-26`) e observa mutações (`:100-104`) — ao portar, é melhor passar valores puros do que replicar a leitura de DOM. O tooltip troca `title` por `dataset.tip` (`tooltip.mjs:105-112`): se a view re-renderizar títulos, o balão some.
- **Atalhos.** O remap é do preload, antes de qualquer script (`preload.cjs:10-16,105-122`) e o editor depende do catálogo/localStorage (`keys.mjs:19-33,221-252`) e de `window.mesaKeys` (`keys.mjs:622-625`). Não mover para o Bend; só a árvore do `#keys-dialog` é view.
- **Contrato que não pode mudar:** seletores/`aria`/`dataset` fixados em `ui-smoke.mjs` (p.ex. `.pdf-panel`, `.pdf-select`, `.page-number`, `.page-total`, `.pdf-divider`, `.pdf-viewport`, `.pdf-page`, `.pdf-hl`, `.find-count`, `.pdf-find`, `.pdf-foot`, `.minimized`, `.textLayer span`, `.message.user/assistant`, `.message.quiz`, `.quiz-option[aria-checked]`, `.quiz-verdict`, `.quiz-send`, `.msg-copy`, `.codeblock/.code-copy`, `.work[data-live][data-expanded]`, `.work-head`, `.work-step[data-kind][data-status][data-detail]`, `.step-label`, `.step-toggle`, `.step-text`, `.attachment/.attachment-remove`, `img.plot/img.shot`, `#toast .toast-item`, `body.chat-collapsed`, `#chat-restore`, `#status-dot.online/.error`, `#stop[hidden]`, `#send[disabled]`, `#references.ggb`, `#ggb-bar`, `.brand-icon`, `#ctx-meter:not([hidden])`, `#auto-compact[aria-pressed]`, `#quote-btn`, `#course-tabs button[data-id][aria-selected]`, `#settings-dialog[open]`, `#end-day-dialog`, `#image-dialog[open]`, `#image-preview`, `#image-copy`, `#result`, `#angle`, `#expression`, `#calc-form button`, `#calc-guide`, `#session-select`, `.pdf-placeholder`, `--pdf-left`).
