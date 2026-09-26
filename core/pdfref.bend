import Base
import ./search.bend as S

# ---------------------------------------------------------------------------
# Citação de PDF dentro de uma resposta: o "Citar" escreve
# "(Limites.pdf, p. 7)" e essa citação vira link para a página do leitor.
#
# A divisão é a mesma do `find.bend`: o host acha os candidatos no texto já
# sanitizado (só o "onde" — o trecho que termina em ".pdf" e, se preciso, o
# rabo depois de cada espaço) e este núcleo decide — qual candidato é nome da
# biblioteca (por dobra, sem acento e sem caixa), qual página o marcador diz,
# quanto texto o cue consome, o rótulo e o title/aria. Nada aqui lê DOM, mede
# ou fala IPC.
#
# Sem marcador de página não há link: menção solta ao arquivo continua texto.
# ---------------------------------------------------------------------------

# O marcador depois do nome: a página (1-based) e quantos caracteres do texto
# original o cue inteiro consumiu (separadores + marcador + espaços + dígitos).
type CiteCue is Data:
  CiteCue{page: Nat, length: Nat}

def charStr(c: Char) -> String:
  SCon{c, SNil{}}

def pageOf(c: CiteCue) -> Nat:
  match c:
    case CiteCue{page, length}:
      page

def cueLenOf(c: CiteCue) -> Nat:
  match c:
    case CiteCue{page, length}:
      length

# Teto de sanidade da página: o host corta no total do PDF depois.
def maxPage() -> Nat:
  10000n

# Teto do candidato: nome de arquivo maior que isso não é citação.
def maxCandidate() -> Nat:
  200n

# O trecho de link que o host mostra quando não quer recortar o texto: o nome
# do arquivo e a página, no mesmo formato do "Citar".
def refLabel(name: String, page: Nat) -> String:
  name ++ ", p. " ++ Nat.show(page)

def refTitle(name: String, page: Nat) -> String:
  "Abrir " ++ name ++ " na p. " ++ Nat.show(page)

def refAria(name: String, page: Nat) -> String:
  "Abrir a página " ++ Nat.show(page) ++ " de " ++ name

# ---------- nome: dobra contra a biblioteca ----------

def fitName(name: String) -> String:
  String.take(String.trim(name), maxCandidate())

# O nome canônico da biblioteca quando o candidato é ele por dobra (sem acento
# e sem caixa, a mesma regra da busca). Vazio ou desconhecido → None.
#
# Bend não deixa `match` olhar valor computado nem deixar dois defs se
# chamarem: os fatos (igualdade por dobra) saem de uma passada e o walk leva o
# acumulador no argumento, como o `takeTrail.go` do sessions.
def knownName.facts(names: List<&2, String>, +folded: String) -> List<&2, Bool>:
  match names:
    case Nil{}:
      Nil{}
    case Con{name, t}:
      Con{String.eq(S.fold(fitName(name)), folded), knownName.facts(t, folded)}

def knownName.pickNone(hit: Bool, name: String) -> Maybe<&2, String>:
  match hit:
    case True{}:
      Some{name}
    case False{}:
      None{}

def knownName.pick(best: Maybe<&2, String>, hit: Bool, name: String) -> Maybe<&2, String>:
  match best:
    case Some{b}:
      Some{b}
    case None{}:
      knownName.pickNone(hit, name)

def knownName.go(folded: String, names: List<&2, String>, facts: List<&2, Bool>, best: Maybe<&2, String>) -> Maybe<&2, String>:
  match names facts:
    case Nil{} _:
      best
    case Con{name, t} Nil{}:
      best
    case Con{name, t} Con{hit, fs}:
      knownName.go(folded, t, fs, knownName.pick(best, hit, name))

def knownName.empty(empty: Bool, +folded: String, +names: List<&2, String>) -> Maybe<&2, String>:
  match empty:
    case True{}:
      None{}
    case False{}:
      knownName.go(folded, names, knownName.facts(names, folded), None{})

def knownName(candidate: String, names: List<&2, String>) -> Maybe<&2, String>:
  +c = fitName(candidate)
  knownName.empty(String.is_empty(c), S.fold(c), names)

# ---------- página: marcador depois do nome ----------

# Marcadores aceitos, do mais longo para o mais curto. O host só dá o texto
# depois do nome; aqui a ordem decide ("página 7" antes de "p. 7").
def cueMarkers() -> List<&2, String>:
  ["página ", "pág. ", "pág ", "#page=", "p. ", "p.", "p "]

# Separadores que podem vir antes do marcador (", p. 7", "; p. 7", " p. 7").
def isSeparator(+c: Char) -> Bool:
  Bool.or(Char.is_space(c), Bool.or(Char.is_eq(c, ','), Char.is_eq(c, ';')))

# Só o PREFIXO conta: o Bool `d` ("já parou") viaja como parâmetro do walk
# (mesma forma do `takeTrail.go` do sessions) e vira `True` no primeiro
# caractere fora do conjunto.
def sep.stop(hit: Bool) -> Bool:
  match hit:
    case True{}:
      False{}
    case False{}:
      True{}

def sep.bump(n: Nat, hit: Bool) -> Nat:
  match hit:
    case True{}:
      Nat.add(n, 1n)
    case False{}:
      n

def sep.go(s: String, d: Bool, n: Nat) -> Nat:
  match s:
    case SNil{}:
      n
    case SCon{h, +t}:
      match d:
        case True{}:
          n
        case False{}:
          +hit = isSeparator(h)
          sep.go(t, sep.stop(hit), sep.bump(n, hit))

def sepAt(s: String) -> Nat:
  sep.go(s, False{}, 0n)

def spaces.stop(hit: Bool) -> Bool:
  match hit:
    case True{}:
      False{}
    case False{}:
      True{}

def spaces.bump(n: Nat, hit: Bool) -> Nat:
  match hit:
    case True{}:
      Nat.add(n, 1n)
    case False{}:
      n

def spaces.go(s: String, d: Bool, n: Nat) -> Nat:
  match s:
    case SNil{}:
      n
    case SCon{h, +t}:
      match d:
        case True{}:
          n
        case False{}:
          +hit = Char.is_space(h)
          spaces.go(t, spaces.stop(hit), spaces.bump(n, hit))

def spacesAt(s: String) -> Nat:
  spaces.go(s, False{}, 0n)

# Dígito ASCII → 0..9 (mesmo caminho do `sessions.bend`).
def digitVal(c: Char) -> Nat:
  Nat.sub(U32.to_nat(Char.to_u32(c)), 48n)

def digits.stop(hit: Bool) -> Bool:
  match hit:
    case True{}:
      False{}
    case False{}:
      True{}

def digits.acc(acc: Nat, +n: Nat, hit: Bool, val: Nat) -> Nat:
  match hit:
    case True{}:
      Nat.add(Nat.mul(acc, 10n), val)
    case False{}:
      acc

def digits.count(n: Nat, hit: Bool) -> Nat:
  match hit:
    case True{}:
      Nat.add(n, 1n)
    case False{}:
      n

def digits.go(s: String, d: Bool, +acc: Nat, +n: Nat) -> Nat & Nat:
  match s:
    case SNil{}:
      (acc, n)
    case SCon{+h, +t}:
      match d:
        case True{}:
          (acc, n)
        case False{}:
          +hit = Char.is_digit(h)
          digits.go(t, digits.stop(hit), digits.acc(acc, n, hit, digitVal(h)), digits.count(n, hit))

def readDigits(s: String) -> Nat & Nat:
  digits.go(s, False{}, 0n, 0n)

def pageOk(+page: Nat) -> Bool:
  Bool.and(Nat.is_ge(page, 1n), Nat.is_le(page, maxPage()))

# Depois do marcador: espaços e pelo menos um dígito. `before` já conta os
# separadores e o marcador; o comprimento do cue é o que o host recorta.
def cueAfter.valid(page: Nat, ok: Bool, consumed: Nat) -> Maybe<&2, CiteCue>:
  match ok:
    case False{}:
      None{}
    case True{}:
      Some{CiteCue{page, consumed}}

def cueAfter.any(any: Bool, +page: Nat, consumed: Nat) -> Maybe<&2, CiteCue>:
  match any:
    case False{}:
      None{}
    case True{}:
      cueAfter.valid(page, pageOk(page), consumed)

# Cada valor é consumido uma vez só: o par desestrutura por parâmetro (padrão
# não aceita valor computado nem binder local) e o `pick` fecha a conta.
def cueAfter.pick(page: Nat, +digits: Nat, before: Nat, +sp: Nat) -> Maybe<&2, CiteCue>:
  cueAfter.any(Nat.is_gt(digits, 0n), page, Nat.add(before, Nat.add(sp, digits)))

def cueAfter.pair(d: Nat & Nat, before: Nat, +sp: Nat) -> Maybe<&2, CiteCue>:
  (page, digits) = d
  cueAfter.pick(page, digits, before, sp)

def cueAfter(+rest: String, before: Nat) -> Maybe<&2, CiteCue>:
  +sp = spacesAt(rest)
  cueAfter.pair(readDigits(String.drop(rest, sp)), before, sp)

def tryMarker.hit(hit: Bool, rest: String, before: Nat, +ml: Nat) -> Maybe<&2, CiteCue>:
  match hit:
    case False{}:
      None{}
    case True{}:
      cueAfter(String.drop(rest, ml), Nat.add(before, ml))

def tryMarker(+rest: String, before: Nat, +marker: String) -> Maybe<&2, CiteCue>:
  +ml = String.length(marker)
  tryMarker.hit(String.starts_with(rest, marker), rest, before, ml)

def tryMarkers.pick(found: Maybe<&2, CiteCue>, next: Maybe<&2, CiteCue>) -> Maybe<&2, CiteCue>:
  match found:
    case Some{c}:
      Some{c}
    case None{}:
      next

def tryMarkers(+rest: String, +before: Nat, markers: List<&2, String>, found: Maybe<&2, CiteCue>) -> Maybe<&2, CiteCue>:
  match markers:
    case Nil{}:
      found
    case Con{m, t}:
      tryMarkers(rest, before, t, tryMarkers.pick(found, tryMarker(rest, before, m)))

# O cue a partir do texto que vem logo depois do nome do arquivo.
def cueFrom(+text: String) -> Maybe<&2, CiteCue>:
  +n = sepAt(text)
  tryMarkers(String.drop(text, n), n, cueMarkers(), None{})
