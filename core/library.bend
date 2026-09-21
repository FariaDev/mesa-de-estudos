import Base

# ---------------------------------------------------------------------------
# Núcleo da biblioteca de PDFs da Mesa (referência: pickPdfs de desk/config.cjs).
#
# O app entrega os nomes dos PDFs e os prefer de cada painel; o núcleo resolve
# os fatos — `Match{self, other}`, na ordem da biblioteca:
#   self  = o nome casa com o prefer DESTE painel;
#   other = o nome casa com o prefer dos OUTROS painéis.
# e decide a escolha, na ordem de hoje:
#   1º o primeiro arquivo livre que casa com o prefer do painel;
#   2º senão o primeiro livre que NÃO casa com o prefer dos outros;
#   3º senão o primeiro livre; senão, nada.
# Escolhido, o arquivo fica marcado (`used`) e não se repete.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type Match is Data:
  Match{self: Bool, other: Bool}

# Um passo de um painel: o índice escolhido (na biblioteca) e a máscara de
# usados com essa escolha marcada.
type Step is Data:
  Step{at: Maybe<&2, Nat>, used: List<&2, Bool>}

# Estado da varredura dos painéis: usados + escolhas (em ordem inversa).
type Acc is Data:
  Acc{used: List<&2, Bool>, at: List<&2, Maybe<&2, Nat>>}

# Resultado final: uma escolha por painel, na ordem dos painéis.
type Picks is Data:
  Picks{at: List<&2, Maybe<&2, Nat>>, used: List<&2, Bool>}

# ---------- máscara ----------

# O índice já está usado? Fora da lista conta como não usado (a busca nunca
# devolve índice fora da lista).
def usedAt(used: List<&2, Bool>, i: Nat) -> Bool:
  match used i:
    case Nil{} _:
      False{}
    case Con{u, t} 0n:
      u
    case Con{u, t} 1n+p:
      usedAt(t, p)

# Marca o índice como usado. Fora da lista, nada muda.
def markAt(used: List<&2, Bool>, i: Nat) -> List<&2, Bool>:
  match used i:
    case Nil{} _:
      Nil{}
    case Con{u, t} 0n:
      Con{True{}, t}
    case Con{u, t} 1n+p:
      Con{u, markAt(t, p)}

# O índice existe na máscara? (usado como pré-condição nas leis de marcação)
def inRange(used: List<&2, Bool>, i: Nat) -> Bool:
  match used i:
    case Nil{} _:
      False{}
    case Con{u, t} 0n:
      True{}
    case Con{u, t} 1n+p:
      inRange(t, p)

def bump(m: Maybe<&2, Nat>) -> Maybe<&2, Nat>:
  match m:
    case None{}:
      None{}
    case Some{i}:
      Some{Succ{i}}

# ---------- fatos dos arquivos ----------

def selfOf(x: Match) -> Bool:
  match x:
    case Match{s, o}:
      s

def otherOf(x: Match) -> Bool:
  match x:
    case Match{s, o}:
      o

def selfAt(xs: List<&2, Match>, i: Nat) -> Bool:
  match xs i:
    case Nil{} _:
      False{}
    case Con{x, t} 0n:
      selfOf(x)
    case Con{x, t} 1n+p:
      selfAt(t, p)

def otherAt(xs: List<&2, Match>, i: Nat) -> Bool:
  match xs i:
    case Nil{} _:
      False{}
    case Con{x, t} 0n:
      otherOf(x)
    case Con{x, t} 1n+p:
      otherAt(t, p)

# Existe arquivo livre que casa com o prefer deste painel?
def hasFreeSelf(xs: List<&2, Match>, used: List<&2, Bool>) -> Bool:
  match xs used:
    case Nil{} _:
      False{}
    case Con{_, _} Nil{}:
      False{}
    case Con{x, t} Con{u, ut}:
      Bool.or(Bool.and(Bool.not(u), selfOf(x)), hasFreeSelf(t, ut))

# Existe arquivo livre que NÃO casa com o prefer dos outros?
def hasFreeOther(xs: List<&2, Match>, used: List<&2, Bool>) -> Bool:
  match xs used:
    case Nil{} _:
      False{}
    case Con{_, _} Nil{}:
      False{}
    case Con{x, t} Con{u, ut}:
      Bool.or(Bool.and(Bool.not(u), Bool.not(otherOf(x))), hasFreeOther(t, ut))

# Existe arquivo livre?
def hasFree(xs: List<&2, Match>, used: List<&2, Bool>) -> Bool:
  match xs used:
    case Nil{} _:
      False{}
    case Con{_, _} Nil{}:
      False{}
    case Con{x, t} Con{u, ut}:
      Bool.or(Bool.not(u), hasFree(t, ut))

# ---------- busca ----------

# Primeiro índice livre que casa com o prefer do painel.
def pickSelf(xs: List<&2, Match>, used: List<&2, Bool>) -> Maybe<&2, Nat>:
  match xs:
    case Nil{}:
      None{}
    case Con{x, t}:
      match x:
        case Match{s, o}:
          match s:
            case True{}:
              match used:
                case Nil{}:
                  None{}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      bump(pickSelf(t, ut))
                    case False{}:
                      Some{0n}
            case False{}:
              match used:
                case Nil{}:
                  None{}
                case Con{u, ut}:
                  bump(pickSelf(t, ut))

# Primeiro índice livre que NÃO casa com o prefer dos outros.
def pickOther(xs: List<&2, Match>, used: List<&2, Bool>) -> Maybe<&2, Nat>:
  match xs:
    case Nil{}:
      None{}
    case Con{x, t}:
      match x:
        case Match{s, o}:
          match o:
            case False{}:
              match used:
                case Nil{}:
                  None{}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      bump(pickOther(t, ut))
                    case False{}:
                      Some{0n}
            case True{}:
              match used:
                case Nil{}:
                  None{}
                case Con{u, ut}:
                  bump(pickOther(t, ut))

# Primeiro índice livre, sem preferência.
def pickFree(xs: List<&2, Match>, used: List<&2, Bool>) -> Maybe<&2, Nat>:
  match xs:
    case Nil{}:
      None{}
    case Con{x, t}:
      match used:
        case Nil{}:
          None{}
        case Con{u, ut}:
          match u:
            case True{}:
              bump(pickFree(t, ut))
            case False{}:
              Some{0n}

# ---------- passo de um painel ----------

# A escolha do passo, só com os resultados das três buscas:
# prefer deste painel; senão "não casa com os outros"; senão o primeiro livre.
def pickStep.choice.after(other: Maybe<&2, Nat>, free: Maybe<&2, Nat>) -> Maybe<&2, Nat>:
  match other:
    case Some{i}:
      Some{i}
    case None{}:
      free

def pickStep.choice(self: Maybe<&2, Nat>, other: Maybe<&2, Nat>, free: Maybe<&2, Nat>) -> Maybe<&2, Nat>:
  match self:
    case Some{i}:
      Some{i}
    case None{}:
      pickStep.choice.after(other, free)

def pickStep.after(+at: Maybe<&2, Nat>, +used: List<&2, Bool>) -> Step:
  match at:
    case None{}:
      Step{None{}, used}
    case Some{i}:
      Step{Some{i}, markAt(used, i)}

def pickStep(+xs: List<&2, Match>, +used: List<&2, Bool>) -> Step:
  pickStep.after(
    pickStep.choice(pickSelf(xs, used), pickOther(xs, used), pickFree(xs, used)),
    used
  )

# ---------- varredura dos painéis ----------

def stepAcc.after(step: Step, acc: List<&2, Maybe<&2, Nat>>) -> Acc:
  match step:
    case Step{at, used1}:
      Acc{used1, Con{at, acc}}

def stepAcc(panel: List<&2, Match>, st: Acc) -> Acc:
  match st:
    case Acc{used, at}:
      stepAcc.after(pickStep(panel, used), at)

def pickAll.rev(st: Acc) -> Picks:
  match st:
    case Acc{used, at}:
      Picks{List.reverse(&2, Maybe<&2, Nat>, at), used}

def pickAll.go(panels: List<&2, List<&2, Match>>, st: Acc) -> Acc:
  match panels:
    case Nil{}:
      st
    case Con{p, rest}:
      pickAll.go(rest, stepAcc(p, st))

# Decide todos os painéis, na ordem, a partir de uma máscara inicial.
def pickAll(panels: List<&2, List<&2, Match>>, used: List<&2, Bool>) -> Picks:
  pickAll.rev(pickAll.go(panels, Acc{used, Nil{}}))

# Máscara inicial: nenhum arquivo usado.
def emptyMask(n: Nat) -> List<&2, Bool>:
  List.replicate(Bool, n, False{})

# Atalho do adaptador: biblioteca inteira livre.
def pickFresh(panels: List<&2, List<&2, Match>>, n: Nat) -> Picks:
  pickAll(panels, emptyMask(n))
