import Base
import ../lightboxview.bend as L
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da view do lightbox de anexos da Conversa (`#image-dialog`).
# Prefixo `lb_`.
#
# Cenários concretos: os fatos entram já resolvidos (nome/alt, índice/total,
# zoomed/dragging, percentual pronto) e a lei fecha por computação. O que se
# fixa aqui é o DOM que o aplicador cola no `index.html` (ids, classes, aria,
# textos, `hidden`, `autofocus` e a ordem das ações). O que ficou de fora
# (showModal/close, foco, zoom/pan com medida, clipboard, fetch) é host.
# ---------------------------------------------------------------------------

def lbFirst(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

def lbNth(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      match i:
        case 0n:
          h
        case 1n+rest:
          lbNth(t, rest)

# ---------- título: nome do arquivo ----------

law lb_titulo_vazio:
  {L.lbTitle("") == "Imagem" : String}

law lb_titulo_nome:
  {L.lbTitle("Imagem enviada") == "Imagem enviada" : String}

law lb_titulo_unix:
  {L.lbTitle("/tmp/conversa/plot.png") == "plot.png" : String}

law lb_titulo_win:
  {L.lbTitle("C:\\Users\\would\\plot.png") == "plot.png" : String}

# Barra final deixa o último segmento vazio (cai no fallback).
law lb_titulo_barra_final:
  {L.lbTitle("/tmp/antes/") == "Imagem" : String}

# Separadores misturados: o último de qualquer barra manda.
law lb_titulo_misto:
  {L.lbTitle("dir\\sub/plot.png") == "plot.png" : String}

# Caminho longo (acima dos tetos antigos de pilha) não muda o basename.
law lb_titulo_longo:
  {L.lbTitle(String.append(String.from_list(List.replicate(Char, 200n, 'a')), "/plot.png")) == "plot.png" : String}

law lb_titulo_no:
  {V.textOf(L.lbTitleNode("curva.png")) == "curva.png" : String}

law lb_titulo_no_texto:
  {V.isText(L.lbTitleNode("")) == True{} : Bool}

# ---------- alt do preview ----------

law lb_alt_vazio:
  {L.lbAlt("") == "Imagem ampliada" : String}

law lb_alt_presente:
  {L.lbAlt("plot.png") == "plot.png" : String}

# ---------- contador ----------

law lb_contagem_uma:
  {L.lbCountText(0n, 1n) == "1/1" : String}

law lb_contagem_meio:
  {L.lbCountText(1n, 3n) == "2/3" : String}

law lb_contagem_ultima:
  {L.lbCountText(9n, 10n) == "10/10" : String}

law lb_nav_escondida_zero:
  {L.lbNavHidden(0n) == True{} : Bool}

law lb_nav_escondida_uma:
  {L.lbNavHidden(1n) == True{} : Bool}

law lb_nav_visivel_duas:
  {L.lbNavHidden(2n) == False{} : Bool}

law lb_nav_visivel_muitas:
  {L.lbNavHidden(7n) == False{} : Bool}

# ---------- contador (nó) ----------

law lb_contador_uma_escondido:
  {V.attrGet(V.attrsOf(L.lbCountNode(0n, 1n)), "hidden") == Some{""} : Maybe<&2, String>}

law lb_contador_varias_visivel:
  {V.attrGet(V.attrsOf(L.lbCountNode(0n, 3n)), "hidden") == None{} : Maybe<&2, String>}

law lb_contador_texto:
  {V.textOf(lbFirst(V.kidsOf(L.lbCountNode(1n, 3n)))) == "2/3" : String}

law lb_contador_id:
  {V.attrGet(V.attrsOf(L.lbCountNode(0n, 3n)), "id") == Some{"image-count"} : Maybe<&2, String>}

# ---------- setas ----------

law lb_anterior_id:
  {V.attrGet(V.attrsOf(L.lbPrevNode(False{})), "id") == Some{"image-prev"} : Maybe<&2, String>}

law lb_anterior_classe:
  {V.attrGet(V.attrsOf(L.lbPrevNode(False{})), "class") == Some{"img-nav"} : Maybe<&2, String>}

law lb_anterior_rotulo:
  {V.attrGet(V.attrsOf(L.lbPrevNode(False{})), "aria-label") == Some{"Imagem anterior"} : Maybe<&2, String>}

law lb_anterior_clique:
  {V.attrGet(V.attrsOf(L.lbPrevNode(False{})), "on:click") == Some{"ImagePrev"} : Maybe<&2, String>}

law lb_anterior_escondida:
  {V.attrGet(V.attrsOf(L.lbPrevNode(True{})), "hidden") == Some{""} : Maybe<&2, String>}

law lb_anterior_visivel:
  {V.attrGet(V.attrsOf(L.lbPrevNode(False{})), "hidden") == None{} : Maybe<&2, String>}

law lb_proxima_id:
  {V.attrGet(V.attrsOf(L.lbNextNode(False{})), "id") == Some{"image-next"} : Maybe<&2, String>}

law lb_proxima_rotulo:
  {V.attrGet(V.attrsOf(L.lbNextNode(False{})), "aria-label") == Some{"Próxima imagem"} : Maybe<&2, String>}

law lb_proxima_clique:
  {V.attrGet(V.attrsOf(L.lbNextNode(False{})), "on:click") == Some{"ImageNext"} : Maybe<&2, String>}

law lb_proxima_escondida:
  {V.attrGet(V.attrsOf(L.lbNextNode(True{})), "hidden") == Some{""} : Maybe<&2, String>}

law lb_setas_sem_texto:
  {List.length(&2, V.ViewNode, V.kidsOf(L.lbNextNode(True{}))) == 0n : Nat}

# ---------- selo do zoom ----------

law lb_zoom_sem_zoom_escondido:
  {V.attrGet(V.attrsOf(L.lbZoomNode("100%", False{})), "hidden") == Some{""} : Maybe<&2, String>}

law lb_zoom_com_zoom_visivel:
  {V.attrGet(V.attrsOf(L.lbZoomNode("250%", True{})), "hidden") == None{} : Maybe<&2, String>}

law lb_zoom_texto:
  {V.textOf(lbFirst(V.kidsOf(L.lbZoomNode("250%", True{})))) == "250%" : String}

law lb_zoom_aria:
  {V.attrGet(V.attrsOf(L.lbZoomNode("100%", False{})), "aria-live") == Some{"polite"} : Maybe<&2, String>}

law lb_zoom_id:
  {V.attrGet(V.attrsOf(L.lbZoomNode("100%", False{})), "id") == Some{"image-zoom"} : Maybe<&2, String>}

# ---------- viewport ----------

law lb_viewport_classe:
  {V.attrGet(V.attrsOf(L.lbViewportNode(False{}, False{})), "class") == Some{"img-viewport"} : Maybe<&2, String>}

law lb_viewport_zoom:
  {V.attrGet(V.attrsOf(L.lbViewportNode(True{}, False{})), "class") == Some{"img-viewport zoomed"} : Maybe<&2, String>}

law lb_viewport_arrasto:
  {V.attrGet(V.attrsOf(L.lbViewportNode(False{}, True{})), "class") == Some{"img-viewport dragging"} : Maybe<&2, String>}

law lb_viewport_zoom_arrasto:
  {V.attrGet(V.attrsOf(L.lbViewportNode(True{}, True{})), "class") == Some{"img-viewport zoomed dragging"} : Maybe<&2, String>}

law lb_viewport_sem_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(L.lbViewportNode(True{}, True{}))) == 0n : Nat}

# ---------- imagem ----------

law lb_preview_id:
  {V.attrGet(V.attrsOf(L.lbPreviewNode("data:image/png;base64,aa", "", "")), "id") == Some{"image-preview"} : Maybe<&2, String>}

law lb_preview_src:
  {V.attrGet(V.attrsOf(L.lbPreviewNode("data:image/png;base64,aa", "", "")), "src") == Some{"data:image/png;base64,aa"} : Maybe<&2, String>}

law lb_preview_sem_src:
  {V.attrGet(V.attrsOf(L.lbPreviewNode("", "", "")), "src") == None{} : Maybe<&2, String>}

law lb_preview_alt_vazio:
  {V.attrGet(V.attrsOf(L.lbPreviewNode("a.png", "", "")), "alt") == Some{"Imagem ampliada"} : Maybe<&2, String>}

law lb_preview_alt:
  {V.attrGet(V.attrsOf(L.lbPreviewNode("a.png", "Imagem enviada", "")), "alt") == Some{"Imagem enviada"} : Maybe<&2, String>}

law lb_preview_arrastavel:
  {V.attrGet(V.attrsOf(L.lbPreviewNode("a.png", "b", "")), "draggable") == Some{"false"} : Maybe<&2, String>}

law lb_preview_transform:
  {V.attrGet(V.attrsOf(L.lbPreviewNode("a.png", "b", "translate(10px,-4px) scale(2)")), "style") == Some{"translate(10px,-4px) scale(2)"} : Maybe<&2, String>}

law lb_preview_sem_transform:
  {V.attrGet(V.attrsOf(L.lbPreviewNode("a.png", "b", "")), "style") == None{} : Maybe<&2, String>}

law lb_preview_tag:
  {V.tagOf(L.lbPreviewNode("a.png", "b", "")) == "img" : String}

law lb_preview_sem_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(L.lbPreviewNode("a.png", "b", ""))) == 0n : Nat}

# ---------- ações ----------

law lb_acoes_duas:
  {List.length(&2, V.ViewNode, L.lbActions()) == 2n : Nat}

law lb_acoes_ordem:
  {V.attrGet(V.attrsOf(lbNth(L.lbActions(), 1n)), "id") == Some{"image-close"} : Maybe<&2, String>}

law lb_acoes_copiar_rotulo:
  {V.textOf(lbFirst(V.kidsOf(lbNth(L.lbActions(), 0n)))) == "Copiar" : String}

law lb_acoes_copiar_clique:
  {V.attrGet(V.attrsOf(lbNth(L.lbActions(), 0n)), "on:click") == Some{"ImageCopy"} : Maybe<&2, String>}

law lb_acoes_copiar_tipo:
  {V.attrGet(V.attrsOf(lbNth(L.lbActions(), 0n)), "type") == Some{"button"} : Maybe<&2, String>}

law lb_acoes_copiar_sem_autofocus:
  {V.attrGet(V.attrsOf(lbNth(L.lbActions(), 0n)), "autofocus") == None{} : Maybe<&2, String>}

law lb_acoes_fechar_rotulo:
  {V.textOf(lbFirst(V.kidsOf(lbNth(L.lbActions(), 1n)))) == "Fechar" : String}

law lb_acoes_fechar_clique:
  {V.attrGet(V.attrsOf(lbNth(L.lbActions(), 1n)), "on:click") == Some{"ImageClose"} : Maybe<&2, String>}

law lb_acoes_fechar_autofocus:
  {V.attrGet(V.attrsOf(lbNth(L.lbActions(), 1n)), "autofocus") == Some{""} : Maybe<&2, String>}

law lb_acoes_fechar_id:
  {V.attrGet(V.attrsOf(lbNth(L.lbActions(), 1n)), "id") == Some{"image-close"} : Maybe<&2, String>}
