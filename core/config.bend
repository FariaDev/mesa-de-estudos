import Base

# ---------------------------------------------------------------------------
# Núcleo da configuração da Mesa (referência: normalize/normalizeDesk/
# normalizePanel/asStringList/needsSetup de desk/config.cjs).
#
# O host lê o JSON e manda fatos; o núcleo decide a forma estável:
#   - campo String: `Some{s}` quando o JSON trazia um valor de verdade (o host
#     já aplicou String(), como o `|| default` de hoje); `None{}` quando
#     ausente/falso. O núcleo apara e aplica os fallbacks do autor.
#   - flag Bool: `Some{True{}}`/`Some{False{}}` só para booleano de verdade;
#     `None{}` para qualquer outra coisa. Só `false` desliga.
#   - painéis: a lista crua, na ordem do array (vazia se não for array). O
#     núcleo corta em 2 e cada slot herda o default dele.
#   - cursos: um fato por item; `base` é o basename do path cru (I/O do host).
#     Vale o filtro de hoje: id (ou basename) e path precisam sobrar não vazios
#     depois do trim; o nome pode ficar vazio.
#   - `desk`: `None{}` quando raw.desk não é objeto.
#
# Defaults do autor preservados (AGENTS.md: não mexer sem pedido): título
# "Mesa de Estudos"; flags true; painéis Enunciado (prefer Limites) e
# "Formulário & apoio" (prefer Formul, toggle Formulário).
#
# Quirk preservado: os quatro paths do topo NÃO são aparados — o app sempre fez
# `String(raw.vaultPath || '')` sem trim (path com espaço nas pontas continua
# valendo); só o bloco desk e os cursos passam por trim.
#
# I/O (ler/escrever JSON, fs.existsSync) fica no adaptador.
# Sem referência para frente: helpers antes de quem chama.
# ---------------------------------------------------------------------------

# ---------- fatos (entrada do host) ----------

# Fatos de um curso cru (um item do array `courses`).
type CourseFacts is Data:
  CourseFacts{
    id: Maybe<&2, String>,
    name: Maybe<&2, String>,
    path: Maybe<&2, String>,
    base: Maybe<&2, String>
  }

# Fatos de um painel cru (um item do array `desk.panels`).
type PanelFacts is Data:
  PanelFacts{
    label: Maybe<&2, String>,
    prefer: +List<String>,
    toggle: Maybe<&2, String>
  }

# Fatos do bloco `desk` (o host só monta quando raw.desk é objeto).
type DeskFacts is Data:
  DeskFacts{
    title: Maybe<&2, String>,
    calculator: Maybe<&2, Bool>,
    xournal: Maybe<&2, Bool>,
    conferir: Maybe<&2, Bool>,
    refsToggle: Maybe<&2, Bool>,
    endDay: Maybe<&2, Bool>,
    studyContext: Maybe<&2, Bool>,
    panels: +List<PanelFacts>
  }

# Fatos da config inteira.
type ConfigFacts is Data:
  ConfigFacts{
    vaultPath: Maybe<&2, String>,
    runtimePath: Maybe<&2, String>,
    piPath: Maybe<&2, String>,
    xournalPath: Maybe<&2, String>,
    courses: +List<CourseFacts>,
    desk: Maybe<&2, DeskFacts>
  }

# ---------- forma final (saída) ----------

type Panel is Data:
  Panel{label: String, prefer: +List<String>, toggle: String}

type Desk is Data:
  Desk{
    title: String,
    calculator: Bool,
    xournal: Bool,
    conferir: Bool,
    refsToggle: Bool,
    endDay: Bool,
    studyContext: Bool,
    panels: +List<Panel>
  }

type Course is Data:
  Course{id: String, name: String, path: String}

type Config is Data:
  Config{
    vaultPath: String,
    runtimePath: String,
    piPath: String,
    xournalPath: String,
    courses: +List<Course>,
    desk: Desk
  }

# ---------- strings ----------

# O `||` do host: valor de verdade, senão o fallback.
def orElse(v: Maybe<&2, String>, fallback: String) -> String:
  match v:
    case None{}:
      fallback
    case Some{s}:
      s

# Apara; se sobrar vazio, devolve o fallback (que o núcleo garante não vazio).
def ifEmpty(s: String, fallback: String, empty: Bool) -> String:
  match empty:
    case True{}:
      fallback
    case False{}:
      s

def trimmedOr(v: Maybe<&2, String>, +fallback: String) -> String:
  +s = String.trim(orElse(v, fallback))
  ifEmpty(s, fallback, String.is_empty(s))

# asStringList do host: cada item vira String (já feito pelo host), trim e
# descarta vazios.
def asStringList.put(+s: String, rest: List<&2, String>, empty: Bool) -> List<&2, String>:
  match empty:
    case True{}:
      rest
    case False{}:
      Con{s, rest}

def asStringList(items: List<&2, String>) -> List<&2, String>:
  match items:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      +s = String.trim(h)
      asStringList.put(s, asStringList(t), String.is_empty(s))

# Lista a valer; vazia herda a do slot.
def preferOr(clean: List<&2, String>, slot: List<&2, String>, empty: Bool) -> List<&2, String>:
  match empty:
    case True{}:
      slot
    case False{}:
      clean

def preferOf(items: List<&2, String>, slot: List<&2, String>) -> List<&2, String>:
  +clean = asStringList(items)
  preferOr(clean, slot, List.is_empty(&2, String, clean))

# ---------- flags ----------

# Flag do host: booleano de verdade manda; ausente/inválida fica true.
def flagOf(v: Maybe<&2, Bool>) -> Bool:
  match v:
    case None{}:
      True{}
    case Some{b}:
      b

# ---------- painéis ----------

# O normalizePanel do host: fatos do painel cru + o default do slot.
def normalizePanel(f: PanelFacts, slot: Panel) -> Panel:
  match f slot:
    case PanelFacts{label, prefer, toggle} Panel{slotLabel, slotPrefer, slotToggle}:
      Panel{
        trimmedOr(label, slotLabel),
        preferOf(prefer, slotPrefer),
        String.trim(orElse(toggle, slotToggle))
      }

def defaultPanel0() -> Panel:
  Panel{"Enunciado", ["Limites"], ""}

def defaultPanel1() -> Panel:
  Panel{"Formulário & apoio", ["Formul"], "Formulário"}

# Slot 0 (Enunciado): toggle default é vazio; não dá para limpar um toggle já
# preenchido via JSON (limitação conhecida, decisão 2026-09-15).
def normalizePanel0(f: PanelFacts) -> Panel:
  normalizePanel(f, defaultPanel0())

# Slot 1 (Formulário & apoio): toggle vazio/ausente herda "Formulário".
def normalizePanel1(f: PanelFacts) -> Panel:
  normalizePanel(f, defaultPanel1())

def defaultPanels() -> List<&2, Panel>:
  [defaultPanel0(), defaultPanel1()]

# 1 painel: um só, com o default do slot. 2+: corta em 2. Lista vazia/não-array
# (o host manda Nil) cai nos dois defaults.
def normalizePanels(panels: List<&2, PanelFacts>) -> List<&2, Panel>:
  match panels:
    case Nil{}:
      defaultPanels()
    case Con{p0, rest}:
      match rest:
        case Nil{}:
          [normalizePanel0(p0)]
        case Con{p1, _}:
          [normalizePanel0(p0), normalizePanel1(p1)]

# ---------- desk ----------

def defaultDesk() -> Desk:
  Desk{
    "Mesa de Estudos",
    True{},
    True{},
    True{},
    True{},
    True{},
    True{},
    defaultPanels()
  }

def normalizeDesk(desk: Maybe<&2, DeskFacts>) -> Desk:
  match desk:
    case None{}:
      defaultDesk()
    case Some{DeskFacts{title, calculator, xournal, conferir, refsToggle, endDay, studyContext, panels}}:
      Desk{
        trimmedOr(title, "Mesa de Estudos"),
        flagOf(calculator),
        flagOf(xournal),
        flagOf(conferir),
        flagOf(refsToggle),
        flagOf(endDay),
        flagOf(studyContext),
        normalizePanels(panels)
      }

# ---------- cursos ----------

# id = trim(id || basename(path)); sem os dois, vazio (e o curso cai).
def courseId(f: CourseFacts) -> String:
  match f:
    case CourseFacts{id, name, path, base}:
      String.trim(orElse(id, orElse(base, "")))

# nome = trim(name || id || ''); id aqui é o cru, não o derivado do basename.
def courseName(f: CourseFacts) -> String:
  match f:
    case CourseFacts{id, name, path, base}:
      String.trim(orElse(name, orElse(id, "")))

def coursePath(f: CourseFacts) -> String:
  match f:
    case CourseFacts{id, name, path, base}:
      String.trim(orElse(path, ""))

def courseOf(+f: CourseFacts) -> Course:
  Course{courseId(f), courseName(f), coursePath(f)}

def courseOk(c: Course) -> Bool:
  match c:
    case Course{id, name, path}:
      Bool.and(Bool.not(String.is_empty(id)), Bool.not(String.is_empty(path)))

def keepCourse(c: Course, rest: List<&2, Course>, ok: Bool) -> List<&2, Course>:
  match ok:
    case True{}:
      Con{c, rest}
    case False{}:
      rest

def normalizeCourses(xs: List<&2, CourseFacts>) -> List<&2, Course>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      +c = courseOf(h)
      keepCourse(c, normalizeCourses(t), courseOk(c))

# ---------- setup ----------

# needsSetup do host: sem vault utilizável e sem nenhum curso, precisa configurar.
def needsSetup(vaultUsable: Bool, courses: List<&2, Course>) -> Bool:
  Bool.and(Bool.not(vaultUsable), List.is_empty(&2, Course, courses))

# ---------- normalize ----------

def normalize(facts: ConfigFacts) -> Config:
  match facts:
    case ConfigFacts{vaultPath, runtimePath, piPath, xournalPath, courses, desk}:
      Config{
        orElse(vaultPath, ""),
        orElse(runtimePath, ""),
        orElse(piPath, ""),
        orElse(xournalPath, ""),
        normalizeCourses(courses),
        normalizeDesk(desk)
      }
