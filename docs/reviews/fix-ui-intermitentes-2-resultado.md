# Intermitências dos testes de janela, parte 2 — resultado

Branch `fix/ui-intermitentes-2`, cortada do `main` local em `b5805d1`.
Continua o que ficou aberto em `fix-quadro-clique-resultado.md` e
`issue-40-auditoria.md`. Nenhuma asserção foi afrouxada e nenhum prazo foi só
aumentado; cada correção vem com a causa medida e a prova antes × depois.

## Preparação

- `visual-check/windows` copiado do checkout principal; `npm ci` em `desk/` e
  `chat/`.
- O `npm ci` deixou o Electron de `desk/` **truncado** (o
  `Electron Framework` com 15 MB de 190 MB; `dyld: … extends beyond end of
  file`) e o de `chat/` sem binário. Todo teste que sobe Electron reprovava com
  "Process failed to launch!". Reinstalei só o binário
  (`node node_modules/electron/install.js` nos dois). Nada versionado mudou.
  Vale lembrar numa worktree nova: se tudo que sobe Electron falha de uma vez,
  confira `node_modules/electron/dist/…/Electron --version`.

## 1. Janela errada: `getAllWindows()[0]` em 43 arquivos

**Causa.** A prévia do PDF e a medição das atividades abrem janelas escondidas
que às vezes vêm antes em `BrowserWindow.getAllWindows()`. Os testes
redimensionavam, mediam, capturavam pixel, mandavam evento ou procuravam a vista
do GeoGebra na primeira janela da lista. Várias esperas escondiam a corrida:
`Math.abs(innerWidth-w)<=12`, `innerWidth<=910` com `.catch(()=>{})` (a espera
vencida era engolida) e, no `tutor-pdf-ui`, medida logo depois do `setSize`
sem espera nenhuma.

**Correção** (`e132c3e`). `tests/helpers.mjs` ganhou:

- `pageWindow(app,page)` — a janela da página (`app.browserWindow(page)`);
- `resizeWindow(app,page,w,h,{content})` — redimensiona essa janela
  (`setSize`, ou `setContentSize` com `content:true`), confere que ela aceitou
  o tamanho pedido (pedido abaixo do mínimo de 900×650 é erro, não medida no
  tamanho errado) e só volta quando o renderer vê `innerWidth`/`innerHeight`
  iguais à área de conteúdo.

Os 43 arquivos usam os dois (resize, `capturePage`, `webContents.send`,
`getBounds`, `isVisible`, `reload`, `getOSProcessId`, vista nativa do
GeoGebra). `tests/test-harness.test.mjs` reprova qualquer teste que volte a
usar `getAllWindows()[0]`, e a regra está no `AGENTS.md`.

## 2. `activity-bridge` e `study-search` no `npm test`

### `activity-bridge.test.mjs` — "ponte detecta troca de escopo durante a publicação"

**Causa.** O teste mandava o pedido, dormia 30 ms e revogava o token. Sob carga
o pedido chegava à ponte depois da revogação; a ponte respondia 403 (token
desconhecido), o que é o certo nesse caso, e não o 409 (sessão mudou durante a
publicação) que o teste quer provar. Defeito do teste, não do app.

**Correção** (`5912430`). A revogação espera a publicação começar (o `publish`
de bancada avisa quando entrou). **Prova:** 60 cópias em paralelo, antes
4 reprovações em 260 execuções; depois 0 em 180.

### `study-search.test.mjs` — "texto do PDF na página certa"

**Causa.** A busca tem orçamento de 2,5 s (`core/studysearch.bend#timeBudgetMs`)
e confere o prazo antes de cada extração. O PDF da sessão Livre vem antes dos PDFs
da matéria (`gather`). Sob carga, a primeira extração (com o `import` frio do
PDF.js) passava do orçamento e os PDFs da matéria ficavam para a busca seguinte
(`truncated: true`), como desenhado. Medido sob 24 cópias: a primeira busca
leva cerca de 1 s. No `npm test`, que roda também Electrons e o portão, passa
do orçamento às vezes. **Reprodução determinística:** com a leitura de `.pdf`
atrasada em 2,6 s (`--import` que só atrasa o `readFileSync` da busca), o teste
original reprova sempre com a mesma mensagem.

**Correção** (`5912430`). O `find` do teste usa relógio parado (o assunto
dele é cobertura) e o orçamento ganhou teste próprio: com extração lenta
injetada, cada busca termina a extração começada, avisa que é parcial enquanto
sobra PDF, e a seguinte continua do cache até cobrir os três. O app não mudou.
Com o atraso de 2,6 s, o arquivo novo passa; sob 30 cópias, 0 reprovações em
60 execuções.

## 3. `hunt-pdf` — "canvas nítido" com a página 200 sem canvas

**Causa.** Restaurar o segundo leitor (que nasce minimizado) estreita o
primeiro. Sonda por quadro: o painel 0 passa de 1045 para 540 px em 62 ms; o
`render()` do leitor solta todos os canvases (`releasePageCanvas`) e recria as
páginas; aos 213 ms a página 200 fica sem canvas, e aos 230 ms ela volta. O teste
media logo depois de restaurar, sem esperar o desenho novo. Às vezes pegava o
intervalo (`null`, a falha relatada) e às vezes o canvas do layout **antigo**,
que passava por acaso.

**Correção** (`773ffea`). `waitPainted(painel,página)` espera a página pintada
no layout de agora: canvas presente e largura da página = largura útil do
leitor × zoom, a mesma conta do `render()`. Vale para a nitidez e para
"redimensionar a janela repinta a página visível". **Prova:** com a CPU do
renderer estrangulada 8× pelo CDP antes de restaurar, a versão antiga mediu
`null` 1/5 e o layout antigo 2/5; a nova mediu o layout novo 5/5.

**Observação, sem mudança no app:** ao mudar de largura, cada página visível
fica em branco entre soltar o canvas e pintar o novo (um quadro, 17 ms aqui;
mais sob carga). É desenho do leitor: o canvas antigo é solto na hora para
devolver memória. Se um dia incomodar, a saída é manter o canvas antigo
escalado até o novo chegar.

## 4. `tutor-states-ui` e `ui-smoke` estourando os 600 s juntos

**Não é lentidão real.** Sozinhos, 20 s e 118 s. Juntos pelo corredor, 2 por
vez, as três primeiras rodadas deram 21–23 s e 102–111 s. Em 20 rodadas do par,
os tempos ficaram iguais aos de cada um sozinho.

**É uma espera sem prazo.** Com o rastro temporário de cada fechamento
(mediana de 54 ms em 174 fechamentos), três casos travaram. Os três seguem a
mesma sequência:

1. sob carga (média de carga 17 com o WindowServer perto de 50%), o Electron
   não chega ao `ready` em 30 s: `firstWindow: Timeout 30000ms exceeded`;
2. o teste fecha o app e o `before-quit` roda; o `ready` só chega uns 30 ms
   depois. O boot (`main.cjs`, `whenReady`) vê `quitting` e retorna sem
   janela: no `desk.log`, "Ponte de material encerrada." e "Ponte de
   atividades encerrada." vêm do `.catch` dos `start()`;
3. o processo não sai. A amostra (`sample`) do processo principal 15 s depois
   mostra a thread principal ociosa no laço do AppKit, sem renderer, com só a GPU
   e o serviço de rede vivos;
4. antes desta branch, o `withArtifacts` chamava `app.close()`, que não tem
   prazo, e esperava esse processo até os 600 s do corredor. Os dois
   travaram no mesmo minuto porque nasceram juntos.

**Correção.** O fechamento agora tem prazo (`closeApp`, item 5): a falha aparece
em cerca de 45 s com o motivo real (`firstWindow`) e sem órfão. Um fechamento
preso grava runtime e capturas (`3cc73b0`); antes, o runtime era apagado
antes do erro.

**O que fica aberto.** O lançamento lento sob carga é do ambiente: em
30 lançamentos da Mesa em pares com a máquina ociosa, a janela abriu em
~0,5 s e o fechamento levou ~60 ms, sem nenhuma parada. Não reproduzi o
"recebe o `ready` depois do `quit` e não sai" de forma determinística. Com o
`loader.js` do Playwright e o `quit` antes, junto e depois do
`__playwright_run`, o processo sempre saiu. Por isso não mudei o `main.cjs`.
Se valer a pena, o candidato é o boot pedir `app.quit()` de novo quando
encontra `quitting` já ligado, em vez de só retornar, mas isso precisa de uma
reprodução antes.

## 5. Electron órfão e `npm test` preso

**Causa.** O Playwright sobe o Electron em grupo de processo próprio
(`detached`) e só o mata no `exit` do Node.

- O corredor matava o teste estourado com SIGKILL. O `exit` não rodava, e o
  Electron ficava órfão.
- Num SIGTERM, o Playwright tenta fechar o app com educação
  (`gracefullyCloseAll`) e espera para sempre se o app não responde. Era o
  "sem responder ao SIGTERM".
- `app.close()` e `page.evaluate` não têm prazo no Playwright, e o
  `node --test` não tinha prazo por teste. Uma espera sem fim no `study-ipc`
  segurava a rodada inteira com o Electron vivo.

**Correção** (`d36c417`).

- `tests/proc-tree.mjs`: árvore do teste lida do `ps` (pid + hora de início, para
  um pid reciclado nunca levar o SIGKILL de outro); `killTree`;
  `guardChildren`, que mata a árvore com SIGKILL na saída e em
  SIGTERM/SIGINT/SIGHUP; e `closeApp`, que fecha com prazo de 15 s. Se o app
  ficar preso, morre com SIGKILL e o teste reprova dizendo isso, porque app que
  não fecha é defeito.
- `testEnv` instala a guarda: todo teste que sobe Electron passa por ele.
- `run-suite.mjs`: no estouro manda SIGTERM, que aciona a guarda. 5 s depois
  manda SIGKILL no teste e em toda a árvore vista. A árvore é revista a cada
  segundo; o que o teste deixou vivo ao sair morre e aparece no resumo
  ("processos que sobraram vivos").
- `npm test` passa a rodar `node --test --test-timeout=180000 --test-force-exit`.
  Um teste preso vira falha, e o processo do arquivo sai, com a guarda matando
  o Electron. Os testes que precisam de mais tempo já declaram o próprio
  `timeout`.
- O `spawnSync` do Electron (`material-template`, `free-material-pdf`)
  estoura com SIGKILL. `withArtifacts`, `study-ipc` e `free-host-ipc` fecham
  com `closeApp`.

**Prova.**

| Cenário | Antes | Depois |
|---|---|---|
| `test-harness.test.mjs`: "Electron" de mentira (grupo próprio, surdo ao SIGTERM) deixado para trás por teste preso, preso e surdo, e que sai sujo | 3 de 3 vivos | 0 vivos; o resumo nomeia o pid que sobrou |
| `ui-smoke` real com prazo de 10 s | 4 processos Electron órfãos | 0 |
| teste que sobe a Mesa e trava num `page.evaluate` | `npm test` preso (morto no teto de 45 s), 4 processos vivos | reprova em 20 s, 0 vivos |

O fechamento com prazo pegou um caso no primeiro portão: o `hunt-calc-ggb`
fecha e relança o app, e o Playwright descarta o objeto do app já fechado
(`app.process()` lança). O `withArtifacts` antigo engolia esse erro. Agora
"app já fechado" quer dizer "nada a fechar", com teste (`eef22aa`).

## Repetições (de 10 a 15 por correção)

| Correção | Rodadas | Resultado |
|---|---|---|
| `activity-bridge` | 180 execuções sob 60 cópias | 0 falhas (antes 4/260) |
| `study-search` | 60 sob 30 cópias, mais a extração atrasada | 0 falhas |
| janela da página (`pdf-models-dialog-ui`, `activity-viz-ui`, `tutor-pdf-ui`, `free-study-ui`, `responsive-ui`) | 10 × 5 arquivos | 50/50 |
| `hunt-pdf` | 10 | 10/10, 0 Electron vivo |
| `test-harness.test.mjs` | 10 | 10/10 |
| par `tutor-states-ui` + `ui-smoke` | 20 pelo corredor | 38/40; as duas falhas foram o lançamento lento descrito no item 4, sem nenhum estouro de 600 s |

## Portões (duas rodadas completas seguidas, em `desk/`)

| Portão | Rodada 1 | Rodada 2 |
|---|---|---|
| `npm run verify:bend` | ok (117 s) | ok (70 s) |
| `MESA_GATE_CACHE=0 npm test` | 1326/1326 (141 s) | 1326/1326 (144 s) |
| `npm run ui` | 59 ok, 0 falha, 0 pulado (397 s) | 59 ok (414 s) |
| `npm run hunts` | 24 ok, 0 falha, 0 pulado (365 s) | 24 ok (342 s) |
| Electron vivo no fim | 0 | 0 |

Os 24 hunts incluem o `hunt-handoff`, porque o `chat/node_modules` estava
instalado.

## Commits

- `5912430` test: `activity-bridge` e `study-search` sem relógio da máquina
- `e132c3e` test: janela da página em vez de `getAllWindows()[0]` (43 arquivos)
- `d36c417` test: nenhum Electron sobra vivo; `npm test` não trava
- `773ffea` test: `hunt-pdf` mede depois do novo desenho
- `3cc73b0` test: fechamento preso guarda a evidência
- `eef22aa` test: `closeApp` com o app já fechado
- este relatório

Nenhum commit mexe no app (`main.cjs` e `src/` intactos): todas as causas
achadas e provadas eram dos testes ou do corredor. O que pode ser do app (o
Electron que recebe o `ready` depois do `quit` e não sai) está no item 4, sem
reprodução. Sem push, sem PR e sem subagentes. `desk/config.cjs` e `chat/`
não mudaram (em `chat/` só o binário do Electron foi reinstalado).
