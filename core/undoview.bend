import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Desfazer remoção (Caderno de revisão e Anotações de página): o token opaco, o
# prazo e a decisão de restaurar.
#
# Nada aqui toca disco, DOM, IPC, relógio ou aleatoriedade: o host
# (`desk/deletion-undo.cjs`) gera o token, guarda no PROCESSO o item removido
# (original, com id/datas/agenda) e consulta este núcleo para decidir. A decisão
# é pura — o token pode ser desconhecido (já usado ou nunca existiu), ter
# vencido, ser de outro curso/conversa ou apontar para material fora da
# biblioteca autorizada.
#
# Ordem da decisão (a primeira que falha vence):
#   desconhecido → vencido → outro escopo → material bloqueado → pronto.
# Escopo e material recusados NÃO consomem o token: o dono legítimo ainda pode
# desfazer dentro do prazo. Quem consome é o host — só `Ready` (sucesso) e
# `Expired` (limpeza do registro) saem do mapa.
#
# O aviso da tela (`noticeMs`) é mais curto que o prazo do host (`ttlMs`): o
# relógio do aviso só esconde a UI, nunca apaga os dados de recuperação.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type UndoDecision is Data:
  UndoUnknown{}
  UndoExpired{}
  UndoForeign{}
  UndoBlocked{}
  UndoReady{}

# ---------- prazos e forma do token (o host compara; o núcleo documenta) ----------

def ttlMs() -> Nat:
  60000n

def noticeMs() -> Nat:
  25000n

def maxToken() -> Nat:
  64n

def maxEntries() -> Nat:
  64n

def expiryFrom(now: Nat, ttl: Nat) -> Nat:
  Nat.add(now, ttl)

# Vencido a partir do instante exato do vencimento (agora >= prazo).
def isExpired(now: Nat, expiresAt: Nat) -> Bool:
  Nat.is_ge(now, expiresAt)

# O fato `expired` entra como parâmetro (match em valor computado não é aceito).
def remainingMs.if(now: Nat, expiresAt: Nat, expired: Bool) -> Nat:
  match expired:
    case True{}:
      0n
    case False{}:
      Nat.sub(expiresAt, now)

# Restante do prazo nunca fica negativo: vencido = 0.
def remainingMs(+now: Nat, +expiresAt: Nat) -> Nat:
  remainingMs.if(now, expiresAt, isExpired(now, expiresAt))

# Segundos cheios que faltam para o contador do aviso (nunca abaixo de 0).
def secondsLeft(now: Nat, expiresAt: Nat) -> Nat:
  Nat.div(remainingMs(now, expiresAt), 1000n)

# Token vazio ou gigante nunca casa com o registro (o host confere de novo).
def validToken(+token: String) -> Bool:
  Bool.and(
    Bool.not(String.is_empty(String.trim(token))),
    Nat.is_le(String.length(token), maxToken())
  )

def clampIndex.if(index: Nat, len: Nat, over: Bool) -> Nat:
  match over:
    case True{}:
      len
    case False{}:
      index

# Posição de reinserção nunca passa do fim da lista (0 = início).
def clampIndex(+index: Nat, +len: Nat) -> Nat:
  clampIndex.if(index, len, Nat.is_gt(index, len))

# ---------- decisão ----------

def decide(known: Bool, expired: Bool, sameScope: Bool, authorized: Bool) -> UndoDecision:
  match known:
    case False{}:
      UndoUnknown{}
    case True{}:
      match expired:
        case True{}:
          UndoExpired{}
        case False{}:
          match sameScope:
            case False{}:
              UndoForeign{}
            case True{}:
              match authorized:
                case False{}:
                  UndoBlocked{}
                case True{}:
                  UndoReady{}

# ---------- rótulos ----------

def undoLabel() -> String:
  M.msg("undo.label")

def undoTitle() -> String:
  M.msg("undo.title")

def closeTitle() -> String:
  M.msg("undo.close")

def noticeReview() -> String:
  M.msg("undo.noticeReview")

def noticeNote() -> String:
  M.msg("undo.noticeNote")

def restoredReview() -> String:
  M.msg("undo.restoredReview")

def restoredNote() -> String:
  M.msg("undo.restoredNote")

def expiredText() -> String:
  M.msg("undo.expired")

def foreignText() -> String:
  M.msg("undo.foreign")

def blockedText() -> String:
  M.msg("undo.blocked")

def unknownText() -> String:
  M.msg("undo.unknown")

def failedText() -> String:
  M.msg("undo.failed")

def countdownLabel(seconds: Nat) -> String:
  M.msg1("undo.countdown", "seconds", Nat.show(seconds))
