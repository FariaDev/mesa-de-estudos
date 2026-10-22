import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Menções `@` das ferramentas do tutor na caixa de mensagem (ticket #53).
# Módulo só da Mesa.
#
# Digitar `@` abre uma lista curta das ferramentas que o motor atual tem; a
# escolhida vira um chip na caixa e chega ao tutor como instrução ("use a
# ferramenta X nesta resposta"). O catálogo, a regra de quem aparece, os chips
# (sem repetir, no máximo `maxChips()`) e o cabeçalho que marca a instrução na
# mensagem moram aqui — UMA fonte para os dois motores. O texto do nome, da
# descrição e da instrução é do catálogo de idiomas (`mention.<id>.name`,
# `.desc`, `.instruction`, #41): o núcleo devolve a chave.
#
# Quem aparece: `visualizar`, `atividade` e `pdf` são do quadro e do PDF do
# tutor, que os dois motores têm na sessão principal; `geogebra` só onde o
# motor oferece a ferramenta (capacidade `geogebra`, `core/agentcaps.bend`).
#
# Fronteira (host): o gatilho `@…` no campo, o filtro pelo nome no idioma da
# tela, o índice ativo com wrap, a inserção do chip, a posição do popover, o
# foco e a troca do slot `.mention-icon` pelo SVG de `icons.mjs`. Tudo aqui é
# construtor puro: entra fato resolvido, sai árvore para o `view-host.mjs`.
# ---------------------------------------------------------------------------

type MentionTool is Data:
  MentionTool{id: String, icon: String}

def maxChips() -> Nat:
  3n

# Ordem da lista: a primeira é a que o ⏎ insere sem filtro.
def catalog() -> List<&2, MentionTool>:
  [ MentionTool{"geogebra", "graph"}
  , MentionTool{"visualizar", "board"}
  , MentionTool{"atividade", "sparkles"}
  , MentionTool{"pdf", "book"}
  ]

# ---------- quem aparece ----------

def toolAllowed(tool: MentionTool, geogebra: Bool) -> Bool:
  match tool:
    case MentionTool{+id, icon}:
      Bool.or(geogebra, Bool.not(String.eq(id, "geogebra")))

def offeredCons(allowed: Bool, tool: MentionTool, rest: List<&2, MentionTool>) -> List<&2, MentionTool>:
  match allowed:
    case True{}:
      Con{tool, rest}
    case False{}:
      rest

def offeredFrom(xs: List<&2, MentionTool>, +geogebra: Bool) -> List<&2, MentionTool>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      offeredCons(toolAllowed(h, geogebra), h, offeredFrom(t, geogebra))

# As ferramentas que o motor atual oferece, na ordem do catálogo.
def offered(geogebra: Bool) -> List<&2, MentionTool>:
  offeredFrom(catalog(), geogebra)

# ---------- chips ----------

def hasId(xs: List<&2, String>, +id: String) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, t}:
      Bool.or(String.eq(h, id), hasId(t, id))

def idCount(xs: List<&2, String>) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{h, t}:
      Nat.add(idCount(t), 1n)

def appendId(xs: List<&2, String>, id: String) -> List<&2, String>:
  match xs:
    case Nil{}:
      Con{id, Nil{}}
    case Con{h, t}:
      Con{h, appendId(t, id)}

def addIdFull(full: Bool, xs: List<&2, String>, id: String) -> List<&2, String>:
  match full:
    case True{}:
      xs
    case False{}:
      appendId(xs, id)

def addIdUnique(dup: Bool, full: Bool, xs: List<&2, String>, id: String) -> List<&2, String>:
  match dup:
    case True{}:
      xs
    case False{}:
      addIdFull(full, xs, id)

# Chip novo no fim; repetido ou acima do teto não entra (a lista fica como está).
def addId(+xs: List<&2, String>, +id: String) -> List<&2, String>:
  addIdUnique(hasId(xs, id), Nat.is_ge(idCount(xs), maxChips()), xs, id)

def removeCons(same: Bool, h: String, rest: List<&2, String>) -> List<&2, String>:
  match same:
    case True{}:
      rest
    case False{}:
      Con{h, rest}

def removeId(xs: List<&2, String>, +id: String) -> List<&2, String>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      removeCons(String.eq(h, id), h, removeId(t, id))

# ---------- instrução na mensagem ----------

# Marca fixa (a mesma em qualquer idioma): é por ela que a Mesa tira o bloco do
# que o aluno vê (`desk/text.mjs`) e das prévias da lista de sessões
# (`core/sessions.bend`). Os ids ficam na marca, em ordem.
def blockMark() -> String:
  "[Ferramenta pedida na Mesa:"

def blockHeader(ids: List<&2, String>) -> String:
  String.append("\n\n", String.append(blockMark(), String.append(" ", String.append(String.join(ids, ", "), "]"))))

# A mensagem do aluno ganha o cabeçalho e, na linha de baixo, as instruções
# (já no idioma do aluno) numa linha só.
def instructionBlock(ids: List<&2, String>, lines: List<&2, String>) -> String:
  String.append(blockHeader(ids), String.append("\n", String.join(lines, " ")))

# ---------- chaves do catálogo ----------

def keyOf(+id: String, part: String) -> String:
  String.append("mention.", String.append(id, String.append(".", part)))

def nameMsg(id: String) -> String:
  M.msg(keyOf(id, "name"))

def descMsg(id: String) -> String:
  M.msg(keyOf(id, "desc"))

def instructionMsg(id: String) -> String:
  M.msg(keyOf(id, "instruction"))

# ---------- textos de casca ----------

def headText() -> String:
  M.msg("mention.head")

def footText() -> String:
  M.msg("mention.foot")

def listLabel() -> String:
  M.msg("mention.list")

def chipsLabel() -> String:
  M.msg("mention.chips")

# ---------- menu ----------

def itemId(i: Nat) -> String:
  String.append("mention-opt-", Nat.show(i))

def iconSlot(icon: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("mention-icon"), V.attrData("icon", icon), V.attrAria("hidden", "true")], [])

def textNode(+id: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("slash-text")],
    [ V.viewEl("span", [V.attrClass("slash-name")], [V.viewText("@"), V.viewText(nameMsg(id))])
    , V.viewEl("span", [V.attrClass("slash-desc")], [V.viewText(descMsg(id))])
    ]
  )

def itemNode(i: Nat, tool: MentionTool, +activeKey: String) -> V.ViewNode:
  match tool:
    case MentionTool{+id, icon}:
      +active = String.eq(id, activeKey)
      V.viewEl(
        "div",
        [ V.classes([V.classOn("slash-item", True{}), V.classOn("mention-item", True{}), V.classOn("active", active)])
        , V.attrId(itemId(i))
        , V.attrKey(id)
        , V.attr("role", "option")
        , V.attrAria("selected", V.boolStr(active))
        , V.attrOn("mousedown", "hold")
        , V.attrOn("mouseenter", "hover")
        , V.attrOn("click", "pick")
        ],
        [iconSlot(icon), textNode(id)]
      )

def itemViews.go(xs: List<&2, MentionTool>, +activeKey: String, +i: Nat) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{itemNode(i, h, activeKey), itemViews.go(t, activeKey, Nat.add(i, 1n))}

def itemViews(xs: List<&2, MentionTool>, activeKey: String) -> List<&2, V.ViewNode>:
  itemViews.go(xs, activeKey, 0n)

def menuView(open: Bool, items: List<&2, MentionTool>, activeKey: String) -> V.ViewNode:
  V.viewEl(
    "div",
    V.attrJoin([
      [ V.attrId("mention-menu")
      , V.attrClass("slash-pop mention-pop")
      , V.attr("style", "position:fixed;z-index:105")
      ],
      V.attrWhen(Bool.not(open), V.attr("hidden", ""))
    ]),
    [ V.viewEl("div", [V.attrClass("slash-head"), V.attr("role", "presentation")], [V.viewText(headText())])
    , V.viewEl(
        "div",
        [ V.attrId("mention-list")
        , V.attrClass("slash-list")
        , V.attr("role", "listbox")
        , V.attrAria("label", listLabel())
        ],
        itemViews(items, activeKey)
      )
    , V.viewEl("div", [V.attrClass("slash-foot"), V.attr("role", "presentation")], [V.viewText(footText())])
    ]
  )

# ---------- chips na caixa ----------

def chipNode(tool: MentionTool) -> V.ViewNode:
  match tool:
    case MentionTool{+id, icon}:
      V.viewEl(
        "span",
        [V.attrClass("mention-chip"), V.attrKey(id), V.attrData("tool", id)],
        [ iconSlot(icon)
        , V.viewEl("span", [V.attrClass("mention-chip-name")], [V.viewText("@"), V.viewText(nameMsg(id))])
        , V.viewEl(
            "button",
            [ V.attrType("button")
            , V.attrClass("mention-chip-remove")
            , V.attrKey(id)
            , V.attrAria("label", M.msg1("mention.removeAria", "name", keyOf(id, "name")))
            , V.attrOn("click", "remove")
            ],
            [V.viewText("×")]
          )
        ]
      )

def chipViews(xs: List<&2, MentionTool>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{chipNode(h), chipViews(t)}
