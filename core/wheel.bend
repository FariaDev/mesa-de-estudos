import Base

# Resultado de uma roda do trackpad.
type Turn is Data:
  Stay{}
  Next{}
  Prev{}

type Spin is Data:
  Spin{accum: F32, turn: Turn}

# Tabela de decisão pura: o host entrega os fatos (bloqueio de cooldown,
# limites da página, direção da roda, limiar) já resolvidos; o núcleo decide.
# Nada aqui compara valores livres — por isso cada regra é provável.
# Helpers primeiro: Bend não tem referência para frente.

def pageTurn.under(under: Bool, next: F32) -> Spin:
  match under:
    case True{}:
      Spin{0.0, Prev{}}
    case False{}:
      Spin{next, Stay{}}

def pageTurn.turn(over: Bool, under: Bool, next: F32) -> Spin:
  match over:
    case True{}:
      Spin{0.0, Next{}}
    case False{}:
      pageTurn.under(under, next)

def pageTurn.dir(
  towardNext: Bool, towardPrev: Bool, over: Bool, under: Bool,
  accum: F32, next: F32
) -> Spin:
  match towardNext:
    case True{}:
      pageTurn.turn(over, under, next)
    case False{}:
      match towardPrev:
        case True{}:
          pageTurn.turn(over, under, next)
        case False{}:
          Spin{accum, Stay{}}

def pageTurn.edge(
  towardNext: Bool, towardPrev: Bool,
  atTop: Bool, atBottom: Bool, over: Bool, under: Bool,
  accum: F32, next: F32
) -> Spin:
  match towardNext:
    case True{}:
      match atBottom:
        case True{}:
          pageTurn.dir(towardNext, towardPrev, over, under, accum, next)
        case False{}:
          Spin{0.0, Stay{}}
    case False{}:
      match towardPrev:
        case True{}:
          match atTop:
            case True{}:
              pageTurn.dir(towardNext, towardPrev, over, under, accum, next)
            case False{}:
              Spin{0.0, Stay{}}
        case False{}:
          pageTurn.dir(towardNext, towardPrev, over, under, accum, next)

def pageTurn.open(
  fits: Bool, towardNext: Bool, towardPrev: Bool,
  atTop: Bool, atBottom: Bool, over: Bool, under: Bool,
  accum: F32, next: F32
) -> Spin:
  match fits:
    case True{}:
      pageTurn.dir(towardNext, towardPrev, over, under, accum, next)
    case False{}:
      pageTurn.edge(towardNext, towardPrev, atTop, atBottom, over, under, accum, next)

def pageTurn(
  blocked: Bool, fits: Bool, towardNext: Bool, towardPrev: Bool,
  atTop: Bool, atBottom: Bool, over: Bool, under: Bool,
  accum: F32, next: F32
) -> Spin:
  match blocked:
    case True{}:
      Spin{0.0, Stay{}}
    case False{}:
      pageTurn.open(fits, towardNext, towardPrev, atTop, atBottom, over, under, accum, next)
