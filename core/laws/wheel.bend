import Base
import ../wheel.bend as W

# LAW: durante o cooldown nenhuma roda vira página e o acumulado zera,
# aconteça o que acontecer com os outros fatos.
law blocked_stays:
  for fits: Bool
  for towardNext: Bool
  for towardPrev: Bool
  for atTop: Bool
  for atBottom: Bool
  for over: Bool
  for under: Bool
  for accum: F32
  for next: F32
  {W.pageTurn(True{}, fits, towardNext, towardPrev, atTop, atBottom, over, under, accum, next) == W.Spin{0.0, W.Stay{}} : W.Spin}

# LAW: fora do limite (rolando para o próximo sem estar no fim) a roda é
# absorvida e o acumulado zera.
law away_stays:
  for towardPrev: Bool
  for atTop: Bool
  for over: Bool
  for under: Bool
  for accum: F32
  for next: F32
  {W.pageTurn(False{}, False{}, True{}, towardPrev, atTop, False{}, over, under, accum, next) == W.Spin{0.0, W.Stay{}} : W.Spin}

# LAW: idem para cima — rolando para o anterior longe do topo, nada vira.
law away_stays_prev:
  for atBottom: Bool
  for over: Bool
  for under: Bool
  for accum: F32
  for next: F32
  {W.pageTurn(False{}, False{}, False{}, True{}, False{}, atBottom, over, under, accum, next) == W.Spin{0.0, W.Stay{}} : W.Spin}

# LAW: roda sem direção (delta zero) mantém o acumulado.
law zero_keeps:
  for over: Bool
  for under: Bool
  for accum: F32
  for next: F32
  {W.pageTurn(False{}, True{}, False{}, False{}, False{}, False{}, over, under, accum, next) == W.Spin{accum, W.Stay{}} : W.Spin}

# LAW: chegou ao limiar, vira para o próximo e zera o acumulado.
law over_turns_next:
  for atTop: Bool
  for atBottom: Bool
  for accum: F32
  for next: F32
  {W.pageTurn(False{}, True{}, True{}, False{}, atTop, atBottom, True{}, False{}, accum, next) == W.Spin{0.0, W.Next{}} : W.Spin}

# LAW: passou do limiar negativo, vira para o anterior.
law under_turns_prev:
  for atTop: Bool
  for atBottom: Bool
  for accum: F32
  for next: F32
  {W.pageTurn(False{}, True{}, False{}, True{}, atTop, atBottom, False{}, True{}, accum, next) == W.Spin{0.0, W.Prev{}} : W.Spin}

# LAW: dentro da faixa do limiar, só acumula — devolve o próximo valor.
law within_keeps:
  for atTop: Bool
  for atBottom: Bool
  for accum: F32
  for next: F32
  {W.pageTurn(False{}, True{}, True{}, False{}, atTop, atBottom, False{}, False{}, accum, next) == W.Spin{next, W.Stay{}} : W.Spin}

# LAW: no fim da página, mesmo sem caber, o limiar vira para o próximo.
law bottom_turns_next:
  for atTop: Bool
  for accum: F32
  for next: F32
  {W.pageTurn(False{}, False{}, True{}, False{}, atTop, True{}, True{}, False{}, accum, next) == W.Spin{0.0, W.Next{}} : W.Spin}
