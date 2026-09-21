import Base
import ../laws/view.bend as Laws
import ../view.bend as V

# Provas das leis da fundação da view. Aceitador: `bend proofs/view.bend`.
# Reescrita com `Equal.sym` para o `%` (buraco onde b aparece).

def Laws.view_concat_id_left(xs):
  {==}

def Laws.view_concat_id_right(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Equal.sym(List<&2, V.ViewNode>, V.viewConcat(t, Nil{}), t, Laws.view_concat_id_right(t)) : {Con{h, _} == Con{h, t} : List<&2, V.ViewNode>}
      {==}

def Laws.view_concat_assoc(a, b, c):
  match a:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Equal.sym(
        List<&2, V.ViewNode>,
        V.viewConcat(V.viewConcat(t, b), c),
        V.viewConcat(t, V.viewConcat(b, c)),
        Laws.view_concat_assoc(t, b, c)
      ) : {Con{h, _} == Con{h, V.viewConcat(t, V.viewConcat(b, c))} : List<&2, V.ViewNode>}
      {==}

def Laws.view_join_vazio():
  {==}

def Laws.view_join_singleton(xs):
  Laws.view_concat_id_right(xs)

def Laws.view_join_dois(a, b):
  %Equal.sym(List<&2, V.ViewNode>, V.viewConcat(b, Nil{}), b, Laws.view_concat_id_right(b)) : {V.viewConcat(a, _) == V.viewConcat(a, b) : List<&2, V.ViewNode>}
  {==}

def Laws.view_when_true(n):
  {==}

def Laws.view_when_false(n):
  {==}

def Laws.view_whenAll_true(xs):
  {==}

def Laws.view_whenAll_false(xs):
  {==}

def Laws.view_attr_ordem(tag, attrs, kids):
  {==}

def Laws.view_el_tag(tag, attrs, kids):
  {==}

def Laws.view_el_kids(tag, attrs, kids):
  {==}

def Laws.view_text_guarda(s):
  {==}

def Laws.view_attr_vazio(name):
  {==}

def Laws.view_attr_choose_true(av, rest):
  {==}

def Laws.view_attr_choose_false(av, rest):
  {==}

def Laws.view_attr_acha():
  {==}

def Laws.view_attr_nao_acha():
  {==}

def Laws.view_attr_primeiro():
  {==}

def Laws.view_attrWhen_true(a):
  {==}

def Laws.view_attrWhen_false(a):
  {==}

def Laws.view_classes_vazia():
  {==}

def Laws.view_classes_off_cabeca(name, t):
  {==}

def Laws.view_classes_nome_vazio():
  {==}

def Laws.view_classes_mistas():
  {==}

def Laws.view_map_len(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Equal.sym(Nat, List.length(&2, V.ViewNode, V.viewMapText(t)), List.length(&2, String, t), Laws.view_map_len(t)) : {1n+_ == 1n+List.length(&2, String, t) : Nat}
      {==}

def Laws.view_mapI_go_len(xs, i):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Equal.sym(Nat, List.length(&2, V.ViewNode, V.viewMapTextI.go(t, Nat.add(i, 1n))), List.length(&2, String, t), Laws.view_mapI_go_len(t, Nat.add(i, 1n))) : {1n+_ == 1n+List.length(&2, String, t) : Nat}
      {==}

def Laws.view_mapI_len(xs):
  Laws.view_mapI_go_len(xs, 0n)
