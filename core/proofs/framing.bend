import Base
import ../laws/framing.bend as Laws
import ../framing.bend as F

# ---------- overflow como fato Bool: reduz ----------

def Laws.overflow_descarta(s):
  {==}

def Laws.over_false_e_split(s):
  {==}

# ---------- overflow do peel: o Frame sempre carrega False{} ----------

def prepend_overflow(h: String, more: F.Frame) ->
  {F.overflowOf(more) == F.overflowOf(F.prependLine(h, more)) : Bool}:
  match more:
    case F.Frame{lines, rest, overflow}:
      {==}

def Laws.peel_go_ok(t, h):
  match t:
    case Nil{}:
      {==}
    case Con{+h2, +t2}:
      %prepend_overflow(h, F.peel.go(t2, h2)) : {_ == False{} : Bool}
      %Laws.peel_go_ok(t2, h2) : {F.overflowOf(F.peel.go(t2, h2)) == _ : Bool}
      {==}

def Laws.peel_ok(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      Laws.peel_go_ok(t, h)

# O Frame de saída carrega False em todos os ramos; indução em s com o estado
# (peça, peças) — o passo reusa a hipótese com o estado que o step devolve.
def split_loop_ok(s: String, st: String & List<&2, String>) ->
  {F.overflowOf(F.split.go(s, st)) == False{} : Bool}:
  match s:
    case SNil{}:
      (cur, acc) = st
      {==}
    case SCon{+h, t}:
      split_loop_ok(t, F.split.step(h, st, Char.is_eq(h, '\n')))

def Laws.split_nunca_overflow(s):
  split_loop_ok(s, (SNil{}, Nil{}))

def Laws.split_go_nunca_overflow(s, st):
  split_loop_ok(s, st)

# ---------- split/strLength em loop (correção #798) ----------

def Laws.str_len_vazio():
  {==}

def Laws.str_len_ascii():
  {==}

def Laws.str_len_acento():
  {==}

def Laws.str_len_emoji():
  {==}

def Laws.str_len_go():
  {==}

def Laws.split_igual_peel():
  {==}

# ---------- conservação do peel (inversa do join da lista) ----------

def prepend_rejoin(h: String, more: F.Frame) ->
  {String.append(h, String.append("\n", F.rejoinFrame(more))) == F.rejoinFrame(F.prependLine(h, more)) : String}:
  match more:
    case F.Frame{lines, rest, overflow}:
      {==}

def Laws.peel_go_rejoin(t, h):
  match t:
    case Nil{}:
      {==}
    case Con{+h2, +t2}:
      %prepend_rejoin(h, F.peel.go(t2, h2)) : {_ == String.join(Con{h, Con{h2, t2}}, "\n") : String}
      %Equal.sym(
        String,
        F.rejoinFrame(F.peel.go(t2, h2)),
        String.join(Con{h2, t2}, "\n"),
        Laws.peel_go_rejoin(t2, h2)
      ) : {String.append(h, String.append("\n", _)) == String.join(Con{h, Con{h2, t2}}, "\n") : String}
      {==}

def Laws.peel_rejoin(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      Laws.peel_go_rejoin(t, h)

# ---------- cenários: fecham por computação ----------

def Laws.sem_nl():
  {==}

def Laws.uma_linha():
  {==}

def Laws.linha_e_resto():
  {==}

def Laws.linha_vazia():
  {==}

def Laws.duas_vazias_e_resto():
  {==}

def Laws.concat_chunk():
  {==}

def Laws.conserva_concreto():
  {==}

def Laws.no_limite():
  {==}

def Laws.acima_do_limite():
  {==}

def Laws.overflow_descarta_linhas():
  {==}

def Laws.split_u2028():
  {==}

def Laws.split_cr():
  {==}

def Laws.vazio():
  {==}
