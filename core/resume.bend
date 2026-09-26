import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Registro local do "Encerrar por hoje" e o cartão de retomada (Mesa).
#
# O Encerrar grava LOCAL primeiro: o que o usuário escreveu precisa sobreviver
# mesmo sem Pi. Este núcleo guarda a forma do registro (o que entra, o que é
# aparado, o que é recusado) e os textos do cartão. O arquivo, a validação de
# caminhos contra a biblioteca da matéria, a IPC e o DOM ficam no host
# (`desk/resume.cjs`, `desk/main.cjs`, `desk/src/resume.mjs`).
#
# Regras que valem a pena ler antes de mexer:
#   - sem "onde parei" E "próximo passo" (depois do trim) não há registro: o
#     miolo do retomar é o que o usuário escreveu;
#   - os textos são aparados e cortados em `maxText()` (240, o mesmo teto do
#     título da questão) e o caminho em `maxPath()`;
#   - página nunca abaixo de 1 — a mesma forma do `#page=N` que o Pi recebe — e
#     o registro guarda no máximo `maxPdfs()` (2) PDFs, na ordem dos painéis;
#   - `resumeDraft` pré-preenche o composer no Retomar e `endDayDraft` é o que o
#     Encerrar manda ao Pi: os dois textos nascem aqui para a leitura ser sempre
#     a mesma.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type ResumePage is Data:
  ResumePage{path: String, page: Nat}

type ResumeRecord is Data:
  ResumeRecord{stopped: String, next: String, exercise: String, xopp: String, pages: +List<&2, ResumePage>}

# ---------- tetos (o host compara; o núcleo documenta) ----------

def maxText() -> Nat:
  240n

def maxPath() -> Nat:
  1024n

def maxPdfs() -> Nat:
  2n

# ---------- textos ----------

def cutLine.if(text: String, limit: Nat, over: Bool) -> String:
  match over:
    case False{}:
      text
    case True{}:
      String.take(text, limit)

def cutLine(+text: String, +limit: Nat) -> String:
  cutLine.if(text, limit, Nat.is_gt(String.length(text), limit))

def line(text: String) -> String:
  cutLine(String.trim(text), maxText())

def pathLine(text: String) -> String:
  cutLine(String.trim(text), maxPath())

# Vale registrar? O fato `blank` entra como parâmetro (match em valor computado
# não é aceito).
def keepRecord.blank(blank: Bool) -> Bool:
  match blank:
    case True{}:
      False{}
    case False{}:
      True{}

def keepRecord(stopped: String, next: String) -> Bool:
  Bool.and(
    keepRecord.blank(String.is_empty(String.trim(stopped))),
    keepRecord.blank(String.is_empty(String.trim(next)))
  )

# ---------- páginas ----------

def pageOf.if(page: Nat, zero: Bool) -> Nat:
  match zero:
    case True{}:
      1n
    case False{}:
      page

def pageOf(+page: Nat) -> Nat:
  pageOf.if(page, Nat.is_eq(page, 0n))

def pageRef(path: String, page: Nat) -> ResumePage:
  ResumePage{pathLine(path), pageOf(page)}

def keepPage(index: Nat) -> Bool:
  Nat.is_lt(index, maxPdfs())

# No máximo `maxPdfs()` páginas: as primeiras ficam (a ordem é a dos painéis).
def takePages(+pages: List<&2, ResumePage>) -> List<&2, ResumePage>:
  List.take(&2, ResumePage, pages, maxPdfs())

# A forma guardada do dia: o host chama isto com o que o formulário e os painéis
# têm, e grava o resultado (nada de normalizar de novo lá).
def record(stopped: String, next: String, exercise: String, xopp: String, pages: List<&2, ResumePage>) -> ResumeRecord:
  ResumeRecord{line(stopped), line(next), line(exercise), pathLine(xopp), takePages(pages)}

# ---------- textos do cartão e da retomada ----------

# "Continuar Cálculo I — Lista 2 · 7b"; sem questão, só a matéria.
def resumeTitle.if(text: String, exercise: String, hasExercise: Bool) -> String:
  match hasExercise:
    case True{}:
      String.append(text, String.append(" — ", exercise))
    case False{}:
      text

def resumeTitle(course: String, +exercise: String) -> String:
  resumeTitle.if(
    String.append("Continuar ", String.trim(course)),
    String.trim(exercise),
    Bool.not(String.is_empty(String.trim(exercise)))
  )

def resumeWhereLabel(stopped: String) -> String:
  String.append("Onde parei: ", stopped)

def resumeNextLabel(next: String) -> String:
  String.append("Próximo passo: ", next)

def resumeGoLabel() -> String:
  "Retomar"

def resumeGoTitle() -> String:
  "Volta a questão, o .xopp e as páginas do registro e escreve a mensagem no composer"

def resumeDismissLabel() -> String:
  "Dispensar"

def resumeDismissTitle() -> String:
  "Descarta o registro de retomada (o que foi escrito fica só no histórico)"

# O que o Encerrar manda ao Pi.
def endDayDraft(stopped: String, next: String) -> String:
  String.append(
    "Encerrar por hoje.\n\nOnde parei: ",
    String.append(stopped, String.append("\n\nPróximo passo: ", next))
  )

# O que o Retomar pré-preenche no composer (o usuário envia quando quiser).
def resumeDraft(stopped: String, next: String) -> String:
  String.append(
    "Continuar de onde parei.\n\nOnde parei: ",
    String.append(stopped, String.append("\n\nPróximo passo: ", next))
  )

# ---------- cartão ----------

def resumeCardTitleView(text: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("resume-card-title")], [V.viewText(text)])

def resumeCardLineView(text: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("resume-card-line")], [V.viewText(text)])

def resumeGoAttrs() -> List<&2, V.ViewAttr>:
  [
    V.attrType("button"),
    V.attrClass("resume-go"),
    V.attrTitle(resumeGoTitle()),
    V.attrOn("click", "resume")
  ]

def resumeGoBtn() -> V.ViewNode:
  V.viewEl("button", resumeGoAttrs(), [V.viewText(resumeGoLabel())])

def resumeDismissAttrs() -> List<&2, V.ViewAttr>:
  [
    V.attrType("button"),
    V.attrClass("resume-dismiss"),
    V.attrTitle(resumeDismissTitle()),
    V.attrOn("click", "dismiss")
  ]

def resumeDismissBtn() -> V.ViewNode:
  V.viewEl("button", resumeDismissAttrs(), [V.viewText(resumeDismissLabel())])

def resumeCardActions() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("resume-card-actions")], [resumeGoBtn(), resumeDismissBtn()])

def resumeCardKids(title: String, stopped: String, next: String) -> List<&2, V.ViewNode>:
  [
    resumeCardTitleView(title),
    resumeCardLineView(resumeWhereLabel(stopped)),
    resumeCardLineView(resumeNextLabel(next)),
    resumeCardActions()
  ]

def resumeCardView(title: String, stopped: String, next: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("resume-card")], resumeCardKids(title, stopped, next))
