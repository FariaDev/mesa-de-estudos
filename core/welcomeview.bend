import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View do vazio da conversa (`#welcome`) dos dois apps.
#
# Mesa (`desk/`): o vazio que aparece no boot e a cada troca de matéria,
# enquanto o Pi não conectou. O host entrega o título já resolvido — o nome da
# matéria na troca, vazio no boot — e este núcleo devolve a árvore que o
# `desk/src/view-host.mjs` monta:
#   - `#welcome` (div) com o título (`h3`, só quando não é vazio), o botão
#     `#connect` e o parágrafo "Sessão local desta matéria.";
#   - o clique do botão é handler do host (`Connect`), como o `toggleMeterTip`
#     do rodapé: quem chama `window.desk.connect()` é o aplicador.
#
# O SVG do botão é asset do host (`desk/icons.mjs`), injetado depois do render
# (como o ícone do título da calculadora) — aqui só o texto. Nada aqui lê o
# DOM, mede ou fala IPC: a troca de matéria só decide o título.
#
# Conversa (`chat/`): o mesmo `#welcome`, com outro shape (1:1 com o que o
# `chat/src/state.mjs` montava à mão e com o `chat/index.html`):
#   - `#welcome` (div) com `<h2>O que vamos conversar?</h2>` e o parágrafo
#     "Perguntas rápidas, anexos e busca na web. …", sempre;
#   - a cauda depende dos fatos `connected`/`connecting`: conectado não tem
#     cauda, conectando mostra a nota `.welcome-note` e desconectado mostra o
#     `button#connect.btn` "Conectar ao Pi";
#   - o clique cai na tabela de handlers do host (`connect`), que é quem fala
#     IPC: o host decide quando mostrar/esconder (repinta só com `#welcome` na
#     tela) e mantém timers e foco.
# ---------------------------------------------------------------------------

# O título é opcional: string vazia não vira `h3` (o vazio de boot não tem).
def welcomeTitle(t: String, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      [V.viewEl("h3", Nil{}, [V.viewText(t)])]

def welcomeButton() -> V.ViewNode:
  V.viewEl(
    "button",
    [V.attrType("button"), V.attrId("connect"), V.attrOn("click", "Connect")],
    [V.viewText("Conectar ao Pi")]
  )

def welcomeParagraph() -> V.ViewNode:
  V.viewEl("p", Nil{}, [V.viewText("Sessão local desta matéria.")])

# Filhos do `#welcome`: título (se houver), botão e parágrafo, nesta ordem.
def welcomeChildren(+title: String) -> List<&2, V.ViewNode>:
  List.append(
    &2,
    V.ViewNode,
    welcomeTitle(title, String.is_empty(title)),
    [welcomeButton(), welcomeParagraph()]
  )

def welcomeView(+title: String) -> V.ViewNode:
  V.viewEl("div", [V.attrId("welcome")], welcomeChildren(title))

# ---------------------------------------------------------------------------
# Vazio da Conversa (`chat/`), prefixado para não colidir com os construtores
# da Mesa acima. O host chama `chatWelcomeView(connected, connecting)` e
# aplica no `#messages`; o clique do botão é a entrada `connect` da tabela de
# handlers (quem chama `window.chat.connect()` é o aplicador).
# ---------------------------------------------------------------------------

def chatWelcomeQuestion() -> V.ViewNode:
  V.viewEl("h2", Nil{}, [V.viewText("O que vamos conversar?")])

def chatWelcomeIntro() -> V.ViewNode:
  V.viewEl("p", Nil{}, [V.viewText("Perguntas rápidas, anexos e busca na web. Só este chat — sem arquivos da mesa.")])

def chatWelcomeNote() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("welcome-note")], [V.viewText("Conectando ao Pi…")])

def chatWelcomeButton() -> V.ViewNode:
  V.viewEl(
    "button",
    [V.attrType("button"), V.attrId("connect"), V.attrClass("btn"), V.attrOn("click", "connect")],
    [V.viewText("Conectar ao Pi")]
  )

# A cauda do vazio: conectado não tem cauda; conectando mostra a nota; senão,
# o botão. `connected`/`connecting` são fatos prontos do host.
def chatWelcomeTail(connected: Bool, connecting: Bool) -> List<&2, V.ViewNode>:
  match connected:
    case True{}:
      Nil{}
    case False{}:
      match connecting:
        case True{}:
          Con{chatWelcomeNote(), Nil{}}
        case False{}:
          Con{chatWelcomeButton(), Nil{}}

def chatWelcomeChildren(connected: Bool, connecting: Bool) -> List<&2, V.ViewNode>:
  List.append(
    &2,
    V.ViewNode,
    [chatWelcomeQuestion(), chatWelcomeIntro()],
    chatWelcomeTail(connected, connecting)
  )

def chatWelcomeView(connected: Bool, connecting: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrId("welcome")], chatWelcomeChildren(connected, connecting))
