import Base
import msg.bend as M
import search.bend as S

# ---------------------------------------------------------------------------
# Busca de estudos (Mesa): a política pura da busca unificada.
#
# O host anda as pastas AUTORIZADAS, lê os arquivos, monta o índice incremental,
# dobra o texto, mede o relógio e monta o recorte original; o núcleo decide o que
# entra, como pontua, o recorte com `…` e os tetos. Nada aqui lê disco, rede ou
# DOM.
#
# A dobra de acento/caixa é a mesma da busca das conversas (`search.bend`):
# Latin-1 + marcas combinantes fora, caixa baixa. `formulario` acha
# "Formulário" e `calculo` acha "Cálculo". O resto do Unicode fica no host.
#
# Autorização (o host entrega os fatos já resolvidos):
#   - dado de runtime (conversa, lateral, caderno, sessão Livre, anotação) entra
#     quando o runtime está na lista;
#   - matéria (título/nome de material) entra só com matéria explícita;
#   - TEXTO de PDF entra só com matéria explícita E autorização explícita do
#     usuário/leitor — `allowed` nunca deixa `HsPdf` passar só com runtime;
#   - caminho vindo do renderer NUNCA autoriza por si: `pathTrusted` só devolve
#     True quando a biblioteca do host confere (`inLibrary`), e o fato
#     `fromRenderer` é ignorado de propósito.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

# ---------- fontes ----------

type HitSource is Data:
  HsConv{}
  HsSide{}
  HsNote{}
  HsReview{}
  HsFree{}
  HsMaterial{}
  HsPdf{}

def sourceKey(s: HitSource) -> String:
  match s:
    case HsConv{}:
      "conversa"
    case HsSide{}:
      "lateral"
    case HsNote{}:
      "nota"
    case HsReview{}:
      "caderno"
    case HsFree{}:
      "livre"
    case HsMaterial{}:
      "materia"
    case HsPdf{}:
      "pdf"

def sourceLabel(s: HitSource) -> String:
  match s:
    case HsConv{}:
      M.msg("search.source.conv")
    case HsSide{}:
      M.msg("search.source.side")
    case HsNote{}:
      M.msg("search.source.note")
    case HsReview{}:
      M.msg("search.source.review")
    case HsFree{}:
      M.msg("search.source.free")
    case HsMaterial{}:
      M.msg("search.source.material")
    case HsPdf{}:
      M.msg("search.source.pdf")

# Só texto de PDF exige autorização explícita (e matéria).
def needsPdfAuth(s: HitSource) -> Bool:
  match s:
    case HsPdf{}:
      True{}
    case _:
      False{}

# O host compara os fatos; o núcleo devolve a tabela. `HsMaterial` é metadado de
# matéria (exige `courseOk`); `HsPdf` exige os dois; o resto vive no runtime.
def allowed(s: HitSource, runtimeOk: Bool, courseOk: Bool, pdfAuth: Bool) -> Bool:
  match s:
    case HsPdf{}:
      Bool.and(runtimeOk, Bool.and(courseOk, pdfAuth))
    case HsMaterial{}:
      courseOk
    case _:
      runtimeOk

# Caminho do renderer só vale depois que a biblioteca do host confere. O fato
# `fromRenderer` não autoriza nada por si — mudar de onde veio o caminho não
# muda o resultado.
def pathTrusted(inLibrary: Bool, _fromRenderer: Bool) -> Bool:
  inLibrary

# ---------- tetos (o host compara; o núcleo documenta) ----------

def minQueryChars() -> Nat:
  2n

def maxQueryChars() -> Nat:
  80n

def defaultLimit() -> Nat:
  30n

def maxLimit() -> Nat:
  50n

def maxHits() -> Nat:
  200n

def maxFiles() -> Nat:
  400n

def maxPerConversation() -> Nat:
  4n

def maxPerFile() -> Nat:
  3n

def maxSnippetChars() -> Nat:
  160n

def maxFileBytes() -> Nat:
  8388608n

def timeBudgetMs() -> Nat:
  2500n

# inválido (NaN, < 1) ⇒ default; senão min(n, max).
def clampLimit.cap(overMax: Bool, n: Nat) -> Nat:
  match overMax:
    case True{}:
      maxLimit()
    case False{}:
      n

def clampLimit(invalid: Bool, overMax: Bool, n: Nat) -> Nat:
  match invalid:
    case True{}:
      defaultLimit()
    case False{}:
      clampLimit.cap(overMax, n)

# ---------- casamento e trecho (a dobra e o recorte são do host; a `…` é daqui) ----------

def matches(hay: String, needle: String) -> Bool:
  S.matches(hay, needle)

def clipText(cutStart: Bool, cutEnd: Bool, body: String) -> String:
  S.snippet(cutStart, cutEnd, body)

# ---------- pontuação ----------

type Rank is Data:
  RankTitle{}
  RankStart{}
  RankWord{}
  RankAny{}

# Prioridade: título da conversa/nota/material > casamento no começo do texto >
# casamento em fronteira de palavra > em qualquer lugar.
def best.any(titleHit: Bool, startHit: Bool, wordHit: Bool) -> Rank:
  match wordHit:
    case True{}:
      RankWord{}
    case False{}:
      RankAny{}

def best.start(titleHit: Bool, startHit: Bool, wordHit: Bool) -> Rank:
  match startHit:
    case True{}:
      RankStart{}
    case False{}:
      best.any(titleHit, startHit, wordHit)

def best(titleHit: Bool, startHit: Bool, wordHit: Bool) -> Rank:
  match titleHit:
    case True{}:
      RankTitle{}
    case False{}:
      best.start(titleHit, startHit, wordHit)

def rankWeight(r: Rank) -> Nat:
  match r:
    case RankTitle{}:
      3n
    case RankStart{}:
      2n
    case RankWord{}:
      1n
    case RankAny{}:
      0n

# `better a b` = a vem antes de b. Só reduz com Rank concreto; o host usa os
# pesos para ordenar e o núcleo prova a precedência.
def better(a: Rank, b: Rank) -> Bool:
  match a:
    case RankTitle{}:
      match b:
        case RankTitle{}:
          False{}
        case _:
          True{}
    case RankStart{}:
      match b:
        case RankTitle{}:
          False{}
        case _:
          True{}
    case RankWord{}:
      match b:
        case RankTitle{}:
          False{}
        case RankStart{}:
          False{}
        case _:
          True{}
    case RankAny{}:
      False{}

# ---------- textos do diálogo ----------

def dialogTitle() -> String:
  M.msg("search.title")

def searchPlaceholder() -> String:
  M.msg("search.placeholder")

def searchLabel() -> String:
  M.msg("search.label")

def searchButton() -> String:
  M.msg("common.search")

def sourcesLabel() -> String:
  M.msg("search.sources")

def coursesLabel() -> String:
  M.msg("search.courses")

def allSourcesLabel() -> String:
  M.msg("search.allSources")

def clearFiltersLabel() -> String:
  M.msg("search.clear")

def pdfScopeHint() -> String:
  M.msg("search.pdfScope")

def allCoursesLabel() -> String:
  M.msg("common.allCourses")

def hintText() -> String:
  M.msg("search.hint")

def shortQueryText() -> String:
  M.msg("search.short")

def searchingText() -> String:
  M.msg("search.searching")

def emptyText() -> String:
  M.msg("search.empty")

def truncatedText() -> String:
  M.msg("search.truncated")

def openLabel() -> String:
  M.msg("search.open")

def closeLabel() -> String:
  M.msg("common.close")

def noteLabel() -> String:
  M.msg("search.note")

def countText.one(n: Nat) -> String:
  match n:
    case 1n:
      M.msg1("search.count", "count", "1")
    case _:
      M.msg1("search.count", "count", Nat.show(n))

def countText(n: Nat) -> String:
  countText.one(n)

def pageLabel(page: Nat) -> String:
  M.msg1("common.pageShort", "page", Nat.show(page))

def nowLabel() -> String:
  M.msg("search.now")
