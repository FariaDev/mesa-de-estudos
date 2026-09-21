import Base

# ---------------------------------------------------------------------------
# Fundação da view (sem telas): árvore de nós que o host aplica no DOM.
#
# O núcleo é puro — não cria elementos, não faz innerHTML, não faz diff.
# Telas posteriores devolvem `ViewNode`; o renderer Electron (aplicador fino)
# anda a árvore e faz `createElement` / `createTextNode` / `setAttribute`.
#
# Atributos são lista de pares nome/valor **em ordem**. Convenções de nome
# (o núcleo não interpreta, o host liga):
#   class, id, type, title, key, data-*, aria-*
#   on:<evento>  — eventos reservados: click, input, change, submit, keydown
#                  (o valor é o nome do handler; o host consulta a tabela)
# `key` é um attr como os outros, não um campo extra: o host pode usar
# `attrGet(attrs, "key")` para identidade de lista na hora de aplicar.
# Primeiro casamento vence — e o host aplica a mesma política: só o primeiro
# attr de cada nome chega ao DOM (`on:<evento>` pendura no máximo um listener).
# O host pula `class`/`id` vazios; os demais attrs vão como estão —
# `attr("hidden", "")` é intencional e não é omitido.
#
# `viewMap` / `viewMapI` são templates (`~f` fechado, inlined). Telas Bend
# passam um def de topo. O host JS mapeia em JS e junta com `viewJoin` /
# `viewWhen`. `viewMapText` / `viewMapTextI` são as instâncias das leis.
#
# Artefato JS: listas `{$:'Con',head,tail}` / `{$:'Nil'}`; registros com
# `$:"ViewEl"` / `$:"ViewText"` / `$:"ViewAttr"` / `$:"ViewClass"`.
# Bool vira boolean; Nat vira BigInt. Sem referência para frente.
# ---------------------------------------------------------------------------

type ViewAttr is Data:
  ViewAttr{name: String, value: String}

# Par nome/ligado para `classes`: só os `on=True` entram, na ordem, separados
# por espaço. Nome vazio é ignorado (não gera espaço extra).
type ViewClass is Data:
  ViewClass{name: String, on: Bool}

type ViewNode is Data:
  ViewEl{tag: String, attrs: +List<ViewAttr>, kids: +List<ViewNode>}
  ViewText{text: String}

# ---------- construtores ----------

def attr(name: String, value: String) -> ViewAttr:
  ViewAttr{name, value}

def classOn(name: String, on: Bool) -> ViewClass:
  ViewClass{name, on}

def viewEl(tag: String, attrs: List<&2, ViewAttr>, kids: List<&2, ViewNode>) -> ViewNode:
  ViewEl{tag, attrs, kids}

def viewText(s: String) -> ViewNode:
  ViewText{s}

# Prepende `key` (convenção de lista). O núcleo não interpreta o valor.
def viewKey(tag: String, key: String, attrs: List<&2, ViewAttr>, kids: List<&2, ViewNode>) -> ViewNode:
  viewEl(tag, Con{ViewAttr{"key", key}, attrs}, kids)

# ---------- extratores (o host também pode ler os campos do artefato) ----------

def tagOf(n: ViewNode) -> String:
  match n:
    case ViewEl{tag, attrs, kids}:
      tag
    case ViewText{text}:
      ""

def attrsOf(n: ViewNode) -> List<&2, ViewAttr>:
  match n:
    case ViewEl{tag, attrs, kids}:
      attrs
    case ViewText{text}:
      Nil{}

def kidsOf(n: ViewNode) -> List<&2, ViewNode>:
  match n:
    case ViewEl{tag, attrs, kids}:
      kids
    case ViewText{text}:
      Nil{}

def textOf(n: ViewNode) -> String:
  match n:
    case ViewEl{tag, attrs, kids}:
      ""
    case ViewText{text}:
      text

def isEl(n: ViewNode) -> Bool:
  match n:
    case ViewEl{tag, attrs, kids}:
      True{}
    case ViewText{text}:
      False{}

def isText(n: ViewNode) -> Bool:
  match n:
    case ViewEl{tag, attrs, kids}:
      False{}
    case ViewText{text}:
      True{}

# ---------- lookup de attr: primeiro casamento vence ----------
# `same` é o fato (String.eq já resolvido). choose não recorre; o walker
# recorre só na cauda — sem recursão mútua.

def attrGet.choose(av: String, rest: Maybe<&2, String>, same: Bool) -> Maybe<&2, String>:
  match same:
    case True{}:
      Some{av}
    case False{}:
      rest

def attrGet.go(attrs: List<&2, ViewAttr>, +name: String) -> Maybe<&2, String>:
  match attrs:
    case Nil{}:
      None{}
    case Con{h, t}:
      match h:
        case ViewAttr{an, av}:
          attrGet.choose(av, attrGet.go(t, name), String.eq(an, name))

def attrGet(attrs: List<&2, ViewAttr>, name: String) -> Maybe<&2, String>:
  attrGet.go(attrs, name)

# ---------- attrs: opcional, concat, convenções de nome ----------

def attrWhen(cond: Bool, a: ViewAttr) -> List<&2, ViewAttr>:
  match cond:
    case True{}:
      Con{a, Nil{}}
    case False{}:
      Nil{}

def attrConcat(xs: List<&2, ViewAttr>, ys: List<&2, ViewAttr>) -> List<&2, ViewAttr>:
  List.append(&2, ViewAttr, xs, ys)

def attrJoin(xss: List<&2, List<&2, ViewAttr>>) -> List<&2, ViewAttr>:
  List.concat(&2, ViewAttr, xss)

def attrId(value: String) -> ViewAttr:
  ViewAttr{"id", value}

def attrClass(value: String) -> ViewAttr:
  ViewAttr{"class", value}

def attrType(value: String) -> ViewAttr:
  ViewAttr{"type", value}

def attrTitle(value: String) -> ViewAttr:
  ViewAttr{"title", value}

def attrKey(value: String) -> ViewAttr:
  ViewAttr{"key", value}

def attrOn(event: String, handler: String) -> ViewAttr:
  ViewAttr{String.append("on:", event), handler}

def attrData(name: String, value: String) -> ViewAttr:
  ViewAttr{String.append("data-", name), value}

def attrAria(name: String, value: String) -> ViewAttr:
  ViewAttr{String.append("aria-", name), value}

def boolStr(on: Bool) -> String:
  match on:
    case True{}:
      "true"
    case False{}:
      "false"

# aria-pressed / aria-expanded / aria-hidden, etc.
def attrBool(name: String, on: Bool) -> ViewAttr:
  ViewAttr{name, boolStr(on)}

# ---------- classes condicionais ----------
# Walker único; helpers só calculam o próximo acumulador.

def classAppend.empty(acc: String, name: String, empty: Bool) -> String:
  match empty:
    case True{}:
      name
    case False{}:
      String.append(acc, String.append(" ", name))

def classAppend(+acc: String, name: String) -> String:
  classAppend.empty(acc, name, String.is_empty(acc))

def classNext.emptyName(name: String, acc: String, emptyName: Bool) -> String:
  match emptyName:
    case True{}:
      acc
    case False{}:
      classAppend(acc, name)

def classNext.on(+name: String, on: Bool, acc: String) -> String:
  match on:
    case False{}:
      acc
    case True{}:
      classNext.emptyName(name, acc, String.is_empty(name))

def classValue.go(xs: List<&2, ViewClass>, acc: String) -> String:
  match xs:
    case Nil{}:
      acc
    case Con{h, t}:
      match h:
        case ViewClass{name, on}:
          classValue.go(t, classNext.on(name, on, acc))

def classValue(xs: List<&2, ViewClass>) -> String:
  classValue.go(xs, "")

def classes(xs: List<&2, ViewClass>) -> ViewAttr:
  ViewAttr{"class", classValue(xs)}

# ---------- nós: when / join ----------

def viewWhen(cond: Bool, node: ViewNode) -> List<&2, ViewNode>:
  match cond:
    case True{}:
      Con{node, Nil{}}
    case False{}:
      Nil{}

def viewWhenAll(cond: Bool, nodes: List<&2, ViewNode>) -> List<&2, ViewNode>:
  match cond:
    case True{}:
      nodes
    case False{}:
      Nil{}

def viewConcat(xs: List<&2, ViewNode>, ys: List<&2, ViewNode>) -> List<&2, ViewNode>:
  List.append(&2, ViewNode, xs, ys)

def viewJoin(xss: List<&2, List<&2, ViewNode>>) -> List<&2, ViewNode>:
  List.concat(&2, ViewNode, xss)

# ---------- map (template) e instâncias das leis ----------

def viewMap(~A: Data, ~f: A -> ViewNode, xs: List<&2, A>) -> List<&2, ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{f(h), viewMap(~A, ~f, t)}

def viewMapI.go(~A: Data, ~f: Nat -> A -> ViewNode, xs: List<&2, A>, +i: Nat) -> List<&2, ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{f(i, h), viewMapI.go(~A, ~f, t, Nat.add(i, 1n))}

def viewMapI(~A: Data, ~f: Nat -> A -> ViewNode, xs: List<&2, A>) -> List<&2, ViewNode>:
  viewMapI.go(~A, ~f, xs, 0n)

def viewMapText(xs: List<&2, String>) -> List<&2, ViewNode>:
  viewMap(~String, ~viewText, xs)

# Instância de `viewMapI` para as leis de comprimento (o índice não muda o nó).
def asTextI(i: Nat, s: String) -> ViewNode:
  viewText(s)

def viewMapTextI.go(xs: List<&2, String>, i: Nat) -> List<&2, ViewNode>:
  viewMapI.go(~String, ~asTextI, xs, i)

def viewMapTextI(xs: List<&2, String>) -> List<&2, ViewNode>:
  viewMapTextI.go(xs, 0n)
