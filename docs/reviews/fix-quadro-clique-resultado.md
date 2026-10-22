# Clique no botão do canto do quadro caía no iframe — resultado

Branch `fix-quadro-clique`, cortada do `main` local em `2df1f8b`.

## Sintoma

`node desk/tests/activity-viz-ui.mjs` reprovava em cerca de metade das rodadas
(2 de 4 no início desta investigação) em "1440x900 light: tela cheia cobre a
janela", com o rótulo ainda em "Tela cheia". O `pointerdown`/`mousedown` caía
no botão `[data-act="expand"]` e, uns 10 ms depois, o `pointerup`/`mouseup`, nas
mesmas coordenadas, caía em `IFRAME.activity-iframe`. O `click` ia para o
ancestral comum (`DIV.activity-stage`) e o handler do botão não rodava.

## Causa

A causa não estava no teste de acerto do OOPIF nem no tooltip. O que oscilava
era o layout da coluna do tutor, a cada quadro.

1. A descrição textual e o título do quadro (`.activity-sr`, #42) são
   `position:absolute` para ficarem fora da vista. O ancestral posicionado mais
   próximo deles era o `#chat` (`position:relative`), não o `#messages`. O slot da
   atividade não fica dentro de `.message`, que é `position:relative`. Assim, o
   bloco de contenção desses elementos era o `#chat`, e o scroller `#messages`
   (`overflow:auto`, sem `position`) não os continha. Eles escapavam do scroller
   na posição estática deles e entravam no overflow rolável do `#chat`.
2. Quando o quadro está acima da dobra e a atividade, abaixo, essa posição fica
   além do pé da coluna. No modo normal medido: `#chat.clientHeight` = 816,
   `#chat.scrollHeight` = 973 e o filho fora do fluxo com `bottom` = 973 (sonda:
   `activity-sr activity-title b=973 pos=absolute op=chat`). Os filhos em fluxo
   cabiam: o composer terminava em 817.
3. `state.mjs#syncChatScrollMode` liga `body.chat-scroll` quando
   `scrollHeight > clientHeight + 1`, condição que conta o filho escapado. No
   modo de rolagem, a conta de saída (`chrome + 84`) só olha o que está em fluxo
   e desliga a classe. O `ResizeObserver` agenda o próximo quadro, e o ciclo se
   repete.
4. Cada modo põe o conteúdo numa rolagem diferente. Medido por
   `requestAnimationFrame`, o topo do palco alternava entre `140` e `-397`, e o
   `#chat` entre 640 e 625 px de largura (a barra de rolagem). O
   `document.elementFromPoint` no centro do botão alternava entre `svg` e
   `IFRAME`. A classe mudou 91 vezes em 1,2 s, e o `data-fit` da fileira do
   composer, 364 (o `fitIndicator` mede três degraus a cada mudança de largura).
5. O clique do Playwright tem cerca de 10 ms entre o down e o up. Se uma virada
   de quadro cai nesse intervalo, o `mouseup` acerta o iframe. O tooltip armando
   e desarmando a cada ~13 ms é consequência disso: o alvo sob o ponteiro troca a
   cada quadro e o `src/tooltip.mjs` só segue o `pointerover`/`pointerout`. Pelo
   mesmo motivo, `opacity:1` nas ferramentas não mudava nada.

Isso explica os detalhes observados:

- **"Só no primeiro clique depois do acento e do tema."** Depende só da
  posição de rolagem. O `hover()` do Playwright rola o palco para a vista, e o
  primeiro bloco de tela cheia era o que mais vezes deixava a atividade
  abaixo da dobra. Em 900×650, a media query `max-height:700px` decide a
  rolagem e a classe não é usada.
- **"O rect do botão fica estável."** As medições caíam sempre na mesma fase do
  ciclo.
- **Para o usuário:** com uma visualização na conversa e outra atividade
  abaixo, numa janela alta, a coluna inteira trocava de layout a cada quadro.
  Isso gastava CPU e fazia o clique em Tela cheia, Recomeçar ou Parar falhar
  como no teste.

### Como foi provado

As sondas foram cópias temporárias do teste, já apagadas:

- listeners em captura no `document` e `MutationObserver` no cartão, para ver a
  sequência down no `svg` → `pointerout svg rel=IFRAME` → up no `IFRAME`, com o
  `title`/`data-tip` alternando;
- ponteiro parado sobre o botão por 1,2 s, sem clicar: 183 eventos de
  fronteira e `elementFromPoint` alternando entre `svg` e `IFRAME`. O registro
  de mutações mostrou `BODY class` a cada quadro;
- amostra por quadro de `body.chat-scroll`, `#chat` (`clientWidth`,
  `clientHeight`, `scrollHeight`) e topo do palco: o ciclo acontece **com o
  ponteiro longe do quadro**, então o tooltip e o iframe ficam descartados como
  causa;
- busca dos descendentes fora do fluxo que passam do pé do `#chat`: só os dois
  `.activity-sr`, com `offsetParent` = `#chat` e `bottom` igual ao
  `scrollHeight`;
- com a correção: `scrollHeight` = 816, uma única leitura em 20 quadros e
  `elementFromPoint` sempre `svg`.

## Correção

`desk/style.css`: `#messages{position:relative; …}`. O scroller passa a ser o
bloco de contenção de tudo o que mora dentro dele. Nenhum filho fora do fluxo
escapa mais para o overflow do `#chat`, e o `syncChatScrollMode` volta a medir
só o que é da coluna.

Escolhi o `#messages` em vez de `.activity-card{position:relative}` porque a
falha é de uma classe inteira: qualquer elemento `absolute` futuro na conversa,
fora de `.message`, causaria o mesmo pisca-pisca. Conferi os `absolute` dentro
do `#messages`: `.message .role`, `.msg-copy`, `.code-copy`, `.code-lang`,
`.img-copy` e `.activity-tools` já têm ancestral posicionado mais próximo
(`.message`, `.codeblock`, `.img-wrap`, `.activity-stage`), então não se mexem.
`position:relative` sem `z-index` não cria contexto de empilhamento, e a tela
cheia (`position:fixed`, z 60) continua relativa à janela, porque `relative` não
é bloco de contenção de `fixed`.

Com o layout parado, o down e o up caem no mesmo botão e os três botões de
canto recebem o clique inteiro. Isso vale também com o quadro em laço: o teste
de acerto é da página-mãe, que agora é estável, e o `mesa-interactive-ui` e o
`activity-card-ui`, que param uma atividade travada, seguem verdes.

### Opções descartadas

- **`pointer-events:none` no iframe com botão pressionado, ou ativar no
  `pointerdown`:** mascaram o sintoma num botão e deixam a coluna piscando, o
  custo de CPU e qualquer outro clique na conversa errando o alvo.
- **Mexer no laço do tooltip:** o tooltip só reage à troca de alvo. Ele não é a
  causa.
- **Tirar as ferramentas de cima do iframe:** mudaria o desenho aprovado no #42
  sem resolver a oscilação.
- **Endurecer o `syncChatScrollMode`** para medir a entrada no modo de rolagem
  pelo mesmo critério em fluxo da saída: a assimetria só vira ciclo quando algo
  escapa para o overflow do `#chat`, e a correção estrutural acaba com isso.
  Fica registrado como risco latente para popovers absolutos filhos diretos do
  `#chat` (por exemplo `#conversations-pop`, que hoje é ancorado no topo e tem
  altura limitada).

## Teste (asserções só acrescentadas)

`desk/tests/activity-viz-ui.mjs` ganhou o bloco "coluna estável com o quadro
acima da dobra", antes da tela cheia, em 1440×900. Ele rola o palco da
visualização para o topo, deixa a atividade abaixo da dobra e afirma:

1. nenhum descendente `absolute`/`fixed` do `#messages` tem `offsetParent` fora
   dele;
2. em 20 quadros seguidos, o par (`body.chat-scroll`, topo do palco) tem um
   único valor.

Nenhuma asserção existente foi afrouxada. Prova negativa, com a correção
revertida no `style.css`:

- asserção 1: reprovou 3 de 3 (`activity-sr activity-title`,
  `activity-sr activity-alternative` × 2 quadros);
- asserção 2, com a 1 retirada numa cópia: reprovou 3 de 3
  (`["true/-397","false/84"]` e `["true/-397","false/-397"]`).

Com a correção, as duas passam.

## Rodadas

- `node desk/tests/activity-viz-ui.mjs` **15 vezes seguidas: 15 PASS**, de 20 a
  23 s cada.
- `npm run ui -- activity,mesa-interactive` **3 vezes: 5 ok, 0 falhas, 0
  pulados** em cada (`activity-concurrency-ui`, `activity-card-ui`,
  `activity-preview-ui`, `mesa-interactive-ui`, `activity-viz-ui`).

## Portões (`desk/`)

Resultado final, todos verdes:

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | ok: toolchain fixada, 88 artefatos reproduzíveis (nenhum byte mudou), provas verdes |
| `MESA_GATE_CACHE=0 npm test` | 1313/1313 (rodadas 2 e 3) |
| `npm run ui` | 59 ok, 0 falhas, 0 pulados (rodada 4, já sobre os commits) |
| `npm run hunts` | 24 ok, 0 falhas, 0 pulados (`hunt-handoff` incluído, com `chat/node_modules`) |

No caminho apareceram falhas intermitentes que **não vêm desta correção**. Cada
uma passou isolada e/ou reprovou também com o `style.css` original de `2df1f8b`:

- `npm test`, rodada 1: `activity-bridge.test.mjs:104` ("ponte detecta troca de
  escopo durante a publicação", 403 em vez de 409) e
  `study-search.test.mjs:177` ("texto do PDF na página certa"). Isoladas, 3/3
  verdes; nas duas rodadas completas seguintes, verdes.
- `npm run ui`, rodada 1: `pdf-models-dialog-ui`. **Corrigido nesta branch**
  (commit separado). O teste redimensionava `BrowserWindow.getAllWindows()[0]`,
  e a janela escondida da prévia do PDF às vezes vinha primeiro. O
  `setSize(900,650)` ia para ela e a Mesa ficava em 1440. Medido: janela de
  794×859 sem tamanho mínimo e `innerWidth` da Mesa parado em 1440 por 8 s.
  Falhou 6/6 com o CSS original e 6/6 com o novo. Com o alvo trocado para
  `app.browserWindow(page)` e a espera do tamanho pedido: 4/4, e verde nas
  rodadas completas. Nenhuma asserção mudou.
- `npm run hunts`, rodada 1: `hunt-pdf` ("canvas nítido": a página 200 ainda sem
  canvas, `null`). Isolado, 3/3 verde; na rodada completa seguinte, 24/24.
- `npm run ui`, rodada 2: `tutor-states-ui` e `ui-smoke` estouraram juntos o
  prazo de 600 s no mesmo minuto. Isolados, passaram em 22 s e 121 s.
- `npm run ui`, rodada 3: `improvements-ui` (`toastWait('tentativas
  acabaram')`, linha 52, prazo de 25 s). Com o `style.css` original, reprovou
  2/6, então a falha é anterior.

A máquina tem dois monitores (Retina e um externo de 1920×1080 a 75 Hz, onde
as janelas dos testes abriram, `dpr=1`), o que pode pesar nessas
intermitências. Elas ficam como continuação proposta: um teste que
redimensiona ou mede `getAllWindows()[0]` existe em 44 arquivos, e o toast da
fila do `improvements-ui` é outra corrida.

## Decisões

- Corrigi a contenção no CSS da coluna e não no quadro nem no teste: a falha é
  do layout da conversa e afeta o usuário, não só o Playwright.
- Mantive `src/tooltip.mjs`, `src/activity.mjs`, `src/activity.css` e
  `state.mjs` sem mudanças.
- Rodei `npm ci` em `chat/` só para o `hunt-handoff` não ser pulado. Nenhum
  arquivo versionado de `chat/` mudou.
- A linha das Visualizações no mapa do `AGENTS.md` cita a nova cobertura do
  `activity-viz-ui`.
- Corrigi só o `pdf-models-dialog-ui` dentre os testes instáveis, porque ele
  reprovava sempre neste ambiente e travava o portão. Os outros 43 arquivos com
  `getAllWindows()[0]` e as demais corridas ficam para uma sessão própria, para
  não misturar com a correção do quadro.
- Commits: `fix(desk)` (CSS + teste de regressão + `AGENTS.md`),
  `test(desk)` (alvo do redimensionamento no `pdf-models-dialog-ui`) e este
  relatório. Sem push.
