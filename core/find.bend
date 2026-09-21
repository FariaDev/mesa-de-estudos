import Base

# Contador e ciclo da busca do PDF (o "Buscar neste PDF…" de cada leitor).
# O núcleo é puro: o app entrega as páginas com ocorrências e as decisões já
# resolvidas (Bool) e recebe o alvo do ciclo e o que o contador deve mostrar.
# A precisão da contagem (texto da página, via PDF.js) fica fora, no app.
# A lista de páginas é `&2` (o app pode reusá-la); helpers primeiro: Bend não
# tem referência para frente.

# Uma página com ocorrências: número (1-based) e quantas vezes o termo aparece.
# O app só põe na lista páginas com ocorrências, em ordem crescente.
type PageHits is Data:
  PageHits{page: Nat, count: Nat}

# O que o contador mostra: some sem ocorrências; com a página atual fora da
# lista, mostra o total; dentro, mostra a posição da primeira ocorrência da
# página atual (soma das anteriores + 1) sobre o total.
type FindCount is Data:
  Hidden{}
  All{total: Nat}
  Shown{index: Nat, total: Nat}

# A página de uma entrada.
def pageOf(h: PageHits) -> Nat:
  match h:
    case PageHits{page, count}:
      page

# As ocorrências de uma entrada.
def countOf(h: PageHits) -> Nat:
  match h:
    case PageHits{page, count}:
      count

# Primeira página da lista (alvo de termo novo); None para lista vazia.
def firstHit(pages: List<&2, PageHits>) -> Maybe<Nat>:
  match pages:
    case Nil{}:
      None{}
    case Con{h, t}:
      Some{pageOf(h)}

# Liga o "achado" na primeira vez que o critério passa; depois, mantém.
def setFound.bump(page: Nat, after: Bool) -> Maybe<Nat>:
  match after:
    case True{}:
      Some{page}
    case False{}:
      None{}

def setFound(found: Maybe<Nat>, page: Nat, after: Bool) -> Maybe<Nat>:
  match found:
    case Some{v}:
      Some{v}
    case None{}:
      setFound.bump(page, after)

# Varredura guiada por fatos: para cada página, o Bool `after` diz se ela passa
# do critério (é > a atual). `facts` anda lado a lado com `pages`.
def walkFound(pages: List<&2, PageHits>, facts: List<&2, Bool>, found: Maybe<Nat>) -> Maybe<Nat>:
  match pages facts:
    case Nil{} _:
      found
    case Con{h, t} Nil{}:
      found
    case Con{h, t} Con{f, fs}:
      walkFound(t, fs, setFound(found, pageOf(h), f))

# Fecha a varredura: sem achado, cai na primeira página; sem lista, None.
def finishWalk(found: Maybe<Nat>, first: Maybe<Nat>) -> Maybe<Nat>:
  match found:
    case Some{p}:
      Some{p}
    case None{}:
      first

# Alvo do ciclo a partir dos fatos: primeira página > atual, senão a primeira.
def nextHitFacts(+pages: List<&2, PageHits>, facts: List<&2, Bool>) -> Maybe<Nat>:
  finishWalk(walkFound(pages, facts, None{}), firstHit(pages))

# Fatos do ciclo: por página, `page > current`.
def afterFacts(pages: List<&2, PageHits>, +current: Nat) -> List<&2, Bool>:
  match pages:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match h:
        case PageHits{page, count}:
          Con{Nat.is_gt(page, current), afterFacts(t, current)}

# Alvo do ciclo: buscando o mesmo termo de novo (o app já decidiu isso).
def nextHit(+pages: List<&2, PageHits>, current: Nat) -> Maybe<Nat>:
  nextHitFacts(pages, afterFacts(pages, current))

# Alvo da busca: termo novo vai para a primeira página; mesmo termo cicla.
def cycleTarget(cycle: Bool, pages: List<&2, PageHits>, current: Nat) -> Maybe<Nat>:
  match cycle:
    case True{}:
      nextHit(pages, current)
    case False{}:
      firstHit(pages)

# Soma das ocorrências (o total mostrado no contador).
def totalHits(pages: List<&2, PageHits>) -> Nat:
  match pages:
    case Nil{}:
      0n
    case Con{h, t}:
      match h:
        case PageHits{page, count}:
          Nat.add(count, totalHits(t))

# Estado do contador: ainda procurando (com as ocorrências anteriores) ou já
# achou a página atual (com o "antes" da primeira ocorrência dela).
type Scan is Data:
  Looking{before: Nat}
  Got{before: Nat}

# Um passo: achado manda; procurando, o fato `same` decide.
def scanStep.look(before: Nat, count: Nat, same: Bool) -> Scan:
  match same:
    case True{}:
      Got{before}
    case False{}:
      Looking{Nat.add(before, count)}

def scanStep(s: Scan, count: Nat, same: Bool) -> Scan:
  match s:
    case Got{before}:
      Got{before}
    case Looking{before}:
      scanStep.look(before, count, same)

# Fecha o contador: achou → índice (antes + 1) sobre o total; senão → total.
def finishScan(s: Scan, total: Nat) -> FindCount:
  match s:
    case Looking{before}:
      All{total}
    case Got{before}:
      Shown{Nat.add(before, 1n), total}

# Contador guiado por fatos: por página, o Bool `same` diz se ela é a atual.
def countFacts(pages: List<&2, PageHits>, facts: List<&2, Bool>, total: Nat, s: Scan) -> FindCount:
  match pages facts:
    case Nil{} _:
      finishScan(s, total)
    case Con{h, t} Nil{}:
      finishScan(s, total)
    case Con{h, t} Con{f, fs}:
      countFacts(t, fs, total, scanStep(s, countOf(h), f))

# Fatos do contador: por página, `page == current`.
def sameFacts(pages: List<&2, PageHits>, +current: Nat) -> List<&2, Bool>:
  match pages:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match h:
        case PageHits{page, count}:
          Con{Nat.is_eq(page, current), sameFacts(t, current)}

# Contador: sem páginas com ocorrências, some; senão, a posição da página
# atual sobre o total (ou só o total, se a página atual não tem ocorrências).
def findCount(+pages: List<&2, PageHits>, current: Nat) -> FindCount:
  match pages:
    case Nil{}:
      Hidden{}
    case Con{h, t}:
      countFacts(pages, sameFacts(pages, current), totalHits(pages), Looking{0n})
