import Base
import ../materialmodel.bend as M
import ../msg.bend as X

# ---------------------------------------------------------------------------
# Contrato dos modelos de PDF do tutor (ticket #39). Prefixo `mm_`.
#
# Os fatos chegam como strings concretas (o host entrega o texto cru; ausência
# ou tipo errado vira `None`) e cada lei fecha em cenário concreto: a ordem dos
# seis modelos, a precedência pedido → último → livre, as opções válidas de
# cada modelo, as colunas do Auto no limite exato de largura, a altura do
# espaço de resposta e as frases que o diálogo mostra.
# ---------------------------------------------------------------------------

# ---------- a lista e a ordem ----------

law mm_model_count:
  {M.modelCount() == 6n : Nat}

law mm_model_at_0:
  {M.modelIdAt(0n) == "lista" : String}

law mm_model_at_1:
  {M.modelIdAt(1n) == "apostila" : String}

law mm_model_at_2:
  {M.modelIdAt(2n) == "resumo" : String}

law mm_model_at_3:
  {M.modelIdAt(3n) == "simulado" : String}

law mm_model_at_4:
  {M.modelIdAt(4n) == "formulario" : String}

law mm_model_at_5:
  {M.modelIdAt(5n) == "livre" : String}

law mm_model_at_out_of_range_is_livre:
  {M.modelIdAt(9n) == "livre" : String}

law mm_default_is_livre:
  {M.modelId(M.modelDefault()) == "livre" : String}

# ---------- parse: nomes concretos; o resto cai no fallback ----------

law mm_parse_lista:
  for fallback: M.MaterialModel
  {M.parseModel("lista", fallback) == M.ModelLista{} : M.MaterialModel}

law mm_parse_apostila:
  for fallback: M.MaterialModel
  {M.parseModel("apostila", fallback) == M.ModelApostila{} : M.MaterialModel}

law mm_parse_resumo:
  for fallback: M.MaterialModel
  {M.parseModel("resumo", fallback) == M.ModelResumo{} : M.MaterialModel}

law mm_parse_simulado:
  for fallback: M.MaterialModel
  {M.parseModel("simulado", fallback) == M.ModelSimulado{} : M.MaterialModel}

law mm_parse_formulario:
  for fallback: M.MaterialModel
  {M.parseModel("formulario", fallback) == M.ModelFormulario{} : M.MaterialModel}

law mm_parse_livre:
  for fallback: M.MaterialModel
  {M.parseModel("livre", fallback) == M.ModelLivre{} : M.MaterialModel}

law mm_parse_unknown_falls_back:
  for fallback: M.MaterialModel
  {M.parseModel("prova", fallback) == fallback : M.MaterialModel}

law mm_parse_case_sensitive:
  for fallback: M.MaterialModel
  {M.parseModel("Lista", fallback) == fallback : M.MaterialModel}

law mm_parse_padded_falls_back:
  for fallback: M.MaterialModel
  {M.parseModel("lista ", fallback) == fallback : M.MaterialModel}

law mm_parse_accented_falls_back:
  for fallback: M.MaterialModel
  {M.parseModel("formulário", fallback) == fallback : M.MaterialModel}

law mm_parse_empty_falls_back:
  for fallback: M.MaterialModel
  {M.parseModel("", fallback) == fallback : M.MaterialModel}

law mm_known_lista:
  {M.isKnownModel("lista") == True{} : Bool}

law mm_known_livre:
  {M.isKnownModel("livre") == True{} : Bool}

law mm_known_formulario:
  {M.isKnownModel("formulario") == True{} : Bool}

law mm_unknown_is_not_known:
  {M.isKnownModel("prova") == False{} : Bool}

law mm_empty_is_not_known:
  {M.isKnownModel("") == False{} : Bool}

# ---------- qual modelo vale: pedido → último → livre ----------

law mm_resolve_request_wins:
  {M.resolveModelId(Some{"resumo"}, Some{"lista"}) == "resumo" : String}

law mm_resolve_last_when_no_request:
  {M.resolveModelId(None{}, Some{"simulado"}) == "simulado" : String}

law mm_resolve_default_when_nothing:
  {M.resolveModelId(None{}, None{}) == "livre" : String}

law mm_resolve_invalid_request_uses_last:
  {M.resolveModelId(Some{"prova"}, Some{"apostila"}) == "apostila" : String}

law mm_resolve_invalid_last_is_livre:
  {M.resolveModelId(None{}, Some{"prova"}) == "livre" : String}

law mm_resolve_both_invalid_is_livre:
  {M.resolveModelId(Some{"x"}, Some{"y"}) == "livre" : String}

law mm_resolve_request_livre_wins_over_last:
  {M.resolveModelId(Some{"livre"}, Some{"lista"}) == "livre" : String}

law mm_source_agent:
  {M.resolveSource(Some{"lista"}, Some{"resumo"}) == "agent" : String}

law mm_source_last:
  {M.resolveSource(None{}, Some{"resumo"}) == "last" : String}

law mm_source_invalid_request_is_last:
  {M.resolveSource(Some{"x"}, Some{"resumo"}) == "last" : String}

law mm_source_default:
  {M.resolveSource(None{}, None{}) == "default" : String}

law mm_source_both_invalid_is_default:
  {M.resolveSource(Some{"x"}, Some{"y"}) == "default" : String}

# ---------- nomes e frases ----------

law mm_label_lista:
  {M.labelOf("lista") == X.msg("material.model.lista") : String}

law mm_label_formulario:
  {M.labelOf("formulario") == X.msg("material.model.formulario") : String}

law mm_label_unknown_is_livre:
  {M.labelOf("prova") == X.msg("material.model.livre") : String}

law mm_blurb_livre:
  {M.blurbOf("livre") == X.msg("material.blurb.livre") : String}

law mm_blurb_lista:
  {M.blurbOf("lista") == X.msg("material.blurb.lista") : String}

# ---------- opções de cada modelo ----------

law mm_option_count_lista:
  {M.optionCount(M.ModelLista{}) == 3n : Nat}

law mm_option_count_apostila:
  {M.optionCount(M.ModelApostila{}) == 3n : Nat}

law mm_option_count_resumo:
  {M.optionCount(M.ModelResumo{}) == 2n : Nat}

law mm_option_count_simulado:
  {M.optionCount(M.ModelSimulado{}) == 3n : Nat}

law mm_option_count_formulario:
  {M.optionCount(M.ModelFormulario{}) == 2n : Nat}

law mm_option_count_livre:
  {M.optionCount(M.ModelLivre{}) == 0n : Nat}

law mm_option_lista_0_colunas:
  {M.optionKeyAt(M.ModelLista{}, 0n) == "colunas" : String}

law mm_option_lista_1_gabarito:
  {M.optionKeyAt(M.ModelLista{}, 1n) == "gabarito" : String}

law mm_option_lista_2_rodape:
  {M.optionKeyAt(M.ModelLista{}, 2n) == "rodape" : String}

law mm_option_lista_past_end:
  {M.optionKeyAt(M.ModelLista{}, 3n) == "" : String}

law mm_option_apostila_0_equacoes:
  {M.optionKeyAt(M.ModelApostila{}, 0n) == "equacoes" : String}

law mm_option_apostila_1_recuo:
  {M.optionKeyAt(M.ModelApostila{}, 1n) == "recuo" : String}

law mm_option_apostila_2_capitulo:
  {M.optionKeyAt(M.ModelApostila{}, 2n) == "capitulo" : String}

law mm_option_apostila_past_end:
  {M.optionKeyAt(M.ModelApostila{}, 3n) == "" : String}

law mm_option_resumo_0_regra:
  {M.optionKeyAt(M.ModelResumo{}, 0n) == "regra" : String}

law mm_option_resumo_1_revisao:
  {M.optionKeyAt(M.ModelResumo{}, 1n) == "revisao" : String}

law mm_option_resumo_past_end:
  {M.optionKeyAt(M.ModelResumo{}, 2n) == "" : String}

law mm_option_simulado_0_valor:
  {M.optionKeyAt(M.ModelSimulado{}, 0n) == "valor" : String}

law mm_option_simulado_1_espaco:
  {M.optionKeyAt(M.ModelSimulado{}, 1n) == "espaco" : String}

law mm_option_simulado_2_gabarito:
  {M.optionKeyAt(M.ModelSimulado{}, 2n) == "gabarito" : String}

law mm_option_simulado_past_end:
  {M.optionKeyAt(M.ModelSimulado{}, 3n) == "" : String}

law mm_option_formulario_0_colunas:
  {M.optionKeyAt(M.ModelFormulario{}, 0n) == "colunas" : String}

law mm_option_formulario_1_umafolha:
  {M.optionKeyAt(M.ModelFormulario{}, 1n) == "umafolha" : String}

law mm_option_formulario_past_end:
  {M.optionKeyAt(M.ModelFormulario{}, 2n) == "" : String}

law mm_option_livre_none:
  {M.optionKeyAt(M.ModelLivre{}, 0n) == "" : String}

law mm_kind_colunas:
  {M.optionKind("colunas") == "columns" : String}

law mm_kind_espaco:
  {M.optionKind("espaco") == "space" : String}

law mm_kind_rodape:
  {M.optionKind("rodape") == "text" : String}

law mm_kind_capitulo:
  {M.optionKind("capitulo") == "text" : String}

law mm_kind_gabarito:
  {M.optionKind("gabarito") == "flag" : String}

law mm_kind_equacoes:
  {M.optionKind("equacoes") == "flag" : String}

law mm_kind_recuo:
  {M.optionKind("recuo") == "flag" : String}

law mm_kind_regra:
  {M.optionKind("regra") == "flag" : String}

law mm_kind_revisao:
  {M.optionKind("revisao") == "flag" : String}

law mm_kind_valor:
  {M.optionKind("valor") == "flag" : String}

law mm_kind_umafolha:
  {M.optionKind("umafolha") == "flag" : String}

law mm_label_gabarito_lista:
  {M.optionLabel(M.ModelLista{}, "gabarito") == X.msg("material.option.gabaritoEnd") : String}

law mm_label_gabarito_simulado:
  {M.optionLabel(M.ModelSimulado{}, "gabarito") == X.msg("material.option.gabaritoSeparate") : String}

law mm_label_espaco:
  {M.optionLabel(M.ModelSimulado{}, "espaco") == X.msg("material.option.espaco") : String}

law mm_label_colunas:
  {M.optionLabel(M.ModelFormulario{}, "colunas") == X.msg("material.option.colunas") : String}

law mm_label_umafolha:
  {M.optionLabel(M.ModelFormulario{}, "umafolha") == X.msg("material.option.umafolha") : String}

law mm_label_rodape:
  {M.optionLabel(M.ModelLista{}, "rodape") == X.msg("material.option.rodape") : String}

# ---------- padrões e limpeza ----------

law mm_flag_default_lista_gabarito:
  {M.flagDefault(M.ModelLista{}, "gabarito") == True{} : Bool}

law mm_flag_default_lista_colunas:
  {M.flagDefault(M.ModelLista{}, "colunas") == False{} : Bool}

law mm_flag_default_apostila_equacoes:
  {M.flagDefault(M.ModelApostila{}, "equacoes") == True{} : Bool}

law mm_flag_default_apostila_recuo:
  {M.flagDefault(M.ModelApostila{}, "recuo") == True{} : Bool}

law mm_flag_default_apostila_capitulo:
  {M.flagDefault(M.ModelApostila{}, "capitulo") == False{} : Bool}

law mm_flag_default_resumo_regra:
  {M.flagDefault(M.ModelResumo{}, "regra") == True{} : Bool}

law mm_flag_default_resumo_revisao:
  {M.flagDefault(M.ModelResumo{}, "revisao") == True{} : Bool}

law mm_flag_default_simulado_valor:
  {M.flagDefault(M.ModelSimulado{}, "valor") == True{} : Bool}

law mm_flag_default_simulado_gabarito:
  {M.flagDefault(M.ModelSimulado{}, "gabarito") == True{} : Bool}

law mm_flag_default_formulario_umafolha:
  {M.flagDefault(M.ModelFormulario{}, "umafolha") == False{} : Bool}

law mm_flag_default_livre_gabarito:
  {M.flagDefault(M.ModelLivre{}, "gabarito") == False{} : Bool}

law mm_flag_missing_uses_fallback_true:
  {M.flagOr(None{}, True{}) == True{} : Bool}

law mm_flag_missing_uses_fallback_false:
  {M.flagOr(None{}, False{}) == False{} : Bool}

law mm_flag_present_off_overrides_default:
  {M.flagOr(Some{False{}}, True{}) == False{} : Bool}

law mm_flag_present_on_overrides_default:
  {M.flagOr(Some{True{}}, False{}) == True{} : Bool}

law mm_max_option_text:
  {M.maxOptionText() == 80n : Nat}

law mm_space_default:
  {M.spaceChoice(None{}) == "medio" : String}

law mm_space_pequeno:
  {M.spaceChoice(Some{"pequeno"}) == "pequeno" : String}

law mm_space_medio:
  {M.spaceChoice(Some{"medio"}) == "medio" : String}

law mm_space_grande:
  {M.spaceChoice(Some{"grande"}) == "grande" : String}

law mm_space_unknown_is_medio:
  {M.spaceChoice(Some{"enorme"}) == "medio" : String}

law mm_space_case_sensitive:
  {M.spaceChoice(Some{"Grande"}) == "medio" : String}

law mm_space_label_pequeno:
  {M.spaceLabel("pequeno") == X.msg("material.space.pequeno") : String}

law mm_space_label_medio:
  {M.spaceLabel("medio") == X.msg("material.space.medio") : String}

law mm_space_label_grande:
  {M.spaceLabel("grande") == X.msg("material.space.grande") : String}

# ---------- colunas ----------

law mm_columns_lista_auto_ok:
  {M.columnsChoice(M.ModelLista{}, Some{"auto"}) == "auto" : String}

law mm_columns_lista_1_ok:
  {M.columnsChoice(M.ModelLista{}, Some{"1"}) == "1" : String}

law mm_columns_lista_2_ok:
  {M.columnsChoice(M.ModelLista{}, Some{"2"}) == "2" : String}

law mm_columns_lista_3_ok:
  {M.columnsChoice(M.ModelLista{}, Some{"3"}) == "3" : String}

law mm_columns_lista_4_falls:
  {M.columnsChoice(M.ModelLista{}, Some{"4"}) == "auto" : String}

law mm_columns_lista_0_falls:
  {M.columnsChoice(M.ModelLista{}, Some{"0"}) == "auto" : String}

law mm_columns_lista_auto_falls:
  {M.columnsChoice(M.ModelLista{}, Some{"Auto"}) == "auto" : String}

law mm_columns_formulario_auto_ok:
  {M.columnsChoice(M.ModelFormulario{}, Some{"auto"}) == "auto" : String}

law mm_columns_formulario_2_ok:
  {M.columnsChoice(M.ModelFormulario{}, Some{"2"}) == "2" : String}

law mm_columns_formulario_3_ok:
  {M.columnsChoice(M.ModelFormulario{}, Some{"3"}) == "3" : String}

law mm_columns_formulario_1_falls:
  {M.columnsChoice(M.ModelFormulario{}, Some{"1"}) == "auto" : String}

law mm_columns_apostila_2_falls:
  {M.columnsChoice(M.ModelApostila{}, Some{"2"}) == "auto" : String}

law mm_columns_simulado_3_falls:
  {M.columnsChoice(M.ModelSimulado{}, Some{"3"}) == "auto" : String}

law mm_columns_livre_2_falls:
  {M.columnsChoice(M.ModelLivre{}, Some{"2"}) == "auto" : String}

law mm_columns_missing_is_auto:
  {M.columnsChoice(M.ModelLista{}, None{}) == "auto" : String}

# ---------- Auto: colunas pela largura medida ----------

law mm_auto_lista_short_is_3:
  {M.autoColumns(M.ModelLista{}, 100n, 500n, 20n) == 3n : Nat}

law mm_auto_lista_medium_is_2:
  {M.autoColumns(M.ModelLista{}, 200n, 500n, 20n) == 2n : Nat}

law mm_auto_lista_long_is_1:
  {M.autoColumns(M.ModelLista{}, 400n, 500n, 20n) == 1n : Nat}

law mm_auto_lista_boundary_fits_3:
  {M.autoColumns(M.ModelLista{}, 160n, 500n, 10n) == 3n : Nat}

law mm_auto_lista_boundary_over_is_2:
  {M.autoColumns(M.ModelLista{}, 161n, 500n, 10n) == 2n : Nat}

law mm_auto_lista_empty_is_3:
  {M.autoColumns(M.ModelLista{}, 0n, 500n, 20n) == 3n : Nat}

law mm_auto_lista_wider_than_sheet_is_1:
  {M.autoColumns(M.ModelLista{}, 900n, 500n, 20n) == 1n : Nat}

law mm_auto_formulario_short_is_3:
  {M.autoColumns(M.ModelFormulario{}, 100n, 500n, 20n) == 3n : Nat}

law mm_auto_formulario_medium_is_2:
  {M.autoColumns(M.ModelFormulario{}, 200n, 500n, 20n) == 2n : Nat}

law mm_auto_formulario_long_stays_2:
  {M.autoColumns(M.ModelFormulario{}, 400n, 500n, 20n) == 2n : Nat}

law mm_auto_apostila_is_1:
  {M.autoColumns(M.ModelApostila{}, 10n, 500n, 20n) == 1n : Nat}

law mm_auto_simulado_is_1:
  {M.autoColumns(M.ModelSimulado{}, 10n, 500n, 20n) == 1n : Nat}

law mm_auto_livre_is_1:
  {M.autoColumns(M.ModelLivre{}, 10n, 500n, 20n) == 1n : Nat}

law mm_columns_label_auto:
  {M.columnsLabel("auto", 3n) == "Auto · 3" : String}

law mm_columns_label_auto_one:
  {M.columnsLabel("auto", 1n) == "Auto · 1" : String}

law mm_columns_label_fixed:
  {M.columnsLabel("2", 3n) == "2" : String}

# ---------- Simulado: espaço de resposta ----------

law mm_answer_pequeno_short:
  {M.answerHeightMm("pequeno", False{}) == 22n : Nat}

law mm_answer_medio_short:
  {M.answerHeightMm("medio", False{}) == 36n : Nat}

law mm_answer_grande_short:
  {M.answerHeightMm("grande", False{}) == 80n : Nat}

law mm_answer_pequeno_long:
  {M.answerHeightMm("pequeno", True{}) == 36n : Nat}

law mm_answer_medio_long:
  {M.answerHeightMm("medio", True{}) == 80n : Nat}

law mm_answer_grande_long:
  {M.answerHeightMm("grande", True{}) == 110n : Nat}

law mm_answer_unknown_is_medio:
  {M.answerHeightMm("enorme", False{}) == 36n : Nat}

# ---------- frases do diálogo ----------

law mm_phrase_agent:
  {M.statusPhrase("agent", "lista") == X.msg1("material.status.agent", "model", "material.model.lista") : String}

law mm_phrase_last:
  {M.statusPhrase("last", "resumo") == X.msg1("material.status.last", "model", "material.model.resumo") : String}

law mm_phrase_default:
  {M.statusPhrase("default", "livre") == X.msg1("material.status.default", "model", "material.model.livre") : String}

law mm_phrase_changed:
  {M.statusPhrase("changed", "apostila") == X.msg1("material.status.changed", "model", "material.model.apostila") : String}

law mm_phrase_unknown_source_is_default:
  {M.statusPhrase("outra", "simulado") == X.msg1("material.status.default", "model", "material.model.simulado") : String}

law mm_page_of:
  {M.pageOf(1n, 3n) == X.msg2("material.pageOf", "page", "1", "total", "3") : String}

# ---------- Formulário: caber numa folha ----------

law mm_fit_start:
  {M.fitStart() == 100n : Nat}

law mm_fit_floor:
  {M.fitFloor() == 60n : Nat}

law mm_fit_next_from_start:
  {M.fitNext(100n) == 96n : Nat}

law mm_fit_next_lands_on_floor:
  {M.fitNext(64n) == 60n : Nat}

law mm_fit_next_never_below_floor:
  {M.fitNext(62n) == 60n : Nat}

law mm_fit_next_stays_at_floor:
  {M.fitNext(60n) == 60n : Nat}

law mm_fit_not_done_above_floor:
  {M.fitDone(96n) == False{} : Bool}

law mm_fit_done_at_floor:
  {M.fitDone(60n) == True{} : Bool}
