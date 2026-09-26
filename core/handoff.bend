import Base

# ---------------------------------------------------------------------------
# Bilhete da Conversa para a Mesa (handoff).
#
# A Conversa é chat geral; a Mesa é estudo com PDFs e Xournal++. Quando o
# assunto da Conversa vira estudo, o usuário leva o pedido para a Mesa em vez de
# recomeçar a conversa. O que atravessa é o pacote mínimo:
#
#   - objetivo: o que se quer;
#   - referências: o que já estava em jogo (arquivos, trechos citados);
#   - pergunta pendente: a pergunta que ficou sem resposta.
#
# Nada de histórico: o valor do bilhete é ser curto. Referência sozinha não é
# bilhete — sem objetivo nem pergunta não há pedido, só histórico, e o bloco não
# é montado.
#
# O host resolve o que é fato (o bilhete é recente? quais referências?) e mede o
# tempo; o núcleo decide o que entra e se o bloco existe. `match` nunca analisa
# valor computado — o fato chega como parâmetro Bool e a decisão vem do host,
# que chama `accepted` (exportada) para calculá-lo.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

def header() -> String:
  "[Da Conversa]"

def seg(text: String) -> String:
  String.append("\n", text)

def goalLine(goal: String) -> String:
  String.append("- objetivo: ", goal)

def questionLine(question: String) -> String:
  String.append("- pergunta pendente: ", question)

def refsHeader() -> String:
  "- referências trazidas da Conversa:"

def refLine(ref: String) -> String:
  String.append("  · ", ref)

def refLines(refs: List<String>) -> String:
  match refs:
    case Nil{}:
      ""
    case Con{h, t}:
      String.append(seg(refLine(h)), refLines(t))

def refsBlock(refs: List<String>) -> String:
  match refs:
    case Nil{}:
      ""
    case Con{h, t}:
      String.append(seg(refsHeader()), refLines(refs))

# Cada campo entra uma vez; a linha opcional decide sozinha se aparece.
def optional(+content: String, empty: Bool) -> String:
  match empty:
    case True{}:
      ""
    case False{}:
      seg(content)

# Bilhete antigo não deixa de valer, mas não passa por assunto de agora: o dia
# mudou e a matéria pode ter mudado junto.
def staleNote() -> String:
  "- atenção: bilhete escrito há mais de um dia; confirme com o usuário antes de tratar como o assunto de agora"

def staleLine(staleFact: Bool) -> String:
  match staleFact:
    case True{}:
      seg(staleNote())
    case False{}:
      ""

# Objetivo ou pergunta: é o que faz o bilhete ser um pedido. As referências não
# contam para esta decisão (a lei `handoff_referencia_sozinha_recusa` fixa isso).
def accepted(goal: String, question: String) -> Bool:
  Bool.or(Bool.not(String.is_empty(goal)), Bool.not(String.is_empty(question)))

# Título curto: o objetivo cabe numa linha, não numa conversa.
def cleanGoal(goal: String) -> String:
  String.take(String.trim(goal), 400n)

# A pergunta pode ser mais longa, mas ainda é o que o usuário digitaria.
def cleanQuestion(question: String) -> String:
  String.take(String.trim(question), 2000n)

def body(+goal: String, +question: String, refs: List<String>) -> String:
  String.append(
    String.append(
      optional(goalLine(goal), String.is_empty(goal)),
      optional(questionLine(question), String.is_empty(question))
    ),
    refsBlock(refs)
  )

# Cada linha já chega prefixada com o seu `\n` (`seg`); o cabeçalho cola direto
# para não abrir uma linha em branco depois dele.
# `acceptedFact` vem do host: `accepted(cleanGoal(g), cleanQuestion(q))`.
def render(goal: String, question: String, refs: List<String>, acceptedFact: Bool, staleFact: Bool) -> String:
  match acceptedFact:
    case False{}:
      ""
    case True{}:
      String.append(String.append(header(), body(goal, question, refs)), staleLine(staleFact))
