import Base
import ../laws/wheel.bend as Laws

# Todas as leis da roda reduzem por computação depois de fixar os fatos
# (os `Bool` são construtores nas leis).

def Laws.blocked_stays(fits, towardNext, towardPrev, atTop, atBottom, over, under, accum, next):
  {==}

def Laws.away_stays(towardPrev, atTop, over, under, accum, next):
  {==}

def Laws.away_stays_prev(atBottom, over, under, accum, next):
  {==}

def Laws.zero_keeps(over, under, accum, next):
  {==}

def Laws.over_turns_next(atTop, atBottom, accum, next):
  {==}

def Laws.under_turns_prev(atTop, atBottom, accum, next):
  {==}

def Laws.within_keeps(atTop, atBottom, accum, next):
  {==}

def Laws.bottom_turns_next(atTop, accum, next):
  {==}
