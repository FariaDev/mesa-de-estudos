import Base

# ---------------------------------------------------------------------------
# Fila guardada no disco (Mesa): `runtime/pending.json`.
#
# O que fica guardado quando o app fecha: os itens que ainda não foram aceitos
# pelo Pi (texto, referências e anexos) e a bandeja do composer. O host mede os
# fatos — texto, contagem de imagens, bytes do arquivo — e este núcleo decide o
# que entra, o que é cortado e o que é recusado; nada aqui toca disco ou DOM.
#
# Regras que valem a pena ler antes de mexer:
#   - um item sem texto (depois do trim) e sem imagem não é guardado: não
#     haveria nada para enviar;
#   - o texto é cortado no teto do rascunho (MAX_DRAFT), o mesmo que o
#     `pi-prompt` recusa — o disco nunca guarda o que o envio recusaria;
#   - com mais de `maxItems()` itens, os PRIMEIROS ficam (a ordem da fila) e o
#     resto volta ao host como descartado;
#   - referências: no máximo `maxRefs()`, página nunca abaixo de 1.
# ---------------------------------------------------------------------------

# ---------- constantes da política (o host compara; o núcleo documenta) ----------

def maxItems() -> Nat:
  50n

def maxRefs() -> Nat:
  2n

# Teto do arquivo inteiro (itens + bandeja). É U32 pelo mesmo motivo dos tetos
# de anexo: Nat em Bend é unário e um literal de 40 MiB não expande.
def maxStoredBytes() -> U32:
  (40 * 1024 * 1024 : U32)

# ---------- regras ----------

# Página guardada: 0 vira 1 — a mesma forma do `#page=N` que o Pi recebe.
# O fato entra como parâmetro (match sobre valor computado não é aceito).
def pageOf.if(page: Nat, zero: Bool) -> Nat:
  match zero:
    case True{}:
      1n
    case False{}:
      page

def pageOf(+page: Nat) -> Nat:
  pageOf.if(page, Nat.is_eq(page, 0n))

# Vale guardar? Texto vazio (depois do trim) só passa com anexo.
def keepItem.empty(hasImage: Bool, blank: Bool) -> Bool:
  match blank:
    case True{}:
      hasImage
    case False{}:
      True{}

def keepItem(text: String, imageCount: Nat) -> Bool:
  keepItem.empty(Nat.is_gt(imageCount, 0n), String.is_empty(String.trim(text)))

# Corte do texto no teto do rascunho (não mexe no que já cabe).
def cutText.if(text: String, limit: Nat, over: Bool) -> String:
  match over:
    case False{}:
      text
    case True{}:
      String.take(text, limit)

def cutText(+text: String, +limit: Nat) -> String:
  cutText.if(text, limit, Nat.is_gt(String.length(text), limit))

# A ordem da fila é o que fica: o índice do item decide se ele entra no arquivo.
def keepAt(index: Nat) -> Bool:
  Nat.is_lt(index, maxItems())

# A fila que veio de outra execução nunca sai sozinha: `held` liga na carga.
# `stored` é o que ficou no arquivo (o usuário parou a fila no meio do turno);
# `recovered` é a fila lida depois de fechar o app.
def heldOnLoad(stored: Bool, recovered: Bool) -> Bool:
  match recovered:
    case True{}:
      True{}
    case False{}:
      stored

def overStored(bytes: U32) -> Bool:
  U32.is_gt(bytes, maxStoredBytes())
