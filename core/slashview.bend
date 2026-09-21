import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Menu de comandos do composer (`/`) — Mesa (`desk/`) e Conversa (`chat/`).
#
# Um só núcleo serve os dois apps: o artefato é gerado em
# `desk/src/generated/slashview.core.js` e `chat/src/generated/slashview.core.js`
# (mesmo módulo, como `statusview`/`worklogview`). A mecânica dos dois é a
# mesma; mudam só o campo ancorado (`#prompt`) e o card medido — host.
#
# Tudo é construtor puro: entra fato resolvido, sai `ViewNode`; quem aplica no
# DOM é o `view-host.mjs` (`build`/`renderChildren`). Nada aqui lê DOM, mede
# elemento, guarda referência, corre com timers ou reage a teclado.
#
# Contrato que o host e os smokes fixam (mesmo DOM/CSS dos dois apps):
# - `#slash-menu.slash-pop` com `hidden` do fato `open` e o `style` fixo
#   (`position:fixed;z-index:105`) que o CSS não carrega;
# - cabeça `Comandos`, rodapé `↑↓ navegar · ⏎ inserir · Esc fechar`;
# - `#slash-list[role=listbox][aria-label="Comandos do Pi"]`;
# - cada linha `.slash-item[role=option][aria-selected]` com `id`
#   `slash-opt-N` (ordem da lista), `key` (identidade para o host) e a classe
#   `active` do item em uso; o `check` nasce em toda linha (só o CSS o acende
#   na ativa) e o SVG é asset do host (`icons.mjs`): aqui vai o slot
#   `.slash-check` com o texto `check`;
# - `.slash-name` mostra `/<nome>`; `.slash-arg` só existe com `argumentHint`
#   e `.slash-desc` só com descrição;
# - `on:mousedown=hold` (não tirar o foco do campo), `on:mouseenter=hover` e
#   `on:click=pick` são os nomes da tabela de handlers do host.
#
# Fronteira (fica no host, como antes): a consulta digitada e o gatilho `/…`,
# o filtro/dobra da lista, o índice ativo com wrap, a inserção no prompt, a
# abertura/fechamento, a posição (`getBoundingClientRect`/`offsetHeight`) e os
# timers/rAF. O núcleo recebe a lista já resolvida (id/nome/descrição/hint) e o
# ativo já resolvido em `key` — a consulta não entra porque o menu não a
# desenha e filtrar é decisão do host.
# ---------------------------------------------------------------------------

# Comando já filtrado pelo host: `key` é a identidade (nome sem a barra),
# `name` o rótulo (vira `/name`), `hint` o `argumentHint` e `desc` a descrição.
type SlashItem is Data:
  SlashItem{key: String, name: String, hint: String, desc: String}

# ---------- textos (cópia PT-BR do DOM atual) ----------

def slashHeadText() -> String:
  "Comandos"

def slashListLabel() -> String:
  "Comandos do Pi"

def slashFootText() -> String:
  "↑↓ navegar · ⏎ inserir · Esc fechar"

# ---------- linha ----------

# O id segue a ordem da lista (o antigo contador global recriava ids a cada
# render; o índice é estável e basta para o `aria-activedescendant` do campo).
def slashItemId(i: Nat) -> String:
  String.append("slash-opt-", Nat.show(i))

# Dica de argumento: vazia não gera nó (o `/\S*$/` já garante que o nome não
# tem espaço; a dica é o "resto" do comando).
def slashArgSlot(+hint: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(String.is_empty(hint)),
    V.viewEl("span", [V.attrClass("slash-arg")], [V.viewText(hint)])
  )

def slashNameNode(+name: String, hint: String) -> V.ViewNode:
  V.viewEl(
    "span",
    [V.attrClass("slash-name")],
    V.viewConcat([V.viewText(String.append("/", name))], slashArgSlot(hint))
  )

def slashDescSlot(+desc: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(String.is_empty(desc)),
    V.viewEl("span", [V.attrClass("slash-desc")], [V.viewText(desc)])
  )

def slashTextNode(name: String, hint: String, desc: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("slash-text")],
    V.viewConcat([slashNameNode(name, hint)], slashDescSlot(desc))
  )

# Slot do check (o host troca pelo SVG de `icons.mjs`, como nos outros menus).
def slashCheckNode() -> V.ViewNode:
  V.viewEl(
    "span",
    [V.attrClass("slash-check"), V.attrAria("hidden", "true")],
    [V.viewText("check")]
  )

def slashItemNode(i: Nat, item: SlashItem, +activeKey: String) -> V.ViewNode:
  match item:
    case SlashItem{+key, name, hint, desc}:
      +active = String.eq(key, activeKey)
      V.viewEl(
        "div",
        [ V.classes([V.classOn("slash-item", True{}), V.classOn("active", active)])
        , V.attrId(slashItemId(i))
        , V.attrKey(key)
        , V.attr("role", "option")
        , V.attrAria("selected", V.boolStr(active))
        , V.attrOn("mousedown", "hold")
        , V.attrOn("mouseenter", "hover")
        , V.attrOn("click", "pick")
        ],
        [slashTextNode(name, hint, desc), slashCheckNode()]
      )

# Linhas na ordem da lista; o `i` acompanha o id e o `activeKey` marca a linha
# que o ⏎ insere (o host mantém o índice e resolve a `key`).
def slashItemViews.go(xs: List<&2, SlashItem>, +activeKey: String, +i: Nat) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{slashItemNode(i, h, activeKey), slashItemViews.go(t, activeKey, Nat.add(i, 1n))}

def slashItemViews(xs: List<&2, SlashItem>, activeKey: String) -> List<&2, V.ViewNode>:
  slashItemViews.go(xs, activeKey, 0n)

# ---------- casca ----------

def slashHeadNode() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("slash-head"), V.attr("role", "presentation")],
    [V.viewText(slashHeadText())]
  )

def slashListNode(items: List<&2, SlashItem>, activeKey: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [ V.attrId("slash-list")
    , V.attrClass("slash-list")
    , V.attr("role", "listbox")
    , V.attrAria("label", slashListLabel())
    ],
    slashItemViews(items, activeKey)
  )

def slashFootNode() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("slash-foot"), V.attr("role", "presentation")],
    [V.viewText(slashFootText())]
  )

# Casca completa: o host monta uma vez com `open=False`/lista vazia e depois só
# troca os filhos do `#slash-list` (`slashItemViews`), como o seletor de modelo
# faz com `modelPopView`/`modelListKids`.
def slashMenuView(open: Bool, items: List<&2, SlashItem>, activeKey: String) -> V.ViewNode:
  V.viewEl(
    "div",
    V.attrJoin([
      [ V.attrId("slash-menu")
      , V.attrClass("slash-pop")
      , V.attr("style", "position:fixed;z-index:105")
      ],
      V.attrWhen(Bool.not(open), V.attr("hidden", ""))
    ]),
    [slashHeadNode(), slashListNode(items, activeKey), slashFootNode()]
  )
