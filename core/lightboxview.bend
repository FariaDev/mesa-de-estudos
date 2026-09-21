import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View do lightbox de anexos da Conversa (`#image-dialog`).
#
# O casco estático (`<dialog id="image-dialog" aria-labelledby="image-title">`
# e o `<menu>`) continua no `chat/index.html`; este núcleo devolve o chrome que
# o aplicador (`chat/src/view-host.mjs`, via `chat/src/chat.mjs`) cola nos
# mesmos ids/classes/aria:
#   - `#image-title`: nome do arquivo (mesma regra do `imageTitle` da Mesa:
#     último segmento do caminho, Unix ou Windows; vazio cai em "Imagem");
#   - `#image-count`: "N/M" (1-based) e `hidden` quando só há uma imagem;
#   - `#image-prev`/`#image-next`: setas `.img-nav`, `aria-label`, `hidden`
#     quando não há mais de uma imagem e o handler do clique;
#   - `#image-zoom`: percentual do zoom como fato do host, `hidden` quando o
#     zoom está em 100%;
#   - `.img-viewport`: classes `zoomed`/`dragging`;
#   - `#image-preview`: src/alt (alt vazio cai em "Imagem ampliada"), o
#     `draggable=false` e o `style` do transform já formatado pelo host;
#   - `menu`: `#image-copy` e `#image-close` (o `#image-close` mantém o
#     `autofocus` que o `<dialog>` usa ao abrir).
#
# Nada aqui mede, foca, mostra/fecha `<dialog>`, faz fetch/clipboard ou observa
# ponteiro: o zoom/pan (escala, deslocamento, `getBoundingClientRect`,
# `setPointerCapture`), o `showModal()`/`close()` e o `ClipboardItem` ficam no
# host. A Conversa não tem ação "abrir no Preview" nem estado de carregando/erro
# no lightbox — o DOM observável não ganha botão novo (o "abrir" existe só no
# `#image-dialog` da Mesa, em `core/dialogsview.bend`).
#
# Convenções (as mesmas de `core/view.bend`): `on:<evento>` vira lookup na
# tabela de handlers do host; `class`/`id` vazios são pulados; `hidden` só
# entra quando é fato; Nat vira BigInt no artefato.
#
# Pilha (issue bendlang/bend#798, acumulador do aron-intframe): o basename
# (`lbFileBase`) percorre o caminho num walk tail; nome de 100k não estoura.
# ---------------------------------------------------------------------------

# ---------- nome do arquivo e textos ----------

# Separador de caminho: as duas barras (Unix e Windows) separam.
def lbIsSep(+c: Char) -> Bool:
  Bool.or(Char.is_eq(c, '/'), Char.is_eq(c, '\\'))

def charStr(c: Char) -> String:
  SCon{c, SNil{}}

# Segmento final de um caminho em um só walk tail (accumulator): a cada
# separador o acumulador reinicia; no fim ele é o último segmento. Substitui
# o `String.split` + `List.last` do Base, que são recursões não-tail e
# estouram a pilha em nomes grandes (issue bendlang/bend#798). O fato do
# próximo char vai como parâmetro (match não escrutina valor computado).
def headSep(s: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{h, t}:
      lbIsSep(h)

def lbFileBase.go(s: String, sep: Bool, acc: String) -> String:
  match s:
    case SNil{}:
      acc
    case SCon{h, +t}:
      match sep:
        case True{}:
          lbFileBase.go(t, headSep(t), SNil{})
        case False{}:
          lbFileBase.go(t, headSep(t), String.append(acc, charStr(h)))

def lbFileBase(+path: String) -> String:
  lbFileBase.go(path, headSep(path), SNil{})

def lbFallback() -> String:
  "Imagem"

def lbTextOr.if(raw: String, fallback: String, empty: Bool) -> String:
  match empty:
    case True{}:
      fallback
    case False{}:
      raw

def lbTextOr(+raw: String, fallback: String) -> String:
  lbTextOr.if(raw, fallback, String.is_empty(raw))

# Título do `#image-title`: nome do arquivo; vazio cai em "Imagem".
def lbTitle(name: String) -> String:
  lbTextOr(lbFileBase(name), lbFallback())

def lbTitleNode(name: String) -> V.ViewNode:
  V.viewText(lbTitle(name))

def lbAltFallback() -> String:
  "Imagem ampliada"

# `alt` do `#image-preview`: vazio cai em "Imagem ampliada".
def lbAlt(raw: String) -> String:
  lbTextOr(raw, lbAltFallback())

# ---------- contador e navegação ----------

# "2/3" — índice 0-based, total do host.
def lbCountText(index: Nat, total: Nat) -> String:
  Nat.show(Nat.add(index, 1n)) ++ "/" ++ Nat.show(total)

# Com uma imagem só (ou nenhuma) não há para onde navegar: o contador e as
# setas ficam `hidden`.
def lbNavHidden(total: Nat) -> Bool:
  match total:
    case 0n:
      True{}
    case 1n:
      True{}
    case 2n+rest:
      False{}

def lbCountNode(index: Nat, +total: Nat) -> V.ViewNode:
  V.viewEl(
    "span",
    V.attrConcat(
      [V.attrId("image-count")],
      V.attrWhen(lbNavHidden(total), V.ViewAttr{"hidden", ""})
    ),
    [V.viewText(lbCountText(index, total))]
  )

def lbNavNode(id: String, label: String, handler: String, hidden: Bool) -> V.ViewNode:
  V.viewEl(
    "button",
    V.attrConcat(
      [ V.attrType("button")
      , V.attrId(id)
      , V.attrClass("img-nav")
      , V.attrAria("label", label)
      , V.attrOn("click", handler)
      ],
      V.attrWhen(hidden, V.ViewAttr{"hidden", ""})
    ),
    Nil{}
  )

def lbPrevNode(hidden: Bool) -> V.ViewNode:
  lbNavNode("image-prev", "Imagem anterior", "ImagePrev", hidden)

def lbNextNode(hidden: Bool) -> V.ViewNode:
  lbNavNode("image-next", "Próxima imagem", "ImageNext", hidden)

# ---------- zoom ----------

# `pct` chega pronto do host ("250%") — o arredondamento da escala é fato de
# quem mede; aqui só se decide o `hidden` do selo.
def lbZoomNode(pct: String, zoomed: Bool) -> V.ViewNode:
  V.viewEl(
    "span",
    V.attrConcat(
      [V.attrId("image-zoom"), V.attrAria("live", "polite")],
      V.attrWhen(Bool.not(zoomed), V.ViewAttr{"hidden", ""})
    ),
    [V.viewText(pct)]
  )

# ---------- imagem e viewport ----------

def lbSrcAttrs(+src: String) -> List<&2, V.ViewAttr>:
  V.attrWhen(Bool.not(String.is_empty(src)), V.ViewAttr{"src", src})

def lbStyleAttrs(+transform: String) -> List<&2, V.ViewAttr>:
  V.attrWhen(Bool.not(String.is_empty(transform)), V.ViewAttr{"style", transform})

# O transform vem formatado pelo host (`translate(Xpx,Ypx) scale(S)`); a
# geometria é medida no host, e é o attr que o mantém no nó vivo entre renders.
def lbPreviewNode(src: String, alt: String, transform: String) -> V.ViewNode:
  V.viewEl(
    "img",
    V.attrJoin([
      [ V.attrId("image-preview")
      , V.attr("draggable", "false")
      , V.attr("alt", lbAlt(alt))
      ],
      lbSrcAttrs(src),
      lbStyleAttrs(transform)
    ]),
    Nil{}
  )

def lbViewportNode(zoomed: Bool, dragging: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    [ V.classes([
        V.classOn("img-viewport", True{}),
        V.classOn("zoomed", zoomed),
        V.classOn("dragging", dragging)
      ])
    ],
    Nil{}
  )

# ---------- ações ----------

def lbCopyLabel() -> String:
  "Copiar"

def lbCloseLabel() -> String:
  "Fechar"

def lbCopyNode() -> V.ViewNode:
  V.viewEl(
    "button",
    [ V.attrType("button")
    , V.attrId("image-copy")
    , V.attrOn("click", "ImageCopy")
    ],
    [V.viewText(lbCopyLabel())]
  )

# O `autofocus` é o que o `<dialog>` usa para dar o foco ao abrir; fechar é por
# handler (não é `<form method=dialog>` como na Mesa).
def lbCloseNode() -> V.ViewNode:
  V.viewEl(
    "button",
    [ V.attrType("button")
    , V.attrId("image-close")
    , V.attr("autofocus", "")
    , V.attrOn("click", "ImageClose")
    ],
    [V.viewText(lbCloseLabel())]
  )

def lbActions() -> List<&2, V.ViewNode>:
  [lbCopyNode(), lbCloseNode()]
