import Base
import ../freeworkspaces.bend as N

# ---------------------------------------------------------------------------
# Contrato do workspace da aba Livre. Prefixo `fw_`.
#
# Os fatos chegam resolvidos (strings concretas) e as leis fecham em cenários
# concretos: os tetos são pinados, o recorte tem caso curto/longo e a sequência
# de nomes prova que a tentativa 0, 1 e 2 produzem nomes DISTINTOS — é o que
# impede a promoção e a importação de sobrescrever um arquivo do usuário.
# ---------------------------------------------------------------------------

# ---------- tetos ----------

law fw_max_title:
  {N.maxTitle() == 120n : Nat}

law fw_max_name:
  {N.maxName() == 240n : Nat}

law fw_max_draft_chars:
  {N.maxDraftChars() == 262144n : Nat}

law fw_max_materials:
  {N.maxMaterials() == 200n : Nat}

law fw_max_slug:
  {N.maxSlug() == 60n : Nat}

# ---------- a matéria reservada ----------

law fw_free_course_id:
  {N.freeCourseId() == "mesa-free" : String}

law fw_free_course_name:
  {N.freeCourseName() == "Livre" : String}

law fw_default_title:
  {N.defaultTitle() == "Conversa livre" : String}

law fw_is_free_course_id_yes:
  {N.isFreeCourseId("mesa-free") == True{} : Bool}

law fw_is_free_course_id_no:
  {N.isFreeCourseId("Calculus I") == False{} : Bool}

# ---------- recorte ----------

law fw_cut_long:
  {N.cut("limites", 3n) == "lim" : String}

law fw_cut_short:
  {N.cut("li", 3n) == "li" : String}

law fw_fit_title_trims:
  {N.fitTitle("  Calculo I  ") == "Calculo I" : String}

law fw_fit_title_short:
  {N.fitTitle("abc") == "abc" : String}

law fw_fit_title_caps:
  {String.length(N.fitTitle(String.repeat("x", 130n))) == 120n : Nat}

law fw_fit_name_trims:
  {N.fitName("  Limites.pdf  ") == "Limites.pdf" : String}

# O rascunho grande não tem função de corte no núcleo de propósito (o
# `String.take` da Base estoura a pilha em ~10k chars): quem corta é o host,
# com o teto pinado aqui.

law fw_fit_title_blank_default:
  {N.fitTitleOr("   ") == "Conversa livre" : String}

law fw_fit_title_or_trims:
  {N.fitTitleOr("  Calculo  ") == "Calculo" : String}

# ---------- promovido ----------

law fw_is_promoted_empty:
  {N.isPromoted("   ") == False{} : Bool}

law fw_is_promoted_value:
  {N.isPromoted("calculo-i") == True{} : Bool}

# ---------- sequência de nomes únicos ----------

law fw_candidate_base:
  {N.candidateName("Limites", ".pdf", 0n) == "Limites.pdf" : String}

law fw_candidate_two:
  {N.candidateName("Limites", ".pdf", 1n) == "Limites-2.pdf" : String}

law fw_candidate_three:
  {N.candidateName("Limites", ".pdf", 2n) == "Limites-3.pdf" : String}

law fw_candidate_ten:
  {N.candidateName("Limites", ".pdf", 9n) == "Limites-10.pdf" : String}

# Tentativas diferentes nunca devolvem o mesmo nome (é o que permite ao host
# avançar sem sobrescrever).
law fw_candidate_distinct:
  {Bool.not(String.eq(N.candidateName("Limites", ".pdf", 0n), N.candidateName("Limites", ".pdf", 1n))) == True{} : Bool}

law fw_candidate_distinct_more:
  {Bool.not(String.eq(N.candidateName("Limites", ".pdf", 1n), N.candidateName("Limites", ".pdf", 2n))) == True{} : Bool}

# O stem é usado como veio: quem sanitiza o nome base é o host, uma vez.
law fw_candidate_stem_verbatim:
  {N.candidateName("a-2", ".pdf", 1n) == "a-2-2.pdf" : String}

law fw_candidate_folder_two:
  {N.candidateFolder("calculo-i", 1n) == "calculo-i-2" : String}

law fw_candidate_folder_base:
  {N.candidateFolder("calculo-i", 0n) == "calculo-i" : String}
