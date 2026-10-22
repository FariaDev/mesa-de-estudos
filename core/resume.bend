import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Registro local do "Encerrar por hoje" e a retomada na coluna do tutor (Mesa).
#
# O Encerrar grava LOCAL primeiro: o que o usuário escreveu precisa sobreviver
# mesmo sem Pi. Este núcleo guarda a forma do registro (o que entra, o que é
# aparado, o que é recusado) e os textos do cartão. O arquivo, a validação de
# caminhos contra a biblioteca da matéria, a IPC e o DOM ficam no host
# (`desk/resume.cjs`, `desk/main.cjs`, `desk/src/resume.mjs`). A árvore do
# bloco da retomada na coluna é do `core/tutorstate.bend`, que monta a casca
# comum aos estados do tutor com os textos e rótulos daqui.
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

# ---------- textos da retomada na coluna ----------

# "Da última vez você parou em Lista 2 · 7b: travei na 3"; sem questão, "Da
# última vez você parou: travei na 3". A questão vai em destaque (`strong`).
def resumeLeadKids.if(exercise: String, stopped: String, hasExercise: Bool) -> List<&2, V.ViewNode>:
  match hasExercise:
    case True{}:
      [
        V.viewText(M.msg("resume.stoppedAt")),
        V.viewEl("strong", Nil{}, [V.viewText(exercise)]),
        V.viewText(String.append(": ", stopped))
      ]
    case False{}:
      [V.viewText(M.msg("resume.stoppedPrefix")), V.viewText(stopped)]

def resumeLeadKids(+exercise: String, stopped: String) -> List<&2, V.ViewNode>:
  resumeLeadKids.if(
    String.trim(exercise),
    stopped,
    Bool.not(String.is_empty(String.trim(exercise)))
  )

def resumeNextLabel(next: String) -> String:
  M.msg1("resume.next", "next", next)

def resumeGoLabel() -> String:
  M.msg("resume.go")

def resumeGoTitle() -> String:
  M.msg("resume.goTitle")

def resumeNewLabel() -> String:
  M.msg("resume.new")

def resumeNewTitle() -> String:
  M.msg("resume.newTitle")

def resumeForgetLabel() -> String:
  M.msg("resume.forget")

def resumeForgetTitle() -> String:
  M.msg("resume.forgetTitle")

# O que o Encerrar manda ao Pi.
def endDayDraft(stopped: String, next: String) -> String:
  M.msg2("resume.endDayDraft", "stopped", stopped, "next", next)

# O que o Retomar pré-preenche no composer (o usuário envia quando quiser).
def resumeDraft(stopped: String, next: String) -> String:
  M.msg2("resume.resumeDraft", "stopped", stopped, "next", next)
