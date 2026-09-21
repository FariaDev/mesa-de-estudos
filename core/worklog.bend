import Base

# Máquina de estados do diário do turno (worklog). O núcleo é puro e provado;
# o adaptador do app cuida do payload (texto, URLs, args do JSONL) e da API
# antiga. Regras: cada rajada de deltas de pensamento mora num passo "running"
# (reusa o último se for pensamento aberto, senão abre um novo); fechar marca
# tudo que estava running; terminar o turno para os pendentes.
#
# Notas para quem integra:
# - `Kind` é palavra reservada do Bend — o tipo do passo chama-se StepKind.
# - `Done`/`Running` etc. já existem na Base — os estados são qualificados
#   (`Status.Done{}`), então os rótulos saem como "Status.Done"; quem traduz
#   para os nomes antigos casa pelo último segmento ("Done").
# - O núcleo só *casa* com dois construtores: o kind `Thinking` e o estado
#   `Status.Running`. Todo o resto atravessa opaco (o host só transporta).
# - Bend não tem referência para frente: os helpers vêm antes de quem chama.
# - Pilha (issue bendlang/bend#798, acumulador do aron-intframe): `toolKind`
#   usa `hasNeedle`/`toLower` em tail em vez de `String.contains`/
#   `String.to_lower` (não-tail por caractere); nomes de 100k não estouram.

type StepKind is Data:
  Thinking{}
  Search{}
  Reference{}
  Fetch{}
  Tool{}
  ErrorKind{}

type Status is Data:
  Status.Running{}
  Status.Done{}
  Status.Stopped{}
  Status.Failed{}

type Hit is Data:
  Hit{title: String, url: String}

type Payload is Data:
  Payload{
    text: String,
    toolName: String,
    argsJson: String,
    query: String,
    url: String,
    domain: String,
    pageTitle: String,
    hits: +List<Hit>,
    resultText: String,
    error: String
  }

type Step is Data:
  Step{id: String, status: Status, kind: StepKind, startedAt: Nat, endedAt: Nat, payload: Payload}

type Log is Data:
  Log{startedAt: Nat, endedAt: Nat, reason: String, text: String, steps: +List<Step>}

# ---------- payload ----------

def emptyPayload() -> Payload:
  Payload{"", "", "", "", "", "", "", Nil{}, "", ""}

def withText(p: Payload, delta: String) -> Payload:
  match p:
    case Payload{text, toolName, argsJson, query, url, domain, pageTitle, hits, resultText, error}:
      Payload{text ++ delta, toolName, argsJson, query, url, domain, pageTitle, hits, resultText, error}

def newThinking(id: String, now: Nat, delta: String) -> Step:
  Step{id, Status.Running{}, Thinking{}, now, 0n, withText(emptyPayload(), delta)}

def thinkId(n: Nat) -> String:
  "pensar-" ++ Nat.show(Nat.add(n, 1n))

# ---------- classificação da ferramenta ----------

# `String.contains` e `String.to_lower` do Base são recursões não-tail por
# caractere (issue bendlang/bend#798); aqui os mesmos contratos viram walks
# em accumulator/tail para nomes de ferramenta de 100k não estourarem a
# pilha. `hasNeedle` espelha `String.contains` (agulha vazia casa). O fato
# do próximo char vai como parâmetro (match não escrutina valor computado).

def headHere(s: String, +needle: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{h, t}:
      String.starts_with(s, needle)

def hasNeedle.go(s: String, here: Bool, +needle: String) -> Bool:
  match s:
    case SNil{}:
      String.is_empty(needle)
    case SCon{h, +t}:
      match here:
        case True{}:
          True{}
        case False{}:
          hasNeedle.go(t, headHere(t, needle), needle)

def hasNeedle(+s: String, +needle: String) -> Bool:
  hasNeedle.go(s, headHere(s, needle), needle)

def toLower.go(s: String, acc: String) -> String:
  match s:
    case SNil{}:
      String.reverse(acc)
    case SCon{h, t}:
      toLower.go(t, SCon{Char.to_lower(h), acc})

def toLower(+s: String) -> String:
  toLower.go(s, SNil{})

# Procura `needle` em qualquer posição do nome. `+n` é reutilizável porque a
# recursão precisa do mesmo nome para comparar com cada agulha.
def anyContains.go(+n: String, needles: List<String>, found: Bool) -> Bool:
  match needles:
    case Nil{}:
      found
    case Con{h, t}:
      anyContains.go(n, t, Bool.or(found, hasNeedle(n, h)))

def anyContains(+n: String, needles: List<String>) -> Bool:
  anyContains.go(n, needles, False{})

# `reference` antes de `search`: "open_reference" também casaria com a busca,
# então a ordem importa. (Cada etapa é um def próprio porque Bend não deixa
# casar direto num valor computado.)

def toolKind.fetch.if(n: String, fetch: Bool) -> StepKind:
  match fetch:
    case True{}:
      Fetch{}
    case False{}:
      Tool{}

def toolKind.fetch(+n: String) -> StepKind:
  toolKind.fetch.if(n, anyContains(n, ["fetch", "reader", "http", "url", "page"]))

def toolKind.search.if(n: String, search: Bool) -> StepKind:
  match search:
    case True{}:
      Search{}
    case False{}:
      toolKind.fetch(n)

def toolKind.search(+n: String) -> StepKind:
  toolKind.search.if(n, anyContains(n, ["search", "busca"]))

def toolKind.ref(n: String, ref: Bool) -> StepKind:
  match ref:
    case True{}:
      Reference{}
    case False{}:
      toolKind.search(n)

def toolKind(name: String) -> StepKind:
  +n = toLower(name)
  toolKind.ref(n, anyContains(n, ["reference"]))

# ---------- log ----------

def createLog(now: Nat) -> Log:
  Log{now, 0n, "", "", Nil{}}

# ---------- rajadas de pensamento ----------

# Se o último passo é pensamento running, anexa o delta nele; senão abre um
# passo novo no fim. `n` é o tamanho atual da lista (id = n + 1).
def burst.last(h: Step, delta: String, now: Nat, n: Nat) -> +List<Step>:
  match h:
    case Step{id, status, kind, startedAt, endedAt, payload}:
      match status kind:
        case Status.Running{} Thinking{}:
          [Step{id, status, kind, startedAt, endedAt, withText(payload, delta)}]
        case _ _:
          [Step{id, status, kind, startedAt, endedAt, payload}, newThinking(thinkId(n), now, delta)]

def burst(xs: +List<Step>, delta: String, now: Nat, n: Nat) -> +List<Step>:
  match xs:
    case Nil{}:
      [newThinking(thinkId(n), now, delta)]
    case Con{h, t}:
      match t:
        case Nil{}:
          burst.last(h, delta, now, n)
        case Con{_, _}:
          Con{h, burst(t, delta, now, n)}

def thinkingDelta.go(log: Log, delta: String, now: Nat) -> Log:
  match log:
    case Log{startedAt, endedAt, reason, text, +steps}:
      n = List.length(&2, Step, steps)
      Log{startedAt, endedAt, reason, text, burst(steps, delta, now, n)}

def thinkingDelta.if(log: Log, delta: String, now: Nat, empty: Bool) -> Log:
  match empty:
    case True{}:
      log
    case False{}:
      thinkingDelta.go(log, delta, now)

def thinkingDelta(log: Log, delta: String, now: Nat) -> Log:
  +d = delta
  thinkingDelta.if(log, d, now, String.is_empty(d))

# ---------- fechos ----------

# Fechar pensamento: só (Thinking, Running) vira Done; o resto fica igual.
def closeStep.running(
  id: String, kind: StepKind, startedAt: Nat, endedAt: Nat, payload: Payload, now: Nat
) -> Step:
  match kind:
    case Thinking{}:
      Step{id, Status.Done{}, Thinking{}, startedAt, now, payload}
    case _:
      Step{id, Status.Running{}, kind, startedAt, endedAt, payload}

def closeStep.status(
  id: String, status: Status, kind: StepKind,
  startedAt: Nat, endedAt: Nat, payload: Payload, now: Nat
) -> Step:
  match status:
    case Status.Running{}:
      closeStep.running(id, kind, startedAt, endedAt, payload, now)
    case _:
      Step{id, status, kind, startedAt, endedAt, payload}

def closeStep(s: Step, now: Nat) -> Step:
  match s:
    case Step{id, status, kind, startedAt, endedAt, payload}:
      closeStep.status(id, status, kind, startedAt, endedAt, payload, now)

def closeEach(xs: +List<Step>, +now: Nat) -> +List<Step>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{closeStep(h, now), closeEach(t, now)}

def closeThinking(log: Log, now: Nat) -> Log:
  match log:
    case Log{startedAt, endedAt, reason, text, steps}:
      Log{startedAt, endedAt, reason, text, closeEach(steps, now)}

# Terminar o turno: pensamento vira Done, qualquer outro running vira Stopped.
def finishStep.running(
  id: String, kind: StepKind, startedAt: Nat, endedAt: Nat, payload: Payload, now: Nat
) -> Step:
  match kind:
    case Thinking{}:
      Step{id, Status.Done{}, Thinking{}, startedAt, now, payload}
    case _:
      Step{id, Status.Stopped{}, kind, startedAt, now, payload}

def finishStep.status(
  id: String, status: Status, kind: StepKind,
  startedAt: Nat, endedAt: Nat, payload: Payload, now: Nat
) -> Step:
  match status:
    case Status.Running{}:
      finishStep.running(id, kind, startedAt, endedAt, payload, now)
    case _:
      Step{id, status, kind, startedAt, endedAt, payload}

def finishStep(s: Step, now: Nat) -> Step:
  match s:
    case Step{id, status, kind, startedAt, endedAt, payload}:
      finishStep.status(id, status, kind, startedAt, endedAt, payload, now)

def finishEach(xs: +List<Step>, +now: Nat) -> +List<Step>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{finishStep(h, now), finishEach(t, now)}

def finishLog(log: Log, now: Nat, reason: String) -> Log:
  match log:
    case Log{startedAt, endedAt, _, text, steps}:
      +n = now
      Log{startedAt, n, reason, text, finishEach(steps, n)}

# ---------- predicados (para as leis) ----------

def isRunningThinking.kind(kind: StepKind) -> Bool:
  match kind:
    case Thinking{}:
      True{}
    case _:
      False{}

def isRunningThinking.check(kind: StepKind, status: Status) -> Bool:
  match status:
    case Status.Running{}:
      isRunningThinking.kind(kind)
    case _:
      False{}

def isRunningThinking(s: Step) -> Bool:
  match s:
    case Step{id, status, kind, startedAt, endedAt, payload}:
      isRunningThinking.check(kind, status)

def isRunning.status(status: Status) -> Bool:
  match status:
    case Status.Running{}:
      True{}
    case _:
      False{}

def isRunning(s: Step) -> Bool:
  match s:
    case Step{id, status, kind, startedAt, endedAt, payload}:
      isRunning.status(status)

def noRunningThinking.and(running: Bool, rest: Bool) -> Bool:
  match running:
    case True{}:
      False{}
    case False{}:
      rest

def noRunningThinking(xs: +List<Step>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{h, t}:
      noRunningThinking.and(isRunningThinking(h), noRunningThinking(t))
