import Base

# ---------------------------------------------------------------------------
# Estado persistido da Mesa e da Conversa — recorte puro e escalar.
#
# O host faz JSON/fs/IPC e converte valores dinâmicos para os registros fechados
# abaixo. Assim, só estas chaves entram no núcleo; chaves desconhecidas somem na
# fronteira. `None` significa ausente OU tipo inválido e portanto usa o default.
# Para números presentes, o host entrega os fatos `under`/`over` já comparados.
# Para draft, entrega também `cut = raw.slice(0, 100000)` e `overLimit`; o Bend
# decide qual texto vale. O host segue mandando o corte preventivo (o rascunho
# não atravessa o IPC inteiro), mas ele já não é muleta do `String.take`: o
# núcleo cobre 100 mil chars com loop (correção #798, ver `take.go`).
#
# Incluído aqui: draft (corte em 100000, sem trim para não alterar o texto do
# usuário), tema, booleanos e clamps de layout. `trimTake` apara e corta strings
# de até 100000 chars no núcleo. PDFs (path autorizado e no
# máximo dois), sessões, courseStates, bounds e maximized ficam no host: exigem
# filesystem/display ou estruturas dinâmicas. O estudo/Xournal já vive em
# `study.bend`; anexos ficam fora por tamanho, MIME e I/O.
#
# A Mesa usa defaults 390/220/0.5, limites 300..700, 72..900 e 0.2..0.8.
# A Conversa usa draft vazio, tema auto e busca desligada.
# ---------------------------------------------------------------------------

type StateTheme is Data:
  StateThemeAuto{}
  StateThemeLight{}
  StateThemeDark{}

type DeskState is Data:
  DeskState{
    draft: String,
    theme: StateTheme,
    referenceVisible: Bool,
    chatWidth: F32,
    calcHeight: F32,
    pdfSplit: F32
  }

type ChatState is Data:
  ChatState{draft: String, theme: StateTheme, search: Bool}

# Inputs fechados: esta é também a lista de chaves aceitas pelo núcleo.
type DeskInput is Data:
  DeskInput{
    draft: Maybe<&2, String>,
    draftCut: String,
    draftOverLimit: Bool,
    theme: Maybe<&2, String>,
    referenceVisible: Maybe<&2, Bool>,
    chatWidth: Maybe<&2, F32>,
    chatWidthUnder: Bool,
    chatWidthOver: Bool,
    calcHeight: Maybe<&2, F32>,
    calcHeightUnder: Bool,
    calcHeightOver: Bool,
    pdfSplit: Maybe<&2, F32>,
    pdfSplitUnder: Bool,
    pdfSplitOver: Bool
  }

type ChatInput is Data:
  ChatInput{
    draft: Maybe<&2, String>,
    draftCut: String,
    draftOverLimit: Bool,
    theme: Maybe<&2, String>,
    search: Maybe<&2, Bool>
  }

# ---------- strings ----------

# Correção #798 (aron-intframe): `String.take` NÃO é nativo — é `SCon{h,
# String.take(t, p)}`, com a self-call fora de tail position; um take de 100000
# (o limite do draft) estoura a pilha no artefato JS. `take.go` caminha em tail
# position acumulando o prefixo invertido e desinverte no fim com
# `String.reverse` (tail-safe). Corte e resultado idênticos a `String.take`.
def take.go(s: String, n: Nat, acc: String) -> String:
  match s n:
    case SNil{} _:
      String.reverse(acc)
    case SCon{h, t} 0n:
      String.reverse(acc)
    case SCon{h, t} 1n+p:
      take.go(t, p, SCon{h, acc})

def take(s: String, n: Nat) -> String:
  take.go(s, n, SNil{})

def trimTake(text: String, limit: Nat) -> String:
  take(String.trim(text), limit)

# Teto do rascunho (contrato do estado persistido; o host lê daqui e não repete
# o número). U32 e não Nat pelo mesmo motivo do `maxDraftChars` de
# `attachments.bend`: Nat em Bend é unário, e um literal grande não expande na
# checagem — medido, `== 100000n : Nat` estoura a pilha do checker.
def maxDraftChars() -> U32:
  (100000 : U32)

def cleanDraft(overLimit: Bool, original: String, cut: String) -> String:
  match overLimit:
    case True{}:
      cut
    case False{}:
      original

def draftOrDefault(
  value: Maybe<&2, String>, cut: String, overLimit: Bool, fallback: String
) -> String:
  match value:
    case None{}:
      fallback
    case Some{text}:
      cleanDraft(overLimit, text, cut)

# ---------- tema ----------

def themeFromDark(isDark: Bool, fallback: StateTheme) -> StateTheme:
  match isDark:
    case True{}:
      StateThemeDark{}
    case False{}:
      fallback

def themeFromLight(isLight: Bool, isDark: Bool, fallback: StateTheme) -> StateTheme:
  match isLight:
    case True{}:
      StateThemeLight{}
    case False{}:
      themeFromDark(isDark, fallback)

def themeFromFacts(
  isAuto: Bool, isLight: Bool, isDark: Bool, fallback: StateTheme
) -> StateTheme:
  match isAuto:
    case True{}:
      StateThemeAuto{}
    case False{}:
      themeFromLight(isLight, isDark, fallback)

def parseTheme(+raw: String, fallback: StateTheme) -> StateTheme:
  themeFromFacts(
    String.eq(raw, "auto"),
    String.eq(raw, "light"),
    String.eq(raw, "dark"),
    fallback
  )

def themeOrDefault(value: Maybe<&2, String>, fallback: StateTheme) -> StateTheme:
  match value:
    case None{}:
      fallback
    case Some{raw}:
      parseTheme(raw, fallback)

# ---------- campos opcionais e clamps ----------

def boolOrDefault(value: Maybe<&2, Bool>, fallback: Bool) -> Bool:
  match value:
    case None{}:
      fallback
    case Some{valid}:
      valid

def clampHigh(over: Bool, value: F32, high: F32) -> F32:
  match over:
    case True{}:
      high
    case False{}:
      value

def clampPresent(under: Bool, over: Bool, value: F32, low: F32, high: F32) -> F32:
  match under:
    case True{}:
      low
    case False{}:
      clampHigh(over, value, high)

def clampOrDefault(
  value: Maybe<&2, F32>, under: Bool, over: Bool,
  low: F32, high: F32, fallback: F32
) -> F32:
  match value:
    case None{}:
      fallback
    case Some{valid}:
      clampPresent(under, over, valid, low, high)

# ---------- defaults e merge ----------

def deskDefaults() -> DeskState:
  DeskState{"", StateThemeAuto{}, True{}, 390.0, 220.0, 0.5}

def chatDefaults() -> ChatState:
  ChatState{"", StateThemeAuto{}, False{}}

def mergeDesk(defaults: DeskState, input: DeskInput) -> DeskState:
  match defaults input:
    case DeskState{draft0, theme0, refs0, chat0, calc0, split0} DeskInput{
      draft, draftCut, draftOver, theme, refs,
      chat, chatUnder, chatOver,
      calc, calcUnder, calcOver,
      split, splitUnder, splitOver
    }:
      DeskState{
        draftOrDefault(draft, draftCut, draftOver, draft0),
        themeOrDefault(theme, theme0),
        boolOrDefault(refs, refs0),
        clampOrDefault(chat, chatUnder, chatOver, 300.0, 700.0, chat0),
        clampOrDefault(calc, calcUnder, calcOver, 72.0, 900.0, calc0),
        clampOrDefault(split, splitUnder, splitOver, 0.2, 0.8, split0)
      }

def mergeChat(defaults: ChatState, input: ChatInput) -> ChatState:
  match defaults input:
    case ChatState{draft0, theme0, search0} ChatInput{draft, draftCut, draftOver, theme, search}:
      ChatState{
        draftOrDefault(draft, draftCut, draftOver, draft0),
        themeOrDefault(theme, theme0),
        boolOrDefault(search, search0)
      }

def normalizeDesk(input: DeskInput) -> DeskState:
  mergeDesk(deskDefaults(), input)

def normalizeChat(input: ChatInput) -> ChatState:
  mergeChat(chatDefaults(), input)
