import Base
import view.bend as V

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
  "Caderno de revisão"

def closeLabel() -> String:
  "Fechar"

def emptyText() -> String:
  "Nada guardado para revisar ainda. Use Guardar para revisar numa resposta do Pi."

def countText.if(n: Nat, one: Bool) -> String:
  match one:
    case True{}:
      "1 item"
    case False{}:
      Nat.show(n) ++ " itens"

def countText(+n: Nat) -> String:
  countText.if(n, Nat.is_eq(n, 1n))

def pageLabel(page: Nat) -> String:
  "p. " ++ Nat.show(page)

# Sem nome (a biblioteca ainda não achou o arquivo) sobra a página.
def refLine.if(name: String, page: Nat, unnamed: Bool) -> String:
  match unnamed:
    case True{}:
      pageLabel(page)
    case False{}:
      name ++ ", " ++ pageLabel(page)

# Sem nome (a biblioteca ainda não achou o arquivo) sobra a página.
def refLine(+name: String, page: Nat) -> String:
  refLine.if(name, page, String.is_empty(String.trim(name)))

def refNone() -> String:
  "sem referência"

def refPrefix() -> String:
  "Referência: "

def questionLabel() -> String:
  "A questão"

def attemptLabel() -> String:
  "O que você tentou"

def difficultyLabel() -> String:
  "Onde travou"

def dialogTitle() -> String:
  "Guardar para revisar"

def saveLabel() -> String:
  "Salvar"

def cancelLabel() -> String:
  "Cancelar"

def similarLabel() -> String:
  "Semelhante"

def similarTitle() -> String:
  "Pedir um exercício semelhante com outros números"

def redoLabel() -> String:
  "Tentar de novo"

def redoTitle() -> String:
  "Refazer este exercício no composer"

def editTitle() -> String:
  "Editar o item do caderno"

def removeLabel() -> String:
  "Remover"

def removeTitle() -> String:
  "Remover o item do caderno"

def saveActionLabel() -> String:
  "Guardar para revisar"

def saveActionTitle() -> String:
  "Guardar esta resposta para revisar depois"

# ---------- linhas ----------

def refNodeFrom(+name: String, +page: Nat, path: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("review-ref"),
    V.attrData("page", Nat.show(page)),
    V.attrData("path", path),
    V.attrData("name", name),
    V.attrTitle("Abrir " ++ refLine(name, page)),
    V.attrAria("label", "Abrir " ++ refLine(name, page)),
    V.attrOn("click", "OpenReviewRef")
  ], [V.viewText(refLine(name, page))])

def refNode(ref: ReviewRef) -> V.ViewNode:
  match ref:
    case ReviewRef{+name, +page, +path}:
      refNodeFrom(name, page, path)

# Sem caminho não há para onde abrir: a linha não aparece.
def refNodeWhen(ref: ReviewRef) -> List<&2, V.ViewNode>:
  match ref:
    case ReviewRef{+name, +page, +path}:
      V.viewWhen(Bool.not(String.is_empty(String.trim(path))), refNodeFrom(name, page, path))

def troubleNode(+difficulty: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(String.is_empty(String.trim(difficulty))),
    V.viewEl("p", [V.attrClass("review-trouble")], [V.viewText(difficulty)])
  )

def attemptNode(+attempt: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(String.is_empty(String.trim(attempt))),
    V.viewEl("p", [V.attrClass("review-attempt")], [V.viewText(attempt)])
  )

def actionButton(+id: Nat, cls: String, label: String, +title: String, action: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass(cls),
    V.attrData("id", Nat.show(id)),
    V.attrTitle(title),
    V.attrAria("label", title),
    V.attrOn("click", action)
  ], [V.viewText(label)])

def reviewActions(+id: Nat) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("review-actions")], [
    actionButton(id, "review-similar", similarLabel(), similarTitle(), "SimilarReview"),
    actionButton(id, "review-redo", redoLabel(), redoTitle(), "RedoReview"),
    actionButton(id, "review-remove", removeLabel(), removeTitle(), "RemoveReview")
  ])

def reviewRow(+id: Nat, item: ReviewItem) -> V.ViewNode:
  match item:
    case ReviewItem{+question, +attempt, +difficulty, +ref}:
      V.viewEl("article", V.attrJoin([
        [V.attrClass("review-item")],
        [V.attrData("id", Nat.show(id))]
      ]), V.viewJoin([
        [V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("review-open"),
          V.attrData("id", Nat.show(id)),
          V.attrTitle(editTitle()),
          V.attrAria("label", editTitle()),
          V.attrOn("click", "EditReview")
        ], [V.viewText(question)])],
        troubleNode(difficulty),
        attemptNode(attempt),
        refNodeWhen(ref),
        [reviewActions(id)]
      ]))

def reviewRows.go(items: List<&2, ReviewItem>, +i: Nat) -> List<&2, V.ViewNode>:
  match items:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{reviewRow(i, h), reviewRows.go(t, Nat.add(i, 1n))}

def reviewRows(items: List<&2, ReviewItem>) -> List<&2, V.ViewNode>:
  reviewRows.go(items, 0n)

# ---------- barra e vazio ----------

def reviewBar(count: Nat) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("review-head")], [
    V.viewEl("h2", Nil{}, [V.viewText(reviewTitle())]),
    V.viewEl("span", [V.attrClass("review-count")], [V.viewText(countText(count))]),
    V.viewEl("button", [
      V.attrType("button"),
      V.attrClass("review-close"),
      V.attrTitle(closeLabel()),
      V.attrAria("label", closeLabel()),
      V.attrOn("click", "CloseReview")
    ], [V.viewText(closeLabel())])
  ])

def reviewEmpty() -> V.ViewNode:
  V.viewEl("p", [V.attrClass("review-empty")], [V.viewText(emptyText())])

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

def refHint.if(name: String, page: Nat, noPath: Bool) -> String:
  match noPath:
    case True{}:
      refPrefix() ++ refNone()
    case False{}:
      refPrefix() ++ refLine(name, page)

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

# ---------- os dois prompts (o host escreve no #prompt) ----------

def attemptSuffix.if(attempt: String, none: Bool) -> String:
  match none:
    case True{}:
      ""
    case False{}:
      "\nO que eu tentei: " ++ attempt

def attemptSuffix(+attempt: String) -> String:
  attemptSuffix.if(attempt, String.is_empty(String.trim(attempt)))

def troubleSuffix.if(difficulty: String, none: Bool) -> String:
  match none:
    case True{}:
      ""
    case False{}:
      "\nOnde eu travei: " ++ difficulty

def troubleSuffix(+difficulty: String) -> String:
  troubleSuffix.if(difficulty, String.is_empty(String.trim(difficulty)))

def refSuffix.if(name: String, page: Nat, noPath: Bool) -> String:
  match noPath:
    case True{}:
      ""
    case False{}:
      "\n" ++ refPrefix() ++ refLine(name, page)

def refSuffix(ref: ReviewRef) -> String:
  match ref:
    case ReviewRef{+name, +page, +path}:
      refSuffix.if(name, page, String.is_empty(String.trim(path)))

def similarPrompt(item: ReviewItem) -> String:
  match item:
    case ReviewItem{+question, _, +difficulty, +ref}:
      "Quero um exercício semelhante a este, com outros números:\n"
      ++ question
      ++ troubleSuffix(difficulty)
      ++ refSuffix(ref)

def redoPrompt(item: ReviewItem) -> String:
  match item:
    case ReviewItem{+question, +attempt, +difficulty, +ref}:
      "Vou refazer este exercício:\n"
      ++ question
      ++ attemptSuffix(attempt)
      ++ troubleSuffix(difficulty)
      ++ refSuffix(ref)
