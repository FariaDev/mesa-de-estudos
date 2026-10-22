# Mesa no Codex — implementação do polimento de UI/UX (2026-10-07)

Rodada de implementação do sub-agente (Pi Mesa Dev, Command Code
`deepseek-v4.1-flash`, thinking max, full-access) a pedido do root, sobre o
painel MCP Apps do plugin Codex (`codex-plugin/mesa-study`), mantendo a
aproximação da Mesa genuína e **sem** tocar servidor, skills, manifests,
versão, app Electron, `desk/`, `core/`, `chat/`, `claude-mod/` ou
`visual-check/`.

Arquivos escritos (somente estes):

| Arquivo | sha256 (antes) | sha256 (depois) |
|---|---|---|
| `codex-plugin/mesa-study/ui/desk.html` | `0f0cd3b4031670dc0ce3292ef3c13053a2aa1e093db72601c2670b4adf37664b` | `0ba923fbe73b346525adb223e63f07ba470c269315a26d5b43062b471e2bd00d` |
| `codex-plugin/mesa-study/tests/ui-client.test.mjs` | `29eeb897d5cf9aae9fbe6269f98e5ebc034e4a85a119a645554f64592e21586c` | `896174bbe08882d98fdcb27541e3242429df82e2dfbbe62fab7ce95ef637c4d8` |
| `codex-plugin/mesa-study/ui/README.md` | `c02859a50b8ae9b12b3c72abf36791551b6df1d39cdc9c57d82a6492aef637e3` | `d5175a62c834eeefaedd2ea79f925eaf96cf78ae0d15b9685fa8d5edc1958d6d` |

Baseline de `ui/desk.html` conferido por hash contra a cópia de trabalho do
root em `codex-plugin/.local-smoke/mesa-context-final-install-20261007-1jdjyqsc/plugin/ui/desk.html`
(`0f0cd3b4…`, idêntico). Nenhum commit, push, instalação, reinício, modelo,
captura real, browser ou leitura de material pessoal nesta rodada.

## 1. O que mudou (por pedido do root)

### 1.1 Tutoria: contexto explícito e ajuda honesta

- `aside#mesa-study` agora tem cabeçalho **Tutoria** (`h2#mesa-study-title`) e
  um resumo vivo do contexto ativo (`p#mesa-context`, `data-context="page" |
  "capture" | "none"`): `arquivo.pdf · página N de M` ou
  `Xournal++ — Janela`, sempre do que está **realmente exibido**
  (`state.shownContext`, fixado no commit).
- Sem prévia válida o resumo limpa: falha vira `A prévia falhou; nenhuma
  página ativa.` e não repete referência velha; depois de um `mesa_open` sem
  página ou de erro de captura/página, o resumo nunca mostra um contexto que
  a ajuda desligada não aceitaria.
- O rodapé do composer lembra que **a resposta aparece nesta conversa do
  Codex** e mantém os atalhos (`⏎ pede ajuda · ⇧⏎ quebra linha`).
- O botão `#mesa-help` ganhou `aria-describedby="mesa-context"`; a seção é
  nomeada por `aria-labelledby`.
- Mensagens de gate em linguagem de usuário, sem jargão de protocolo:
  - tools: `Este aplicativo não permite chamar as ferramentas da Mesa; esta
    ação fica desativada.` (títulos de biblioteca, navegação, janelas e
    captura);
  - mensagens: `Este aplicativo não permite enviar mensagens; pedir ajuda
    fica desativado.`;
  - handshake: erro `Sem conexão com o aplicativo do Codex: <motivo>` e
    status `Reabra a Mesa por uma conversa do Codex para tentar de novo.`

### 1.2 Legenda fora do papel + área de leitura estável

- O rodapé `.pdf-foot` saiu de dentro de `.pdf-stage` (era `position:
  absolute` com gradiente sobre a página) e virou uma linha **no fluxo** do
  cartão, com `border-top`, `#mesa-doc-label` truncável e o chip de
  carregamento à direita. A página não é mais coberta por legenda.
- `.pdf-stage` continua com altura fixa (`--stage-h` com `clamp`), então a
  área de leitura é estável e o rodapé não encolhe o palco.
- Sem `sticky` abaixo de 720px (decisão da rodada anterior preservada): o
  composer fica no fluxo e não cobre o PDF. Alturas inline seguem limitadas.
- Tela cheia só é reconhecida quando o host declara `fullscreen` **e** está
  nesse modo: o painel aplica `data-display="fullscreen|inline"` no
  `documentElement` (removido sem a capacidade) e o CSS
  `:root[data-display='fullscreen']{--stage-h:clamp(320px,70vh,880px)}`
  oferece palco maior, ainda limitado. Sem ack, nada muda.

### 1.3 Carregamento visível e rolagem

- Novo chip `#mesa-busy` (`role="status"`, `aria-live="polite"`, spinner CSS,
  `prefers-reduced-motion`) no rodapé do leitor, com o texto da operação
  certa: `Carregando página N…` (página) ou `Capturando a janela…` (captura).
  `aria-busy` e `.is-busy` continuam no `#mesa-viewport`.
- Em voo, a prévia provada permanece visível (opacidade reduzida) até o
  sucesso; a ajuda fica desligada nesse intervalo (`helpContextReady()` já
  rejeita `opActive`), então nunca se pede ajuda com prévia antiga. No
  cancelamento (`ui/notifications/tool-cancelled`) o busy é limpo e a ajuda
  volta a valer sobre a prévia provada (antes ficava desligada por engano).
- Zoom nunca mexe em `scrollTop/scrollLeft`; página **diferente** (chave
  `page:<file>#<page>`) volta ao topo no sucesso; reenvio da mesma página não
  reseta.
- Status global fica quieto no caso normal: `Página N de M.` (a antiga prosa
  com nome do arquivo e aviso de gate saiu). `Mesa aberta.` só acrescenta
  aviso quando `ready.pdf`/`ready.windows` estão fora do normal.

### 1.4 Vazio, biblioteca e desabilitados

- Placeholder de vazio acionável (`Nenhuma página aberta. Escolha um PDF na
  lista acima ou peça uma página ao tutor.`) e placeholder próprio de falha
  (`A prévia falhou e foi liberada. Escolha um PDF ou tente de novo.`).
- Biblioteca vazia ganha nota `Nenhum PDF autorizado. Confira as pastas
  liberadas para a Mesa na configuração do plugin.`; sem tools/call a nota é
  a mensagem de gate em linguagem de usuário.
- Títulos de controle desabilitado cobrem o motivo: `Aguarde a conexão com o
  aplicativo.` enquanto o handshake não terminou, `Escolha um PDF na lista
  para navegar pelas páginas.` sem documento, e os gates acima.
- `Conferir Xournal++` indisponível agora diz `Conferir Xournal++ está
  indisponível neste servidor; a leitura de PDF continua funcionando.`

### 1.5 Pedido de ajuda pendente

- Novo `#mesa-help-pending` (`role="status"`, hidden): `Enviando o pedido ao
  tutor…` enquanto o único `ui/message` está em voo; some no sucesso e na
  recusa. O status global não duplica mais o aviso de envio.
- Recusa tratada como falha honesta: `O aplicativo recusou o pedido de ajuda;
  o rascunho ficou guardado.` + `Pedido não enviado.` — o rascunho continua no
  campo, nada de entrega inventada nem retry automático. O tipo do pedido
  (página/captura) continua capturado no envio (fix preservado e coberto pelo
  teste existente "ajuda: confirmação mantém o tipo do pedido…").

### 1.6 Controles e acessibilidade

- `touch-action:manipulation` e `-webkit-tap-highlight-color:transparent` nos
  botões (alvos seguem 28px, acima do mínimo WCAG 2.5.8); `:focus-visible`
  preservado.
- `#mesa-zoom-fit` sempre rotulado `Ajustar`, com `aria-pressed` refletindo o
  modo de ajuste; `#mesa-zoom-value` mostra `Ajustada` no ajuste, `N%` no zoom
  explícito e `—` sem prévia (o antigo `100%` inventado para o fit saiu).
- As novas regiões vivas (`#mesa-busy`, `#mesa-help-pending`) ficam `hidden`
  fora do uso; `#mesa-context` não é live region (evita eco redundante);
  nenhum `focus()` novo (o painel continua sem roubar foco).

## 2. Testes

`tests/ui-client.test.mjs` (VM + DOM mínimo + ponte simulada) foi ajustado e
ampliado. Contagem: **49 casos** no arquivo (era 43). Novos casos de
comportamento:

1. `tutoria: contexto ativo mostra página/captura, limpa na falha e não repete
   referência velha` — resumo por página e por captura, resumo em voo segue o
   exibido, falha limpa e desliga ajuda.
2. `carregando: chip no leitor mantém a prévia antiga, anuncia busy e desliga
   a ajuda até o sucesso` — texto exato do chip, `aria-busy`, prévia provada
   retida, ajuda desligada, status curto no sucesso.
3. `rolagem: zoom preserva a posição; página diferente volta ao topo e
   reenvio da mesma não` — `scrollTop/Left` observáveis no DOM falso.
4. `pedido: estado de envio visível, um ui/message e rascunho preservado na
   recusa` — pendência visível, um envio, rascunho mantido, recusa sem entrega
   inventada.
5. `tela cheia: palco extra só quando o host declara e está em fullscreen` —
   `data-display` ausente/`inline`/`fullscreen` e volta.
6. `ponte: falha no handshake vira orientação de usuário, sem jargão de
   protocolo` — erro real visível + status acionável.

Asserções existentes atualizadas (sem mudar a intenção): gates passam a
verificar a frase de usuário (não `tools/call`/`ui/message`), o teste de zoom
passa a verificar `Ajustada`/`N%`/`aria-pressed` e a ausência de
`position:absolute` no `.pdf-foot`; cancelamento agora pina busy limpo e ajuda
religada; teardown pina `#mesa-help-pending`/`#mesa-busy` escondidos; falha de
captura pina contexto limpo; vazio/biblioteca vazia/placeholder de falha
ganharam asserções acionáveis; acessibilidade pina `Tutoria`,
`aria-labelledby`, `aria-describedby`, `#mesa-busy` e `#mesa-help-pending`.

O que a suíte **não** prova: layout real, recorte de texto, spinner,
comportamento do host Codex, captura real. Continua sendo VM + ponte
simulada; a validação de navegador/Codex é do root.

## 3. Checagens executadas

- `node --test tests/ui-client.test.mjs` → **49/49 pass**, 0 fail.
- `node --test tests/ui-client.test.mjs tests/ui-server.test.mjs
  tests/ui-server-library.test.mjs` → **71/71 pass**, 0 fail (recurso real e
  biblioteca reais inclusos).
- `npm test` (suíte completa do pacote) → **178/178 pass**, 0 fail, 0 skipped,
  7,8 s; o recurso na disco continua sendo servido inline e idêntico
  (`tests/ui-server.test.mjs` compara com `ui/desk.html`).
- `node --check` no script extraído e no teste: OK.
- Node v26.10.0, execução 2026-10-07 22:3x–22:4x -03, só com fixtures
  sintéticas e diretórios temporários.

## 4. Formas/IDs para o QA de navegador do root

Novos/changed no DOM:

| Seletor | Forma |
|---|---|
| `aside#mesa-study` | `aria-labelledby="mesa-study-title"` |
| `h2#mesa-study-title` | texto `Tutoria` |
| `p#mesa-context` | `data-context="none|page|capture"`; texto `Nenhuma página ativa.` / `arquivo.pdf · página N de M` / `Xournal++ — Janela` / `A prévia falhou; nenhuma página ativa.` |
| `div.pdf-foot` | no fluxo, após `.pdf-stage`; sem `position:absolute` |
| `span#mesa-busy.pdf-busy` | `role="status" aria-live="polite"`, hidden; textos `Carregando página N…` / `Capturando a janela…`; `::before` é o spinner |
| `p#mesa-help-pending.composer-pending` | `role="status"`, hidden; texto `Enviando o pedido ao tutor…` |
| `button#mesa-help` | ganhou `aria-describedby="mesa-context"` |
| `button#mesa-zoom-fit` | texto `Ajustar`, `aria-pressed="true|false"` |
| `span#mesa-zoom-value` | `Ajustada` / `NN%` / `—` |
| `html` | `data-display="inline|fullscreen"` só com `fullscreen` declarado |

Roteiro sugerido para o harness real (PDF sintético): 1280×800 e 360×420/650;
conferir legenda fora do papel (sem gradiente sobre a página), chip
"Carregando página…" com prévia anterior retida, `Tutoria` com contexto
mudando página→captura e limpando em falha injetada, pendência visível no
envio, rolagem preservada no zoom e reiniciada na troca de página, e
`data-display` só com `renderFullscreen` do host simulado.

## 5. Limites e o que não foi feito

- Sem validação no app Codex real (painel dentro do Codex, `data:image/png`,
  `tools/call` do iframe, `hostCapabilities` cru, captura real continuam
  pendentes). Nada aqui autoriza dizer "compatível com o Codex".
- Sem browser/harness nesta rodada; nenhuma medição de layout foi feita (a
  suíte é VM). O QA visual é do root.
- Sem alteração em `server/`, `skills/`, `.codex-plugin/plugin.json`,
  `package.json`/versão, `.mcp.json`, staging/instalado, app Electron, curso,
  sessões ou credenciais. O painel continua sem rede, sem dependências, sem
  `innerHTML` de dado de ferramenta e com as sete ferramentas intocadas.
- `ui/README.md` foi sincronizado com o comportamento novo; a cópia
  instalada/staged continua por conta do root no empacotamento.
- O rótulo do rodapé (`#mesa-doc-label`) mantém a semântica antiga de "última
  referência conhecida" mesmo após falha (pinned por teste de época); quem
  limpa no erro é o resumo da Tutoria, que é o que a ajuda usa. Essa distinção
  é deliberada e está documentada no README.
- Durante a sessão, `scripts/doctor.mjs` e `scripts/prepare-local.mjs`
  apareceram com mtime novo (context review r4 concorrente); não foram
  tocados por esta rodada — os três arquivos deste relatório são os únicos
  com alteração minha.
