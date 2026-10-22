import Base
import msg.bend as M
import view.bend as V
import reviewschedule.bend as R

# ---------------------------------------------------------------------------
# Caderno de revisão (pedido 6): o que o aluno guarda de uma conversa para
# revisar depois — a questão, o que ele tentou, onde travou e a referência do
# material. Nada aqui lê o DOM nem o disco: o host entrega a lista
# (`ReviewItem`, na ordem do arquivo), reescreve o JSON quando ela muda e
# repõe os campos na tela; os textos do diálogo e das ações saem daqui.
#
# Convenções:
#   - item = `article.review-item[data-id]`, e o `data-id` é a POSIÇÃO na lista
#     que a tela mostra — é por ela que o host acha o item clicado. Editar e
#     remover NÃO vão pela posição: a lista da tela é filtrada (item que aponta
#     para PDF fora da biblioteca fica de fora), então a identidade do registro
#     (mesma questão no mesmo material) é quem manda. Dentro dele: a questão em
#     `button.review-open[data-id]`, a dificuldade em `.review-trouble`, a
#     tentativa em `.review-attempt` (as duas só quando há texto), a referência
#     em `button.review-ref[data-id][data-page][data-path][data-name]` (só
#     quando há caminho) e as ações `button.review-similar`, `button.review-redo`
#     e `button.review-remove`, todas com o mesmo `data-id`;
#   - a barra `#review-bar` recebe `reviewBar(count)` (título, contagem e
#     "Fechar"); lista vazia cai em `reviewEmpty()`;
#   - o diálogo `#review-dialog` recebe `reviewDialogChildren(...)`: a
#     referência fixa em `#review-ref`, os campos `#review-question`,
#     `#review-attempt` e `#review-difficulty` e as ações do molde
#     (`#review-save` com value `ok`, mais o cancelar);
#   - as duas ações de prompt devolvem o texto que o host escreve no `#prompt`.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type ReviewRef is Data:
  ReviewRef{name: String, page: Nat, path: String}

type ReviewItem is Data:
  ReviewItem{question: String, attempt: String, difficulty: String, ref: ReviewRef}

# ---------- tetos (o host compara; o núcleo documenta) ----------

def maxQuestion() -> Nat:
  400n

def maxAttempt() -> Nat:
  400n

def maxDifficulty() -> Nat:
  240n

def maxName() -> Nat:
  60n

def maxPath() -> Nat:
  1024n

def maxItems() -> Nat:
  200n

# ---------- textos (aparar antes de cortar) ----------

def cutReview.if(text: String, limit: Nat, over: Bool) -> String:
  match over:
    case False{}:
      text
    case True{}:
      String.take(text, limit)

def cutReview(+text: String, +limit: Nat) -> String:
  cutReview.if(text, limit, Nat.is_gt(String.length(text), limit))

def clip(+text: String, +limit: Nat) -> String:
  cutReview(String.trim(text), limit)

def fitQuestion(+text: String) -> String:
  clip(text, maxQuestion())

def fitAttempt(+text: String) -> String:
  clip(text, maxAttempt())

def fitDifficulty(+text: String) -> String:
  clip(text, maxDifficulty())

def fitName(+text: String) -> String:
  clip(text, maxName())

def fitPath(+text: String) -> String:
  clip(text, maxPath())

def pageFloor.if(page: Nat, low: Bool) -> Nat:
  match low:
    case True{}:
      1n
    case False{}:
      page

# Página nunca abaixo de 1 (a citação pode chegar vazia de um leitor sem PDF).
def pageFloor(+page: Nat) -> Nat:
  pageFloor.if(page, Nat.is_lt(page, 1n))

# ---------- item novo ----------

def newRef(name: String, page: Nat, path: String) -> ReviewRef:
  ReviewRef{fitName(name), pageFloor(page), fitPath(path)}

def newItem(
  question: String, attempt: String, difficulty: String, name: String, page: Nat, path: String
) -> ReviewItem:
  ReviewItem{fitQuestion(question), fitAttempt(attempt), fitDifficulty(difficulty), newRef(name, page, path)}

# A questão é o que dá sentido ao item (o host recusa o diálogo sem ela).
def keepQuestion.blank(blank: Bool) -> Bool:
  match blank:
    case True{}:
      False{}
    case False{}:
      True{}

def keepQuestion(question: String) -> Bool:
  keepQuestion.blank(String.is_empty(String.trim(question)))

def keepItem(item: ReviewItem) -> Bool:
  match item:
    case ReviewItem{question, _, _, _}:
      keepQuestion(question)

# Mesmo item = mesma questão no mesmo material (guardar de novo atualiza).
def sameRef(a: ReviewRef, b: ReviewRef) -> Bool:
  match a:
    case ReviewRef{+name, +page, +path}:
      match b:
        case ReviewRef{+name2, +page2, +path2}:
          Bool.and(
            Bool.and(String.eq(name, name2), Nat.is_eq(page, page2)),
            String.eq(path, path2)
          )

def sameItem(a: ReviewItem, b: ReviewItem) -> Bool:
  match a:
    case ReviewItem{question, _, _, ref}:
      match b:
        case ReviewItem{question2, _, _, ref2}:
          Bool.and(String.eq(question, question2), sameRef(ref, ref2))

# A cauda da lista já filtrada e o casamento como parâmetro (match em valor
# computado não é aceito).
def dropSame.head(+h: ReviewItem, rest: List<&2, ReviewItem>, same: Bool) -> List<&2, ReviewItem>:
  match same:
    case True{}:
      rest
    case False{}:
      Con{h, rest}

def dropSame.go(items: List<&2, ReviewItem>, +item: ReviewItem) -> List<&2, ReviewItem>:
  match items:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      dropSame.head(h, dropSame.go(t, item), sameItem(h, item))

def takeItems.go(xs: List<&2, ReviewItem>, n: Nat) -> List<&2, ReviewItem>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match n:
        case 0n:
          Nil{}
        case 1n+p:
          Con{h, takeItems.go(t, p)}

# Guardar de novo o mesmo item atualiza: o novo (ou editado) entra na frente e o
# teto corta o resto.
def addItem(items: List<&2, ReviewItem>, +item: ReviewItem) -> List<&2, ReviewItem>:
  takeItems.go(Con{item, dropSame.go(items, item)}, maxItems())

# Editar pela IDENTIDADE do item (mesma questão no mesmo material), mantendo a
# posição: a lista da tela é filtrada, então o índice da linha não é o índice do
# arquivo. Chave que não está mais na lista não mexe em nada — a tela pode ter
# envelhecido entre o clique e o Salvar, e trocar "o item da posição" seria mexer
# em outro registro.
def replaceSame.head(+h: ReviewItem, rest: List<&2, ReviewItem>, +item: ReviewItem, same: Bool) -> List<&2, ReviewItem>:
  match same:
    case True{}:
      Con{item, rest}
    case False{}:
      Con{h, rest}

def replaceSame.go(xs: List<&2, ReviewItem>, +key: ReviewItem, +item: ReviewItem) -> List<&2, ReviewItem>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      replaceSame.head(h, replaceSame.go(t, key, item), item, sameItem(h, key))

def replaceSame(items: List<&2, ReviewItem>, +key: ReviewItem, +item: ReviewItem) -> List<&2, ReviewItem>:
  replaceSame.go(items, key, item)

# Remover pela identidade (mesma questão no mesmo material), onde o item estiver.
def removeSame(items: List<&2, ReviewItem>, +key: ReviewItem) -> List<&2, ReviewItem>:
  dropSame.go(items, key)

# ---------- rótulos ----------

def reviewTitle() -> String:
  M.msg("review.title")

def closeLabel() -> String:
  M.msg("review.close")

def emptyTitle() -> String:
  M.msg("review.empty.title")

def emptyLead() -> String:
  M.msg("review.empty.lead")

def emptyTail() -> String:
  M.msg("review.empty.tail")

def countText(+n: Nat) -> String:
  M.msg1("review.count", "count", Nat.show(n))

# A contagem da barra. Com a agenda carregada: "3 para hoje · 7 no caderno",
# "Nada para hoje · 7 no caderno" ou "0 itens". Sem a agenda (host sem ela, ou
# ainda carregando) sobra só o total: "1 item" / "N itens".
def countLine.none(+total: Nat) -> String:
  M.msg1("review.countLine.none", "total", Nat.show(total))

def countLine.some(+due: Nat, +total: Nat, +noDue: Bool) -> String:
  match noDue:
    case True{}:
      countLine.none(total)
    case False{}:
      M.msg2("review.countLine.some", "due", Nat.show(due), "total", Nat.show(total))

def countLine.known(+due: Nat, +total: Nat, +empty: Bool) -> String:
  match empty:
    case True{}:
      countText(0n)
    case False{}:
      countLine.some(due, total, Nat.is_eq(due, 0n))

def countLine.pick(+due: Nat, +total: Nat, +known: Bool) -> String:
  match known:
    case False{}:
      countText(total)
    case True{}:
      countLine.known(due, total, Nat.is_eq(total, 0n))

def countLine(+due: Nat, +total: Nat, +known: Bool) -> String:
  countLine.pick(due, total, known)

def pageLabel(+page: Nat) -> String:
  M.msg1("review.ref.page", "page", Nat.show(page))

def refLine.if(+name: String, +page: Nat, +unnamed: Bool) -> String:
  match unnamed:
    case True{}:
      pageLabel(page)
    case False{}:
      M.msg2("review.ref.named", "name", name, "page", Nat.show(page))

# Sem nome (a biblioteca ainda não achou o arquivo) sobra a página.
def refLine(+name: String, +page: Nat) -> String:
  refLine.if(name, page, String.is_empty(String.trim(name)))

def refOpen.if(+name: String, +page: Nat, +unnamed: Bool) -> String:
  match unnamed:
    case True{}:
      M.msg1("review.ref.open.page", "page", Nat.show(page))
    case False{}:
      M.msg2("review.ref.open.named", "name", name, "page", Nat.show(page))

def refOpen(+name: String, +page: Nat) -> String:
  refOpen.if(name, page, String.is_empty(String.trim(name)))

def questionLabel() -> String:
  M.msg("review.question")

def attemptLabel() -> String:
  M.msg("review.attempt")

def difficultyLabel() -> String:
  M.msg("review.difficulty")

def dialogTitle() -> String:
  M.msg("review.saveForReview")

def saveLabel() -> String:
  M.msg("common.save")

def cancelLabel() -> String:
  M.msg("common.cancel")

def similarLabel() -> String:
  M.msg("review.similar")

def similarTitle() -> String:
  M.msg("review.similar.title")

def redoLabel() -> String:
  M.msg("review.redo")

def redoTitle() -> String:
  M.msg("review.redo.title")

def editLabel() -> String:
  M.msg("common.edit")

def editTitle() -> String:
  M.msg("review.edit.title")

def removeLabel() -> String:
  M.msg("common.remove")

def removeTitle() -> String:
  M.msg("review.remove.title")

def saveActionLabel() -> String:
  M.msg("review.saveForReview")

def saveActionTitle() -> String:
  M.msg("review.saveAction.title")

def gradesTitle() -> String:
  M.msg("review.grades.title")

def allTitle() -> String:
  M.msg("review.all.title")

def dueGroupTitle() -> String:
  M.msg("review.group.due")

def laterGroupTitle() -> String:
  M.msg("review.group.later")

def todayKicker() -> String:
  M.msg("review.kicker.today")

def allDoneKicker() -> String:
  M.msg("review.kicker.done")

def aheadKicker() -> String:
  M.msg("review.kicker.ahead")

def refMissingWarn() -> String:
  M.msg("review.warn.missing")

def refOutsideWarn() -> String:
  M.msg("review.warn.outside")

# ---------- o item da tela (fatos já resolvidos pelo host) ----------

# `id` é o da agenda (`desk/src/study-data/review-schedule.cjs`); `due` diz se
# vence hoje; `when` é "hoje", "amanhã" ou "em N dias"; `saved` é "9 out" (ou
# vazio); `interval` é o intervalo atual em dias (0 = nunca revisado); `warn` é
# o aviso da referência (vazio quando está tudo certo).
type ReviewEntry is Data:
  ReviewEntry{
    id: String, question: String, attempt: String, difficulty: String,
    ref: ReviewRef, due: Bool, when: String, saved: String, interval: Nat, warn: String
  }

def entryId(+e: ReviewEntry) -> String:
  match e:
    case ReviewEntry{+id, _, _, _, _, _, _, _, _, _}:
      id

def entryDue(+e: ReviewEntry) -> Bool:
  match e:
    case ReviewEntry{_, _, _, _, _, +due, _, _, _, _}:
      due

# ---------- a lista: separar, achar e escolher ----------

def keepEntry(+h: ReviewEntry, +rest: List<&2, ReviewEntry>, +keep: Bool) -> List<&2, ReviewEntry>:
  match keep:
    case True{}:
      Con{h, rest}
    case False{}:
      rest

def dueEntries(+xs: List<&2, ReviewEntry>) -> List<&2, ReviewEntry>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      keepEntry(h, dueEntries(t), entryDue(h))

def laterEntries(+xs: List<&2, ReviewEntry>) -> List<&2, ReviewEntry>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      keepEntry(h, laterEntries(t), Bool.not(entryDue(h)))

def countEntries(+xs: List<&2, ReviewEntry>) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{h, t}:
      Nat.add(1n, countEntries(t))

def firstEntry(+xs: List<&2, ReviewEntry>) -> Maybe<&2, ReviewEntry>:
  match xs:
    case Nil{}:
      None{}
    case Con{h, t}:
      Some{h}

def findEntry.step(+h: ReviewEntry, +rest: Maybe<&2, ReviewEntry>, +same: Bool) -> Maybe<&2, ReviewEntry>:
  match same:
    case True{}:
      Some{h}
    case False{}:
      rest

def findEntry(+xs: List<&2, ReviewEntry>, +id: String) -> Maybe<&2, ReviewEntry>:
  match xs:
    case Nil{}:
      None{}
    case Con{+h, t}:
      findEntry.step(h, findEntry(t, id), String.eq(entryId(h), id))

def preferEntry(+a: Maybe<&2, ReviewEntry>, +b: Maybe<&2, ReviewEntry>) -> Maybe<&2, ReviewEntry>:
  match a:
    case Some{x}:
      Some{x}
    case None{}:
      b

# O item da esquerda: o que o aluno escolheu na lista; se ele sumiu (ou nada foi
# escolhido), o primeiro que vence hoje; se nada vence, o primeiro da lista.
def currentEntry(+xs: List<&2, ReviewEntry>, +id: String) -> Maybe<&2, ReviewEntry>:
  preferEntry(findEntry(xs, id), preferEntry(firstEntry(dueEntries(xs)), firstEntry(xs)))

# Posição (de 1) do item na lista; 0 quando não está.
def positionOf.step(+found: Bool, +here: Nat, +rest: Nat) -> Nat:
  match found:
    case True{}:
      here
    case False{}:
      rest

def positionOf.go(+xs: List<&2, ReviewEntry>, +id: String, +i: Nat) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{+h, t}:
      positionOf.step(String.eq(entryId(h), id), Nat.add(i, 1n), positionOf.go(t, id, Nat.add(i, 1n)))

def positionOf(+xs: List<&2, ReviewEntry>, +id: String) -> Nat:
  positionOf.go(xs, id, 0n)

# ---------- o progresso de hoje ----------

# `done` são as revisões que o aluno marcou nesta abertura do caderno: o
# progresso não volta para "1 de 2" cada vez que um item sai da fila.
def progressShown(+done: Nat, +position: Nat) -> Nat:
  Nat.add(done, position)

def progressTotal(+done: Nat, +due: Nat) -> Nat:
  Nat.add(done, due)

def progressText(+shown: Nat, +total: Nat) -> String:
  M.msg2("review.progress", "shown", Nat.show(shown), "total", Nat.show(total))

# ---------- "Como foi?": quando o item volta para cada resposta ----------

def gradeWhen(+interval: Nat, +result: R.ReviewResult) -> String:
  R.returnsLabel(R.nextInterval(interval, result))

def gradeButton(+id: String, +interval: Nat, +result: R.ReviewResult) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("review-grade"),
    V.attrData("id", id),
    V.attrData("result", R.resultTag(result)),
    V.attrTitle(R.gradeNote(result))
  ], [
    V.viewEl("span", [V.attrClass("review-grade-name")], [V.viewText(R.resultLabel(result))]),
    V.viewEl("span", [V.attrClass("review-grade-when")], [V.viewText(gradeWhen(interval, result))])
  ])

def gradesRow(+id: String, +interval: Nat) -> V.ViewNode:
  V.viewEl("section", [V.attrClass("review-grades"), V.attrAria("label", gradesTitle())], [
    V.viewEl("h3", [V.attrClass("review-grades-title")], [V.viewText(gradesTitle())]),
    V.viewEl("div", [V.attrClass("review-grade-row")], [
      gradeButton(id, interval, R.ResultErrei{}),
      gradeButton(id, interval, R.ResultDificil{}),
      gradeButton(id, interval, R.ResultBom{}),
      gradeButton(id, interval, R.ResultFacil{})
    ])
  ])

# ---------- o cartão do item ----------

def blank(+text: String) -> Bool:
  String.is_empty(String.trim(text))

def refNodeFrom(+name: String, +page: Nat, +path: String, +warn: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [V.attrType("button")],
    [V.attrClass("review-ref")],
    [V.attrData("page", Nat.show(page))],
    [V.attrData("path", path)],
    [V.attrData("name", name)],
    V.attrWhen(blank(warn), V.attrTitle(refOpen(name, page))),
    V.attrWhen(Bool.not(blank(warn)), V.attrTitle(warn)),
    V.attrWhen(Bool.not(blank(warn)), V.attr("disabled", "")),
    [V.attrAria("label", refOpen(name, page))]
  ]), [V.viewText(refLine(name, page))])

# Sem caminho não há para onde abrir: a citação não aparece.
def refNodeWhen(+ref: ReviewRef, +warn: String) -> List<&2, V.ViewNode>:
  match ref:
    case ReviewRef{+name, +page, +path}:
      V.viewWhen(Bool.not(blank(path)), refNodeFrom(name, page, path, warn))

def savedNode(+saved: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(blank(saved)),
    V.viewEl("span", [V.attrClass("review-saved")], [V.viewText(M.msg1("review.savedOn", "date", saved))])
  )

def metaRow(+ref: ReviewRef, +saved: String, +warn: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("review-meta")], V.viewJoin([
    refNodeWhen(ref, warn),
    savedNode(saved)
  ]))

def warnNode(+warn: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(blank(warn)),
    V.viewEl("p", [V.attrClass("review-reference-warning")], [V.viewText(warn)])
  )

def noteNode(+cls: String, +label: String, +text: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(blank(text)),
    V.viewEl("div", [V.attrClass("review-note")], [
      V.viewEl("span", [V.attrClass("review-note-label")], [V.viewText(label)]),
      V.viewEl("p", [V.attrClass(cls)], [V.viewText(text)])
    ])
  )

def notesNode(+attempt: String, +difficulty: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.or(Bool.not(blank(attempt)), Bool.not(blank(difficulty))),
    V.viewEl("div", [V.attrClass("review-notes")], V.viewJoin([
      noteNode("review-attempt", attemptLabel(), attempt),
      noteNode("review-trouble", difficultyLabel(), difficulty)
    ]))
  )

def cardButton(+id: String, +cls: String, +label: String, +title: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass(cls),
    V.attrData("id", id),
    V.attrTitle(title),
    V.attrAria("label", title)
  ], [V.viewText(label)])

def cardActions(+id: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("review-actions")], [
    cardButton(id, "review-redo primary", redoLabel(), redoTitle()),
    cardButton(id, "review-similar", similarLabel(), similarTitle()),
    V.viewEl("span", [V.attrClass("review-spacer")], Nil{}),
    cardButton(id, "review-edit", editLabel(), editTitle()),
    cardButton(id, "review-remove", removeLabel(), removeTitle())
  ])

def reviewCard(+e: ReviewEntry) -> V.ViewNode:
  match e:
    case ReviewEntry{+id, +question, +attempt, +difficulty, +ref, _, _, +saved, _, +warn}:
      V.viewEl("article", V.attrJoin([
        [V.attrClass("review-item review-card")],
        [V.attrData("id", id)]
      ]), V.viewJoin([
        [metaRow(ref, saved, warn)],
        [V.viewEl("h3", [V.attrClass("review-question")], [V.viewText(question)])],
        warnNode(warn),
        notesNode(attempt, difficulty),
        [cardActions(id)]
      ]))

# ---------- a coluna da esquerda: "Para hoje" ----------

# Marca de onde o aluno está: "Para hoje · 1 de 3" com a barra; fora do que vence
# hoje, o que dá para dizer é quando o item volta.
def progressNode(+shown: Nat, +total: Nat) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("review-progress")], [
    V.viewEl("span", [V.attrClass("review-kicker")], [V.viewText(todayKicker())]),
    V.viewEl("span", [V.attrClass("review-position")], [V.viewText(progressText(shown, total))]),
    V.viewEl("progress", [
      V.attrClass("review-bar-track"),
      V.attr("max", Nat.show(total)),
      V.attr("value", Nat.show(shown)),
      V.attrAria("label", progressText(shown, total))
    ], Nil{})
  ])

def aheadNode(+kicker: String, +when: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("review-progress")], [
    V.viewEl("span", [V.attrClass("review-kicker")], [V.viewText(kicker)]),
    V.viewEl("span", [V.attrClass("review-position")], [
      V.viewText(M.msg("review.returnsWord")),
      V.viewText(" "),
      V.viewText(when)
    ])
  ])

def aheadKickerFor.pick(+someDue: Bool) -> String:
  match someDue:
    case True{}:
      aheadKicker()
    case False{}:
      allDoneKicker()

def headerFor.pick(+due: Bool, +when: String, +id: String, +xs: List<&2, ReviewEntry>, +done: Nat) -> V.ViewNode:
  match due:
    case True{}:
      progressNode(
        progressShown(done, positionOf(dueEntries(xs), id)),
        progressTotal(done, countEntries(dueEntries(xs)))
      )
    case False{}:
      aheadNode(aheadKickerFor.pick(Bool.not(Nat.is_eq(countEntries(dueEntries(xs)), 0n))), when)

def headerFor(+e: ReviewEntry, +xs: List<&2, ReviewEntry>, +done: Nat) -> V.ViewNode:
  match e:
    case ReviewEntry{+id, _, _, _, _, +due, +when, _, _, _}:
      headerFor.pick(due, when, id, xs, done)

def entryInterval(+e: ReviewEntry) -> Nat:
  match e:
    case ReviewEntry{_, _, _, _, _, _, _, _, +interval, _}:
      interval

def gradesWhen(+e: ReviewEntry, +grades: Bool) -> List<&2, V.ViewNode>:
  V.viewWhen(grades, gradesRow(entryId(e), entryInterval(e)))

def reviewMain.with(+e: ReviewEntry, +xs: List<&2, ReviewEntry>, +done: Nat, +grades: Bool) -> V.ViewNode:
  V.viewEl("section", [
    V.attrId("review-today"),
    V.attrClass("review-main"),
    V.attrAria("label", M.msg("review.today.title"))
  ], V.viewJoin([
    [headerFor(e, xs, done)],
    [reviewCard(e)],
    gradesWhen(e, grades)
  ]))

def reviewMain.pick(+m: Maybe<&2, ReviewEntry>, +xs: List<&2, ReviewEntry>, +done: Nat, +grades: Bool) -> V.ViewNode:
  match m:
    case Some{e}:
      reviewMain.with(e, xs, done, grades)
    case None{}:
      V.viewEl("section", [V.attrId("review-today"), V.attrClass("review-main")], Nil{})

# ---------- a coluna da direita: "Todos os itens" ----------

def rowSrc.pick(+noPath: Bool, +name: String, +page: Nat) -> String:
  match noPath:
    case True{}:
      ""
    case False{}:
      refLine(name, page)

def rowSrc(+name: String, +page: Nat, +path: String) -> String:
  rowSrc.pick(blank(path), name, page)

def rowNode(+current: String, +e: ReviewEntry) -> V.ViewNode:
  match e:
    case ReviewEntry{+id, +question, _, _, ReviewRef{+name, +page, +path}, _, +when, _, _, _}:
      V.viewEl("button", V.attrJoin([
        [V.attrType("button")],
        [V.attrClass("review-row")],
        [V.attrData("id", id)],
        V.attrWhen(String.eq(id, current), V.attrAria("current", "true"))
      ]), [
        V.viewEl("span", [V.attrClass("review-row-title")], [V.viewText(question)]),
        V.viewEl("span", [V.attrClass("review-row-meta")], [
          V.viewEl("span", [V.attrClass("review-row-src")], [V.viewText(rowSrc(name, page, path))]),
          V.viewEl("span", [V.attrClass("review-row-when")], [V.viewText(when)])
        ])
      ])

def rowNodes(+current: String, +xs: List<&2, ReviewEntry>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{rowNode(current, h), rowNodes(current, t)}

def groupNode(+title: String, +current: String, +xs: List<&2, ReviewEntry>) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(Nat.is_eq(countEntries(xs), 0n)),
    V.viewEl("div", [V.attrClass("review-group")], Con{
      V.viewEl("h4", [V.attrClass("review-group-title")], [V.viewText(title)]),
      rowNodes(current, xs)
    })
  )

def reviewAside(+xs: List<&2, ReviewEntry>, +current: String) -> V.ViewNode:
  V.viewEl("aside", [V.attrId("review-list"), V.attrClass("review-all"), V.attrAria("label", allTitle())], [
    V.viewEl("div", [V.attrClass("review-all-head")], [
      V.viewEl("h3", Nil{}, [V.viewText(allTitle())]),
      V.viewEl("span", [V.attrClass("review-all-count")], [V.viewText(Nat.show(countEntries(xs)))])
    ]),
    V.viewEl("div", [V.attrClass("review-all-body")], V.viewJoin([
      groupNode(dueGroupTitle(), current, dueEntries(xs)),
      groupNode(laterGroupTitle(), current, laterEntries(xs))
    ]))
  ])

def currentId(+m: Maybe<&2, ReviewEntry>) -> String:
  match m:
    case Some{e}:
      entryId(e)
    case None{}:
      ""

# ---------- a tela inteira (o conteúdo de `#review-view`) ----------

# Vazio: um bloco só, no centro — o título, uma frase que explica o Guardar para
# revisar e a miniatura da fileira de ações da resposta.
def reviewEmpty() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("review-empty-block")], [
    V.viewEl("h3", [V.attrClass("review-empty-title")], [V.viewText(emptyTitle())]),
    V.viewEl("p", [V.attrClass("review-empty")], [
      V.viewText(emptyLead()),
      V.viewEl("strong", Nil{}, [V.viewText(saveActionLabel())]),
      V.viewText(emptyTail())
    ]),
    V.viewEl("div", [V.attrClass("review-empty-sample"), V.attrAria("hidden", "true")], [
      V.viewEl("span", Nil{}, [V.viewText("Copiar")]),
      V.viewEl("span", [V.attrClass("review-empty-dot")], [V.viewText("·")]),
      V.viewEl("span", Nil{}, [V.viewText("Citar")]),
      V.viewEl("span", [V.attrClass("review-empty-dot")], [V.viewText("·")]),
      V.viewEl("span", [V.attrClass("review-empty-save")], [V.viewText(saveActionLabel())])
    ])
  ])

def reviewBoard.full(+xs: List<&2, ReviewEntry>, +m: Maybe<&2, ReviewEntry>, +done: Nat, +grades: Bool) -> List<&2, V.ViewNode>:
  [reviewMain.pick(m, xs, done, grades), reviewAside(xs, currentId(m))]

def reviewBoard.pick(+xs: List<&2, ReviewEntry>, +id: String, +done: Nat, +grades: Bool, +empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      [reviewEmpty()]
    case False{}:
      reviewBoard.full(xs, currentEntry(xs, id), done, grades)

def reviewBoard(+xs: List<&2, ReviewEntry>, +id: String, +done: Nat, +grades: Bool) -> List<&2, V.ViewNode>:
  reviewBoard.pick(xs, id, done, grades, Nat.is_eq(countEntries(xs), 0n))

# ---------- barra e vazio ----------

def courseNode(+course: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(blank(course)),
    V.viewEl("span", [V.attrClass("review-course")], [V.viewText(String.trim(course))])
  )

def reviewBar(+course: String, +due: Nat, +total: Nat, +known: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("review-head")], V.viewJoin([
    [V.viewEl("h2", Nil{}, [V.viewText(reviewTitle())])],
    courseNode(course),
    [V.viewEl("span", [V.attrClass("review-count")], [V.viewText(countLine(due, total, known))])],
    [V.viewEl("button", [
      V.attrType("button"),
      V.attrClass("review-close"),
      V.attrTitle(closeLabel()),
      V.attrAria("label", closeLabel()),
      V.attrOn("click", "CloseReview")
    ], [V.viewText(closeLabel())])]
  ]))

# ---------- diálogo (o miolo; o <dialog> é do index.html) ----------

def reviewQuestionField(value: String) -> V.ViewNode:
  V.viewEl("label", Nil{}, [
    V.viewText(questionLabel()),
    V.viewEl("textarea", [
      V.attrId("review-question"),
      V.attr("rows", "3"),
      V.attr("required", "")
    ], [V.viewText(value)])
  ])

def reviewAttemptField(value: String) -> V.ViewNode:
  V.viewEl("label", Nil{}, [
    V.viewText(attemptLabel()),
    V.viewEl("textarea", [
      V.attrId("review-attempt"),
      V.attr("rows", "3")
    ], [V.viewText(value)])
  ])

def reviewDifficultyField(value: String) -> V.ViewNode:
  V.viewEl("label", Nil{}, [
    V.viewText(difficultyLabel()),
    V.viewEl("input", [
      V.attrId("review-difficulty"),
      V.attrType("text"),
      V.attr("value", value)
    ], Nil{})
  ])

def refHint.named(+name: String, +page: Nat, unnamed: Bool) -> String:
  match unnamed:
    case True{}:
      M.msg1("review.refHint.page", "page", Nat.show(page))
    case False{}:
      M.msg2("review.refHint.named", "name", name, "page", Nat.show(page))

def refHint.if(+name: String, +page: Nat, noPath: Bool) -> String:
  match noPath:
    case True{}:
      M.msg("review.refHint.none")
    case False{}:
      refHint.named(name, page, String.is_empty(String.trim(name)))

def refHint(ref: ReviewRef) -> String:
  match ref:
    case ReviewRef{+name, +page, +path}:
      refHint.if(name, page, String.is_empty(String.trim(path)))

def reviewDialogActions() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("dialog-actions")], [
    V.viewEl("button", [
      V.attr("value", "cancel"),
      V.attr("formnovalidate", "")
    ], [V.viewText(cancelLabel())]),
    V.viewEl("button", [
      V.attrId("review-save"),
      V.attr("value", "ok"),
      V.attrClass("primary")
    ], [V.viewText(saveLabel())])
  ])

def reviewDialogChildren(
  question: String, attempt: String, difficulty: String, hint: String
) -> List<&2, V.ViewNode>:
  [ V.viewEl("h2", Nil{}, [V.viewText(dialogTitle())])
  , V.viewEl("p", V.attrJoin([[V.attrId("review-ref")], [V.attrClass("help-lead")]]), [V.viewText(hint)])
  , reviewQuestionField(question)
  , reviewAttemptField(attempt)
  , reviewDifficultyField(difficulty)
  , reviewDialogActions()
  ]

# Resposta do modelo só pode preencher um campo ainda intocado do diálogo atual.
# O host mede a identidade do pedido e acompanha input (inclusive editar e apagar).
def canFillDraft(open: Bool, current: Bool, untouched: Bool) -> Bool:
  match open:
    case False{}:
      False{}
    case True{}:
      match current:
        case False{}:
          False{}
        case True{}:
          untouched

def draftStatus(text: String) -> V.ViewNode:
  V.viewEl("p", [V.attrId("review-draft-status"), V.attr("role", "status")], [V.viewText(text)])
