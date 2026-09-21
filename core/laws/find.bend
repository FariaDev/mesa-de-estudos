import Base
import ../find.bend as F

# Leis do contador/ciclo da busca. Vocabulário auxiliar primeiro: só serve
# para falar do núcleo, nada disso vai para o app.

# A página p aparece em alguma entrada da lista?
def hasPage(pages: List<&2, F.PageHits>, +p: Nat) -> Bool:
  match pages:
    case Nil{}:
      False{}
    case Con{h, t}:
      match h:
        case F.PageHits{page, count}:
          Bool.or(hasPage(t, p), Nat.is_eq(page, p))

# A página do Maybe, quando existe, está na lista?
def maybeIn(m: Maybe<Nat>, pages: List<&2, F.PageHits>) -> Bool:
  match m:
    case None{}:
      True{}
    case Some{p}:
      hasPage(pages, p)

# A entrada h casa com a página do Maybe?
def hitsHead(m: Maybe<Nat>, h: F.PageHits) -> Bool:
  match m:
    case None{}:
      False{}
    case Some{p}:
      Nat.is_eq(F.pageOf(h), p)

# Nenhum fato verdadeiro na lista?
def noTrue.cons(f: Bool, rest: Bool) -> Bool:
  match f:
    case True{}:
      False{}
    case False{}:
      rest

def noTrue(facts: List<&2, Bool>) -> Bool:
  match facts:
    case Nil{}:
      True{}
    case Con{f, fs}:
      noTrue.cons(f, noTrue(fs))

# Mesmo comprimento que `pages`, todos falsos.
def allFalse(pages: List<&2, F.PageHits>) -> List<&2, Bool>:
  match pages:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{False{}, allFalse(t)}

# a ≤ b como tipo (as leis de contagem falam em tipos). Dois matches aninhados
# para o caso 0n reduzir mesmo com o lado direito ainda preso.
def Le(a: Nat, b: Nat) -> Type:
  match a:
    case 0n:
      Unit
    case 1n+p:
      match b:
        case 0n:
          Empty
        case 1n+q:
          Le(p, q)

# ---------------------------------------------------------------------------
# Leis do ciclo (alvo da busca)
# ---------------------------------------------------------------------------

# O comparador de Nat é reflexivo: o fato da própria página casa.
law is_eq_self:
  for x: Nat
  {Nat.is_eq(x, x) == True{} : Bool}

# Um "ou" com True à direita é True.
law or_true:
  for b: Bool
  {Bool.or(b, True{}) == True{} : Bool}

# Um achado já feito é mantido até o fim da varredura.
law walk_kept:
  for pages: List<&2, F.PageHits>
  for facts: List<&2, Bool>
  for p: Nat
  {F.walkFound(pages, facts, Some{p}) == Some{p} : Maybe<Nat>}

# O "ou" da cabeça: a página da entrada h também conta para a lista.
law maybeIn_cons:
  for m: Maybe<Nat>
  for h: F.PageHits
  for t: List<&2, F.PageHits>
  {maybeIn(m, Con{h, t}) == Bool.or(maybeIn(m, t), hitsHead(m, h)) : Bool}

# A varredura só devolve páginas da lista (indução em pages/facts).
law found_in_list:
  for +pages: List<&2, F.PageHits>
  for +facts: List<&2, Bool>
  {maybeIn(F.walkFound(pages, facts, None{}), pages) == True{} : Bool}

# Primeira página da lista está na lista.
law firstHit_in_list:
  for +pages: List<&2, F.PageHits>
  {maybeIn(F.firstHit(pages), pages) == True{} : Bool}

# O fecho da varredura também só devolve página da lista.
law finishWalk_in_list:
  for pages: List<&2, F.PageHits>
  for found: Maybe<Nat>
  for first: Maybe<Nat>
  for hf: {maybeIn(found, pages) == True{} : Bool}
  for h1: {maybeIn(first, pages) == True{} : Bool}
  {maybeIn(F.finishWalk(found, first), pages) == True{} : Bool}

# LAW: o alvo do ciclo, quando existe, é uma página que está na lista.
law next_in_list:
  for +pages: List<&2, F.PageHits>
  for +current: Nat
  {maybeIn(F.nextHit(pages, current), pages) == True{} : Bool}

# Se o primeiro fato é True, o alvo é a primeira página.
law next_true_head:
  for +page: Nat
  for count: Nat
  for +t: List<&2, F.PageHits>
  for +fs: List<&2, Bool>
  {F.nextHitFacts(Con{F.PageHits{page, count}, t}, Con{True{}, fs}) == Some{page} : Maybe<Nat>}

# Há página > atual depois de uma que não passa: o alvo é a primeira delas.
law next_true_second:
  for p0: Nat
  for c0: Nat
  for +p1: Nat
  for c1: Nat
  for +t: List<&2, F.PageHits>
  for +fs: List<&2, Bool>
  {F.nextHitFacts(Con{F.PageHits{p0, c0}, Con{F.PageHits{p1, c1}, t}}, Con{False{}, Con{True{}, fs}}) == Some{p1} : Maybe<Nat>}

# Um passo de fato False não muda a varredura.
law walk_false_cons:
  for page: Nat
  for count: Nat
  for t: List<&2, F.PageHits>
  for fs: List<&2, Bool>
  {F.walkFound(Con{F.PageHits{page, count}, t}, Con{False{}, fs}, None{}) == F.walkFound(t, fs, None{}) : Maybe<Nat>}

# Lista sem nenhum fato verdadeiro não acha nada.
law walk_all_false:
  for pages: List<&2, F.PageHits>
  {F.walkFound(pages, allFalse(pages), None{}) == None{} : Maybe<Nat>}

# LAW: lista não vazia e nenhuma página > atual → o alvo é a primeira página.
law next_fallback:
  for page: Nat
  for count: Nat
  for +t: List<&2, F.PageHits>
  {F.nextHitFacts(Con{F.PageHits{page, count}, t}, allFalse(Con{F.PageHits{page, count}, t})) == Some{page} : Maybe<Nat>}

# O que o despacho do alvo faz: termo novo vs mesmo termo.
law cycle_new:
  for pages: List<&2, F.PageHits>
  for current: Nat
  {F.cycleTarget(False{}, pages, current) == F.firstHit(pages) : Maybe<Nat>}

law cycle_same:
  for pages: List<&2, F.PageHits>
  for current: Nat
  {F.cycleTarget(True{}, pages, current) == F.nextHit(pages, current) : Maybe<Nat>}

# ---------------------------------------------------------------------------
# Leis do contador
# ---------------------------------------------------------------------------

# Sem páginas com ocorrências o contador some.
law hidden_empty:
  for current: Nat
  {F.findCount(Nil{}, current) == F.Hidden{} : F.FindCount}

# Um achado manda: achada a página, o índice é antes+1 sobre o total.
law count_got_absorb:
  for pages: List<&2, F.PageHits>
  for facts: List<&2, Bool>
  for total: Nat
  for before: Nat
  {F.countFacts(pages, facts, total, F.Got{before}) == F.Shown{Nat.add(before, 1n), total} : F.FindCount}

# Nenhum fato verdadeiro: o contador só conta o total.
law count_all_false:
  for pages: List<&2, F.PageHits>
  for total: Nat
  for before: Nat
  {F.countFacts(pages, allFalse(pages), total, F.Looking{before}) == F.All{total} : F.FindCount}

# Com o primeiro fato True, o achado é na primeira página: índice antes+1.
law count_true_head:
  for page: Nat
  for count: Nat
  for t: List<&2, F.PageHits>
  for fs: List<&2, Bool>
  for total: Nat
  for before: Nat
  {F.countFacts(Con{F.PageHits{page, count}, t}, Con{True{}, fs}, total, F.Looking{before}) == F.Shown{Nat.add(before, 1n), total} : F.FindCount}

# Página fora da lista (concreta): o contador mostra o total.
law count_miss_concrete:
  {F.findCount([F.PageHits{2n, 3n}, F.PageHits{5n, 1n}], 1n) == F.All{4n} : F.FindCount}

# Página fora da lista (estrutural): a única entrada é a página 1+.
# O lado direito usa `totalHits` da própria lista porque `Nat.add(count, 0n)`
# não reduz com count simbólico (é o termo que o contador realmente devolve).
law count_miss_succ_head:
  for extra: Nat
  for count: Nat
  {F.findCount([F.PageHits{1n+extra, count}], 0n) == F.All{F.totalHits([F.PageHits{1n+extra, count}])} : F.FindCount}

# Página fora da lista (estrutural): a única entrada é a página 0.
law count_miss_zero_head:
  for q: Nat
  for count: Nat
  {F.findCount([F.PageHits{0n, count}], 1n+q) == F.All{F.totalHits([F.PageHits{0n, count}])} : F.FindCount}

# Motivo do ramo impossível de noTrue (um fato True contradiz noTrue).
# Com b=True o motivo é o goal do contador já com o achado; com b=False é Unit.
def noTrueMotive(pages: List<&2, F.PageHits>, facts: List<&2, Bool>, total: Nat, before: Nat, b: Bool) -> Type:
  match b:
    case True{}:
      {F.countFacts(pages, facts, total, F.Got{before}) == F.All{total} : F.FindCount}
    case False{}:
      Unit

# LAW: página fora da lista (nenhum fato verdadeiro) → o contador mostra o total.
law countFacts_miss:
  for +pages: List<&2, F.PageHits>
  for +facts: List<&2, Bool>
  for total: Nat
  for before: Nat
  for ef: {noTrue(facts) == True{} : Bool}
  {F.countFacts(pages, facts, total, F.Looking{before}) == F.All{total} : F.FindCount}

# Um passo de contador com a página atual fora: só soma o "antes".
law count_skip_head:
  for page: Nat
  for count: Nat
  for t: List<&2, F.PageHits>
  for current: Nat
  for ef: {Nat.is_eq(page, current) == False{} : Bool}
  {F.findCount(Con{F.PageHits{page, count}, t}, current) == F.countFacts(t, F.sameFacts(t, current), F.totalHits(Con{F.PageHits{page, count}, t}), F.Looking{count}) : F.FindCount}

# Página atual na primeira entrada: índice 1 sobre o total.
law count_first_hit:
  for +page: Nat
  for count: Nat
  for +t: List<&2, F.PageHits>
  {F.findCount(Con{F.PageHits{page, count}, t}, page) == F.Shown{1n, Nat.add(count, F.totalHits(t))} : F.FindCount}

# Página atual na segunda entrada: o "antes" soma as ocorrências da primeira.
law count_second_hit:
  for +q: Nat
  for +c0: Nat
  for +extra: Nat
  for +t: List<&2, F.PageHits>
  {F.findCount(Con{F.PageHits{0n, c0}, Con{F.PageHits{1n+q, 1n+extra}, t}}, 1n+q)
    == F.Shown{Nat.add(c0, 1n), Nat.add(c0, Nat.add(Nat.add(1n, extra), F.totalHits(t)))} : F.FindCount}

# ---------------------------------------------------------------------------
# Leis da contagem (índice e total)
# ---------------------------------------------------------------------------

# a ≤ b é preservado somando o mesmo dos dois lados.
law le_add_same_left:
  for a: Nat
  for b: Nat
  for c: Nat
  for e: {Le(b, c) : Type}
  {Le(Nat.add(a, b), Nat.add(a, c)) : Type}

# 1 ≤ 1+extra+after: o achado cabe no total.
law le_one_add:
  for extra: Nat
  for after: Nat
  {Le(1n, Nat.add(Nat.add(1n, extra), after)) : Type}

# 1 ≤ índice.
law got_lower:
  for before: Nat
  {Le(1n, Nat.add(before, 1n)) : Type}

# índice ≤ total (com o total escrito como antes + esta página + resto).
law got_upper:
  for before: Nat
  for +extra: Nat
  for +after: Nat
  {Le(Nat.add(before, 1n), Nat.add(before, Nat.add(Nat.add(1n, extra), after))) : Type}

# LAW: com ocorrências e página atual na lista, 1 ≤ índice ≤ total.
# Caso do achado na segunda página (o "antes" já soma a primeira).
law count_second_hit_bounds:
  for q: Nat
  for +c0: Nat
  for extra: Nat
  for t: List<&2, F.PageHits>
  {Le(1n, Nat.add(c0, 1n)) & Le(Nat.add(c0, 1n), Nat.add(c0, Nat.add(Nat.add(1n, extra), F.totalHits(t)))) : Type}
