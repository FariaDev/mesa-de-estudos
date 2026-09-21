import Base
import ../laws/library.bend as Laws
import ../library.bend as L

# ---------------------------------------------------------------------------
# Provas das leis do núcleo da biblioteca.
# ---------------------------------------------------------------------------

# ---------- cenários de escolha ----------

def Laws.cena_limites_formulario():
  {==}

def Laws.cena_sobras():
  {==}

def Laws.cena_sem_livre():
  {==}

def Laws.cena_um_painel():
  {==}

def Laws.cena_evita_outro():
  {==}

# ---------- deslocamentos: índice Succ na cabeça é o índice na cauda ----------

def livreAt.shift(u: Bool, ut: List<&2, Bool>, m: Maybe<&2, Nat>) ->
  {Laws.livreAt(ut, m) == Laws.livreAt(Con{u, ut}, L.bump(m)) : Bool}:
  match m:
    case None{}:
      {==}
    case Some{i}:
      {==}

def inRangeAt.shift(u: Bool, ut: List<&2, Bool>, m: Maybe<&2, Nat>) ->
  {Laws.inRangeAt(ut, m) == Laws.inRangeAt(Con{u, ut}, L.bump(m)) : Bool}:
  match m:
    case None{}:
      {==}
    case Some{i}:
      {==}

def preferCase.shift(x: L.Match, u: Bool, t: List<&2, L.Match>, ut: List<&2, Bool>, m: Maybe<&2, Nat>) ->
  {Laws.preferCase(t, ut, m) == Laws.preferCase(Con{x, t}, Con{u, ut}, L.bump(m)) : Bool}:
  match m:
    case None{}:
      {==}
    case Some{i}:
      {==}

def outrosCase.shift(x: L.Match, u: Bool, t: List<&2, L.Match>, ut: List<&2, Bool>, m: Maybe<&2, Nat>) ->
  {Laws.outrosCase(t, ut, m) == Laws.outrosCase(Con{x, t}, Con{u, ut}, L.bump(m)) : Bool}:
  match m:
    case None{}:
      {==}
    case Some{i}:
      {==}

# ---------- busca do prefer ----------

def Laws.busca_prefer_livre(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match x:
        case L.Match{s, o}:
          match s:
            case True{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %livreAt.shift(u, ut, L.pickSelf(t, ut)) : {_ == True{} : Bool}
                      %Laws.busca_prefer_livre(t, ut) : {Laws.livreAt(ut, L.pickSelf(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      {==}
            case False{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  %livreAt.shift(u, ut, L.pickSelf(t, ut)) : {_ == True{} : Bool}
                  %Laws.busca_prefer_livre(t, ut) : {Laws.livreAt(ut, L.pickSelf(t, ut)) == _ : Bool}
                  {==}

def Laws.busca_prefer_alcance(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match x:
        case L.Match{s, o}:
          match s:
            case True{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %inRangeAt.shift(u, ut, L.pickSelf(t, ut)) : {_ == True{} : Bool}
                      %Laws.busca_prefer_alcance(t, ut) : {Laws.inRangeAt(ut, L.pickSelf(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      {==}
            case False{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  %inRangeAt.shift(u, ut, L.pickSelf(t, ut)) : {_ == True{} : Bool}
                  %Laws.busca_prefer_alcance(t, ut) : {Laws.inRangeAt(ut, L.pickSelf(t, ut)) == _ : Bool}
                  {==}

def Laws.busca_prefer_casa(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match x:
        case L.Match{s, o}:
          match s:
            case True{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %preferCase.shift(x, u, t, ut, L.pickSelf(t, ut)) : {_ == True{} : Bool}
                      %Laws.busca_prefer_casa(t, ut) : {Laws.preferCase(t, ut, L.pickSelf(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      {==}
            case False{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  %preferCase.shift(x, u, t, ut, L.pickSelf(t, ut)) : {_ == True{} : Bool}
                  %Laws.busca_prefer_casa(t, ut) : {Laws.preferCase(t, ut, L.pickSelf(t, ut)) == _ : Bool}
                  {==}

# ---------- busca dos outros ----------

def Laws.busca_outros_livre(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match x:
        case L.Match{s, o}:
          match o:
            case False{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %livreAt.shift(u, ut, L.pickOther(t, ut)) : {_ == True{} : Bool}
                      %Laws.busca_outros_livre(t, ut) : {Laws.livreAt(ut, L.pickOther(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      {==}
            case True{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  %livreAt.shift(u, ut, L.pickOther(t, ut)) : {_ == True{} : Bool}
                  %Laws.busca_outros_livre(t, ut) : {Laws.livreAt(ut, L.pickOther(t, ut)) == _ : Bool}
                  {==}

def Laws.busca_outros_alcance(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match x:
        case L.Match{s, o}:
          match o:
            case False{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %inRangeAt.shift(u, ut, L.pickOther(t, ut)) : {_ == True{} : Bool}
                      %Laws.busca_outros_alcance(t, ut) : {Laws.inRangeAt(ut, L.pickOther(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      {==}
            case True{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  %inRangeAt.shift(u, ut, L.pickOther(t, ut)) : {_ == True{} : Bool}
                  %Laws.busca_outros_alcance(t, ut) : {Laws.inRangeAt(ut, L.pickOther(t, ut)) == _ : Bool}
                  {==}

def Laws.busca_outros_casa(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match x:
        case L.Match{s, o}:
          match o:
            case False{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %outrosCase.shift(x, u, t, ut, L.pickOther(t, ut)) : {_ == True{} : Bool}
                      %Laws.busca_outros_casa(t, ut) : {Laws.outrosCase(t, ut, L.pickOther(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      {==}
            case True{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  %outrosCase.shift(x, u, t, ut, L.pickOther(t, ut)) : {_ == True{} : Bool}
                  %Laws.busca_outros_casa(t, ut) : {Laws.outrosCase(t, ut, L.pickOther(t, ut)) == _ : Bool}
                  {==}

# ---------- escolha livre ----------

def Laws.busca_livre_livre(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match used:
        case Nil{}:
          {==}
        case Con{u, ut}:
          match u:
            case True{}:
              %livreAt.shift(u, ut, L.pickFree(t, ut)) : {_ == True{} : Bool}
              %Laws.busca_livre_livre(t, ut) : {Laws.livreAt(ut, L.pickFree(t, ut)) == _ : Bool}
              {==}
            case False{}:
              {==}

def Laws.busca_livre_alcance(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match used:
        case Nil{}:
          {==}
        case Con{u, ut}:
          match u:
            case True{}:
              %inRangeAt.shift(u, ut, L.pickFree(t, ut)) : {_ == True{} : Bool}
              %Laws.busca_livre_alcance(t, ut) : {Laws.inRangeAt(ut, L.pickFree(t, ut)) == _ : Bool}
              {==}
            case False{}:
              {==}

# ---------- vazio: a busca só devolve None quando não havia candidato ----------

def preferVazio.shift(
  x: L.Match, u: Bool, t: List<&2, L.Match>, ut: List<&2, Bool>, m: Maybe<&2, Nat>,
  h: {False{} == Bool.and(Bool.not(u), L.selfOf(x)) : Bool}
) -> {Laws.preferVazio(t, ut, m) == Laws.preferVazio(Con{x, t}, Con{u, ut}, L.bump(m)) : Bool}:
  match m:
    case None{}:
      %h : {Bool.not(L.hasFreeSelf(t, ut)) == Bool.not(Bool.or(_, L.hasFreeSelf(t, ut))) : Bool}
      {==}
    case Some{i}:
      {==}

def outrosVazio.shift(
  x: L.Match, u: Bool, t: List<&2, L.Match>, ut: List<&2, Bool>, m: Maybe<&2, Nat>,
  h: {False{} == Bool.and(Bool.not(u), Bool.not(L.otherOf(x))) : Bool}
) -> {Laws.outrosVazio(t, ut, m) == Laws.outrosVazio(Con{x, t}, Con{u, ut}, L.bump(m)) : Bool}:
  match m:
    case None{}:
      %h : {Bool.not(L.hasFreeOther(t, ut)) == Bool.not(Bool.or(_, L.hasFreeOther(t, ut))) : Bool}
      {==}
    case Some{i}:
      {==}

def livreVazio.shift(
  x: L.Match, u: Bool, t: List<&2, L.Match>, ut: List<&2, Bool>, m: Maybe<&2, Nat>,
  h: {False{} == Bool.not(u) : Bool}
) -> {Laws.livreVazio(t, ut, m) == Laws.livreVazio(Con{x, t}, Con{u, ut}, L.bump(m)) : Bool}:
  match m:
    case None{}:
      %h : {Bool.not(L.hasFree(t, ut)) == Bool.not(Bool.or(_, L.hasFree(t, ut))) : Bool}
      {==}
    case Some{i}:
      {==}

def Laws.busca_prefer_vazio(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match x:
        case L.Match{s, o}:
          match s:
            case True{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %preferVazio.shift(x, u, t, ut, L.pickSelf(t, ut), ({==} : {False{} == Bool.and(Bool.not(u), L.selfOf(x)) : Bool})) : {_ == True{} : Bool}
                      %Laws.busca_prefer_vazio(t, ut) : {Laws.preferVazio(t, ut, L.pickSelf(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      {==}
            case False{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %preferVazio.shift(x, u, t, ut, L.pickSelf(t, ut), ({==} : {False{} == Bool.and(Bool.not(u), L.selfOf(x)) : Bool})) : {_ == True{} : Bool}
                      %Laws.busca_prefer_vazio(t, ut) : {Laws.preferVazio(t, ut, L.pickSelf(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      %preferVazio.shift(x, u, t, ut, L.pickSelf(t, ut), ({==} : {False{} == Bool.and(Bool.not(u), L.selfOf(x)) : Bool})) : {_ == True{} : Bool}
                      %Laws.busca_prefer_vazio(t, ut) : {Laws.preferVazio(t, ut, L.pickSelf(t, ut)) == _ : Bool}
                      {==}

def Laws.busca_outros_vazio(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match x:
        case L.Match{s, o}:
          match o:
            case False{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %outrosVazio.shift(x, u, t, ut, L.pickOther(t, ut), ({==} : {False{} == Bool.and(Bool.not(u), Bool.not(L.otherOf(x))) : Bool})) : {_ == True{} : Bool}
                      %Laws.busca_outros_vazio(t, ut) : {Laws.outrosVazio(t, ut, L.pickOther(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      {==}
            case True{}:
              match used:
                case Nil{}:
                  {==}
                case Con{u, ut}:
                  match u:
                    case True{}:
                      %outrosVazio.shift(x, u, t, ut, L.pickOther(t, ut), ({==} : {False{} == Bool.and(Bool.not(u), Bool.not(L.otherOf(x))) : Bool})) : {_ == True{} : Bool}
                      %Laws.busca_outros_vazio(t, ut) : {Laws.outrosVazio(t, ut, L.pickOther(t, ut)) == _ : Bool}
                      {==}
                    case False{}:
                      %outrosVazio.shift(x, u, t, ut, L.pickOther(t, ut), ({==} : {False{} == Bool.and(Bool.not(u), Bool.not(L.otherOf(x))) : Bool})) : {_ == True{} : Bool}
                      %Laws.busca_outros_vazio(t, ut) : {Laws.outrosVazio(t, ut, L.pickOther(t, ut)) == _ : Bool}
                      {==}

def Laws.busca_livre_vazio(xs, used):
  match xs:
    case Nil{}:
      {==}
    case Con{x, t}:
      match used:
        case Nil{}:
          {==}
        case Con{u, ut}:
          match u:
            case True{}:
              %livreVazio.shift(x, u, t, ut, L.pickFree(t, ut), ({==} : {False{} == Bool.not(u) : Bool})) : {_ == True{} : Bool}
              %Laws.busca_livre_vazio(t, ut) : {Laws.livreVazio(t, ut, L.pickFree(t, ut)) == _ : Bool}
              {==}
            case False{}:
              {==}


# ---------- passo: composição ----------

def or_true(b: Bool) -> {Bool.or(b, True{}) == True{} : Bool}:
  match b:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.escolha_prefer(xs, used, self, other, free, hs, hc):
  match self:
    case Some{i}:
      %Equal.sym(Bool, L.selfAt(xs, i), True{}, hs) : {Bool.or(Bool.not(L.hasFreeSelf(xs, used)), _) == True{} : Bool}
      or_true(Bool.not(L.hasFreeSelf(xs, used)))
    case None{}:
      %Equal.sym(Bool, Bool.not(L.hasFreeSelf(xs, used)), True{}, hc) : {Bool.or(_, Laws.casaEscolha.after(other, free, xs)) == True{} : Bool}
      {==}

def Laws.passo_prefer(xs, used):
  Laws.escolha_prefer(
    xs, used,
    L.pickSelf(xs, used), L.pickOther(xs, used), L.pickFree(xs, used),
    Laws.busca_prefer_casa(xs, used), Laws.busca_prefer_vazio(xs, used)
  )

def Laws.escolha_livre(used, self, other, free, hs, ho, hf):
  match self:
    case Some{i}:
      hs
    case None{}:
      match other:
        case Some{j}:
          ho
        case None{}:
          match free:
            case Some{k}:
              hf
            case None{}:
              {==}

def Laws.passo_livre(xs, used):
  Laws.escolha_livre(
    used,
    L.pickSelf(xs, used), L.pickOther(xs, used), L.pickFree(xs, used),
    Laws.busca_prefer_livre(xs, used), Laws.busca_outros_livre(xs, used), Laws.busca_livre_livre(xs, used)
  )

def Laws.escolha_alcance(used, self, other, free, hs, ho, hf):
  match self:
    case Some{i}:
      hs
    case None{}:
      match other:
        case Some{j}:
          ho
        case None{}:
          match free:
            case Some{k}:
              hf
            case None{}:
              {==}

def Laws.marca_posicao(used, i, h):
  match used i:
    case Nil{} _:
      h
    case Con{u, t} 0n:
      {==}
    case Con{u, t} 1n+p:
      Laws.marca_posicao(t, p, h)

def Laws.passo_marca_cond(used, at, h):
  match at:
    case None{}:
      {==}
    case Some{i}:
      Laws.marca_posicao(used, i, h)

def Laws.passo_marca(xs, used):
  Laws.passo_marca_cond(
    used,
    L.pickStep.choice(L.pickSelf(xs, used), L.pickOther(xs, used), L.pickFree(xs, used)),
    Laws.escolha_alcance(
      used,
      L.pickSelf(xs, used), L.pickOther(xs, used), L.pickFree(xs, used),
      Laws.busca_prefer_alcance(xs, used), Laws.busca_outros_alcance(xs, used), Laws.busca_livre_alcance(xs, used)
    )
  )

# ---------- índices distintos (transporte pela máscara) ----------

def disc(b: Bool) -> Type:
  match b:
    case True{}:
      Empty
    case False{}:
      Unit

def false_absurd(e: {True{} == False{} : Bool}) -> Empty:
  %Equal.sym(Bool, True{}, False{}, e) : {disc(_) : Type}
  Unit{}

def usedAt.cong(used: List<&2, Bool>, i: Nat, j: Nat, p: {i == j : Nat}) ->
  {L.usedAt(used, i) == L.usedAt(used, j) : Bool}:
  %p : {L.usedAt(used, i) == L.usedAt(used, _) : Bool}
  {==}

def not.false(b: Bool, h: {Bool.not(b) == True{} : Bool}) -> {b == False{} : Bool}:
  match b:
    case True{}:
      Equal.sym(Bool, False{}, True{}, h)
    case False{}:
      {==}

def Laws.indices_distintos(i, j, used, hi, hj):
  p =>
    false_absurd(
      Equal.trans(
        Bool, True{}, L.usedAt(used, j), False{},
        Equal.sym(
          Bool, L.usedAt(used, j), True{},
          Equal.trans(
            Bool, L.usedAt(used, j), L.usedAt(used, i), True{},
            Equal.sym(Bool, L.usedAt(used, i), L.usedAt(used, j), usedAt.cong(used, i, j, p)),
            hi
          )
        ),
        not.false(L.usedAt(used, j), hj)
      )
    )

