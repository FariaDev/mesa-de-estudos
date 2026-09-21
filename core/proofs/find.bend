import Base
import ../laws/find.bend as Laws
import ../find.bend as F

# Provas das leis do contador/ciclo. Aceitador: `bend proofs/find.bend` deve
# imprimir "All terms check.". Cada reescrita usa `Equal.sym` para levar a
# equação na direção que o `%` espera (buraco onde b aparece).

# ---------------------------------------------------------------------------
# Ciclo
# ---------------------------------------------------------------------------

def Laws.is_eq_self(x):
  match x:
    case 0n:
      {==}
    case 1n+p:
      Laws.is_eq_self(p)

def Laws.or_true(b):
  match b:
    case False{}:
      {==}
    case True{}:
      {==}

def Laws.walk_kept(pages, facts, p):
  match pages facts:
    case Nil{} _:
      {==}
    case Con{h, t} Nil{}:
      {==}
    case Con{h, t} Con{f, fs}:
      Laws.walk_kept(t, fs, p)

def Laws.maybeIn_cons(m, h, t):
  match m h:
    case None{} _:
      {==}
    case Some{p} F.PageHits{page, count}:
      {==}

def Laws.found_in_list(pages, facts):
  match pages facts:
    case Nil{} _:
      {==}
    case Con{F.PageHits{page, count}, t} Nil{}:
      {==}
    case Con{F.PageHits{page, count}, t} Con{True{}, fs}:
      %Equal.sym(Maybe<Nat>, F.walkFound(t, fs, Some{page}), Some{page}, Laws.walk_kept(t, fs, page)) : {Laws.maybeIn(_, Con{F.PageHits{page, count}, t}) == True{} : Bool}
      %Equal.sym(Bool, Nat.is_eq(page, page), True{}, Laws.is_eq_self(page)) : {Bool.or(Laws.hasPage(t, page), _) == True{} : Bool}
      %Equal.sym(Bool, Bool.or(Laws.hasPage(t, page), True{}), True{}, Laws.or_true(Laws.hasPage(t, page))) : {_ == True{} : Bool}
      {==}
    case Con{F.PageHits{page, count}, t} Con{False{}, fs}:
      %Equal.sym(Bool, Laws.maybeIn(F.walkFound(t, fs, None{}), Con{F.PageHits{page, count}, t}), Bool.or(Laws.maybeIn(F.walkFound(t, fs, None{}), t), Laws.hitsHead(F.walkFound(t, fs, None{}), F.PageHits{page, count})), Laws.maybeIn_cons(F.walkFound(t, fs, None{}), F.PageHits{page, count}, t)) : {_ == True{} : Bool}
      %Equal.sym(Bool, Laws.maybeIn(F.walkFound(t, fs, None{}), t), True{}, Laws.found_in_list(t, fs)) : {Bool.or(_, Laws.hitsHead(F.walkFound(t, fs, None{}), F.PageHits{page, count})) == True{} : Bool}
      {==}

def Laws.firstHit_in_list(pages):
  match pages:
    case Nil{}:
      {==}
    case Con{F.PageHits{page, count}, t}:
      %Equal.sym(Bool, Nat.is_eq(page, page), True{}, Laws.is_eq_self(page)) : {Bool.or(Laws.hasPage(t, page), _) == True{} : Bool}
      %Equal.sym(Bool, Bool.or(Laws.hasPage(t, page), True{}), True{}, Laws.or_true(Laws.hasPage(t, page))) : {_ == True{} : Bool}
      {==}

def Laws.finishWalk_in_list(pages, found, first, hf, h1):
  match found:
    case Some{p}:
      hf
    case None{}:
      match first:
        case None{}:
          {==}
        case Some{q}:
          h1

def Laws.next_in_list(pages, current):
  Laws.finishWalk_in_list(
    pages,
    F.walkFound(pages, F.afterFacts(pages, current), None{}),
    F.firstHit(pages),
    Laws.found_in_list(pages, F.afterFacts(pages, current)),
    Laws.firstHit_in_list(pages)
  )

def Laws.next_true_head(page, count, t, fs):
  %Equal.sym(Maybe<Nat>, F.walkFound(t, fs, Some{page}), Some{page}, Laws.walk_kept(t, fs, page)) : {F.finishWalk(_, Some{page}) == Some{page} : Maybe<Nat>}
  {==}

def Laws.next_true_second(p0, c0, p1, c1, t, fs):
  %Equal.sym(Maybe<Nat>, F.walkFound(t, fs, Some{p1}), Some{p1}, Laws.walk_kept(t, fs, p1)) : {F.finishWalk(_, Some{p0}) == Some{p1} : Maybe<Nat>}
  {==}

def Laws.walk_false_cons(page, count, t, fs):
  {==}

def Laws.walk_all_false(pages):
  match pages:
    case Nil{}:
      {==}
    case Con{F.PageHits{page, count}, t}:
      Laws.walk_all_false(t)

def Laws.next_fallback(page, count, t):
  %Equal.sym(Maybe<Nat>, F.walkFound(t, Laws.allFalse(t), None{}), None{}, Laws.walk_all_false(t)) : {F.finishWalk(_, Some{page}) == Some{page} : Maybe<Nat>}
  {==}

def Laws.cycle_new(pages, current):
  {==}

def Laws.cycle_same(pages, current):
  {==}

# ---------------------------------------------------------------------------
# Contador
# ---------------------------------------------------------------------------

def Laws.hidden_empty(current):
  {==}

def Laws.count_got_absorb(pages, facts, total, before):
  match pages facts:
    case Nil{} _:
      {==}
    case Con{h, t} Nil{}:
      {==}
    case Con{h, t} Con{f, fs}:
      Laws.count_got_absorb(t, fs, total, before)

def Laws.count_all_false(pages, total, before):
  match pages:
    case Nil{}:
      {==}
    case Con{F.PageHits{page, count}, t}:
      Laws.count_all_false(t, total, Nat.add(before, count))

def Laws.count_true_head(page, count, t, fs, total, before):
  Laws.count_got_absorb(t, fs, total, before)

def Laws.count_skip_head(page, count, t, current, ef):
  %Equal.sym(Bool, Nat.is_eq(page, current), False{}, ef) : {F.countFacts(t, F.sameFacts(t, current), F.totalHits(Con{F.PageHits{page, count}, t}), F.scanStep.look(0n, count, _)) == F.countFacts(t, F.sameFacts(t, current), F.totalHits(Con{F.PageHits{page, count}, t}), F.Looking{count}) : F.FindCount}
  {==}

def Laws.count_first_hit(page, count, t):
  %Equal.sym(Bool, Nat.is_eq(page, page), True{}, Laws.is_eq_self(page)) : {F.countFacts(t, F.sameFacts(t, page), Nat.add(count, F.totalHits(t)), F.scanStep.look(0n, count, _)) == F.Shown{1n, Nat.add(count, F.totalHits(t))} : F.FindCount}
  Laws.count_got_absorb(t, F.sameFacts(t, page), Nat.add(count, F.totalHits(t)), 0n)

def Laws.count_second_hit(q, c0, extra, t):
  %Equal.sym(Bool, Nat.is_eq(1n+q, 1n+q), True{}, Laws.is_eq_self(1n+q)) : {F.countFacts(t, F.sameFacts(t, 1n+q), Nat.add(c0, Nat.add(Nat.add(1n, extra), F.totalHits(t))), F.scanStep.look(c0, Nat.add(1n, extra), _)) == F.Shown{Nat.add(c0, 1n), Nat.add(c0, Nat.add(Nat.add(1n, extra), F.totalHits(t)))} : F.FindCount}
  Laws.count_got_absorb(t, F.sameFacts(t, 1n+q), Nat.add(c0, Nat.add(Nat.add(1n, extra), F.totalHits(t))), c0)

def Laws.count_miss_concrete():
  {==}

def Laws.count_miss_succ_head(extra, count):
  {==}

def Laws.count_miss_zero_head(q, count):
  {==}

def Laws.countFacts_miss(pages, facts, total, before, ef):
  match pages facts:
    case Nil{} _:
      {==}
    case Con{h, t} Nil{}:
      {==}
    case Con{h, t} Con{False{}, fs}:
      Laws.countFacts_miss(t, fs, total, Nat.add(before, F.countOf(h)), ef)
    case Con{h, t} Con{True{}, fs}:
      %ef : {Laws.noTrueMotive(t, fs, total, before, _) : Type}
      Unit{}

# ---------------------------------------------------------------------------
# Contagem (índice e total)
# ---------------------------------------------------------------------------

def Laws.le_add_same_left(a, b, c, e):
  match a:
    case 0n:
      e
    case 1n+p:
      Laws.le_add_same_left(p, b, c, e)

def Laws.le_one_add(extra, after):
  Unit{}

def Laws.got_lower(before):
  match before:
    case 0n:
      Unit{}
    case 1n+p:
      Unit{}

def Laws.got_upper(before, extra, after):
  Laws.le_add_same_left(before, 1n, Nat.add(Nat.add(1n, extra), after), Laws.le_one_add(extra, after))

def Laws.count_second_hit_bounds(q, c0, extra, t):
  (Laws.got_lower(c0), Laws.got_upper(c0, extra, F.totalHits(t)))
