import Base
import ../sessionhandoff.bend as H

# ---------------------------------------------------------------------------
# Contrato da passagem de contexto entre sessões (#87). Prefixo `handoff_`.
#
# As leis fixam o que custaria estudo ao aluno:
#   1. nunca trocar sem origem liquidada, com entrega incerta, sem destino
#      pronto ou entre matérias diferentes;
#   2. nunca criar destino sem matéria e nunca descartar questão, materiais ou
#      falas quando existem;
#   3. recusar acima do teto de 50.000 caracteres;
#   4. sessão de motor fora da vista continua legível, sem prometer retomada
#      nativa.
#
# O plano da troca (origem preservada, destino novo) é um objeto JS do host:
# montar e ler os campos de volta no núcleo só repetiria o código (ADR 0003).
# O que não cabe aqui: ler o descritor/JSONL, montar o texto, o cartão e a
# lista (host e JS, ADR 0003).
# ---------------------------------------------------------------------------

# ---------- elegibilidade ----------

law handoff_switch_ok:
  {H.canSwitch(True{}, False{}, True{}, True{}) == True{} : Bool}

law handoff_source_not_settled:
  {H.canSwitch(False{}, False{}, True{}, True{}) == False{} : Bool}

law handoff_source_uncertain:
  {H.canSwitch(True{}, True{}, True{}, True{}) == False{} : Bool}

law handoff_target_not_ready:
  {H.canSwitch(True{}, False{}, False{}, True{}) == False{} : Bool}

law handoff_other_course:
  {H.canSwitch(True{}, False{}, True{}, False{}) == False{} : Bool}

# ---------- teto ----------

law handoff_cap:
  {H.handoffCap() == 50000n : Nat}

law handoff_within_cap:
  {H.withinCap(50000n) == True{} : Bool}

law handoff_above_cap:
  {H.withinCap(50001n) == False{} : Bool}

law handoff_empty_within_cap:
  {H.withinCap(0n) == True{} : Bool}

# ---------- seções ----------

law handoff_no_facts:
  {H.handoffSections(False{}, False{}, False{}, False{}) == Nil{} : List<&2, H.HandoffSection>}

law handoff_course_only:
  {H.handoffSections(True{}, False{}, False{}, False{})
    == [H.HandoffSection.Course{}] : List<&2, H.HandoffSection>}

law handoff_exercise_kept:
  {H.handoffSections(True{}, True{}, False{}, False{})
    == [H.HandoffSection.Course{}, H.HandoffSection.Exercise{}] : List<&2, H.HandoffSection>}

law handoff_materials_kept:
  {H.handoffSections(True{}, False{}, True{}, False{})
    == [H.HandoffSection.Course{}, H.HandoffSection.Materials{}] : List<&2, H.HandoffSection>}

law handoff_turns_kept:
  {H.handoffSections(True{}, False{}, False{}, True{})
    == [H.HandoffSection.Course{}, H.HandoffSection.Turns{}] : List<&2, H.HandoffSection>}

law handoff_all_sections_in_order:
  {H.handoffSections(True{}, True{}, True{}, True{})
    == [ H.HandoffSection.Course{}
       , H.HandoffSection.Exercise{}
       , H.HandoffSection.Materials{}
       , H.HandoffSection.Turns{}
       ] : List<&2, H.HandoffSection>}

# Questão/materiais/falas nunca entram sem matéria: a troca exige `sameCourse`.
law handoff_no_course_no_materials:
  {H.handoffSections(False{}, False{}, True{}, False{}) == Nil{} : List<&2, H.HandoffSection>}

# ---------- sessão antiga ----------

law handoff_legacy_pi:
  {H.canContinueLegacy("pi", False{}, False{}) == True{} : Bool}

law handoff_legacy_hidden_native:
  {H.canContinueLegacy("claude", False{}, True{}) == True{} : Bool}

law handoff_visible_native_not_legacy:
  {H.canContinueLegacy("opencode", True{}, True{}) == False{} : Bool}

law handoff_unknown_engine_not_legacy:
  {H.canContinueLegacy("outro", False{}, False{}) == False{} : Bool}
