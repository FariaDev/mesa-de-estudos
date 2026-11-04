import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# View pura da conversa da Mesa.
#
# O host resolve Markdown/KaTeX em `V.ViewNode`s opacos (na prática, a extensão
# `{ $: "Html" }` do aplicador), entrega fatos Bool e aplica a árvore. Este
# módulo decide o DOM das bolhas; não lê seleção, relógio, scroll, clipboard
# nem IPC. Os cartões de quiz/pergunta vivem no aplicador (#92).
#
# Contrato principal:
#   article.message.user|assistant[data-role]
#     .role + .body + .message-actions (button.msg-copy / button.msg-quote /
#     button.msg-review, só ícone com nome acessível)
# HTML sanitizado continua sendo criado pelo host e só atravessa a árvore como
# filho opaco. Imagens enviadas são `img.shot`; o host acrescenta o overlay de
# cópia depois de aplicar a árvore.
# ---------------------------------------------------------------------------

def off(on: Bool) -> Bool:
  match on:
    case True{}:
      False{}
    case False{}:
      True{}

def roleName(user: Bool) -> String:
  match user:
    case True{}:
      "user"
    case False{}:
      "assistant"

def roleLabel(user: Bool) -> String:
  match user:
    case True{}:
      M.msg("talk.you")
    case False{}:
      "Pi"

def messageClasses(+user: Bool) -> List<&2, V.ViewClass>:
  [V.classOn("message", True{}), V.classOn("user", user), V.classOn("assistant", off(user))]

def messageAttrs(+user: Bool) -> List<&2, V.ViewAttr>:
  [V.classes(messageClasses(user)), V.attrData("role", roleName(user))]

def roleNode(label: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("role")], [V.viewText(label)])

def shot(src: String) -> V.ViewNode:
  V.viewEl(
    "img",
    [ V.attrClass("shot")
    , V.attr("src", src)
    , V.attr("alt", M.msg("talk.imageSent"))
    , V.attr("loading", "lazy")
    , V.attr("decoding", "async")
    ],
    Nil{}
  )

def shotNodes(xs: List<&2, String>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{shot(h), shotNodes(t)}

def messageBody(markup: V.ViewNode, images: List<&2, String>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("body")], Con{markup, shotNodes(images)})

# As ações da mensagem são só ícones (#90): o nome acessível e o tooltip
# carregam o rótulo que antes era texto. O glifo é `data-icon` para o host.
def messageAction(className: String, +label: String, handler: String, icon: String) -> V.ViewNode:
  V.viewEl(
    "button",
    [ V.attrType("button"), V.attrClass(className)
    , V.attrAria("label", label), V.attrTitle(label)
    , V.attrData("icon", icon), V.attrOn("click", handler)
    ],
    Nil{}
  )

def messageActions(canCopy: Bool, canQuote: Bool, canReview: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("message-actions")], V.viewJoin([
    V.viewWhen(canCopy, messageAction("msg-copy", M.msg("talk.copy"), "CopyMessage", "copy")),
    V.viewWhen(canQuote, messageAction("msg-quote", M.msg("talk.quote"), "QuoteMessage", "textQuote")),
    V.viewWhen(canReview, messageAction("msg-review", M.msg("talk.review"), "SaveForReview", "bookmark"))
  ]))

def messageKids(
  +user: Bool,
  markup: V.ViewNode,
  images: List<&2, String>,
  canCopy: Bool,
  canQuote: Bool,
  canReview: Bool
) -> List<&2, V.ViewNode>:
  [roleNode(roleLabel(user)), messageBody(markup, images), messageActions(canCopy, canQuote, canReview)]

def message(
  +user: Bool,
  markup: V.ViewNode,
  images: List<&2, String>,
  canCopy: Bool,
  canQuote: Bool,
  canReview: Bool
) -> V.ViewNode:
  V.viewEl("article", messageAttrs(user), messageKids(user, markup, images, canCopy, canQuote, canReview))

# ---------- assets do corpo (figura hidratada e moldura do código) ----------
# O Markdown (marked/KaTeX/DOMPurify) e o realce continuam no host: ele resolve
# o HTML, lê a imagem (`readImage`) e entrega `src`/`path`/`alt`/`caption` já
# prontos. Aqui mora só a forma com que o aplicador hidrata a figura e embrulha
# o `<pre>` realçado. O overlay de cópia da imagem e os cliques delegados
# continuam no host (clipboard) — a mesma fronteira de `img.shot`.

type AssetRow is Data:
  AssetRow{src: String, path: String, alt: String, caption: String}

def assetImg.go(src: String, path: String, alt: String) -> V.ViewNode:
  V.viewEl(
    "img",
    [ V.attrClass("plot")
    , V.attr("src", src)
    , V.attrData("path", path)
    , V.attr("alt", alt)
    , V.attr("loading", "lazy")
    , V.attr("decoding", "async")
    ],
    Nil{}
  )

def assetCaption(+caption: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(String.is_empty(caption)),
    V.viewEl("figcaption", Nil{}, [V.viewText(caption)])
  )

def assetKids.go(src: String, path: String, alt: String, +caption: String) -> List<&2, V.ViewNode>:
  List.append(&2, V.ViewNode, [assetImg.go(src, path, alt)], assetCaption(caption))

def assetKids(row: AssetRow) -> List<&2, V.ViewNode>:
  match row:
    case AssetRow{src, path, alt, caption}:
      assetKids.go(src, path, alt, caption)

# Figura inteira para o caminho em que um `code` com caminho local vira imagem.
def assetFigure.go(src: String, path: String, alt: String, +caption: String) -> V.ViewNode:
  V.viewEl("figure", [V.attrClass("asset")], assetKids.go(src, path, alt, caption))

def assetFigure(row: AssetRow) -> V.ViewNode:
  match row:
    case AssetRow{src, path, alt, caption}:
      assetFigure.go(src, path, alt, caption)

# Quando a leitura falha, o caminho cru volta como código (nada de imagem quebrada).
def assetFallback(source: String) -> V.ViewNode:
  V.viewEl("code", Nil{}, [V.viewText(source)])

def codeCopy() -> V.ViewNode:
  V.viewEl(
    "button",
    [V.attrType("button"), V.attrClass("code-copy"), V.attrAria("label", M.msg("talk.copyCode"))],
    [V.viewText(M.msg("talk.copyShort"))]
  )

# O rótulo da linguagem chega já em caixa alta (fato do host); vazio, some. A
# faixa de cabeçalho leva a linguagem à esquerda e o copiar à direita; o código
# começa abaixo dela, sem etiqueta sobreposta (ticket de polimento visual).
def codeHead.kids(+lang: String) -> List<&2, V.ViewNode>:
  V.viewConcat(
    V.viewWhen(
      Bool.not(String.is_empty(lang)),
      V.viewEl("span", [V.attrClass("code-lang")], [V.viewText(lang)])
    ),
    [codeCopy()]
  )

def codeHead(+lang: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("code-head")], codeHead.kids(lang))

def codeBlock.kids(+lang: String, pre: V.ViewNode) -> List<&2, V.ViewNode>:
  [codeHead(lang), pre]

def codeBlock(pre: V.ViewNode, lang: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("codeblock")], codeBlock.kids(lang, pre))
