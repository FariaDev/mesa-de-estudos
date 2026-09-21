import Base

# ---------------------------------------------------------------------------
# Núcleo de matérias da Mesa (referência: mergeCourses e courseLibrary de
# desk/courses.cjs).
#
# O host descobre pastas, checa se o path existe e resolve o caminho
# canônico (realpath). O núcleo:
#   - junta descobertos + config, sem repetir id; rótulo e path do config
#     vencem; a ordem é a dos descobertos e, no fim, os ids novos do config;
#   - na biblioteca, a primeira ocorrência de cada canônico vence e o
#     resultado sai ordenado pelo nome (ordem de codepoint; o localeCompare
#     do host fica no adaptador se precisar).
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type Course is Data:
  Course{id: String, name: String, path: String}

type Pdf is Data:
  Pdf{name: String, path: String, canonical: String}

# Estado da inserção: `acc` é o prefixo já visto (ao contrário); `done`
# diz se o pdf novo já entrou.
type PdfIns is Data:
  PdfIns{acc: List<&2, Pdf>, rest: List<&2, Pdf>, x: Pdf, done: Bool}

# ---------- extratores ----------

def idOf(c: Course) -> String:
  match c:
    case Course{id, name, path}:
      id

def nameOf(c: Course) -> String:
  match c:
    case Course{id, name, path}:
      name

def pathOf(c: Course) -> String:
  match c:
    case Course{id, name, path}:
      path

def pdfName(p: Pdf) -> String:
  match p:
    case Pdf{name, path, canonical}:
      name

def ids(xs: List<&2, Course>) -> List<&2, String>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{idOf(h), ids(t)}

def names(xs: List<&2, Pdf>) -> List<&2, String>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{pdfName(h), names(t)}

# ---------- merge: procura e rótulo ----------

# Já tem esse id na lista? `+id` porque cada passo compara e segue.
def hasId(xs: List<&2, Course>, +id: String) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, t}:
      match h:
        case Course{cid, name, path}:
          Bool.or(String.eq(cid, id), hasId(t, id))

# Nome do config, se vier preenchido; senão o anterior; senão o id.
def pickName.prev.if(prevName: String, id: String, empty: Bool) -> String:
  match empty:
    case False{}:
      prevName
    case True{}:
      id

def pickName.prev(+prevName: String, id: String) -> String:
  pickName.prev.if(prevName, id, String.is_empty(prevName))

def pickName.cfg(cfgName: String, prevName: String, id: String, empty: Bool) -> String:
  match empty:
    case False{}:
      cfgName
    case True{}:
      pickName.prev(prevName, id)

def pickName(+cfgName: String, prevName: String, id: String) -> String:
  pickName.cfg(cfgName, prevName, id, String.is_empty(cfgName))

# Config por cima do descoberto: mesmo id, nome do config se houver, path novo.
def overlay(prev: Course, cfg: Course) -> Course:
  match prev cfg:
    case Course{pid, prevName, ppath} Course{+id, cfgName, cfgPath}:
      Course{id, pickName(cfgName, prevName, id), cfgPath}

# Entrada só do config (não havia descoberto com esse id).
def asNew(cfg: Course) -> Course:
  match cfg:
    case Course{+id, name, path}:
      Course{id, pickName(name, "", id), path}

# Se o id casa, aplica o config; senão mantém o descoberto.
def rewrite(h: Course, cfg: Course, same: Bool) -> Course:
  match same:
    case True{}:
      overlay(h, cfg)
    case False{}:
      h

def rewriteHead(h: Course, cfg: Course) -> Course:
  match h cfg:
    case Course{+hid, hname, hpath} Course{+cid, cname, cpath}:
      rewrite(
        Course{hid, hname, hpath},
        Course{cid, cname, cpath},
        String.eq(hid, cid)
      )

# Overlay em todo id igual. Com ids únicos (invariante do merge) é o
# mesmo que atualizar só o primeiro, e evita recursão mútua com um Bool.
def updateById(xs: List<&2, Course>, +cfg: Course) -> List<&2, Course>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{rewriteHead(h, cfg), updateById(t, cfg)}

def mergeOne.has(
  acc: List<&2, Course>, cfg: Course, found: Bool
) -> List<&2, Course>:
  match found:
    case True{}:
      updateById(acc, cfg)
    case False{}:
      List.append(&2, Course, acc, [asNew(cfg)])

# `+acc`: precisa olhar os ids e depois atualizar ou anexar a mesma lista.
def mergeOne(+acc: List<&2, Course>, cfg: Course) -> List<&2, Course>:
  match cfg:
    case Course{+id, name, path}:
      +c = {Course{id, name, path} : Course}
      mergeOne.has(acc, c, hasId(acc, id))

def merge.go(cfg: List<&2, Course>, acc: List<&2, Course>) -> List<&2, Course>:
  match cfg:
    case Nil{}:
      acc
    case Con{h, t}:
      merge.go(t, mergeOne(acc, h))

# Descobertos primeiro; cada item do config atualiza o id ou entra no fim.
def mergeCourses(
  discovered: List<&2, Course>, config: List<&2, Course>
) -> List<&2, Course>:
  merge.go(config, discovered)

# ---------- predicados (para as leis) ----------

def uniqueIds.and(found: Bool, rest: Bool) -> Bool:
  match found:
    case True{}:
      False{}
    case False{}:
      rest

def uniqueIds(xs: List<&2, Course>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{h, +t}:
      match h:
        case Course{+id, name, path}:
          uniqueIds.and(hasId(t, id), uniqueIds(t))

# ---------- biblioteca: dedupe + ordem ----------

def hasCanonical(xs: List<&2, Pdf>, +key: String) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, t}:
      match h:
        case Pdf{n, p, c}:
          Bool.or(String.eq(c, key), hasCanonical(t, key))

def keepPdf(acc: List<&2, Pdf>, pdf: Pdf, seen: Bool) -> List<&2, Pdf>:
  match seen:
    case True{}:
      acc
    case False{}:
      List.append(&2, Pdf, acc, [pdf])

# Primeira ocorrência de cada canônico, na ordem em que apareceu.
def dedupe.go(xs: List<&2, Pdf>, +acc: List<&2, Pdf>) -> List<&2, Pdf>:
  match xs:
    case Nil{}:
      acc
    case Con{h, t}:
      match h:
        case Pdf{n, p, +c}:
          +pdf = {Pdf{n, p, c} : Pdf}
          dedupe.go(t, keepPdf(acc, pdf, hasCanonical(acc, c)))

def dedupe(xs: List<&2, Pdf>) -> List<&2, Pdf>:
  dedupe.go(xs, Nil{})

def pdfLe(a: Pdf, b: Pdf) -> Bool:
  match a b:
    case Pdf{na, pa, ca} Pdf{nb, pb, cb}:
      String.is_le(na, nb)

# Inserção com combustível: o passo só devolve estado; a recursão é no Nat.
def insertPdf.finish(st: PdfIns) -> List<&2, Pdf>:
  match st:
    case PdfIns{acc, rest, x, done}:
      List.append(&2, Pdf, List.reverse(&2, Pdf, acc), Con{x, rest})

def insertPdf.step(
  acc: List<&2, Pdf>, +x: Pdf, y: Pdf, ys: List<&2, Pdf>, le: Bool
) -> PdfIns:
  match le:
    case True{}:
      PdfIns{acc, Con{y, ys}, x, True{}}
    case False{}:
      PdfIns{Con{y, acc}, ys, x, False{}}

def insertPdf.go(fuel: Nat, st: PdfIns) -> List<&2, Pdf>:
  match fuel:
    case 0n:
      insertPdf.finish(st)
    case 1n+f:
      match st:
        case PdfIns{acc, rest, +x, done}:
          match rest done:
            case Nil{} _:
              insertPdf.finish(PdfIns{acc, Nil{}, x, True{}})
            case Con{+y, ys} True{}:
              insertPdf.finish(PdfIns{acc, Con{y, ys}, x, True{}})
            case Con{+y, ys} False{}:
              insertPdf.go(f, insertPdf.step(acc, x, y, ys, pdfLe(x, y)))

def insertPdf(x: Pdf, +xs: List<&2, Pdf>) -> List<&2, Pdf>:
  +n = List.length(&2, Pdf, xs)
  insertPdf.go(n, PdfIns{Nil{}, xs, x, False{}})

def sortPdfs.go(fuel: Nat, xs: List<&2, Pdf>, acc: List<&2, Pdf>) -> List<&2, Pdf>:
  match fuel:
    case 0n:
      acc
    case 1n+f:
      match xs:
        case Nil{}:
          acc
        case Con{h, t}:
          sortPdfs.go(f, t, insertPdf(h, acc))

def sortPdfs(+xs: List<&2, Pdf>) -> List<&2, Pdf>:
  +n = List.length(&2, Pdf, xs)
  sortPdfs.go(n, xs, Nil{})

# Dedupe por canônico e ordena pelo nome (codepoint).
def courseLibrary(xs: List<&2, Pdf>) -> List<&2, Pdf>:
  +ds = dedupe(xs)
  sortPdfs(ds)

def uniqueCanonicals.and(found: Bool, rest: Bool) -> Bool:
  match found:
    case True{}:
      False{}
    case False{}:
      rest

def uniqueCanonicals(xs: List<&2, Pdf>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{h, +t}:
      match h:
        case Pdf{n, p, +c}:
          uniqueCanonicals.and(hasCanonical(t, c), uniqueCanonicals(t))
