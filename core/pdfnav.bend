import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Navegação do leitor (pedido 5): favoritos nomeados, sumário do documento e o
# popover "Navegar" que os oferece — mais os rótulos do botão que o abre e do
# Voltar (o `core/pdfpageview.bend` monta os dois botões).
#
# O host entrega fatos já resolvidos: os favoritos da matéria (`Bookmark`, na
# ordem em que o JSON os guarda) e o sumário do documento (`OutlineEntry`, do
# `getOutline` do pdf.js, com página 1-based e profundidade). Nada aqui lê o
# DOM, o disco ou o pdf.js; nada apaga — remover um favorito é do host, que
# reescreve o arquivo com um item a menos.
#
# Convenções:
#   - favorito = `button.nav-bookmark[data-id][data-page][data-path]` (o
#     `data-id` é a POSIÇÃO na lista que a tela mostra — é por ela que o host
#     acha o registro) com `button.nav-bookmark-remove` irmão; o favorito do
#     documento aberto ganha `.current`. A POSIÇÃO não é identidade: a lista da
#     tela é filtrada pelos documentos da matéria, então abrir usa a posição e
#     remover vai pela identidade (`removeBookmark`);
#   - sumário = `button.nav-outline[data-depth][data-page]`; sem sumário cai no
#     `outlineEmpty()` e a profundidade é limitada por `maxDepth()`;
#   - o popover é `div.pdf-nav-pop[hidden]` (sem id: cada leitor tem o seu) com o
#     "Guardar esta página…" (`button.nav-save`), a seção de favoritos e a do
#     sumário.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type Bookmark is Data:
  Bookmark{name: String, path: String, page: Nat}

type OutlineEntry is Data:
  OutlineEntry{title: String, page: Nat, depth: Nat}

# ---------- tetos (o host compara; o núcleo documenta) ----------

def maxName() -> Nat:
  60n

def maxPath() -> Nat:
  1024n

def maxBookmarks() -> Nat:
  200n

def maxOutline() -> Nat:
  40n

def maxDepth() -> Nat:
  3n

# ---------- textos ----------

def cutName.if(text: String, limit: Nat, over: Bool) -> String:
  match over:
    case False{}:
      text
    case True{}:
      String.take(text, limit)

def cutName(+text: String, +limit: Nat) -> String:
  cutName.if(text, limit, Nat.is_gt(String.length(text), limit))

# O nome do favorito como o usuário digitou, sem espaços nas pontas e no teto.
def fitName(+text: String) -> String:
  cutName(String.trim(text), maxName())

def keepName.blank(blank: Bool) -> Bool:
  match blank:
    case True{}:
      False{}
    case False{}:
      True{}

# Sem nome não há favorito (o host recusa, como o Encerrar sem ponto).
def keepName(name: String) -> Bool:
  keepName.blank(String.is_empty(String.trim(name)))

def pageLabel(page: Nat) -> String:
  "p. " ++ Nat.show(page)

def bookmarkLabel(name: String) -> String:
  name

def bookmarkTitle(name: String, page: Nat) -> String:
  "Abrir " ++ name ++ " na " ++ pageLabel(page)

def bookmarkAria(name: String, page: Nat) -> String:
  "Abrir o favorito " ++ name ++ ", " ++ pageLabel(page)

def removeLabel() -> String:
  "Remover"

def removeTitle(name: String) -> String:
  "Remover o favorito " ++ name

def removeAria(name: String) -> String:
  "Remover o favorito " ++ name

def saveLabel() -> String:
  "Guardar esta página…"

def saveTitle() -> String:
  "Guardar a página aberta como favorito"

def favoritesTitle() -> String:
  "Favoritos desta matéria"

def favoritesEmpty() -> String:
  "Nenhum favorito nesta matéria."

def outlineTitle() -> String:
  "Sumário deste PDF"

def outlineEmpty() -> String:
  "Este PDF não tem sumário."

def navButtonLabel() -> String:
  "Navegar"

def navButtonTitle() -> String:
  "Favoritos e sumário"

def navAria(label: String) -> String:
  "Navegar em " ++ label

def navBackLabel() -> String:
  "Voltar"

def navBackTitle() -> String:
  "Voltar à página anterior"

def navBackAria(label: String) -> String:
  "Voltar à página anterior de " ++ label

# ---------- diálogo do favorito (o miolo; o <dialog> é do index.html) ----------

def bookmarkDialogTitle() -> String:
  "Guardar esta página"

def bookmarkNameLabel() -> String:
  "Nome do favorito"

def bookmarkDialogHint(name: String, page: Nat) -> String:
  name ++ ", " ++ pageLabel(page)

def bookmarkSaveLabel() -> String:
  "Salvar"

def bookmarkCancelLabel() -> String:
  "Cancelar"

# ---------- favorito novo ----------

def pageFloor.if(page: Nat, low: Bool) -> Nat:
  match low:
    case True{}:
      1n
    case False{}:
      page

# Página nunca abaixo de 1 (o diálogo pode mandar 0 vindo de um leitor vazio).
def pageFloor(+page: Nat) -> Nat:
  pageFloor.if(page, Nat.is_lt(page, 1n))

def fitPath(+text: String) -> String:
  cutName(String.trim(text), maxPath())

# Favorito vindo do diálogo: nome e path aparados no teto, página >= 1.
def newBookmark(name: String, path: String, page: Nat) -> Bookmark:
  Bookmark{fitName(name), fitPath(path), pageFloor(page)}

# Vale guardar? Precisa de nome e de um documento (o host recusa o diálogo).
def keepBookmark.path(noPath: Bool) -> Bool:
  match noPath:
    case True{}:
      False{}
    case False{}:
      True{}

def keepBookmark(bm: Bookmark) -> Bool:
  match bm:
    case Bookmark{+name, +path, _}:
      Bool.and(
        keepName.blank(String.is_empty(String.trim(name))),
        keepBookmark.path(String.is_empty(String.trim(path)))
      )

# Mesmo favorito = mesmo documento e mesmo nome.
def sameBookmark(a: Bookmark, b: Bookmark) -> Bool:
  match a:
    case Bookmark{+name, +path, _}:
      match b:
        case Bookmark{+name2, +path2, _}:
          Bool.and(String.eq(name, name2), String.eq(path, path2))

# A cauda da lista já filtrada e o casamento como parâmetro (match em valor
# computado não é aceito).
def dropSame.head(+h: Bookmark, rest: List<&2, Bookmark>, same: Bool) -> List<&2, Bookmark>:
  match same:
    case True{}:
      rest
    case False{}:
      Con{h, rest}

def dropSame.go(bs: List<&2, Bookmark>, +bm: Bookmark) -> List<&2, Bookmark>:
  match bs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      dropSame.head(h, dropSame.go(t, bm), sameBookmark(h, bm))

def takeList.go(xs: List<&2, Bookmark>, n: Nat) -> List<&2, Bookmark>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match n:
        case 0n:
          Nil{}
        case 1n+p:
          Con{h, takeList.go(t, p)}

# Guardar de novo o mesmo favorito renomeia: o novo entra na frente dos outros
# (o mais recente primeiro) e o teto corta o resto.
def addBookmark(bs: List<&2, Bookmark>, +bm: Bookmark) -> List<&2, Bookmark>:
  takeList.go(Con{bm, dropSame.go(bs, bm)}, maxBookmarks())

# Remove o favorito pela IDENTIDADE (mesmo documento e mesmo nome), onde ele
# estiver: a posição da linha na tela não serve para isso — a lista da tela é
# filtrada pelos documentos da matéria. O `data-id` da linha continua sendo a
# posição, mas só para o host achar o REGISTRO que o usuário clicou; quem remove
# entrega esse registro inteiro e o casamento é o do `addBookmark` (o mesmo que
# impede duplicata).
def removeBookmark(bs: List<&2, Bookmark>, +bm: Bookmark) -> List<&2, Bookmark>:
  dropSame.go(bs, bm)

# ---------- favoritos ----------

def emptyBooks(bs: List<&2, Bookmark>) -> Bool:
  Nat.is_eq(List.length(&2, Bookmark, bs), 0n)

def emptyOutline(os: List<&2, OutlineEntry>) -> Bool:
  Nat.is_eq(List.length(&2, OutlineEntry, os), 0n)

def bookmarkRow(+id: Nat, bm: Bookmark, +currentPath: String) -> V.ViewNode:
  match bm:
    case Bookmark{+name, +path, +page}:
      V.viewEl("div", [V.attrClass("nav-row")], [
        V.viewEl("button", [
          V.attrType("button"),
          V.classes([
            V.classOn("nav-bookmark", True{}),
            V.classOn("current", String.eq(path, currentPath))
          ]),
          V.attrData("id", Nat.show(id)),
          V.attrData("page", Nat.show(page)),
          V.attrData("path", path),
          V.attrTitle(bookmarkTitle(name, page)),
          V.attrAria("label", bookmarkAria(name, page)),
          V.attrOn("click", "OpenBookmark")
        ], [
          V.viewEl("span", [V.attrClass("nav-name")], [V.viewText(bookmarkLabel(name))]),
          V.viewEl("span", [V.attrClass("nav-page")], [V.viewText(pageLabel(page))])
        ]),
        V.viewEl("button", [
          V.attrType("button"),
          V.classes([V.classOn("icon-btn", True{}), V.classOn("nav-bookmark-remove", True{})]),
          V.attrData("icon", "minus"),
          V.attrData("id", Nat.show(id)),
          V.attrTitle(removeTitle(name)),
          V.attrAria("label", removeAria(name)),
          V.attrOn("click", "RemoveBookmark")
        ], Nil{})
      ])

def bookmarkRows.go(bs: List<&2, Bookmark>, +currentPath: String, +i: Nat) -> List<&2, V.ViewNode>:
  match bs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{bookmarkRow(i, h, currentPath), bookmarkRows.go(t, currentPath, Nat.add(i, 1n))}

def bookmarkRows(bs: List<&2, Bookmark>, +currentPath: String) -> List<&2, V.ViewNode>:
  bookmarkRows.go(bs, currentPath, 0n)

# ---------- sumário ----------

def clampDepth.if(depth: Nat, over: Bool) -> Nat:
  match over:
    case True{}:
      maxDepth()
    case False{}:
      depth

def clampDepth(+depth: Nat) -> Nat:
  clampDepth.if(depth, Nat.is_gt(depth, maxDepth()))

def outlineDepth(depth: Nat) -> String:
  Nat.show(clampDepth(depth))

def outlineLabel(title: String, page: Nat) -> String:
  "Ir para a p. " ++ Nat.show(page) ++ ": " ++ title

def outlineRow(o: OutlineEntry) -> V.ViewNode:
  match o:
    case OutlineEntry{+title, +page, depth}:
      V.viewEl("button", [
        V.attrType("button"),
        V.attrClass("nav-outline"),
        V.attrData("depth", outlineDepth(depth)),
        V.attrData("page", Nat.show(page)),
        V.attrTitle(outlineLabel(title, page)),
        V.attrAria("label", outlineLabel(title, page)),
        V.attrOn("click", "OpenOutline")
      ], [V.viewText(title)])

def outlineRows(os: List<&2, OutlineEntry>) -> List<&2, V.ViewNode>:
  V.viewMap(~OutlineEntry, ~outlineRow, os)

# ---------- popover ----------

def navEmpty(text: String) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("nav-empty")], [V.viewText(text)])

def navSaveButton() -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("nav-save"),
    V.attrTitle(saveTitle()),
    V.attrAria("label", saveTitle()),
    V.attrOn("click", "SaveBookmark")
  ], [V.viewText(saveLabel())])

def navSection(title: String, empty: Bool, emptyText: String, rows: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("nav-section")], V.viewJoin([
    [V.viewEl("h4", Nil{}, [V.viewText(title)])],
    V.viewWhen(empty, navEmpty(emptyText)),
    rows
  ]))

def navPopover(
  open: Bool, +bs: List<&2, Bookmark>, +os: List<&2, OutlineEntry>, +currentPath: String
) -> V.ViewNode:
  V.viewEl("div", V.attrJoin([
    [V.classes([V.classOn("pdf-nav-pop", True{})])],
    V.attrWhen(Bool.not(open), V.attr("hidden", "")),
    [V.attrAria("label", navButtonTitle())]
  ]), [
    navSaveButton(),
    navSection(favoritesTitle(), emptyBooks(bs), favoritesEmpty(), bookmarkRows(bs, currentPath)),
    navSection(outlineTitle(), emptyOutline(os), outlineEmpty(), outlineRows(os))
  ])
