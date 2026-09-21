import Base

# ---------------------------------------------------------------------------
# Framing das linhas JSON-RPC do stdout do Pi.
#
# No host (chat/rpc.cjs e o gêmeo desk/rpc.cjs):
#   buffer += chunk
#   se buffer.length > 33554432 → derruba a conexão e descarta TUDO
#   cada '\n' fecha uma linha; o resto fica no buffer
#   linha vazia/branca é ignorada *antes* do JSON.parse (isso fica no host)
#
# O núcleo é fiel ao descarte: overflow ⇒ lines=[], rest="", overflow=True.
# O split em si é puro — linhas vazias SAEM; o host filtra com trim. Assim a
# conservação (rejuntar com '\n') não precisa falar de whitespace.
#
# IMPORTANTE (hot path): no app, o split das linhas continua sendo feito pelo
# host em JS nativo (`frameSplit` em `rpc.cjs`). Este núcleo é a SPEC e agora
# roda nos mesmos buffers: `split`/`strLength` são loops accumulator/tail no
# padrão do comentário da issue #798 (self-call em tail position ⇒ `run_jump`;
# `String.reverse`/`List.reverse` já são tail-safe).
#
# Upstream: bendlang/bend#798 — `String.split`/`String.length` (e `String.take`,
# ao contrário do que se pensava) recursam fora de tail position e estouram a
# pilha do lane JS com ~5–8k chars; a direção de correção é do comentário do
# aron-intframe (Str.length.go + split com step/go/fin). Aqui não usamos mais as
# primitivas recursivas do prelude para varrer string.
#
# Comprimento: o JS conta unidades UTF-16; aqui `strLength` conta Chars
# (escalares Unicode). O adaptador deve usar `feed.over` com o Bool do host
# se quiser o teto idêntico ao JS; `feed` serve quando o Char count basta.
# Só LF (`'\n'`, U+000A) fecha linha — CR e U+2028 ficam dentro, como hoje.
# ---------------------------------------------------------------------------

type Frame is Data:
  Frame{lines: +List<String>, rest: String, overflow: Bool}

# ---------- peel: o último fragmento é o resto; o resto da lista são linhas

def prependLine(h: String, more: Frame) -> Frame:
  match more:
    case Frame{lines, rest, overflow}:
      Frame{Con{h, lines}, rest, overflow}

# A lista que encolhe vem primeiro (checagem de terminação: da esquerda
# para a direita, um argumento menor, o resto livre).
def peel.go(t: +List<String>, h: String) -> Frame:
  match t:
    case Nil{}:
      Frame{Nil{}, h, False{}}
    case Con{h2, t2}:
      prependLine(h, peel.go(t2, h2))

def peel(xs: +List<String>) -> Frame:
  match xs:
    case Nil{}:
      Frame{Nil{}, "", False{}}
    case Con{h, t}:
      peel.go(t, h)

# Split puro em loop (padrão `step`/`go`/`fin` do comentário #798). O estado é
# (peça atual, invertida; peças fechadas, invertidas): a cada LF a peça corrente
# fecha e entra na lista; no fim a peça corrente é o resto. Idêntico ao antigo
# `peel(String.split(s, '\n'))` — inclusive string vazia, LF inicial/final e
# LFs adjacentes — sem a recursão não-tail de `String.split`/`peel`.
def split.step(h: Char, st: String & List<&2, String>, cut: Bool) ->
  String & List<&2, String>:
  (cur, acc) = st
  match cut:
    case True{}:
      (SNil{}, String.reverse(cur) <> acc)
    case False{}:
      (SCon{h, cur}, acc)

def split.fin(cur: String, acc: +List<String>) -> Frame:
  Frame{List.reverse(&2, String, acc), String.reverse(cur), False{}}

def split.go(s: String, st: String & List<&2, String>) -> Frame:
  match s:
    case SNil{}:
      (cur, acc) = st
      split.fin(cur, acc)
    case SCon{+h, t}:
      split.go(t, split.step(h, st, Char.is_eq(h, '\n')))

def split(s: String) -> Frame:
  split.go(s, (SNil{}, Nil{}))

# Comprimento em loop: `String.length` também recursa por caractere e estoura
# em ~10k (o `joined` do feed chega a MBs). Mesma contagem por Char (escalar).
def strLength.go(s: String, acc: Nat) -> Nat:
  match s:
    case SNil{}:
      acc
    case SCon{h, t}:
      strLength.go(t, 1n+acc)

def strLength(s: String) -> Nat:
  strLength.go(s, 0n)

# ---------- overflow: o Bool vem do host (feed.over) ou do comprimento (feed)

def feed.over(joined: String, over: Bool) -> Frame:
  match over:
    case True{}:
      Frame{Nil{}, "", True{}}
    case False{}:
      split(joined)

# Concatena e, se strLength(joined) > limit, descarta tudo — o mesmo `>` do JS.
def feed(buffer: String, chunk: String, limit: Nat) -> Frame:
  +joined = buffer ++ chunk
  feed.over(joined, Nat.is_gt(strLength(joined), limit))

# ---------- inversa: linhas juntadas com '\n' e o resto no fim

def rejoin(lines: +List<String>, rest: String) -> String:
  match lines:
    case Nil{}:
      rest
    case Con{h, t}:
      String.append(h, String.append("\n", rejoin(t, rest)))

def rejoinFrame(f: Frame) -> String:
  match f:
    case Frame{lines, rest, overflow}:
      rejoin(lines, rest)

def overflowOf(f: Frame) -> Bool:
  match f:
    case Frame{lines, rest, overflow}:
      overflow
