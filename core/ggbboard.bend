import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Quadro limpo do GeoGebra por uso do tutor (ticket #53). Módulo só da Mesa.
#
# O tutor pede ao applet; cada RESPOSTA nova dele começa com a construção
# vazia, mas nada do que havia some: a construção que sai do quadro fica
# guardada (histórico curto) e há um "Voltar à construção anterior".
#
# O host entrega fatos e o núcleo decide:
#   - o que o tutor está fazendo: executar um comando (`UseRun`) ou só ler
#     (`UseRead`: estado, print). Ler NUNCA limpa: o aluno que pede "confira
#     minha construção" tem de ver a dele;
#   - `continues`: o tutor pediu para continuar a construção que já está lá;
#   - `sameRequest`: o quadro já foi limpo (ou usado) nesta resposta;
#   - `empty`: o quadro está vazio — não há o que guardar.
#
# Limpa só quando o tutor vai EXECUTAR, é a primeira vez da resposta, não pediu
# para continuar e há algo no quadro (`PlanFresh`). Em qualquer outro caso o
# quadro fica como está (`PlanKeep`).
#
# O que sai do quadro é guardado com a ORIGEM: o desenho do próprio tutor ou o
# que o aluno montou (ou mexeu depois do tutor). O aviso diz qual, para o que
# o aluno fez sozinho nunca se perder calado. O histórico guarda até
# `keptLimit()` construções; ao voltar, a construção que estava no quadro
# ocupa o lugar da restaurada (troca), então voltar também se desfaz.
#
# Fora daqui (host): ler o applet, comparar o desenho com o último do tutor,
# gravar o histórico em disco e `setBase64`/`newConstruction`.
# ---------------------------------------------------------------------------

type UseKind is Data:
  UseRun{}
  UseRead{}

type BoardPlan is Data:
  PlanKeep{}
  PlanFresh{}

type KeptOrigin is Data:
  FromTutor{}
  FromStudent{}

type RestorePlan is Data:
  RestoreNone{}
  RestoreOnly{}
  RestoreSwap{}

# ---------- quando limpar ----------

def planOfKeep(keep: Bool) -> BoardPlan:
  match keep:
    case True{}:
      PlanKeep{}
    case False{}:
      PlanFresh{}

def runPlan(continues: Bool, sameRequest: Bool, empty: Bool) -> BoardPlan:
  planOfKeep(Bool.or(continues, Bool.or(sameRequest, empty)))

def boardPlan(kind: UseKind, continues: Bool, sameRequest: Bool, empty: Bool) -> BoardPlan:
  match kind:
    case UseRead{}:
      PlanKeep{}
    case UseRun{}:
      runPlan(continues, sameRequest, empty)

# ---------- o que guardar ----------

def keptLimit() -> Nat:
  3n

# Origem do que sai do quadro: do tutor só se ele já desenhou aqui e nada mudou
# desde o último comando dele; senão é do aluno.
def originOfTutor(tutor: Bool) -> KeptOrigin:
  match tutor:
    case True{}:
      FromTutor{}
    case False{}:
      FromStudent{}

def originOf(tutorDrew: Bool, unchangedSinceTutor: Bool) -> KeptOrigin:
  originOfTutor(Bool.and(tutorDrew, unchangedSinceTutor))

# Quantas ficam guardadas depois de guardar mais uma (a mais antiga sai).
def keptAfterPush(count: Nat) -> Nat:
  Nat.min(Nat.add(count, 1n), keptLimit())

# ---------- voltar ----------

def canGoBack(count: Nat) -> Bool:
  match count:
    case 0n:
      False{}
    case 1n+p:
      True{}

def restoreWith(currentEmpty: Bool) -> RestorePlan:
  match currentEmpty:
    case True{}:
      RestoreOnly{}
    case False{}:
      RestoreSwap{}

# Sem nada guardado, nada a restaurar. Com o quadro vazio, a restaurada só sai
# do histórico; com algo no quadro, ele toma o lugar dela (troca).
def restorePlan(count: Nat, currentEmpty: Bool) -> RestorePlan:
  match count:
    case 0n:
      RestoreNone{}
    case 1n+p:
      restoreWith(currentEmpty)

def keptAfterRestore.pick(currentEmpty: Bool, rest: Nat) -> Nat:
  match currentEmpty:
    case True{}:
      rest
    case False{}:
      Nat.add(rest, 1n)

def keptAfterRestore(count: Nat, currentEmpty: Bool) -> Nat:
  match count:
    case 0n:
      0n
    case 1n+p:
      keptAfterRestore.pick(currentEmpty, p)

# ---------- textos (mensagens do catálogo, #41) ----------

def freshNote(origin: KeptOrigin) -> String:
  match origin:
    case FromTutor{}:
      M.msg("ggb.board.freshTutor")
    case FromStudent{}:
      M.msg("ggb.board.freshStudent")

def backLabel() -> String:
  M.msg("ggb.board.back")

def backTitle(count: Nat) -> String:
  M.msg1("ggb.board.backTitle", "count", Nat.show(count))

def restoredNote() -> String:
  M.msg("ggb.board.restored")

def nothingToRestoreNote() -> String:
  M.msg("ggb.board.nothingToRestore")
