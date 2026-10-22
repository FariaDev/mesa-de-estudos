import Base
import msg.bend as M

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

# Falhas só podem repetir quando o host comprovou que nada foi enviado.
# O limite vale por item; o host mede tentativas, cancela timers e compara.
def maxAutoRetries() -> Nat:
  3n

def retryAllowed(safe: Bool, belowLimit: Bool) -> Bool:
  match safe:
    case False{}:
      False{}
    case True{}:
      belowLimit

# Número da repetição (1, 2, 3): 2s, 4s, 8s. Outros valores não agendam.
def retryDelay(retry: Nat) -> U32:
  match retry:
    case 1n:
      2000
    case 2n:
      4000
    case 3n:
      8000
    case _:
      0

# ---------------------------------------------------------------------------
# Enviar com o tutor desligado (ticket #18).
#
# Escrever e enviar sem o tutor ligado não vai direto ao Pi: a mensagem é
# GUARDADA na fila (a que já persiste por sessão) e a conexão é chamada. Quando
# o tutor atende, a fila sai — uma vez, na ordem. O host mede os fatos (ligado,
# ocupado, comando digitado, texto, anexos) e este núcleo decide.
#
#   - ligado: vai direto (nada a guardar);
#   - ocupado (resposta em andamento): a fila de sempre cuida — não é "guardada";
#   - comando digitado (/compact, /conferir): não vira mensagem guardada;
#   - o que não vale guardar (vazio, sem anexo) nunca entra (`keepItem`).
# ---------------------------------------------------------------------------

def keptWhileOff.ready(command: Bool, usable: Bool) -> Bool:
  match command:
    case True{}:
      False{}
    case False{}:
      usable

def keptWhileOff.idle(busy: Bool, command: Bool, usable: Bool) -> Bool:
  match busy:
    case True{}:
      False{}
    case False{}:
      keptWhileOff.ready(command, usable)

def keptWhileOff(connected: Bool, busy: Bool, command: Bool, text: String, imageCount: Nat) -> Bool:
  match connected:
    case True{}:
      False{}
    case False{}:
      keptWhileOff.idle(busy, command, keepItem(text, imageCount))

# O que a faixa da fila diz enquanto o tutor não atende. `plain` é o rótulo
# comum da fila (`composerview.queueLabel`, "Na fila" ou "Recuperadas"): a fila
# recuperada de outra execução continua dizendo de onde veio — nada nela sai
# sozinho —, e com o tutor atendendo vale o rótulo comum.
def keptLabel(many: Bool, count: String) -> String:
  match many:
    case False{}:
      M.msg("pending.kept")
    case True{}:
      M.msg1("pending.keptMany", "count", count)

def stripLabel.off(tutorOff: Bool, many: Bool, count: String, plain: String) -> String:
  match tutorOff:
    case True{}:
      keptLabel(many, count)
    case False{}:
      plain

def stripLabel(recovered: Bool, tutorOff: Bool, many: Bool, count: String, plain: String) -> String:
  match recovered:
    case True{}:
      plain
    case False{}:
      stripLabel.off(tutorOff, many, count, plain)

# A fila guardada sai quando o tutor PASSA a atender — não a cada checagem de
# saúde que repete "ligado".
def tutorAnswered(wasOnline: Bool, isOnline: Bool) -> Bool:
  match wasOnline:
    case True{}:
      False{}
    case False{}:
      isOnline

# Tutor atendeu, mas a fila está vetada por algo que NÃO se resolve sozinho
# (entrega incerta ou cancelamento em confirmação): a mensagem guardada não pode
# ficar parada sem saída — ela é SEGURADA, e a faixa passa a oferecer "Enviar
# agora". Resposta em andamento e permissão pendente não entram: esses vetos
# passam sozinhos (o `desk-idle` solta a fila).
def holdAfterAnswer.stuck(uncertain: Bool, cancelled: Bool) -> Bool:
  match uncertain:
    case True{}:
      True{}
    case False{}:
      cancelled

def holdAfterAnswer.free(permissionPending: Bool, uncertain: Bool, cancelled: Bool) -> Bool:
  match permissionPending:
    case True{}:
      False{}
    case False{}:
      holdAfterAnswer.stuck(uncertain, cancelled)

def holdAfterAnswer(busy: Bool, permissionPending: Bool, uncertain: Bool, cancelled: Bool) -> Bool:
  match busy:
    case True{}:
      False{}
    case False{}:
      holdAfterAnswer.free(permissionPending, uncertain, cancelled)
