import Base
import ../view.bend as V
import ../welcomeview.bend as W

# ---------------------------------------------------------------------------
# Contrato do vazio da conversa (`#welcome`). Cenários concretos: o título é
# uma String fixa e as decisões (`String.is_empty`, `String.eq` do `attrGet`)
# normalizam. Nada de binder abstrato — como nas leis do status.
# ---------------------------------------------------------------------------

# Com título: `h3` + botão + parágrafo, nesta ordem.
law welcome_com_titulo:
  {V.kidsOf(W.welcomeView("Matéria B")) == [
      V.viewEl("h3", Nil{}, [V.viewText("Matéria B")]),
      W.welcomeButton(),
      W.welcomeParagraph()
    ] : List<&2, V.ViewNode>}

# Sem título (boot): nada de `h3` vazio.
law welcome_sem_titulo:
  {V.kidsOf(W.welcomeView("")) == [W.welcomeButton(), W.welcomeParagraph()] : List<&2, V.ViewNode>}

law welcome_id:
  {V.attrGet(V.attrsOf(W.welcomeView("Matéria B")), "id") == Some{"welcome"} : Maybe<&2, String>}

# ---------- botão ----------

law welcome_botao_id:
  {V.attrGet(V.attrsOf(W.welcomeButton()), "id") == Some{"connect"} : Maybe<&2, String>}

law welcome_botao_click:
  {V.attrGet(V.attrsOf(W.welcomeButton()), "on:click") == Some{"Connect"} : Maybe<&2, String>}

law welcome_botao_type:
  {V.attrGet(V.attrsOf(W.welcomeButton()), "type") == Some{"button"} : Maybe<&2, String>}

law welcome_botao_texto:
  {V.kidsOf(W.welcomeButton()) == [V.viewText("Conectar ao Pi")] : List<&2, V.ViewNode>}

# ---------- parágrafo ----------

law welcome_paragrafo:
  {V.kidsOf(W.welcomeParagraph()) == [V.viewText("Sessão local desta matéria.")] : List<&2, V.ViewNode>}

# ---------- vazio da Conversa (chat/) ----------

# Conectado: só título e parágrafo (sem nota e sem botão).
law chat_welcome_conectado:
  {V.kidsOf(W.chatWelcomeView(True{}, False{})) == [
      W.chatWelcomeQuestion(),
      W.chatWelcomeIntro()
    ] : List<&2, V.ViewNode>}

# Desconectado e sem conexão em curso: título, parágrafo e botão.
law chat_welcome_desconectado:
  {V.kidsOf(W.chatWelcomeView(False{}, False{})) == [
      W.chatWelcomeQuestion(),
      W.chatWelcomeIntro(),
      W.chatWelcomeButton()
    ] : List<&2, V.ViewNode>}

# Conectando: a cauda é a nota, nunca o botão.
law chat_welcome_conectando:
  {V.kidsOf(W.chatWelcomeView(False{}, True{})) == [
      W.chatWelcomeQuestion(),
      W.chatWelcomeIntro(),
      W.chatWelcomeNote()
    ] : List<&2, V.ViewNode>}

law chat_welcome_id:
  {V.attrGet(V.attrsOf(W.chatWelcomeView(False{}, True{})), "id") == Some{"welcome"} : Maybe<&2, String>}

law chat_welcome_pergunta:
  {V.kidsOf(W.chatWelcomeQuestion()) == [V.viewText("O que vamos conversar?")] : List<&2, V.ViewNode>}

law chat_welcome_intro:
  {V.kidsOf(W.chatWelcomeIntro()) == [V.viewText("Perguntas rápidas, anexos e busca na web. Só este chat — sem arquivos da mesa.")] : List<&2, V.ViewNode>}

law chat_welcome_nota_classe:
  {V.attrGet(V.attrsOf(W.chatWelcomeNote()), "class") == Some{"welcome-note"} : Maybe<&2, String>}

law chat_welcome_nota_texto:
  {V.kidsOf(W.chatWelcomeNote()) == [V.viewText("Conectando ao Pi…")] : List<&2, V.ViewNode>}

law chat_welcome_botao_id:
  {V.attrGet(V.attrsOf(W.chatWelcomeButton()), "id") == Some{"connect"} : Maybe<&2, String>}

law chat_welcome_botao_classe:
  {V.attrGet(V.attrsOf(W.chatWelcomeButton()), "class") == Some{"btn"} : Maybe<&2, String>}

law chat_welcome_botao_type:
  {V.attrGet(V.attrsOf(W.chatWelcomeButton()), "type") == Some{"button"} : Maybe<&2, String>}

# O nome do handler é o contrato com o `chat/src/state.mjs` (tabela handlers).
law chat_welcome_botao_click:
  {V.attrGet(V.attrsOf(W.chatWelcomeButton()), "on:click") == Some{"connect"} : Maybe<&2, String>}

law chat_welcome_botao_texto:
  {V.kidsOf(W.chatWelcomeButton()) == [V.viewText("Conectar ao Pi")] : List<&2, V.ViewNode>}
