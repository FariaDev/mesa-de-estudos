import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View da busca no conteúdo das conversas (app Conversa, paleta `.pc-*`).
#
# O host entrega fatos já resolvidos — título e "quando" em texto, papel como
# Bool, trecho já recortado pelo núcleo de busca (`core/search.bend`) e picado
# em Piece (texto simples × casado) — e este núcleo devolve a árvore de nós do
# painel: seções por conversa (título + quando), itens com papel/trecho, item
# ativo (`aria-selected`), estados vazio/carregando/erro e a linha de contagem
# do rodapé. Nada aqui mede, foca, lê relógio ou fala com o DOM; quem cria os
# elementos é o aplicador (`chat/src/view-host.mjs`).
#
# Convenções (as mesmas de `core/view.bend`):
#   - item: id `pc-item-<n>` (n = 1.. no total de trechos), classes
#     `palette-item pc-item[ active]`, `role=option`, `aria-selected`;
#   - `.pc-role` ganha `user` quando o papel é do usuário;
#   - `when` vazio esconde o `.pc-when`; título vazio vira "Conversa";
#   - `same[k]` = o trecho k é da mesma conversa do k-1 (o primeiro é False);
#     `active[k]` = é o item ativo. Fatos alinhados com `hits`.
# ---------------------------------------------------------------------------

# Peça do trecho: texto simples vira nó de texto; casado vira `<mark>`
# (quem decide o que casou é o host — a dobra com mapa de índices é dele).
type Piece is Data:
  PieceText{text: String}
  PieceMark{text: String}

# Fatos de um trecho. `when` já é o rótulo relativo ("agora", "5m", …).
type ResultHit is Data:
  ResultHit{title: String, when: String, isUser: Bool, isAssistant: Bool, pieces: +List<Piece>}

# Linha da lista: cabeça de conversa ou item de trecho.
type ResultRow is Data:
  ResultRowGroup{title: String, when: String}
  ResultRowHit{n: String, isUser: Bool, label: String, pieces: +List<Piece>, active: Bool}

# O que a lista está mostrando. `StateRows` vem com as linhas prontas de
# `rows`; os demais viram um `.palette-empty.pc-state` com o texto do núcleo.
type ResultState is Data:
  StateShort{}
  StateLoading{}
  StateEmpty{query: String}
  StateError{message: String}
  StateRows{rows: +List<ResultRow>}

# ---------- rótulos e textos ----------

def roleLabel(isUser: Bool, isAssistant: Bool) -> String:
  match isUser:
    case True{}:
      "Você"
    case False{}:
      match isAssistant:
        case True{}:
          "Pi"
        case False{}:
          ""

def titleLabel.when(title: String, empty: Bool) -> String:
  match empty:
    case True{}:
      "Conversa"
    case False{}:
      title

def titleLabel(+title: String) -> String:
  titleLabel.when(title, String.is_empty(title))

# Id do item no total de trechos (1-based, como o `aria-activedescendant`).
def itemId(i: Nat) -> String:
  String.append("pc-item-", Nat.show(Nat.add(i, 1n)))

def minQueryHint() -> String:
  "Digite ao menos 2 caracteres para buscar no conteúdo."

def loadingText() -> String:
  "Buscando…"

def notFoundText(query: String) -> String:
  "Nada encontrado para “" ++ query ++ "”."

def errorText.given(message: String, empty: Bool) -> String:
  match empty:
    case True{}:
      "Não foi possível buscar agora."
    case False{}:
      message

def errorText(+message: String) -> String:
  errorText.given(message, String.is_empty(message))

def hintText() -> String:
  "↑↓ navegar · ⏎ abrir conversa · Esc fechar"

# ---------- linha de contagem do rodapé ----------

def plural.one(one: String, many: String, isOne: Bool) -> String:
  match isOne:
    case True{}:
      one
    case False{}:
      many

def plural(n: Nat, one: String, many: String) -> String:
  plural.one(one, many, Nat.is_eq(n, 1n))

def countLabel(+n: Nat, one: String, many: String) -> String:
  Nat.show(n) ++ " " ++ plural(n, one, many)

def partsAdd(parts: List<&2, String>, text: String, on: Bool) -> List<&2, String>:
  match on:
    case True{}:
      List.append(&2, String, parts, [text])
    case False{}:
      parts

# "3 trechos · 2 arquivos · 12 ms · 2 grandes ignorados · busca parcial"
def infoParts(count: Nat, files: Nat, +ms: Nat, +large: Nat, truncated: Bool) -> List<&2, String>:
  partsAdd(
    partsAdd(
      partsAdd(
        [countLabel(count, "trecho", "trechos"), countLabel(files, "arquivo", "arquivos")],
        Nat.show(ms) ++ " ms",
        Nat.is_gt(ms, 0n)
      ),
      countLabel(large, "grande ignorado", "grandes ignorados"),
      Nat.is_gt(large, 0n)
    ),
    "busca parcial",
    truncated
  )

def infoText(count: Nat, files: Nat, ms: Nat, large: Nat, truncated: Bool) -> String:
  String.join(infoParts(count, files, ms, large, truncated), " · ")

# ---------- linhas: cabeça por conversa + itens ----------

def rows.headOf(h: ResultHit) -> ResultRow:
  match h:
    case ResultHit{title, when, _, _, _}:
      ResultRowGroup{titleLabel(title), when}

def rows.item(i: Nat, h: ResultHit, active: Bool) -> ResultRow:
  match h:
    case ResultHit{_, _, +isUser, isAssistant, pieces}:
      ResultRowHit{itemId(i), isUser, roleLabel(isUser, isAssistant), pieces, active}

# Cabeça (quando a conversa muda) seguida do item; a ordem é a da lista.
def rows.span(i: Nat, +h: ResultHit, s: Bool, a: Bool) -> List<&2, ResultRow>:
  match s:
    case True{}:
      [rows.item(i, h, a)]
    case False{}:
      [rows.headOf(h), rows.item(i, h, a)]

# `i` é o índice 0-based do trecho (o id sai 1-based). Fatos desalinhados:
# lista vazia (o host mantém os três comprimentos iguais).
def rows.go(
  hits: List<&2, ResultHit>,
  same: List<&2, Bool>,
  active: List<&2, Bool>,
  +i: Nat
) -> List<&2, ResultRow>:
  match hits same active:
    case Nil{} _ _:
      Nil{}
    case Con{h, t} Con{s, ss} Con{a, as}:
      List.append(
        &2,
        ResultRow,
        rows.span(i, h, s, a),
        rows.go(t, ss, as, Nat.add(i, 1n))
      )
    case Con{_, _} _ _:
      Nil{}

def rows(hits: List<&2, ResultHit>, same: List<&2, Bool>, active: List<&2, Bool>) -> List<&2, ResultRow>:
  rows.go(hits, same, active, 0n)

# Contagens (leis e conferência do host; não desenham nada).
def hitCount(xs: List<&2, ResultRow>) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{h, t}:
      match h:
        case ResultRowGroup{title, when}:
          hitCount(t)
        case ResultRowHit{n, isUser, label, pieces, active}:
          Nat.add(1n, hitCount(t))

def headCount(xs: List<&2, ResultRow>) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{h, t}:
      match h:
        case ResultRowGroup{title, when}:
          Nat.add(1n, headCount(t))
        case ResultRowHit{n, isUser, label, pieces, active}:
          headCount(t)

# ---------- árvore ----------

def pieceView(p: Piece) -> V.ViewNode:
  match p:
    case PieceText{text}:
      V.viewText(text)
    case PieceMark{text}:
      V.viewEl("mark", Nil{}, [V.viewText(text)])

def pieceViews(ps: List<&2, Piece>) -> List<&2, V.ViewNode>:
  V.viewMap(~Piece, ~pieceView, ps)

def titleNode(title: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("pc-group-title")], [V.viewText(title)])

def whenNode(when: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("pc-when")], [V.viewText(when)])

def groupNode(title: String, +when: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("palette-section pc-group"), V.attr("role", "presentation")],
    V.viewConcat([titleNode(title)], V.viewWhen(Bool.not(String.is_empty(when)), whenNode(when)))
  )

def roleNode(isUser: Bool, label: String) -> V.ViewNode:
  V.viewEl(
    "span",
    [V.classes([V.classOn("pc-role", True{}), V.classOn("user", isUser)])],
    [V.viewText(label)]
  )

def snippetNode(pieces: List<&2, Piece>) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("pc-snippet")], pieceViews(pieces))

def hitNode(n: String, isUser: Bool, label: String, pieces: List<&2, Piece>, +active: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    [ V.classes(
        [ V.classOn("palette-item", True{})
        , V.classOn("pc-item", True{})
        , V.classOn("active", active)
        ]
      )
    , V.attrId(n)
    , V.attr("role", "option")
    , V.attrAria("selected", V.boolStr(active))
    , V.attrOn("mousedown", "hold")
    , V.attrOn("click", "pick")
    ],
    [roleNode(isUser, label), snippetNode(pieces)]
  )

def rowView(r: ResultRow) -> V.ViewNode:
  match r:
    case ResultRowGroup{title, when}:
      groupNode(title, when)
    case ResultRowHit{n, isUser, label, pieces, active}:
      hitNode(n, isUser, label, pieces, active)

def rowsView(xs: List<&2, ResultRow>) -> List<&2, V.ViewNode>:
  V.viewMap(~ResultRow, ~rowView, xs)

def noticeView(text: String) -> List<&2, V.ViewNode>:
  [V.viewEl("div", [V.attrClass("palette-empty pc-state")], [V.viewText(text)])]

def listView(s: ResultState) -> List<&2, V.ViewNode>:
  match s:
    case StateShort{}:
      noticeView(minQueryHint())
    case StateLoading{}:
      noticeView(loadingText())
    case StateEmpty{query}:
      noticeView(notFoundText(query))
    case StateError{message}:
      noticeView(errorText(message))
    case StateRows{rs}:
      rowsView(rs)

# ---------- casca do painel (uma vez; o host só troca os filhos da lista) ----------

def infoNode() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("pc-info")], Nil{})

def hintNode() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("palette-hint pc-hint")],
    [V.viewText(hintText()), infoNode()]
  )

def inputNode() -> V.ViewNode:
  V.viewEl(
    "input",
    [ V.attrType("text")
    , V.attrClass("palette-input pc-input")
    , V.attr("placeholder", "Buscar no conteúdo das conversas…")
    , V.attrAria("label", "Buscar no conteúdo das conversas")
    , V.attr("role", "combobox")
    , V.attrAria("expanded", "true")
    , V.attrAria("autocomplete", "list")
    , V.attrAria("controls", "pc-list")
    , V.attr("autocomplete", "off")
    , V.attr("spellcheck", "false")
    , V.attrOn("input", "schedule")
    , V.attrOn("keydown", "key")
    ],
    Nil{}
  )

def listNode() -> V.ViewNode:
  V.viewEl(
    "div",
    [ V.attrClass("palette-list pc-list")
    , V.attrId("pc-list")
    , V.attr("role", "listbox")
    , V.attrAria("label", "Trechos encontrados")
    ],
    Nil{}
  )

def panelNode() -> V.ViewNode:
  V.viewEl(
    "div",
    [ V.attrClass("palette pc-panel")
    , V.attr("role", "dialog")
    , V.attrAria("modal", "true")
    , V.attrAria("label", "Buscar no conteúdo das conversas")
    ],
    [inputNode(), listNode(), hintNode()]
  )

def panelView() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("palette-backdrop pc-backdrop"), V.attr("hidden", ""), V.attrOn("mousedown", "dim")],
    [panelNode()]
  )
