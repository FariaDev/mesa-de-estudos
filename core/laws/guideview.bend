import Base
import ../msg.bend as M
import ../guideview.bend as N
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato do Guia da Mesa. Prefixo `guide_`.
#
# Os ids e as listas são concretos: `String.eq` só reduz em valores concretos.
# ---------------------------------------------------------------------------

def hitsTutorRevisao() -> List<&2, String>:
  Con{"revisao", Con{"tutor", Nil{}}}

def hitsOnlyCalc() -> List<&2, String>:
  Con{"calc", Nil{}}

def visFiltered() -> List<&2, String>:
  N.guideVisible(hitsTutorRevisao())

def firstKid(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

def secondKid(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      firstKid(t)

def thirdKid(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      secondKid(t)

def kidCount(xs: List<&2, V.ViewNode>) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{h, t}:
      Nat.add(1n, kidCount(t))

# ---------- a ordem da lateral ----------

law guide_order_is_the_sidebar:
  {N.guideAll() == Con{"comecar", Con{"tutor", Con{"leitores", Con{"lateral", Con{"revisao", Con{"calc", Con{"atalhos", Nil{}}}}}}}} : List<&2, String>}

law guide_labels_follow_the_sidebar:
  {N.guideLabel("lateral") == M.msg("guide.label.lateral") : String}

law guide_label_unknown_is_empty:
  {N.guideLabel("outra") == "" : String}

law guide_title_start:
  {N.guideTitle("comecar") == M.msg("guide.sectionTitle.comecar") : String}

law guide_title_keys_repeats_label:
  {N.guideTitle("atalhos") == N.guideLabel("atalhos") : String}

law guide_crumb_is_label:
  {N.guideCrumb("revisao") == M.msg("guide.label.revisao") : String}

# ---------- Próximo e Anterior ----------

law guide_next_of_start:
  {N.guideNext(N.guideAll(), "comecar") == "tutor" : String}

law guide_next_middle:
  {N.guideNext(N.guideAll(), "lateral") == "revisao" : String}

law guide_next_before_last:
  {N.guideNext(N.guideAll(), "calc") == "atalhos" : String}

# A última seção não tem Próximo.
law guide_last_has_no_next:
  {N.guideNext(N.guideAll(), "atalhos") == "" : String}

# A primeira seção não tem Anterior.
law guide_first_has_no_prev:
  {N.guidePrev(N.guideAll(), "comecar") == "" : String}

law guide_prev_of_second:
  {N.guidePrev(N.guideAll(), "tutor") == "comecar" : String}

law guide_prev_of_last:
  {N.guidePrev(N.guideAll(), "atalhos") == "calc" : String}

# Andar de Próximo em Próximo, a partir da primeira, passa por todas e acaba
# na última.
law guide_walk_next_reaches_last:
  {N.guideNext(N.guideAll(), N.guideNext(N.guideAll(), N.guideNext(N.guideAll(), N.guideNext(N.guideAll(), N.guideNext(N.guideAll(), N.guideNext(N.guideAll(), "comecar")))))) == "atalhos" : String}

# E de volta por Anterior, a partir da última.
law guide_walk_prev_reaches_first:
  {N.guidePrev(N.guideAll(), N.guidePrev(N.guideAll(), N.guidePrev(N.guideAll(), N.guidePrev(N.guideAll(), N.guidePrev(N.guideAll(), N.guidePrev(N.guideAll(), "atalhos")))))) == "comecar" : String}

law guide_next_of_unknown_is_empty:
  {N.guideNext(N.guideAll(), "outra") == "" : String}

law guide_prev_of_unknown_is_empty:
  {N.guidePrev(N.guideAll(), "outra") == "" : String}

# ---------- rótulos do fim da seção ----------

law guide_next_label:
  {N.guideNextLabel(N.guideAll(), "comecar") == M.msg1("guide.next", "section", "guide.label.tutor") : String}

law guide_next_label_names_the_next_section:
  {N.guideNextLabel(N.guideAll(), "calc") == M.msg1("guide.next", "section", "guide.label.atalhos") : String}

law guide_next_label_last_is_empty:
  {N.guideNextLabel(N.guideAll(), "atalhos") == "" : String}

law guide_prev_label:
  {N.guidePrevLabel(N.guideAll(), "tutor") == M.msg("guide.prev") : String}

law guide_prev_label_first_is_empty:
  {N.guidePrevLabel(N.guideAll(), "comecar") == "" : String}

# ---------- busca ----------

law guide_visible_keeps_canonical_order:
  {visFiltered() == Con{"tutor", Con{"revisao", Nil{}}} : List<&2, String>}

law guide_visible_all_when_every_section_matches:
  {N.guideVisible(N.guideAll()) == N.guideAll() : List<&2, String>}

law guide_visible_none:
  {N.guideVisible(Nil{}) == Nil{} : List<&2, String>}

law guide_visible_drops_unknown_ids:
  {N.guideVisible(Con{"outra", Con{"calc", Nil{}}}) == hitsOnlyCalc() : List<&2, String>}

# Com a busca, o Próximo pula as seções que não casaram.
law guide_next_skips_hidden:
  {N.guideNext(visFiltered(), "tutor") == "revisao" : String}

law guide_prev_skips_hidden:
  {N.guidePrev(visFiltered(), "revisao") == "tutor" : String}

law guide_filtered_last_has_no_next:
  {N.guideNext(visFiltered(), "revisao") == "" : String}

law guide_filtered_label_names_visible_next:
  {N.guideNextLabel(visFiltered(), "tutor") == M.msg1("guide.next", "section", "guide.label.revisao") : String}

# A seção ativa que sai da busca cede a vez à primeira que sobrou.
law guide_current_keeps_a_visible_section:
  {N.guideCurrent(visFiltered(), "revisao") == "revisao" : String}

law guide_current_falls_to_first_visible:
  {N.guideCurrent(visFiltered(), "calc") == "tutor" : String}

law guide_current_empty_when_nothing_matches:
  {N.guideCurrent(Nil{}, "tutor") == "" : String}

# ---------- nós ----------

law guide_nav_one_button_per_visible_section:
  {kidCount(N.guideNavNodes(N.guideAll(), "tutor")) == 7n : Nat}

law guide_nav_filtered_count:
  {kidCount(N.guideNavNodes(visFiltered(), "tutor")) == 2n : Nat}

law guide_nav_marks_the_current_as_page:
  {V.attrGet(V.attrsOf(secondKid(N.guideNavNodes(N.guideAll(), "tutor"))), "aria-current") == Some{"page"} : Maybe<&2, String>}

law guide_nav_others_are_not_current:
  {V.attrGet(V.attrsOf(firstKid(N.guideNavNodes(N.guideAll(), "tutor"))), "aria-current") == Some{"false"} : Maybe<&2, String>}

law guide_nav_carries_the_section:
  {V.attrGet(V.attrsOf(thirdKid(N.guideNavNodes(N.guideAll(), "tutor"))), "data-section") == Some{"leitores"} : Maybe<&2, String>}

law guide_nav_label:
  {V.textOf(firstKid(V.kidsOf(thirdKid(N.guideNavNodes(N.guideAll(), "tutor"))))) == M.msg("guide.label.leitores") : String}

law guide_nav_handler:
  {V.attrGet(V.attrsOf(firstKid(N.guideNavNodes(N.guideAll(), "tutor"))), "on:click") == Some{"GuidePick"} : Maybe<&2, String>}

# Fim da seção: Anterior e Próximo no meio; só Próximo na primeira; só
# Anterior na última.
law guide_foot_middle_has_both:
  {kidCount(N.guideFoot(N.guideAll(), "lateral")) == 2n : Nat}

law guide_foot_first_has_only_next:
  {kidCount(N.guideFoot(N.guideAll(), "comecar")) == 1n : Nat}

law guide_foot_last_has_only_prev:
  {kidCount(N.guideFoot(N.guideAll(), "atalhos")) == 1n : Nat}

law guide_foot_order_prev_then_next:
  {V.attrGet(V.attrsOf(firstKid(N.guideFoot(N.guideAll(), "lateral"))), "data-section") == Some{"leitores"} : Maybe<&2, String>}

law guide_foot_next_target:
  {V.attrGet(V.attrsOf(secondKid(N.guideFoot(N.guideAll(), "lateral"))), "data-section") == Some{"revisao"} : Maybe<&2, String>}

law guide_foot_next_text:
  {V.textOf(firstKid(V.kidsOf(secondKid(N.guideFoot(N.guideAll(), "lateral"))))) == M.msg1("guide.next", "section", "guide.label.revisao") : String}

law guide_foot_last_is_prev:
  {V.textOf(firstKid(V.kidsOf(firstKid(N.guideFoot(N.guideAll(), "atalhos"))))) == M.msg("guide.prev") : String}

law guide_foot_empty_search_has_no_steps:
  {kidCount(N.guideFoot(Nil{}, "")) == 0n : Nat}
