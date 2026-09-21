import Base

# ---------------------------------------------------------------------------
# Política de ferramentas e embrulho de prompt do app Conversa
# (referência: chat/prompt.cjs).
#
# O host entrega o nome da ferramenta, o texto, os Bools `search`/`edit` e a
# lista de anexos. O núcleo:
#   - libera nome vazio/branco; recusa `browser` / `browser_*` / `browser:*`
#     antes de qualquer palavra permitida; senão libera se o nome (caixa
#     irrelevante) contém uma agulha de busca/imagem;
#   - embrulha o prompt na ordem editar → texto → busca → anexos, com as
#     marcas idempotentes (`String.contains`);
#   - no display, tira o prefixo de editar, troca o bloco de anexo por
#     `(anexo: nome)` e some com a linha de busca.
#
# `contentParts` fica noutro módulo. I/O, JSONL e o system prompt ficam no
# host. Sem referência para frente: helpers vêm antes de quem chama.
# Recursão só em si mesma; Bool/ToolHit já vêm como parâmetro (o match nunca
# é num valor computado).
#
# VARREDURA TAIL (upstream bendlang/bend#798, comentário do aron-intframe):
# no backend JS, `String.split`/`String.length`/`String.take` (n grande) e
# `String.to_lower` gastam um quadro de pilha por caractere — o produto aceita
# mensagem de 100k e anexo de 80k. Os helpers `strLen`/`strTake`/`strSplit`/
# `strJoin`/`strLower` e os walkers abaixo acumulam e só se chamam em tail
# position: o backend emite `run_jump` e a pilha fica plana. Resultados
# idênticos aos da Base, inclusive bordas vazias do split e o teto do take.
# (`String.contains` já era tail e fica; o resto da varredura por caractere da
# Base entrava fora de tail.)
# ---------------------------------------------------------------------------

type ToolFile is Data:
  ToolFile{name: String, text: String}

# Varredura das linhas do display de anexo / busca.
type AnxMode is Data:
  AnxLook{}
  AnxGrab{}
  AnxOpen{name: String}
  AnxBody{name: String}

type SrchMode is Data:
  SrchLook{}
  SrchDrop{}

# ---------- constantes ----------

def maxName() -> Nat:
  120n

# 80_000: literal `80000n` estoura o Peano no checker; o produto não expande.
def maxBody() -> Nat:
  Nat.mul(80n, 1000n)

def editMark() -> String:
  "[Editar última]"

def editHint() -> String:
  "Ignore a pergunta anterior e considere esta versão corrigida."

def editLine() -> String:
  "[Editar última] Ignore a pergunta anterior e considere esta versão corrigida."

def searchMark() -> String:
  "[Buscar na web]"

def searchHint() -> String:
  "O usuário pediu web search nesta mensagem. Use a ferramenta web_search (e web_fetch se precisar da página) e cite fontes (título + URL)."

def searchLine() -> String:
  "[Buscar na web] O usuário pediu web search nesta mensagem. Use a ferramenta web_search (e web_fetch se precisar da página) e cite fontes (título + URL)."

def anexoLinePrefix() -> String:
  "[Anexo: "

def ticksLine() -> String:
  "```"

def charStr(c: Char) -> String:
  SCon{c, SNil{}}

def allowedNeedles() -> List<String>:
  [
    "search",
    "web",
    "fetch",
    "http",
    "url",
    "image",
    "vision",
    "screenshot",
    "jina",
    "brave",
    "tavily",
    "serper",
    "searx",
    "reference",
    "quiz",
    "mcp"
  ]

# ---------- varredura tail de String (issue #798) ----------

# Comprimento em Chars (escalares), tail. `String.length` da Base soma 1n no
# retorno e afunda a pilha.
def strLen.go(s: String, acc: Nat) -> Nat:
  match s:
    case SNil{}:
      acc
    case SCon{h, t}:
      strLen.go(t, Nat.add(acc, 1n))

def strLen(s: String) -> Nat:
  strLen.go(s, 0n)

# `String.take` da Base monta `SCon{h, take(t, p)}`; aqui o prefixo entra
# invertido no acumulador e sai em `String.reverse` (tail). Mesmos casos: string
# vazia e n=0 devolvem vazio; n maior que a string devolve a string inteira.
def strTake.go(s: String, n: Nat, acc: String) -> String:
  match s n:
    case SNil{} _:
      String.reverse(acc)
    case SCon{h, t} 0n:
      String.reverse(acc)
    case SCon{h, t} 1n+p:
      strTake.go(t, p, SCon{h, acc})

def strTake(s: String, n: Nat) -> String:
  strTake.go(s, n, SNil{})

# `String.split` da Base chama `String.split.fin(h, split(t), cut)` com a
# chamada dentro do argumento (não-tail). Aqui `step` é um passo puro
# (par invertido: peça atual invertida, peças fechadas invertidas) e `go` só
# se chama em tail position — molde de core/framing.bend. As partes e as
# bordas (string vazia, LF inicial/final, LFs adjacentes) são as da Base.
def strSplit.step(h: Char, st: String & List<&2, String>, cut: Bool) ->
  String & List<&2, String>:
  (cur, acc) = st
  match cut:
    case True{}:
      (SNil{}, Con{String.reverse(cur), acc})
    case False{}:
      (SCon{h, cur}, acc)

def strSplit.fin(cur: String, acc: List<&2, String>) -> List<&2, String>:
  List.reverse(&2, String, Con{String.reverse(cur), acc})

def strSplit.go(s: String, +sep: Char, st: String & List<&2, String>) ->
  List<&2, String>:
  match s:
    case SNil{}:
      (cur, acc) = st
      strSplit.fin(cur, acc)
    case SCon{+h, t}:
      strSplit.go(t, sep, strSplit.step(h, st, Char.is_eq(h, sep)))

def strSplit(s: String, +sep: Char) -> List<&2, String>:
  strSplit.go(s, sep, (SNil{}, Nil{}))

# `String.join.go` da Base pendura a chamada em `h + (sep + rec)` (não-tail).
# Aqui o prefixo acumula à esquerda, com a mesma junção e a mesma lista vazia.
def strJoin.go(xs: List<&2, String>, +sep: String, acc: String) -> String:
  match xs:
    case Nil{}:
      acc
    case Con{h, t}:
      strJoin.go(t, sep, String.append(String.append(acc, sep), h))

def strJoin.start(xs: List<&2, String>, +sep: String) -> String:
  match xs:
    case Nil{}:
      SNil{}
    case Con{h, t}:
      strJoin.go(t, sep, h)

def strJoin(xs: List<&2, String>, +sep: String) -> String:
  strJoin.start(xs, sep)

# `String.to_lower` da Base monta `SCon{Char.to_lower(h), to_lower(t)}` fora de
# tail; `Char.to_lower` é nativo, só a varredura é nossa.
def strLower.go(s: String, acc: String) -> String:
  match s:
    case SNil{}:
      String.reverse(acc)
    case SCon{h, t}:
      strLower.go(t, SCon{Char.to_lower(h), acc})

def strLower(s: String) -> String:
  strLower.go(s, SNil{})

# `String.contains` da Base já é tail (mutual com `contains.if` via run_jump) e
# tem saída cedo; fica. O que afundava a pilha era a varredura por caractere de
# `to_lower`/`split`/`length`/`take`, coberta acima.

# ---------- compact: [\s-]+ → "_" ----------

# Espaço da Base (U+0009–U+000D e U+0020) ou hífen ASCII. Outros Unicode
# de `\s` (NBSP etc.) não aparecem em nome de ferramenta; a lei fecha nos
# casos concretos do contrato.
def isSep(+c: Char) -> Bool:
  Bool.or(Char.is_space(c), Char.is_eq(c, '-'))

def headSep(s: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{h, _}:
      isSep(h)

# Acumulador invertido (o run colapsado só decide o que entra; a ordem sai no
# `String.reverse` do fim). Mesmos casos do ramo antigo.
def compact.go(s: String, inRun: Bool, sep: Bool, acc: String) -> String:
  match s inRun sep:
    case SNil{} _ _:
      String.reverse(acc)
    case SCon{+h, +t} True{} True{}:
      compact.go(t, True{}, headSep(t), acc)
    case SCon{+h, +t} False{} True{}:
      compact.go(t, True{}, headSep(t), SCon{'_', acc})
    case SCon{+h, +t} _ False{}:
      compact.go(t, False{}, headSep(t), SCon{h, acc})

def compactName(s: String) -> String:
  +x = s
  compact.go(x, False{}, headSep(x), SNil{})

# ---------- toolAllowed ----------

def anyContains(+n: String, needles: List<String>) -> Bool:
  match needles:
    case Nil{}:
      False{}
    case Con{h, t}:
      Bool.or(String.contains(n, h), anyContains(n, t))

# `browser` exato no compacto, `browser_*` no compacto, ou `browser:` /
# `browser_` no nome original (já em minúsculas). Vem antes das agulhas:
# `browser_web_search` cai aqui mesmo contendo "web".
def isBrowser(+compact: String, +low: String) -> Bool:
  Bool.or(
    Bool.or(String.eq(compact, "browser"), String.starts_with(compact, "browser_")),
    Bool.or(String.starts_with(low, "browser:"), String.starts_with(low, "browser_"))
  )

def toolAllowed.keywords(n: String) -> Bool:
  anyContains(strLower(n), allowedNeedles())

def toolAllowed.browser.if(+n: String, blocked: Bool) -> Bool:
  match blocked:
    case True{}:
      False{}
    case False{}:
      toolAllowed.keywords(n)

def toolAllowed.browser(+n: String) -> Bool:
  +low = strLower(n)
  +compact = strLower(compactName(n))
  toolAllowed.browser.if(n, isBrowser(compact, low))

def toolAllowed.empty(n: String, empty: Bool) -> Bool:
  match empty:
    case True{}:
      True{}
    case False{}:
      toolAllowed.browser(n)

def toolAllowed(name: String) -> Bool:
  +n = String.trim(name)
  toolAllowed.empty(n, String.is_empty(n))

# ---------- nome/corpo do anexo ----------

def isCrLf(+c: Char) -> Bool:
  Bool.or(Char.is_eq(c, '\n'), Char.is_eq(c, '\r'))

def sanitizeChar.if(+c: Char, bad: Bool) -> String:
  match bad:
    case True{}:
      " "
    case False{}:
      charStr(c)

def sanitizeChar(c: Char) -> String:
  +ch = c
  sanitizeChar.if(ch, isCrLf(ch))

# `String.append(sanitizeChar(h), acc)` é 1 char + resto (nativo); o acumulador
# invertido sai no `String.reverse`. Mesmo saneamento do ramo antigo.
def sanitizeName.go(s: String, acc: String) -> String:
  match s:
    case SNil{}:
      String.reverse(acc)
    case SCon{h, t}:
      sanitizeName.go(t, String.append(sanitizeChar(h), acc))

def sanitizeName(s: String) -> String:
  sanitizeName.go(s, SNil{})

# maxName() reduz no checker (120n): a lei fecha o corte do nome pelos dois
# caminhos, o automático e o fato `cut` dado.
def cleanFileName.given(+name: String, cut: Bool) -> String:
  match cut:
    case True{}:
      strTake(name, maxName())
    case False{}:
      name

def cleanFileName.if(+name: String, empty: Bool) -> String:
  match empty:
    case True{}:
      "anexo"
    case False{}:
      +n = sanitizeName(name)
      cleanFileName.given(n, Nat.is_gt(strLen(n), maxName()))

def cleanFileName(name: String) -> String:
  +n = name
  cleanFileName.if(n, String.is_empty(n))

# O teto de 80k não reduz no checker (Peano); o `over` vem resolvido e o
# corte em si fica no ramo `given`.
def cleanFileBody.given(text: String, cut: Bool) -> String:
  match cut:
    case True{}:
      strTake(text, maxBody())
    case False{}:
      text

def cleanFileBody(text: String) -> String:
  +t = text
  cleanFileBody.given(t, Nat.is_gt(strLen(t), maxBody()))

# ---------- wrapPrompt: editar → texto → busca → anexos ----------

def wrap.edit.put(+text: String, empty: Bool) -> String:
  match empty:
    case True{}:
      editLine()
    case False{}:
      String.append(editLine(), String.append("\n\n", text))

def wrap.edit.put.auto(text: String) -> String:
  +t = text
  wrap.edit.put(t, String.is_empty(t))

def wrap.edit.has(text: String, hasMark: Bool) -> String:
  match hasMark:
    case True{}:
      text
    case False{}:
      wrap.edit.put.auto(text)

def wrap.edit(text: String, edit: Bool) -> String:
  match edit:
    case False{}:
      text
    case True{}:
      +t = text
      wrap.edit.has(t, String.contains(t, editMark()))

def wrap.search.put(+text: String, empty: Bool) -> String:
  match empty:
    case True{}:
      searchLine()
    case False{}:
      String.append(text, String.append("\n\n", searchLine()))

def wrap.search.put.auto(text: String) -> String:
  +t = text
  wrap.search.put(t, String.is_empty(t))

def wrap.search.has(text: String, hasMark: Bool) -> String:
  match hasMark:
    case True{}:
      text
    case False{}:
      wrap.search.put.auto(text)

def wrap.search(text: String, search: Bool) -> String:
  match search:
    case False{}:
      text
    case True{}:
      +t = text
      wrap.search.has(t, String.contains(t, searchMark()))

def wrap.file.if(message: String, +name: String, +body: String, empty: Bool) -> String:
  match empty:
    case True{}:
      message
    case False{}:
      String.append(
        message,
        String.append(
          "\n\n[Anexo: ",
          String.append(name, String.append("]\n```\n", String.append(body, "\n```")))
        )
      )

def wrap.file(message: String, f: ToolFile) -> String:
  match f:
    case ToolFile{name, text}:
      +body = cleanFileBody(text)
      wrap.file.if(message, cleanFileName(name), body, String.is_empty(body))

def wrap.files(files: List<&2, ToolFile>, message: String) -> String:
  match files:
    case Nil{}:
      message
    case Con{h, t}:
      wrap.files(t, wrap.file(message, h))

def wrapPrompt(text: String, search: Bool, files: List<&2, ToolFile>, edit: Bool) -> String:
  wrap.files(files, wrap.search(wrap.edit(text, edit), search))

def display.edit.blank(+s: String, +rest: List<&2, String>, blank: Bool) -> String:
  match blank:
    case False{}:
      s
    case True{}:
      strJoin(rest, "\n")

def display.edit.tail(+s: String, t: List<&2, String>) -> String:
  match t:
    case Nil{}:
      s
    case Con{second, rest}:
      display.edit.blank(s, rest, String.is_empty(second))

def display.edit.lines(+s: String, lines: List<&2, String>) -> String:
  match lines:
    case Nil{}:
      s
    case Con{_, t}:
      display.edit.tail(s, t)

def display.edit.if(+s: String, hit: Bool) -> String:
  match hit:
    case False{}:
      s
    case True{}:
      display.edit.lines(s, strSplit(s, '\n'))

def display.edit(s: String) -> String:
  +x = s
  display.edit.if(x, String.starts_with(x, editMark()))

def predNat(n: Nat) -> Nat:
  match n:
    case 0n:
      0n
    case 1n+p:
      p

def isAnexoLine(line: String) -> Bool:
  +ln = line
  Bool.and(String.starts_with(ln, anexoLinePrefix()), String.ends_with(ln, "]"))

def anexoName(line: String) -> String:
  +ln = line
  String.drop(strTake(ln, predNat(strLen(ln))), 8n)

def anexoShow(name: String) -> String:
  String.append("(anexo: ", String.append(name, ")"))

def headEmpty(xs: List<&2, String>) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, _}:
      String.is_empty(h)

def headTicks(xs: List<&2, String>) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, _}:
      String.eq(h, ticksLine())

def headAnexo(xs: List<&2, String>) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, _}:
      isAnexoLine(h)

def sndAnexo(xs: List<&2, String>) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{_, t}:
      headAnexo(t)

def headSearch(xs: List<&2, String>) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, _}:
      String.starts_with(h, searchMark())

# A lista que encolhe vem primeiro. Sem `_` nos Bool e sem Con aninhado.
# `acc` guarda a saída invertida; o Nil fecha em `List.reverse` (tail).
def anexosWalk(
  xs: List<&2, String>, mode: AnxMode, empty: Bool, nxt: Bool,
  acc: List<&2, String>
) -> List<&2, String>:
  match xs mode empty nxt:
    case Nil{} AnxLook{} False{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxLook{} False{} True{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxLook{} True{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxLook{} True{} True{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxGrab{} False{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxGrab{} False{} True{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxGrab{} True{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxGrab{} True{} True{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxOpen{name} False{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxOpen{name} False{} True{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxOpen{name} True{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxOpen{name} True{} True{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxBody{name} False{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxBody{name} False{} True{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxBody{name} True{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} AnxBody{name} True{} True{}:
      List.reverse(&2, String, acc)
    case Con{h, +t} AnxLook{} False{} False{}:
      anexosWalk(t, AnxLook{}, headEmpty(t), sndAnexo(t), Con{h, acc})
    case Con{h, +t} AnxLook{} False{} True{}:
      anexosWalk(t, AnxLook{}, headEmpty(t), sndAnexo(t), Con{h, acc})
    case Con{h, +t} AnxLook{} True{} False{}:
      anexosWalk(t, AnxLook{}, headEmpty(t), sndAnexo(t), Con{h, acc})
    case Con{h, +t} AnxLook{} True{} True{}:
      anexosWalk(t, AnxGrab{}, False{}, False{}, acc)
    case Con{nline, +r} AnxGrab{} False{} False{}:
      anexosWalk(r, AnxOpen{anexoName(nline)}, headTicks(r), False{}, acc)
    case Con{nline, +r} AnxGrab{} False{} True{}:
      anexosWalk(r, AnxOpen{anexoName(nline)}, headTicks(r), False{}, acc)
    case Con{nline, +r} AnxGrab{} True{} False{}:
      anexosWalk(r, AnxOpen{anexoName(nline)}, headTicks(r), False{}, acc)
    case Con{nline, +r} AnxGrab{} True{} True{}:
      anexosWalk(r, AnxOpen{anexoName(nline)}, headTicks(r), False{}, acc)
    case Con{_, +t} AnxOpen{name} False{} False{}:
      anexosWalk(t, AnxLook{}, headEmpty(t), sndAnexo(t), acc)
    case Con{_, +t} AnxOpen{name} False{} True{}:
      anexosWalk(t, AnxLook{}, headEmpty(t), sndAnexo(t), acc)
    case Con{_, +t} AnxOpen{name} True{} False{}:
      anexosWalk(t, AnxBody{name}, headTicks(t), False{}, acc)
    case Con{_, +t} AnxOpen{name} True{} True{}:
      anexosWalk(t, AnxBody{name}, headTicks(t), False{}, acc)
    case Con{_, +t} AnxBody{name} False{} False{}:
      anexosWalk(t, AnxBody{name}, headTicks(t), False{}, acc)
    case Con{_, +t} AnxBody{name} False{} True{}:
      anexosWalk(t, AnxBody{name}, headTicks(t), False{}, acc)
    case Con{_, +t} AnxBody{name} True{} False{}:
      anexosWalk(t, AnxLook{}, headEmpty(t), sndAnexo(t), Con{anexoShow(name), Con{SNil{}, acc}})
    case Con{_, +t} AnxBody{name} True{} True{}:
      anexosWalk(t, AnxLook{}, headEmpty(t), sndAnexo(t), Con{anexoShow(name), Con{SNil{}, acc}})

def display.anexos(s: String) -> String:
  +lines = strSplit(s, '\n')
  strJoin(
    anexosWalk(lines, AnxLook{}, headEmpty(lines), sndAnexo(lines), Nil{}),
    "\n"
  )

# `acc` guarda a saída invertida; a linha de busca (com a vazia anterior)
# some, como no ramo antigo.
def searchWalk(xs: List<&2, String>, st: SrchMode, empty: Bool, acc: List<&2, String>) ->
  List<&2, String>:
  match xs st empty:
    case Nil{} SrchLook{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} SrchLook{} True{}:
      List.reverse(&2, String, acc)
    case Nil{} SrchDrop{} False{}:
      List.reverse(&2, String, acc)
    case Nil{} SrchDrop{} True{}:
      List.reverse(&2, String, acc)
    case Con{h, +t} SrchLook{} False{}:
      searchWalk(t, SrchLook{}, headEmpty(t), Con{h, acc})
    case Con{h, +t} SrchLook{} True{}:
      searchWalk(t, SrchDrop{}, headSearch(t), acc)
    case Con{h, +t} SrchDrop{} False{}:
      searchWalk(t, SrchLook{}, headEmpty(t), Con{h, Con{SNil{}, acc}})
    case Con{_, +t} SrchDrop{} True{}:
      searchWalk(t, SrchLook{}, headEmpty(t), acc)

def display.search(s: String) -> String:
  +lines = strSplit(s, '\n')
  strJoin(searchWalk(lines, SrchLook{}, headEmpty(lines), Nil{}), "\n")

def displayUserText(text: String) -> String:
  String.trim_end(display.search(display.anexos(display.edit(text))))
