import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View pura da conversa da Mesa.
#
# O host resolve Markdown/KaTeX em `V.ViewNode`s opacos (na prática, a extensão
# `{ $: "Html" }` do aplicador), entrega fatos Bool e aplica a árvore. Este
# módulo decide o DOM das bolhas e dos cards de quiz; não lê seleção, relógio,
# scroll, clipboard nem IPC.
#
# Contrato principal:
#   article.message.user|assistant[data-role]
#     .role + .body + button.msg-copy / button.msg-quote
#   article.message.assistant.quiz[data-tool]
#     .role + .quiz-card (.quiz-question, .quiz-details, .quiz-options,
#     .quiz-actions, .quiz-verdict, .quiz-note, .quiz-explain)
# HTML sanitizado continua sendo criado pelo host e só atravessa a árvore como
# filho opaco. Imagens enviadas são `img.shot`; o host acrescenta o overlay de
# cópia depois de aplicar a árvore.
# ---------------------------------------------------------------------------

type QuizOptionRow is Data:
  QuizOptionRow{
    label: String,
    index: String,
    markup: V.ViewNode,
    checked: Bool,
    disabled: Bool,
    correct: Bool,
    wrong: Bool,
    dim: Bool,
    mark: String
  }

type QuizRow is Data:
  QuizRow{
    toolId: String,
    multi: Bool,
    question: V.ViewNode,
    hasDetails: Bool,
    details: V.ViewNode,
    options: +List<QuizOptionRow>,
    showSend: Bool,
    sendDisabled: Bool,
    showSkip: Bool,
    hasVerdict: Bool,
    verdict: String,
    hasNote: Bool,
    note: V.ViewNode,
    hasExplain: Bool,
    explain: V.ViewNode
  }

def off(on: Bool) -> Bool:
  match on:
    case True{}:
      False{}
    case False{}:
      True{}

def roleName(user: Bool) -> String:
  match user:
    case True{}:
      "user"
    case False{}:
      "assistant"

def roleLabel(user: Bool) -> String:
  match user:
    case True{}:
      "Você"
    case False{}:
      "Pi"

def messageClasses(+user: Bool) -> List<&2, V.ViewClass>:
  [V.classOn("message", True{}), V.classOn("user", user), V.classOn("assistant", off(user))]

def messageAttrs(+user: Bool) -> List<&2, V.ViewAttr>:
  [V.classes(messageClasses(user)), V.attrData("role", roleName(user))]

def roleNode(label: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("role")], [V.viewText(label)])

def shot(src: String) -> V.ViewNode:
  V.viewEl(
    "img",
    [ V.attrClass("shot")
    , V.attr("src", src)
    , V.attr("alt", "Imagem enviada")
    , V.attr("loading", "lazy")
    , V.attr("decoding", "async")
    ],
    Nil{}
  )

def shotNodes(xs: List<&2, String>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{shot(h), shotNodes(t)}

def messageBody(markup: V.ViewNode, images: List<&2, String>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("body")], Con{markup, shotNodes(images)})

def messageAction(className: String, label: String, handler: String) -> V.ViewNode:
  V.viewEl(
    "button",
    [V.attrType("button"), V.attrClass(className), V.attrOn("click", handler)],
    [V.viewText(label)]
  )

def messageActions(canCopy: Bool, canQuote: Bool, canReview: Bool) -> List<&2, V.ViewNode>:
  V.viewJoin([
    V.viewWhen(canCopy, messageAction("msg-copy", "Copiar", "CopyMessage")),
    V.viewWhen(canQuote, messageAction("msg-quote", "Citar", "QuoteMessage")),
    V.viewWhen(canReview, messageAction("msg-review", "Guardar para revisar", "SaveForReview"))
  ])

def messageKids(
  +user: Bool,
  markup: V.ViewNode,
  images: List<&2, String>,
  canCopy: Bool,
  canQuote: Bool,
  canReview: Bool
) -> List<&2, V.ViewNode>:
  V.viewConcat(
    [roleNode(roleLabel(user)), messageBody(markup, images)],
    messageActions(canCopy, canQuote, canReview)
  )

def message(
  +user: Bool,
  markup: V.ViewNode,
  images: List<&2, String>,
  canCopy: Bool,
  canQuote: Bool,
  canReview: Bool
) -> V.ViewNode:
  V.viewEl("article", messageAttrs(user), messageKids(user, markup, images, canCopy, canQuote, canReview))

# Citação e chips curtos são construtores reutilizáveis para conteúdo já
# convertido em texto pelo host. O diário detalhado do turno não usa estes nós.
def citation(text: String) -> V.ViewNode:
  V.viewEl("blockquote", [V.attrClass("citation")], [V.viewText(text)])

def talkChip(+kind: String, label: String) -> V.ViewNode:
  V.viewEl(
    "span",
    [V.classes([V.classOn("talk-chip", True{}), V.classOn(kind, True{})]), V.attrData("kind", kind)],
    [V.viewText(label)]
  )

def thinkingChip(label: String) -> V.ViewNode:
  talkChip("thinking", label)

def toolChip(label: String) -> V.ViewNode:
  talkChip("tool", label)

# Estado vazio e estado transitório de digitação. A Mesa mantém o indicador
# global de atividade no host; estes construtores fixam a forma caso a conversa
# precise montá-los dentro de `#messages`.
def emptyState() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrId("welcome")],
    [ V.viewEl(
        "button",
        [V.attrId("connect"), V.attrType("button"), V.attrOn("click", "Connect")],
        [V.viewText("Conectar ao Pi")]
      )
    , V.viewEl("p", Nil{}, [V.viewText("Sessão local desta matéria.")])
    ]
  )

def typingState(label: String) -> V.ViewNode:
  V.viewEl(
    "article",
    [V.attrClass("message assistant typing"), V.attrData("role", "assistant")],
    [ roleNode("Pi")
    , V.viewEl(
        "div",
        [V.attrClass("body")],
        [ V.viewEl("span", [V.attrClass("pulse"), V.attrAria("hidden", "true")], Nil{})
        , V.viewText(label)
        ]
      )
    ]
  )

# ---------- assets do corpo (figura hidratada e moldura do código) ----------
# O Markdown (marked/KaTeX/DOMPurify) e o realce continuam no host: ele resolve
# o HTML, lê a imagem (`readImage`) e entrega `src`/`path`/`alt`/`caption` já
# prontos. Aqui mora só a forma com que o aplicador hidrata a figura e embrulha
# o `<pre>` realçado. O overlay de cópia da imagem e os cliques delegados
# continuam no host (clipboard) — a mesma fronteira de `img.shot`.

type AssetRow is Data:
  AssetRow{src: String, path: String, alt: String, caption: String}

def assetImg.go(src: String, path: String, alt: String) -> V.ViewNode:
  V.viewEl(
    "img",
    [ V.attrClass("plot")
    , V.attr("src", src)
    , V.attrData("path", path)
    , V.attr("alt", alt)
    , V.attr("loading", "lazy")
    , V.attr("decoding", "async")
    ],
    Nil{}
  )

def assetCaption(+caption: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(String.is_empty(caption)),
    V.viewEl("figcaption", Nil{}, [V.viewText(caption)])
  )

def assetKids.go(src: String, path: String, alt: String, +caption: String) -> List<&2, V.ViewNode>:
  List.append(&2, V.ViewNode, [assetImg.go(src, path, alt)], assetCaption(caption))

def assetKids(row: AssetRow) -> List<&2, V.ViewNode>:
  match row:
    case AssetRow{src, path, alt, caption}:
      assetKids.go(src, path, alt, caption)

# Figura inteira para o caminho em que um `code` com caminho local vira imagem.
def assetFigure.go(src: String, path: String, alt: String, +caption: String) -> V.ViewNode:
  V.viewEl("figure", [V.attrClass("asset")], assetKids.go(src, path, alt, caption))

def assetFigure(row: AssetRow) -> V.ViewNode:
  match row:
    case AssetRow{src, path, alt, caption}:
      assetFigure.go(src, path, alt, caption)

# Quando a leitura falha, o caminho cru volta como código (nada de imagem quebrada).
def assetFallback(source: String) -> V.ViewNode:
  V.viewEl("code", Nil{}, [V.viewText(source)])

def codeCopy() -> V.ViewNode:
  V.viewEl(
    "button",
    [V.attrType("button"), V.attrClass("code-copy"), V.attrAria("label", "Copiar código")],
    [V.viewText("cópia")]
  )

# O rótulo da linguagem chega já em caixa alta (fato do host); vazio, some.
def codeBlock.kids(+lang: String, pre: V.ViewNode) -> List<&2, V.ViewNode>:
  V.viewConcat(
    V.viewWhen(
      Bool.not(String.is_empty(lang)),
      V.viewEl("span", [V.attrClass("code-lang")], [V.viewText(lang)])
    ),
    [codeCopy(), pre]
  )

def codeBlock(pre: V.ViewNode, lang: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("codeblock")], codeBlock.kids(lang, pre))

# ---------- quiz ----------

def quizRole(multi: Bool) -> String:
  match multi:
    case True{}:
      "Quiz · múltipla escolha"
    case False{}:
      "Quiz"

def quizAria(multi: Bool) -> String:
  match multi:
    case True{}:
      "Quiz de múltipla escolha"
    case False{}:
      "Pergunta de quiz"

def optionRole(multi: Bool) -> String:
  match multi:
    case True{}:
      "checkbox"
    case False{}:
      "radio"

def optionsRole(multi: Bool) -> String:
  match multi:
    case True{}:
      "group"
    case False{}:
      "radiogroup"

def optionClasses(correct: Bool, wrong: Bool, dim: Bool) -> List<&2, V.ViewClass>:
  [ V.classOn("quiz-option", True{})
  , V.classOn("correct", correct)
  , V.classOn("wrong", wrong)
  , V.classOn("dim", dim)
  ]

def optionAttrs(
  label: String,
  +index: String,
  multi: Bool,
  checked: Bool,
  disabled: Bool,
  correct: Bool,
  wrong: Bool,
  dim: Bool
) -> List<&2, V.ViewAttr>:
  V.attrJoin([
    [ V.attrType("button")
    , V.classes(optionClasses(correct, wrong, dim))
    , V.attrKey(String.join(["quiz-option-", index], ""))
    , V.attrData("label", label)
    , V.attrData("index", index)
    , V.attr("role", optionRole(multi))
    , V.attrAria("checked", V.boolStr(checked))
    ],
    V.attrWhen(disabled, V.attr("disabled", "")),
    [V.attrOn("click", "SelectQuizOption")]
  ])

def markKids(+mark: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(String.is_empty(mark)),
    V.viewEl("span", [V.attrClass("quiz-mark")], [V.viewText(mark)])
  )

def quizOption.go(
  label: String,
  +index: String,
  markup: V.ViewNode,
  checked: Bool,
  disabled: Bool,
  correct: Bool,
  wrong: Bool,
  dim: Bool,
  +mark: String,
  multi: Bool
) -> V.ViewNode:
  V.viewEl(
    "button",
    optionAttrs(label, index, multi, checked, disabled, correct, wrong, dim),
    V.viewConcat(
      [V.viewEl("span", Nil{}, [V.viewText(String.join([index, ". "], "")), markup])],
      markKids(mark)
    )
  )

def quizOption(row: QuizOptionRow, multi: Bool) -> V.ViewNode:
  match row:
    case QuizOptionRow{label, index, markup, checked, disabled, correct, wrong, dim, mark}:
      quizOption.go(label, index, markup, checked, disabled, correct, wrong, dim, mark, multi)

def quizOptions(xs: List<&2, QuizOptionRow>, +multi: Bool) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{quizOption(h, multi), quizOptions(t, multi)}

def quizQuestion(markup: V.ViewNode) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("quiz-question")], [markup])

def quizDetails(has: Bool, markup: V.ViewNode) -> List<&2, V.ViewNode>:
  V.viewWhen(has, V.viewEl("div", [V.attrClass("quiz-details")], [markup]))

def quizOptionsBox(+multi: Bool, options: List<&2, QuizOptionRow>) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("quiz-options"), V.attr("role", optionsRole(multi)), V.attrAria("label", "Opções")],
    quizOptions(options, multi)
  )

def sendButton(disabled: Bool) -> V.ViewNode:
  V.viewEl(
    "button",
    V.attrConcat(
      [ V.attrType("button")
      , V.attrClass("quiz-send primary")
      , V.attrKey("quiz-send")
      , V.attrOn("click", "SendQuiz")
      ],
      V.attrWhen(disabled, V.attr("disabled", ""))
    ),
    [V.viewText("Enviar resposta")]
  )

def skipButton() -> V.ViewNode:
  V.viewEl(
    "button",
    [V.attrType("button"), V.attrClass("quiz-skip"), V.attrOn("click", "SkipQuiz")],
    [V.viewText("Pular")]
  )

def quizActions(+showSend: Bool, sendDisabled: Bool, +showSkip: Bool) -> List<&2, V.ViewNode>:
  +kids = V.viewConcat(V.viewWhen(showSend, sendButton(sendDisabled)), V.viewWhen(showSkip, skipButton()))
  V.viewWhenAll(
    Bool.or(showSend, showSkip),
    [V.viewEl("div", [V.attrClass("quiz-actions")], kids)]
  )

def quizTail(
  hasVerdict: Bool,
  verdict: String,
  hasNote: Bool,
  note: V.ViewNode,
  hasExplain: Bool,
  explain: V.ViewNode
) -> List<&2, V.ViewNode>:
  V.viewJoin([
    V.viewWhen(hasVerdict, V.viewEl("div", [V.attrClass("quiz-verdict")], [V.viewText(verdict)])),
    V.viewWhen(hasNote, V.viewEl("div", [V.attrClass("quiz-note")], [V.viewText("Observação: "), note])),
    V.viewWhen(hasExplain, V.viewEl("div", [V.attrClass("quiz-explain")], [explain]))
  ])

def quizCard.go(
  +toolId: String,
  +multi: Bool,
  question: V.ViewNode,
  hasDetails: Bool,
  details: V.ViewNode,
  options: List<&2, QuizOptionRow>,
  showSend: Bool,
  sendDisabled: Bool,
  showSkip: Bool,
  hasVerdict: Bool,
  verdict: String,
  hasNote: Bool,
  note: V.ViewNode,
  hasExplain: Bool,
  explain: V.ViewNode
) -> V.ViewNode:
  +boxKids = V.viewJoin([
    [quizQuestion(question)],
    quizDetails(hasDetails, details),
    [quizOptionsBox(multi, options)],
    quizActions(showSend, sendDisabled, showSkip),
    quizTail(hasVerdict, verdict, hasNote, note, hasExplain, explain)
  ])
  V.viewEl(
    "article",
    [ V.attrClass("message assistant quiz")
    , V.attrData("role", "assistant")
    , V.attrData("tool", toolId)
    , V.attrAria("label", quizAria(multi))
    ],
    [roleNode(quizRole(multi)), V.viewEl("div", [V.attrClass("quiz-card")], boxKids)]
  )

def quizCard(row: QuizRow) -> V.ViewNode:
  match row:
    case QuizRow{toolId, multi, question, hasDetails, details, options, showSend, sendDisabled, showSkip, hasVerdict, verdict, hasNote, note, hasExplain, explain}:
      quizCard.go(toolId, multi, question, hasDetails, details, options, showSend, sendDisabled, showSkip, hasVerdict, verdict, hasNote, note, hasExplain, explain)
