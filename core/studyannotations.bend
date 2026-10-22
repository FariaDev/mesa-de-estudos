import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Anotações de página (Mesa): o que o aluno guarda de um trecho do material —
# o trecho selecionado, a observação/dúvida, a página e a referência portátil.
#
# O PDF original NUNCA é tocado: o host grava um JSON à parte
# (`runtime/pdf-notes.json`), escopado por matéria ou por sessão Livre. Aqui
# ficam a forma, os tetos, a identidade e a ordem — nada de disco, DOM ou IPC.
#
# Regras que o host garante e o núcleo decide:
#   - página nunca abaixo de 1 (`pageFloor`);
#   - trecho/observação/nome/caminho aparados e cortados nos tetos;
#   - a anotação vale quando tem trecho OU observação (`keep`);
#   - editar/remover vão pela ID estável (`sameId`), nunca pela posição — a
#     lista da tela é filtrada por página/matéria e o índice da linha não é o
#     índice do arquivo;
#   - o novo item entra na frente e a lista para em `maxItems()`;
#   - a referência guarda o caminho relativo (`rel`) para o pacote/backup poder
#     reancorar em outra raiz; `path` é o absoluto resolvido pelo host.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type NoteKind is Data:
  NoteNote{}
  NoteDoubt{}

type NoteRef is Data:
  NoteRef{name: String, rel: String, path: String, page: Nat}

type NoteItem is Data:
  NoteItem{id: String, kind: NoteKind, quote: String, note: String, ref: NoteRef}

# ---------- tetos (o host compara; o núcleo documenta) ----------

def maxId() -> Nat:
  80n

def maxQuote() -> Nat:
  2000n

def maxNote() -> Nat:
  2000n

def maxName() -> Nat:
  120n

def maxRel() -> Nat:
  1024n

def maxPath() -> Nat:
  4096n

def maxItems() -> Nat:
  500n

# ---------- aparar antes de cortar ----------

def cut.if(text: String, limit: Nat, over: Bool) -> String:
  match over:
    case False{}:
      text
    case True{}:
      String.take(text, limit)

def cut(+text: String, +limit: Nat) -> String:
  cut.if(text, limit, Nat.is_gt(String.length(text), limit))

def clip(+text: String, +limit: Nat) -> String:
  cut(String.trim(text), limit)

def fitId(+text: String) -> String:
  clip(text, maxId())

def fitQuote(+text: String) -> String:
  clip(text, maxQuote())

def fitNote(+text: String) -> String:
  clip(text, maxNote())

def fitName(+text: String) -> String:
  clip(text, maxName())

def fitRel(+text: String) -> String:
  clip(text, maxRel())

def fitPath(+text: String) -> String:
  clip(text, maxPath())

# ---------- página ----------

def pageFloor.if(page: Nat, low: Bool) -> Nat:
  match low:
    case True{}:
      1n
    case False{}:
      page

# Página nunca abaixo de 1 (a seleção pode chegar sem página do leitor).
def pageFloor(+page: Nat) -> Nat:
  pageFloor.if(page, Nat.is_lt(page, 1n))

# ---------- escopo ----------

# Sessão Livre tem escopo próprio, prefixado — a mesma matéria promovida depois
# não herda as anotações da sessão avulsa.
def scopeOf(isFree: Bool, courseId: String, freeId: String) -> String:
  match isFree:
    case True{}:
      "free:" ++ freeId
    case False{}:
      courseId

# ---------- espécie ----------

def kindOf(doubt: Bool) -> NoteKind:
  match doubt:
    case True{}:
      NoteDoubt{}
    case False{}:
      NoteNote{}

def kindKey(k: NoteKind) -> String:
  match k:
    case NoteNote{}:
      "nota"
    case NoteDoubt{}:
      "duvida"

def kindLabel(k: NoteKind) -> String:
  match k:
    case NoteNote{}:
      M.msg("annot.kind.note")
    case NoteDoubt{}:
      M.msg("annot.kind.doubt")

# ---------- item novo ----------

def newRef(name: String, rel: String, path: String, page: Nat) -> NoteRef:
  NoteRef{fitName(name), fitRel(rel), fitPath(path), pageFloor(page)}

def newItem(id: String, doubt: Bool, quote: String, note: String, name: String, rel: String, path: String, page: Nat) -> NoteItem:
  NoteItem{fitId(id), kindOf(doubt), fitQuote(quote), fitNote(note), newRef(name, rel, path, page)}

# Vale guardar quando tem trecho OU observação (o host recusa o diálogo vazio).
def keep.tags(emptyQuote: Bool, emptyNote: Bool) -> Bool:
  match emptyQuote:
    case True{}:
      Bool.not(emptyNote)
    case False{}:
      True{}

def keep(item: NoteItem) -> Bool:
  match item:
    case NoteItem{_, _, quote, note, _}:
      keep.tags(String.is_empty(String.trim(quote)), String.is_empty(String.trim(note)))

# ---------- identidade ----------

def sameId(a: NoteItem, b: NoteItem) -> Bool:
  match a:
    case NoteItem{+id, _, _, _, _}:
      match b:
        case NoteItem{+id2, _, _, _, _}:
          String.eq(id, id2)

# ---------- lista ----------

def takeItems.go(xs: List<&2, NoteItem>, n: Nat) -> List<&2, NoteItem>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match n:
        case 0n:
          Nil{}
        case 1n+p:
          Con{h, takeItems.go(t, p)}

# A cauda já filtrada e o casamento como parâmetro (match em valor computado
# não é aceito).
def dropSame.head(+h: NoteItem, rest: List<&2, NoteItem>, same: Bool) -> List<&2, NoteItem>:
  match same:
    case True{}:
      rest
    case False{}:
      Con{h, rest}

def dropSame.go(items: List<&2, NoteItem>, +item: NoteItem) -> List<&2, NoteItem>:
  match items:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      dropSame.head(h, dropSame.go(t, item), sameId(h, item))

# Guardar de novo o mesmo id atualiza: o novo entra na frente e o teto corta.
def addItem(items: List<&2, NoteItem>, +item: NoteItem) -> List<&2, NoteItem>:
  takeItems.go(Con{item, dropSame.go(items, item)}, maxItems())

# Editar pela ID estável, mantendo a posição. Chave que não está mais na lista
# não mexe em nada (a tela pode ter envelhecido entre o clique e o Salvar).
def replaceSame.head(+h: NoteItem, rest: List<&2, NoteItem>, +item: NoteItem, same: Bool) -> List<&2, NoteItem>:
  match same:
    case True{}:
      Con{item, rest}
    case False{}:
      Con{h, rest}

def replaceSame.go(xs: List<&2, NoteItem>, +key: NoteItem, +item: NoteItem) -> List<&2, NoteItem>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      replaceSame.head(h, replaceSame.go(t, key, item), item, sameId(h, key))

def replaceSame(items: List<&2, NoteItem>, +key: NoteItem, +item: NoteItem) -> List<&2, NoteItem>:
  replaceSame.go(items, key, item)

# Remover pela ID estável, onde o item estiver.
def removeSame(items: List<&2, NoteItem>, +key: NoteItem) -> List<&2, NoteItem>:
  dropSame.go(items, key)

# O filtro de página é do host (facts por item); a lista inteira já vem no teto.
def onPage(ref: NoteRef, page: Nat) -> Bool:
  match ref:
    case NoteRef{_, _, _, +p}:
      Nat.is_eq(p, page)

# ---------- rótulos ----------

def panelTitle() -> String:
  M.msg("annot.title")

def panelLead() -> String:
  M.msg("annot.lead")

def quoteLabel() -> String:
  M.msg("annot.quote")

def noteLabel() -> String:
  M.msg("annot.note")

def kindLabelText() -> String:
  M.msg("annot.kind")

def pageFieldLabel() -> String:
  M.msg("annot.page")

def filterPageLabel() -> String:
  M.msg("annot.page")

def filterAllLabel() -> String:
  M.msg("annot.filterAll")

def saveLabel() -> String:
  M.msg("annot.save")

def cancelLabel() -> String:
  M.msg("common.cancel")

def editTitle() -> String:
  M.msg("annot.edit")

def removeLabel() -> String:
  M.msg("common.remove")

def removeTitle() -> String:
  M.msg("annot.remove")

def closeLabel() -> String:
  M.msg("common.close")

def useQuoteLabel() -> String:
  M.msg("annot.useQuote")

def useQuoteTitle() -> String:
  M.msg("annot.useQuoteTitle")

def emptyText() -> String:
  M.msg("annot.empty")

def countText(n: Nat) -> String:
  M.msg1("annot.count", "count", Nat.show(n))

def pageLabel(page: Nat) -> String:
  M.msg1("common.pageShort", "page", Nat.show(page))

def refLine.if(name: String, page: Nat, unnamed: Bool) -> String:
  match unnamed:
    case True{}:
      pageLabel(page)
    case False{}:
      M.msg2("common.refNamed", "name", name, "page", Nat.show(page))

def refLine(+name: String, page: Nat) -> String:
  refLine.if(name, page, String.is_empty(String.trim(name)))

def refNone() -> String:
  M.msg("annot.refNone")

def portableHint() -> String:
  M.msg("annot.portable")
