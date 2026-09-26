import Base

# ---------------------------------------------------------------------------
# Bloco de contexto da Mesa que acompanha a mensagem do usuário
# (referência: desk/main.cjs, pi-send).
#
# O host resolve os fatos e compõe as linhas; o núcleo decide o que entra e se
# o bloco vai. Três regras que não podem quebrar:
#
#   1. contexto inalterado e sem captura nova não é reenviado — o histórico da
#      conversa já carrega a versão anterior, e repetir o bloco inteiro a cada
#      turno é custo puro;
#   2. referência aberta nunca aparece como conteúdo já lido;
#   3. captura de outro exercício é marcada como tal, em vez de passar por
#      tentativa do exercício ativo.
#
# Sem referência para frente: helpers vêm antes de quem chama. `match` nunca
# analisa valor computado (o fato chega como parâmetro Bool) e usa `+` no
# pattern quando o campo é lido mais de uma vez — o afim padrão só permite um
# uso.
# ---------------------------------------------------------------------------

type StudyCapture is Data:
  NoCapture{}
  Capture{time: String, exercise: String, matches: Bool}

type StudyContext is Data:
  StudyContext{course: String, exercise: String, draft: String, hasRefs: Bool, capture: StudyCapture}

def header() -> String:
  "[Contexto da Mesa]"

def seg(text: String) -> String:
  String.append("\n", text)

def courseLine(course: String) -> String:
  String.append("- matéria: ", course)

def exerciseLine(exercise: String) -> String:
  String.append("- exercício ativo: ", exercise)

def draftLine(draft: String) -> String:
  String.append("- rascunho Xournal++ aberto: ", draft)

# A presença vem resolvida do host (`empty`); o núcleo só decide a linha.
def optional(+content: String, prefix: String, empty: Bool) -> String:
  match empty:
    case True{}:
      ""
    case False{}:
      seg(String.append(prefix, content))

def refsHeader() -> String:
  "- referências abertas na mesa (abertas, não lidas por você):"

def refLine(ref: String) -> String:
  String.append("  · ", ref)

def refLines(refs: List<String>) -> String:
  match refs:
    case Nil{}:
      ""
    case Con{h, t}:
      String.append(seg(refLine(h)), refLines(t))

def refsPresent(refs: List<String>) -> Bool:
  match refs:
    case Nil{}:
      False{}
    case Con{h, t}:
      True{}

def refsBlock(refs: List<String>) -> String:
  match refs:
    case Nil{}:
      ""
    case Con{h, t}:
      String.append(seg(refsHeader()), refLines(refs))

def captureMatchesNote(time: String, exercise: String) -> String:
  String.append(
    String.append(
      String.append("captura desta mensagem: janela do Xournal++ às ", time),
      ", do exercício "
    ),
    exercise
  )

def captureStaleNote(time: String, exercise: String) -> String:
  String.append(
    String.append(
      String.append("captura desta mensagem: janela do Xournal++ às ", time),
      ", do exercício "
    ),
    String.append(exercise, " — atenção: a captura é de outro exercício, não do ativo")
  )

def captureNoteGiven(time: String, exercise: String, matches: Bool) -> String:
  match matches:
    case True{}:
      captureMatchesNote(time, exercise)
    case False{}:
      captureStaleNote(time, exercise)

def captureNote(capture: StudyCapture) -> String:
  match capture:
    case NoCapture{}:
      ""
    case Capture{time, exercise, matches}:
      seg(captureNoteGiven(time, exercise, matches))

def capturePresent(capture: StudyCapture) -> Bool:
  match capture:
    case NoCapture{}:
      False{}
    case Capture{time, exercise, matches}:
      True{}

# Cada campo entra uma vez; as linhas opcionais decidem sozinhas se aparecem.
def body(+course: String, +exercise: String, +draft: String, refs: List<String>, capture: StudyCapture) -> String:
  String.append(
    String.append(
      String.append(
        optional(courseLine(course), "", String.is_empty(course)),
        optional(exerciseLine(exercise), "", String.is_empty(exercise))
      ),
      optional(draftLine(draft), "", String.is_empty(draft))
    ),
    String.append(refsBlock(refs), captureNote(capture))
  )

def hasAnything(refsPresentFact: Bool, course: String, exercise: String, draft: String, capture: StudyCapture) -> Bool:
  Bool.or(
    Bool.or(Bool.not(String.is_empty(course)), Bool.not(String.is_empty(exercise))),
    Bool.or(
      Bool.or(Bool.not(String.is_empty(draft)), refsPresentFact),
      capturePresent(capture)
    )
  )

# Cada linha já chega prefixada com o seu `\n` (`seg`); o cabeçalho cola direto
# para não abrir uma linha em branco depois dele.
def compose(inner: String, presentFact: Bool) -> String:
  match presentFact:
    case True{}:
      String.append(header(), inner)
    case False{}:
      ""

def renderRepeat(repeatFact: Bool, course: String, exercise: String, draft: String, refs: List<String>, capture: StudyCapture) -> String:
  match repeatFact:
    case True{}:
      ""
    case False{}:
      compose(body(course, exercise, draft, refs, capture), True{})

# Captura sempre vai (é conteúdo novo); sem captura, o bloco só vai quando o
# contexto mudou desde o turno anterior.
def renderCapture(capPresent: Bool, course: String, exercise: String, draft: String, refs: List<String>, capture: StudyCapture, repeat: Bool) -> String:
  match capPresent:
    case True{}:
      compose(body(course, exercise, draft, refs, capture), True{})
    case False{}:
      renderRepeat(repeat, course, exercise, draft, refs, capture)

def renderPresent(presentFact: Bool, course: String, exercise: String, draft: String, refs: List<String>, +capture: StudyCapture, repeat: Bool) -> String:
  match presentFact:
    case False{}:
      ""
    case True{}:
      renderCapture(capturePresent(capture), course, exercise, draft, refs, capture, repeat)

# `repeat` = o host já mandou este mesmo contexto no turno anterior. Sem captura
# nova e sem mudança, o bloco não vai: o histórico já tem a versão anterior.
# `refs` viaja fora do registro de propósito: o campo de lista num `Data` do
# Bend vira tipo afim (`+List`) e amarra o consumidor; como parâmetro simples
# ele é lido uma vez e a cadeia inteira fica transparente.
def render(ctx: StudyContext, refs: List<String>, repeat: Bool) -> String:
  match ctx:
    case StudyContext{+course, +exercise, +draft, hasRefs, +capture}:
      renderPresent(hasAnything(hasRefs, course, exercise, draft, capture), course, exercise, draft, refs, capture, repeat)
