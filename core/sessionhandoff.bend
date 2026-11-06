import Base

# ---------------------------------------------------------------------------
# Passagem de contexto entre sessões (#87). O aluno troca o motor no meio do
# estudo e a sessão nova precisa levar matéria, questão ativa, materiais
# abertos e as últimas falas. Se a troca perder algum desses fatos, o aluno
# perde estudo; por isso a elegibilidade, o conteúdo obrigatório e o teto são
# invariantes de domínio e moram aqui.
#
# O host faz o I/O (ler o descritor ou o JSONL do Pi, montar o texto e criar o
# descritor novo). O núcleo decide:
#
#   - `canSwitch`: só troca com origem liquidada, sem entrega incerta, destino
#     pronto e a MESMA matéria. Trocar no meio de um turno, com entrega incerta
#     ou entre matérias perderia o ponto de parada;
#   - `handoffSections`: as seções obrigatórias do digest; matéria entra sempre,
#     questão/materiais/falas quando existem. Nunca se descarta material aberto
#     que existe;
#   - `handoffCap`/`withinCap`: o teto de 50.000 caracteres, o mesmo caminho que
#     a transcrição importada dos dois motores já lê;
#   - `canContinueLegacy`: sessão de motor fora da vista (Pi ou Claude escondido)
#     continua legível e pode continuar em outro motor, mas nunca promete
#     retomada nativa.
#
# O plano da troca é um objeto JS do host (origem preservada, destino novo):
# montar um `HandoffPlan` e ler os campos de volta só repetiria o código
# (ADR 0003), então não há tipo de plano aqui.
#
# O cartão, o texto da lista e a ordem dos botões ficam em JS (ADR 0003).
# ---------------------------------------------------------------------------

# Seções do digest, na ordem fixa: fatos antes das falas.
type HandoffSection is Data:
  HandoffSection.Course{}
  HandoffSection.Exercise{}
  HandoffSection.Materials{}
  HandoffSection.Turns{}

# ---------- elegibilidade ----------

def canSwitch(
  sourceSettled: Bool,
  sourceUncertain: Bool,
  targetReady: Bool,
  sameCourse: Bool
) -> Bool:
  Bool.and(
    sourceSettled,
    Bool.and(
      Bool.not(sourceUncertain),
      Bool.and(targetReady, sameCourse)
    )
  )

# ---------- teto ----------

def handoffCap() -> Nat:
  50000n

def withinCap(+length: Nat) -> Bool:
  Bool.not(Nat.is_gt(length, handoffCap()))

# ---------- seções obrigatórias ----------

def add(has: Bool, section: HandoffSection, acc: List<&2, HandoffSection>) -> List<&2, HandoffSection>:
  match has:
    case True{}:
      List.append(&2, HandoffSection, acc, [section])
    case False{}:
      acc

def sectionsWithCourse(
  hasExercise: Bool,
  hasMaterials: Bool,
  hasTurns: Bool
) -> List<&2, HandoffSection>:
  +withExercise = add(hasExercise, HandoffSection.Exercise{}, [HandoffSection.Course{}])
  +withMaterials = add(hasMaterials, HandoffSection.Materials{}, withExercise)
  add(hasTurns, HandoffSection.Turns{}, withMaterials)

# Matéria entra sempre (a troca exige `sameCourse`); as outras seções entram
# quando o fato existe. Sem matéria não há destino nem seção alguma.
def handoffSections(
  hasCourse: Bool,
  hasExercise: Bool,
  hasMaterials: Bool,
  hasTurns: Bool
) -> List<&2, HandoffSection>:
  match hasCourse:
    case False{}:
      Nil{}
    case True{}:
      sectionsWithCourse(hasExercise, hasMaterials, hasTurns)

# ---------- sessão antiga ----------

def knownEngine(+engine: String) -> Bool:
  Bool.or(
    String.eq(engine, "pi"),
    Bool.or(String.eq(engine, "claude"), String.eq(engine, "opencode"))
  )

# Legível e continuável em outro motor: Pi (sem motor) ou nativo fora da vista.
# Nativo visível não é legado — abre normalmente.
def canContinueLegacy(engine: String, visible: Bool, native: Bool) -> Bool:
  Bool.and(
    knownEngine(engine),
    Bool.or(Bool.not(native), Bool.not(visible))
  )
