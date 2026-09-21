import Base
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da fundação da view. Prefixo `view_`.
#
# Join/when/ordem de attrs/choose de attr e classes-off reduzem em geral
# (fatos Bool ou List.append). Lookup público `attrGet` e classes-on com
# nome livre não: String.eq / String.is_empty são valor computado — essas
# leis ficam em cenários concretos. `viewMap` é template; o comprimento
# fala da instância `viewMapText` / `viewMapTextI`.
# ---------------------------------------------------------------------------

# ---------- join: identidade e associatividade ----------

law view_concat_id_left:
  for xs: List<&2, V.ViewNode>
  {V.viewConcat(Nil{}, xs) == xs : List<&2, V.ViewNode>}

law view_concat_id_right:
  for xs: List<&2, V.ViewNode>
  {V.viewConcat(xs, Nil{}) == xs : List<&2, V.ViewNode>}

law view_concat_assoc:
  for a: List<&2, V.ViewNode>
  for b: List<&2, V.ViewNode>
  for c: List<&2, V.ViewNode>
  {V.viewConcat(V.viewConcat(a, b), c) == V.viewConcat(a, V.viewConcat(b, c)) : List<&2, V.ViewNode>}

law view_join_vazio:
  {V.viewJoin(Nil{}) == Nil{} : List<&2, V.ViewNode>}

law view_join_singleton:
  for xs: List<&2, V.ViewNode>
  {V.viewJoin(Con{xs, Nil{}}) == xs : List<&2, V.ViewNode>}

law view_join_dois:
  for a: List<&2, V.ViewNode>
  for b: List<&2, V.ViewNode>
  {V.viewJoin(Con{a, Con{b, Nil{}}}) == V.viewConcat(a, b) : List<&2, V.ViewNode>}

# ---------- when ----------

law view_when_true:
  for n: V.ViewNode
  {V.viewWhen(True{}, n) == Con{n, Nil{}} : List<&2, V.ViewNode>}

law view_when_false:
  for n: V.ViewNode
  {V.viewWhen(False{}, n) == Nil{} : List<&2, V.ViewNode>}

law view_whenAll_true:
  for xs: List<&2, V.ViewNode>
  {V.viewWhenAll(True{}, xs) == xs : List<&2, V.ViewNode>}

law view_whenAll_false:
  for xs: List<&2, V.ViewNode>
  {V.viewWhenAll(False{}, xs) == Nil{} : List<&2, V.ViewNode>}

# ---------- ordem de attrs / extratores do elemento ----------

law view_attr_ordem:
  for tag: String
  for attrs: List<&2, V.ViewAttr>
  for kids: List<&2, V.ViewNode>
  {V.attrsOf(V.viewEl(tag, attrs, kids)) == attrs : List<&2, V.ViewAttr>}

law view_el_tag:
  for tag: String
  for attrs: List<&2, V.ViewAttr>
  for kids: List<&2, V.ViewNode>
  {V.tagOf(V.viewEl(tag, attrs, kids)) == tag : String}

law view_el_kids:
  for tag: String
  for attrs: List<&2, V.ViewAttr>
  for kids: List<&2, V.ViewNode>
  {V.kidsOf(V.viewEl(tag, attrs, kids)) == kids : List<&2, V.ViewNode>}

law view_text_guarda:
  for s: String
  {V.textOf(V.viewText(s)) == s : String}

# ---------- lookup de attr ----------

law view_attr_vazio:
  for name: String
  {V.attrGet(Nil{}, name) == None{} : Maybe<&2, String>}

law view_attr_choose_true:
  for av: String
  for rest: Maybe<&2, String>
  {V.attrGet.choose(av, rest, True{}) == Some{av} : Maybe<&2, String>}

law view_attr_choose_false:
  for av: String
  for rest: Maybe<&2, String>
  {V.attrGet.choose(av, rest, False{}) == rest : Maybe<&2, String>}

# String.eq não reduz em String livre: acha / não acha / primeiro são concretos.
law view_attr_acha:
  {V.attrGet([V.ViewAttr{"id", "x"}, V.ViewAttr{"class", "y"}], "id") == Some{"x"} : Maybe<&2, String>}

law view_attr_nao_acha:
  {V.attrGet([V.ViewAttr{"id", "x"}], "class") == None{} : Maybe<&2, String>}

law view_attr_primeiro:
  {V.attrGet([V.ViewAttr{"id", "a"}, V.ViewAttr{"id", "b"}], "id") == Some{"a"} : Maybe<&2, String>}

law view_attrWhen_true:
  for a: V.ViewAttr
  {V.attrWhen(True{}, a) == Con{a, Nil{}} : List<&2, V.ViewAttr>}

law view_attrWhen_false:
  for a: V.ViewAttr
  {V.attrWhen(False{}, a) == Nil{} : List<&2, V.ViewAttr>}

# ---------- classes condicionais ----------

law view_classes_vazia:
  {V.classes(Nil{}) == V.ViewAttr{"class", ""} : V.ViewAttr}

# Cabeça desligada some; o resto decide.
law view_classes_off_cabeca:
  for name: String
  for t: List<&2, V.ViewClass>
  {V.classes(Con{V.ViewClass{name, False{}}, t}) == V.classes(t) : V.ViewAttr}

# Nome vazio, mesmo ligado, não entra (nem gera espaço).
law view_classes_nome_vazio:
  {V.classes([V.ViewClass{"", True{}}]) == V.ViewAttr{"class", ""} : V.ViewAttr}

# Ordem preservada; False no meio some.
law view_classes_mistas:
  {V.classes([V.ViewClass{"hidden", True{}}, V.ViewClass{"open", False{}}, V.ViewClass{"busy", True{}}]) == V.ViewAttr{"class", "hidden busy"} : V.ViewAttr}

# ---------- map preserva comprimento ----------

law view_map_len:
  for xs: List<&2, String>
  {List.length(&2, V.ViewNode, V.viewMapText(xs)) == List.length(&2, String, xs) : Nat}

law view_mapI_go_len:
  for xs: List<&2, String>
  for i: Nat
  {List.length(&2, V.ViewNode, V.viewMapTextI.go(xs, i)) == List.length(&2, String, xs) : Nat}

law view_mapI_len:
  for xs: List<&2, String>
  {List.length(&2, V.ViewNode, V.viewMapTextI(xs)) == List.length(&2, String, xs) : Nat}
