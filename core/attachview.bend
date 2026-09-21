import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View dos anexos do composer e do chip de citação (Mesa + Conversa).
#
# O host faz o mundo: lê bytes, comprime, persiste o rascunho, guarda o texto
# do trecho citado e cobre o clipboard. Aqui mora só a forma: cada item vira
# `div.attachment` (imagem ou arquivo) com o botão `.attachment-remove`, e o
# trecho vira `div#quote-chip.quote-chip` (rótulo + texto truncado + remover).
#
# Fatos explícitos onde os dois apps divergem — o host passa tudo pronto:
#   - `lazy`: `img` com `loading=lazy`/`decoding=async` (Mesa) ou sem eles
#     (Conversa);
#   - `removeTitle`: `title` do botão (Conversa) ou vazio (Mesa);
#   - `handler`: nome do handler em `on:click` (cada app tem a sua tabela);
#   - `alt`/`removeLabel`: rótulos já resolvidos pelo host.
#
# `key` por item (identidade de lista do aplicador); o handler acha o item pelo
# `dataset.key` do `.attachment` mais próximo, como a fila faz com `data-id`.
#
# O estado transiente (lista viva, data URLs, IPC `readImage`, clipboard,
# timers do "Copiado", foco) nunca entra aqui.
#
# Pilha (issue bendlang/bend#798): o `long` da citação é um predicado limitado
# a 161 chars (`quoteIsLong`), não `String.length` da string inteira — o texto
# do usuário não é truncado, só o visível do chip corta em 159 + "…".
# ---------------------------------------------------------------------------

# ---------- fatos ----------

# Imagem anexada. `key` é a identidade do item; `removeLabel`/`removeTitle`
# são o `aria-label`/`title` do × (title vazio é omitido).
type AttachImage is Data:
  AttachImage{
    key: String,
    dataUrl: String,
    alt: String,
    removeLabel: String,
    removeTitle: String,
    handler: String,
    lazy: Bool
  }

# Arquivo de texto anexado (a Conversa lista `.file`; a Mesa não usa).
type AttachFile is Data:
  AttachFile{
    key: String,
    name: String,
    removeLabel: String,
    removeTitle: String,
    handler: String
  }

# ---------- textos ----------

def quoteChipLabel() -> String:
  "Citar:"

def quoteChipRemove() -> String:
  "Remover citação"

# Teto do trecho no chip (caracteres do texto plano). O `title` guarda o texto
# inteiro; o visível corta em 159 + "…" (o mesmo 160 do host antigo).
def quoteChipMax() -> Nat:
  160n

# Predicado limitado: "passa do teto" para no 161º char. `String.drop` anda no
# máximo 160 chars e o Bool só olha se ainda sobrou o 161º; nada de
# `String.length` na string inteira (recursão não-tail por caractere que
# estoura a pilha em textos grandes — issue bendlang/bend#798).
def quoteIsLong.drop(rest: String) -> Bool:
  match rest:
    case SNil{}:
      False{}
    case SCon{h, t}:
      True{}

def quoteIsLong(+s: String) -> Bool:
  quoteIsLong.drop(String.drop(s, quoteChipMax()))

def quoteDisplay.given(flat: String, long: Bool) -> String:
  match long:
    case False{}:
      flat
    case True{}:
      String.append(String.take(flat, Nat.sub(quoteChipMax(), 1n)), "…")

def quoteDisplay(+flat: String) -> String:
  quoteDisplay.given(flat, quoteIsLong(flat))

# O visível é aspeado; o `title` (fato `flat`) fica sem as aspas. O `.given`
# recebe a decisão pronta (o host/lei não precisa de `String.length` simbólico).
def quoteChipText.given(flat: String, long: Bool) -> String:
  String.join(["“", quoteDisplay.given(flat, long), "”"], "")

def quoteChipText(+flat: String) -> String:
  quoteChipText.given(flat, quoteIsLong(flat))

# ---------- attrs condicionais (fato → lista) ----------

def lazyAttrs(lazy: Bool) -> List<&2, V.ViewAttr>:
  match lazy:
    case True{}:
      [V.attr("loading", "lazy"), V.attr("decoding", "async")]
    case False{}:
      Nil{}

def removeTitleAttrs.if(title: String, empty: Bool) -> List<&2, V.ViewAttr>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      [V.attrTitle(title)]

def removeTitleAttrs(+title: String) -> List<&2, V.ViewAttr>:
  removeTitleAttrs.if(title, String.is_empty(title))

# ---------- nós ----------

def attachImg(dataUrl: String, alt: String, lazy: Bool) -> V.ViewNode:
  V.viewEl("img", V.attrJoin([[V.attr("src", dataUrl), V.attr("alt", alt)], lazyAttrs(lazy)]), Nil{})

def attachRemove(handler: String, label: String, title: String) -> V.ViewNode:
  V.viewEl(
    "button",
    V.attrJoin([
      [V.attrType("button"), V.attrClass("attachment-remove"), V.attrAria("label", label)],
      removeTitleAttrs(title),
      [V.attrOn("click", handler)]
    ]),
    [V.viewText("×")]
  )

def imageItem(row: AttachImage) -> V.ViewNode:
  match row:
    case AttachImage{key, dataUrl, alt, removeLabel, removeTitle, handler, lazy}:
      V.viewKey(
        "div",
        key,
        [V.attrClass("attachment")],
        [attachImg(dataUrl, alt, lazy), attachRemove(handler, removeLabel, removeTitle)]
      )

def fileItem(row: AttachFile) -> V.ViewNode:
  match row:
    case AttachFile{key, name, removeLabel, removeTitle, handler}:
      V.viewKey(
        "div",
        key,
        [V.attrClass("attachment")],
        [V.viewEl("div", [V.attrClass("file")], [V.viewText(name)]), attachRemove(handler, removeLabel, removeTitle)]
      )

def imageItemViews(xs: List<&2, AttachImage>) -> List<&2, V.ViewNode>:
  V.viewMap(~AttachImage, ~imageItem, xs)

def fileItemViews(xs: List<&2, AttachFile>) -> List<&2, V.ViewNode>:
  V.viewMap(~AttachFile, ~fileItem, xs)

# Filhos de `#attachments`: imagens primeiro, arquivos de texto depois (a
# ordem do composer atual). O `#attachments` em si é âncora do host (index.html).
def attachmentViews(images: List<&2, AttachImage>, files: List<&2, AttachFile>) -> List<&2, V.ViewNode>:
  V.viewJoin([imageItemViews(images), fileItemViews(files)])

# ---------- chip de citação ----------

def quoteChipNode(+flat: String, long: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrId("quote-chip"), V.attrClass("quote-chip")],
    [
      V.viewEl("span", [V.attrClass("quote-chip-label")], [V.viewText(quoteChipLabel())]),
      V.viewEl(
        "span",
        [V.attrClass("quote-chip-text"), V.attrTitle(flat)],
        [V.viewText(quoteChipText.given(flat, long))]
      ),
      V.viewEl(
        "button",
        [
          V.attrType("button"),
          V.attrClass("quote-chip-remove"),
          V.attrAria("label", quoteChipRemove()),
          V.attrTitle(quoteChipRemove()),
          V.attrOn("click", "RemoveQuote")
        ],
        [V.viewText("×")]
      )
    ]
  )

# O host mede o fato `long` (limitado ao teto) e passa pronto; o caminho
# automático mede com o predicado limitado.
def quoteChipView.given(+flat: String, long: Bool) -> V.ViewNode:
  quoteChipNode(flat, long)

def quoteChipView(+flat: String) -> V.ViewNode:
  quoteChipNode(flat, quoteIsLong(flat))
