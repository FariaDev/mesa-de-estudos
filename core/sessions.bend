import Base

# ---------------------------------------------------------------------------
# Núcleo de texto/rótulo/agrupamento de sessões (referência: chat/lib.cjs,
# desk/lib.cjs e chat/src/sessions-view.mjs).
#
# O que é comum mora aqui. O que difere entra como dados ou fatos:
#   - listas de marcadores (Mesa vs Conversa) e o rewrite de `/conferir`;
#   - o conceito "Nova conversa" (só a Conversa; a Mesa passa False);
#   - componentes locais da data (o host resolve o Date) e o fato `valid`;
#   - é hoje? é ontem? (o host resolve o dia civil).
#
# I/O, JSON.parse, Date e o agrupamento extra da Conversa (fixadas, últimos
# 7 dias, arquivadas, sort por started) ficam no host. Sem referência para
# frente: helpers vêm antes de quem chama. Sem recursão mútua: cada walker
# é um só def.
#
# Pilha (issue bendlang/bend#798, acumulador do aron-intframe): `String.split`,
# `String.length` e `String.take` com `n` grande do Base são recursões não-tail
# por caractere e estouram em ~5–8k; os walkers deste módulo percorrem a string
# em accumulator (self-call em tail position → run_jump) e o `String.reverse`
# final (tail-safe) devolve a ordem. Preview, nota e caminho aguentam 100k.
# ---------------------------------------------------------------------------

# Conteúdo já extraído pelo host: string, partes de texto, ou o campo `text`.
type MsgBody is Data:
  BodyString{text: String}
  BodyParts{parts: +List<String>}
  BodyField{text: String}

# Uma mensagem parseada. `isUser` é o fato `role == "user"` (o host compara).
type SessionMsg is Data:
  SessionMsg{isUser: Bool, body: MsgBody}

# Cortes do preview: cada marcador é cortado de `\n\n`+marcador até o fim
# (nessa ordem). `conferir` liga o rewrite da Mesa (`/conferir` → rótulo).
type PreviewCuts is Data:
  PreviewCuts{suffix: +List<String>, conferir: Bool}

# Três grupos do núcleo. Fixadas / últimos 7 dias / arquivadas: host.
type SessionGroup is Data:
  GroupToday{}
  GroupYesterday{}
  GroupOlder{}

type SessionBucket is Data:
  SessionBucket{group: SessionGroup, label: String, items: +List<String>}

# Acumulador interno do groupSessions (ordem de inserção = ordem de entrada).
type SessAcc is Data:
  SessAcc{today: List<&2, String>, yesterday: List<&2, String>, older: List<&2, String>}

# ---------- constantes (o host compara comprimentos; o núcleo documenta) ----------

def previewCap() -> Nat:
  48n

def noteCap() -> Nat:
  40n

def jsonlLen() -> Nat:
  6n

def conferirLen() -> Nat:
  9n

def novaLabel() -> String:
  "Nova conversa"

def conversaLabel() -> String:
  "Conversa"

def conferirLabel() -> String:
  "Conferir Xournal++"

def conferirCmd() -> String:
  "/conferir"

def noteSep() -> String:
  " · "

# Marcadores da Mesa: blocos de contexto/referências/conferência, cortados
# até o fim. O JS da Mesa usa lookahead no contexto; como referências e
# conferência também saem até o fim, cortar cada um até o fim é o mesmo.
def mesaSuffix() -> List<&2, String>:
  [
    "[Contexto da sessão na Mesa:",
    "[Referências abertas",
    "[Conferência visual"
  ]

# Marcadores da Conversa. `[Anexo: ` no JS é um bloco até a cerca ````;
# no app o anexo é apenso no fim da mensagem, então cortar até o fim
# coincide. Texto do usuário *depois* de um anexo no meio diferiria.
def chatSuffix() -> List<&2, String>:
  ["[Buscar na web]", "[Anexo: "]

def mesaCuts() -> PreviewCuts:
  PreviewCuts{mesaSuffix(), True{}}

def chatCuts() -> PreviewCuts:
  PreviewCuts{chatSuffix(), False{}}

# ---------- caracteres ----------

def charStr(c: Char) -> String:
  SCon{c, SNil{}}

# `\w` do JS: letra, dígito ou `_`. Usado no `\b` de `/conferir`.
def isWord(+c: Char) -> Bool:
  Bool.or(Char.is_alpha(c), Bool.or(Char.is_digit(c), Char.is_eq(c, '_')))

# ---------- colapso de espaços (JS: replace(/\s+/g, ' ').trim()) ----------
# Char.is_space cobre espaço ASCII e 9–13 (tab/LF/VT/FF/CR). NBSP e afins
# ficam no host — o preview das sessões não depende deles.
#
# Accumulator: `acc` guarda o resultado invertido; cada passo é uma self-call
# em tail position (run_jump) e o `String.reverse` final devolve a ordem.
# O fato do próximo char vai como parâmetro (o `match` não pode escrutinar
# valor computado nem binder local).
def headSpace(s: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{h, t}:
      Char.is_space(h)

def collapse.go(s: String, space: Bool, inSpace: Bool, acc: String) -> String:
  match s:
    case SNil{}:
      acc
    case SCon{h, +t}:
      match space:
        case False{}:
          collapse.go(t, headSpace(t), False{}, SCon{h, acc})
        case True{}:
          match inSpace:
            case True{}:
              collapse.go(t, headSpace(t), True{}, acc)
            case False{}:
              collapse.go(t, headSpace(t), True{}, SCon{' ', acc})

def collapseSpaces(+s: String) -> String:
  String.reverse(collapse.go(s, headSpace(s), False{}, SNil{}))

def cleanText(s: String) -> String:
  String.trim(collapseSpaces(s))

# ---------- corte de marcador: de `\n\n`+agulha até o fim ----------
# Walk em accumulator: no primeiro casamento devolve o prefixo acumulado
# (invertido de volta no fim); agulha vazia nunca é usada (os marcadores têm
# `\n\n` na frente).

def headStarts(s: String, +needle: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{h, t}:
      String.starts_with(s, needle)

def cutFrom.go(s: String, here: Bool, +needle: String, acc: String) -> String:
  match s:
    case SNil{}:
      String.reverse(acc)
    case SCon{h, +t}:
      match here:
        case True{}:
          String.reverse(acc)
        case False{}:
          cutFrom.go(t, headStarts(t, needle), needle, SCon{h, acc})

def cutFrom(+s: String, +needle: String) -> String:
  cutFrom.go(s, headStarts(s, needle), needle, SNil{})

def cutOne(s: String, marker: String) -> String:
  cutFrom(s, String.append("\n\n", marker))

def cutSuffixes(markers: List<&2, String>, s: String) -> String:
  match markers:
    case Nil{}:
      s
    case Con{h, t}:
      cutSuffixes(t, cutOne(s, h))

# ---------- `/conferir` (Mesa): `^\/conferir\b` no texto aparado ----------

def isConferir.rest(rest: String) -> Bool:
  match rest:
    case SNil{}:
      True{}
    case SCon{+h, t}:
      Bool.not(isWord(h))

def isConferir.if(+s: String, starts: Bool) -> Bool:
  match starts:
    case False{}:
      False{}
    case True{}:
      isConferir.rest(String.drop(s, conferirLen()))

def isConferir(+s: String) -> Bool:
  isConferir.if(s, String.starts_with(s, conferirCmd()))

def rewriteConferir.hit(t: String, hit: Bool) -> String:
  match hit:
    case True{}:
      conferirLabel()
    case False{}:
      t

def rewriteConferir.on(text: String) -> String:
  +t = String.trim(text)
  rewriteConferir.hit(t, isConferir(t))

def rewriteConferir(text: String, on: Bool) -> String:
  match on:
    case False{}:
      text
    case True{}:
      rewriteConferir.on(text)

def applyCuts(text: String, cuts: PreviewCuts) -> String:
  match cuts:
    case PreviewCuts{suffix, conferir}:
      rewriteConferir(cutSuffixes(suffix, text), conferir)

# ---------- corpo da mensagem ----------

def contentText(body: MsgBody) -> String:
  match body:
    case BodyString{text}:
      text
    case BodyParts{parts}:
      String.join(parts, " ")
    case BodyField{text}:
      text

# ---------- preview: primeira mensagem user não vazia, cortada em 48 ----------
# Walker no estilo walkFound: um achado se mantém; senão tenta a cabeça.

def preview.try.empty(cleaned: String, empty: Bool) -> Maybe<&2, String>:
  match empty:
    case True{}:
      None{}
    case False{}:
      Some{String.take(cleaned, previewCap())}

def preview.try.clean(+cleaned: String) -> Maybe<&2, String>:
  preview.try.empty(cleaned, String.is_empty(cleaned))

def preview.try.user(text: String, cuts: PreviewCuts) -> Maybe<&2, String>:
  preview.try.clean(cleanText(applyCuts(text, cuts)))

def preview.try.role(
  isUser: Bool, text: String, cuts: PreviewCuts
) -> Maybe<&2, String>:
  match isUser:
    case False{}:
      None{}
    case True{}:
      preview.try.user(text, cuts)

def preview.try(h: SessionMsg, cuts: PreviewCuts) -> Maybe<&2, String>:
  match h:
    case SessionMsg{isUser, body}:
      preview.try.role(isUser, contentText(body), cuts)

def preview.step(
  found: Maybe<&2, String>, h: SessionMsg, cuts: PreviewCuts
) -> Maybe<&2, String>:
  match found:
    case Some{v}:
      Some{v}
    case None{}:
      preview.try(h, cuts)

def preview.go(
  msgs: List<&2, SessionMsg>, +cuts: PreviewCuts, found: Maybe<&2, String>
) -> Maybe<&2, String>:
  match msgs:
    case Nil{}:
      found
    case Con{h, t}:
      preview.go(t, cuts, preview.step(found, h, cuts))

def preview.fin(m: Maybe<&2, String>) -> String:
  match m:
    case None{}:
      ""
    case Some{s}:
      s

# Host: split das linhas, JSON.parse, recorte role+corpo. Núcleo: só user,
# cortes, colapso, 48, primeira não vazia.
def sessionPreview(msgs: List<&2, SessionMsg>, +cuts: PreviewCuts) -> String:
  preview.fin(preview.go(msgs, cuts, None{}))

# ---------- timestamp no caminho: /pi-(\d+)\.jsonl$/ ----------
# Expresso com String (ends_with, reverse/drop, dígitos, Nat.read).
# Sem `.jsonl` no fim → 0. Sem `pi-` imediatamente antes dos dígitos → 0.
# Sem dígitos → 0. O parser é um acc decimal (não Nat.read: o teto 2^48
# da Base não reduz no checker). O walk do último trecho de dígitos também
# é accumulator/tail (100k de path não estoura a pilha — #798).

def headDigit(s: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{h, t}:
      Char.is_digit(h)

def takeTrail.go(s: String, d: Bool, prefix: String, digits: String) -> String & String:
  match s:
    case SNil{}:
      (prefix, digits)
    case SCon{h, +t}:
      match d:
        case True{}:
          takeTrail.go(t, headDigit(t), prefix, String.append(digits, charStr(h)))
        case False{}:
          takeTrail.go(t, headDigit(t), String.append(prefix, String.append(digits, charStr(h))), "")

def takeTrail(+s: String) -> String & String:
  takeTrail.go(s, headDigit(s), "", "")

def stripJsonl(path: String) -> String:
  String.reverse(String.drop(String.reverse(path), jsonlLen()))

# Dígito ASCII → 0..9. Só chamado em chars que já passaram Char.is_digit.
def digitVal(c: Char) -> Nat:
  Nat.sub(U32.to_nat(Char.to_u32(c)), 48n)

# Nat.read da Base usa teto 2^48 e não reduz no checker; aqui o acc é só
# o valor decimal (timestamps cabem; a lei usa números pequenos).
def readDigits(s: String, acc: Nat) -> Nat:
  match s:
    case SNil{}:
      acc
    case SCon{h, t}:
      readDigits(t, Nat.add(Nat.mul(acc, 10n), digitVal(h)))

def started.val(+digits: String, empty: Bool) -> Nat:
  match empty:
    case True{}:
      0n
    case False{}:
      readDigits(digits, 0n)

def started.pi(+digits: String, ok: Bool) -> Nat:
  match ok:
    case False{}:
      0n
    case True{}:
      started.val(digits, String.is_empty(digits))

def started.from(pd: String & String) -> Nat:
  (prefix, digits) = pd
  started.pi(digits, String.ends_with(prefix, "pi-"))

def started.digits(s: String) -> Nat:
  started.from(takeTrail(s))

# Fato do host: o caminho termina em `.jsonl`? Sem o fato, o núcleo mede.
def started.if(path: String, jsonl: Bool) -> Nat:
  match jsonl:
    case False{}:
      0n
    case True{}:
      started.digits(stripJsonl(path))

def sessionStartedFromPath(+path: String) -> Nat:
  started.if(path, String.ends_with(path, ".jsonl"))

# ---------- rótulo: título > nota > Nova conversa / data / Conversa ----------
# Data: o host passa componentes *locais já resolvidos* (mês 1–12) e o fato
# `valid`. Formato `dd/mm, hh:mm` (zero à esquerda), igual ao
# toLocaleString('pt-BR', {...}) do host. Ano não entra no rótulo.

def pad2.if(n: Nat, small: Bool) -> String:
  match small:
    case True{}:
      String.append("0", Nat.show(n))
    case False{}:
      Nat.show(n)

def pad2(+n: Nat) -> String:
  pad2.if(n, Nat.is_lt(n, 10n))

def formatDate(day: Nat, month: Nat, hour: Nat, minute: Nat) -> String:
  pad2(day) ++ "/" ++ pad2(month) ++ ", " ++ pad2(hour) ++ ":" ++ pad2(minute)

def formatWhen(
  valid: Bool, day: Nat, month: Nat, hour: Nat, minute: Nat
) -> String:
  match valid:
    case False{}:
      conversaLabel()
    case True{}:
      formatDate(day, month, hour, minute)

def formatLabel.withNote(
  note: String, valid: Bool, day: Nat, month: Nat, hour: Nat, minute: Nat
) -> String:
  formatWhen(valid, day, month, hour, minute)
    ++ noteSep()
    ++ String.take(note, noteCap())

def formatLabel.empty(
  nova: Bool, valid: Bool, day: Nat, month: Nat, hour: Nat, minute: Nat
) -> String:
  match nova:
    case True{}:
      novaLabel()
    case False{}:
      formatWhen(valid, day, month, hour, minute)

def formatLabel.note.if(
  note: String,
  noNote: Bool,
  nova: Bool,
  valid: Bool,
  day: Nat,
  month: Nat,
  hour: Nat,
  minute: Nat
) -> String:
  match noNote:
    case True{}:
      formatLabel.empty(nova, valid, day, month, hour, minute)
    case False{}:
      formatLabel.withNote(note, valid, day, month, hour, minute)

def formatLabel.note(
  preview: String,
  nova: Bool,
  valid: Bool,
  day: Nat,
  month: Nat,
  hour: Nat,
  minute: Nat
) -> String:
  +note = cleanText(preview)
  formatLabel.note.if(note, String.is_empty(note), nova, valid, day, month, hour, minute)

def formatLabel.title.if(
  title: String,
  empty: Bool,
  preview: String,
  nova: Bool,
  valid: Bool,
  day: Nat,
  month: Nat,
  hour: Nat,
  minute: Nat
) -> String:
  match empty:
    case False{}:
      title
    case True{}:
      formatLabel.note(preview, nova, valid, day, month, hour, minute)

def formatSessionLabel(
  title: String,
  preview: String,
  nova: Bool,
  valid: Bool,
  day: Nat,
  month: Nat,
  hour: Nat,
  minute: Nat
) -> String:
  +t = String.trim(title)
  formatLabel.title.if(t, String.is_empty(t), preview, nova, valid, day, month, hour, minute)

# ---------- grupos: hoje / ontem / antes (fatos do host) ----------
# Host: `isToday` = started >= início civil de hoje; `isYesterday` = started
# >= início de ontem e < hoje. Se os dois vierem True, hoje vence. Pinned,
# week, archived, path vazio e a ordem por started desc ficam no host.

def groupOf.yest(isYesterday: Bool) -> SessionGroup:
  match isYesterday:
    case True{}:
      GroupYesterday{}
    case False{}:
      GroupOlder{}

def groupOf(isToday: Bool, isYesterday: Bool) -> SessionGroup:
  match isToday:
    case True{}:
      GroupToday{}
    case False{}:
      groupOf.yest(isYesterday)

def groupLabel(g: SessionGroup) -> String:
  match g:
    case GroupToday{}:
      "Hoje"
    case GroupYesterday{}:
      "Ontem"
    case GroupOlder{}:
      "Anteriores"

def group.push.at(
  today: List<&2, String>,
  yesterday: List<&2, String>,
  older: List<&2, String>,
  item: String,
  g: SessionGroup
) -> SessAcc:
  match g:
    case GroupToday{}:
      SessAcc{List.append(&2, String, today, [item]), yesterday, older}
    case GroupYesterday{}:
      SessAcc{today, List.append(&2, String, yesterday, [item]), older}
    case GroupOlder{}:
      SessAcc{today, yesterday, List.append(&2, String, older, [item])}

def group.push(acc: SessAcc, item: String, g: SessionGroup) -> SessAcc:
  match acc:
    case SessAcc{today, yesterday, older}:
      group.push.at(today, yesterday, older, item, g)

def group.go(
  items: List<&2, String>,
  todayF: List<&2, Bool>,
  yestF: List<&2, Bool>,
  acc: SessAcc
) -> SessAcc:
  match items:
    case Nil{}:
      acc
    case Con{h, t}:
      match todayF:
        case Nil{}:
          acc
        case Con{td, tds}:
          match yestF:
            case Nil{}:
              acc
            case Con{yd, yds}:
              group.go(t, tds, yds, group.push(acc, h, groupOf(td, yd)))

def keepBucket.if(
  +g: SessionGroup,
  items: List<&2, String>,
  rest: List<&2, SessionBucket>,
  empty: Bool
) -> List<&2, SessionBucket>:
  match empty:
    case True{}:
      rest
    case False{}:
      Con{SessionBucket{g, groupLabel(g), items}, rest}

def keepBucket(
  g: SessionGroup, +items: List<&2, String>, rest: List<&2, SessionBucket>
) -> List<&2, SessionBucket>:
  keepBucket.if(g, items, rest, List.is_empty(&2, String, items))

def group.finish(acc: SessAcc) -> List<&2, SessionBucket>:
  match acc:
    case SessAcc{today, yesterday, older}:
      keepBucket(
        GroupToday{},
        today,
        keepBucket(
          GroupYesterday{},
          yesterday,
          keepBucket(GroupOlder{}, older, Nil{})
        )
      )

# Itens já filtrados/ordenados pelo host; fatos alinhados com os itens.
# Grupos vazios não saem. Ordem: Hoje, Ontem, Anteriores.
def groupSessions(
  items: List<&2, String>,
  todayF: List<&2, Bool>,
  yestF: List<&2, Bool>
) -> List<&2, SessionBucket>:
  group.finish(group.go(items, todayF, yestF, SessAcc{Nil{}, Nil{}, Nil{}}))
