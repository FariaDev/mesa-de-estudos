import Base
import ../msg.bend as M
import ../studysearch.bend as N

# ---------------------------------------------------------------------------
# Contrato da busca de estudos. Prefixo `ss_`.
#
# Fatos chegam resolvidos (Bools e fontes concretas) e as leis fecham em
# cenários concretos. O que ficou de fora (índice UTF-16, leitura de arquivo,
# parser JSONL, colapso de espaços, NFD além de Latin-1, relógio) é host.
# ---------------------------------------------------------------------------

# ---------- tetos ----------

law ss_min_query:
  {N.minQueryChars() == 2n : Nat}

law ss_default_30:
  {N.defaultLimit() == 30n : Nat}

law ss_teto_50:
  {N.maxLimit() == 50n : Nat}

law ss_teto_hits:
  {N.maxHits() == 200n : Nat}

law ss_teto_arquivos:
  {N.maxFiles() == 400n : Nat}

law ss_teto_por_conversa:
  {N.maxPerConversation() == 4n : Nat}

law ss_teto_por_arquivo:
  {N.maxPerFile() == 3n : Nat}

law ss_teto_trecho:
  {N.maxSnippetChars() == 160n : Nat}

law ss_teto_bytes:
  {N.maxFileBytes() == 8388608n : Nat}

law ss_orcamento:
  {N.timeBudgetMs() == 2500n : Nat}

# ---------- casamento (dobra Latin-1 sem marcas) ----------

law ss_matches_calculo:
  {N.matches("Cálculo diferencial", "calculo") == True{} : Bool}

law ss_matches_formulario:
  {N.matches("FORMULÁRIO pronto", "formulario") == True{} : Bool}

law ss_matches_vazio:
  {N.matches("texto", "   ") == False{} : Bool}

# ---------- trecho ----------

law ss_trecho_pontas:
  {N.clipText(True{}, True{}, "limite") == "…limite…" : String}

law ss_trecho_meio:
  {N.clipText(False{}, False{}, "limite") == "limite" : String}

law ss_trecho_inicio:
  {N.clipText(False{}, True{}, "limite") == "limite…" : String}

# ---------- pontuação ----------

law ss_best_titulo:
  {N.best(True{}, False{}, False{}) == N.RankTitle{} : N.Rank}

law ss_best_inicio:
  {N.best(False{}, True{}, False{}) == N.RankStart{} : N.Rank}

law ss_best_palavra:
  {N.best(False{}, False{}, True{}) == N.RankWord{} : N.Rank}

law ss_best_qualquer:
  {N.best(False{}, False{}, False{}) == N.RankAny{} : N.Rank}

law ss_peso_titulo:
  {N.rankWeight(N.RankTitle{}) == 3n : Nat}

law ss_peso_inicio:
  {N.rankWeight(N.RankStart{}) == 2n : Nat}

law ss_peso_palavra:
  {N.rankWeight(N.RankWord{}) == 1n : Nat}

law ss_peso_qualquer:
  {N.rankWeight(N.RankAny{}) == 0n : Nat}

law ss_melhor_titulo_antes:
  {N.better(N.RankTitle{}, N.RankWord{}) == True{} : Bool}

law ss_melhor_inicio_antes:
  {N.better(N.RankStart{}, N.RankWord{}) == True{} : Bool}

law ss_melhor_palavra_antes_qualquer:
  {N.better(N.RankWord{}, N.RankAny{}) == True{} : Bool}

law ss_melhor_palavra_nao_antes_inicio:
  {N.better(N.RankWord{}, N.RankStart{}) == False{} : Bool}

law ss_melhor_qualquer_nunca:
  {N.better(N.RankAny{}, N.RankAny{}) == False{} : Bool}

# ---------- fontes ----------

law ss_key_conversa:
  {N.sourceKey(N.HsConv{}) == "conversa" : String}

law ss_key_pdf:
  {N.sourceKey(N.HsPdf{}) == "pdf" : String}

law ss_label_lateral:
  {N.sourceLabel(N.HsSide{}) == M.msg("search.source.side") : String}

# O vocabulário da interface é Tutor e Sessão (CONTEXT.md): a fonte "conversa"
# se chama Sessão para quem lê; a chave interna segue estável.
law ss_label_sessao:
  {N.sourceLabel(N.HsConv{}) == M.msg("search.source.conv") : String}

law ss_placeholder_sessoes:
  {N.searchPlaceholder() == M.msg("search.placeholder") : String}

law ss_pdf_exige_auth:
  {N.needsPdfAuth(N.HsPdf{}) == True{} : Bool}

law ss_conversa_nao_exige_auth:
  {N.needsPdfAuth(N.HsConv{}) == False{} : Bool}

# ---------- autorização ----------

law ss_runtime_ok:
  {N.allowed(N.HsConv{}, True{}, False{}, False{}) == True{} : Bool}

law ss_runtime_faltando_vence:
  {N.allowed(N.HsConv{}, False{}, True{}, True{}) == False{} : Bool}

law ss_lateral_no_runtime:
  {N.allowed(N.HsSide{}, True{}, False{}, False{}) == True{} : Bool}

law ss_caderno_no_runtime:
  {N.allowed(N.HsReview{}, True{}, False{}, False{}) == True{} : Bool}

law ss_livre_no_runtime:
  {N.allowed(N.HsFree{}, True{}, False{}, False{}) == True{} : Bool}

law ss_nota_no_runtime:
  {N.allowed(N.HsNote{}, True{}, False{}, False{}) == True{} : Bool}

law ss_materia_exige_curso:
  {N.allowed(N.HsMaterial{}, True{}, False{}, False{}) == False{} : Bool}

law ss_materia_com_curso:
  {N.allowed(N.HsMaterial{}, True{}, True{}, False{}) == True{} : Bool}

# Texto de PDF nunca passa só com runtime — nem só com curso.
law ss_pdf_nao_passa_com_runtime:
  {N.allowed(N.HsPdf{}, True{}, False{}, True{}) == False{} : Bool}

law ss_pdf_nao_passa_sem_auth:
  {N.allowed(N.HsPdf{}, True{}, True{}, False{}) == False{} : Bool}

law ss_pdf_passa_com_curso_e_auth:
  {N.allowed(N.HsPdf{}, True{}, True{}, True{}) == True{} : Bool}

# Runtime desligado recusa mesmo com curso e autorização.
law ss_pdf_nao_passa_sem_runtime:
  {N.allowed(N.HsPdf{}, False{}, True{}, True{}) == False{} : Bool}

# Caminho do renderer não autoriza por si: só a biblioteca do host decide.
law ss_path_renderer_nao_autoriza:
  {N.pathTrusted(False{}, True{}) == False{} : Bool}

law ss_path_biblioteca_autoriza:
  {N.pathTrusted(True{}, True{}) == True{} : Bool}

law ss_path_fora_da_biblioteca:
  {N.pathTrusted(False{}, False{}) == False{} : Bool}

law ss_path_host_tambem_precisa_biblioteca:
  {N.pathTrusted(False{}, False{}) == False{} : Bool}

# ---------- limite ----------

law ss_limite_invalido_vira_default:
  {N.clampLimit(True{}, True{}, 7n) == 30n : Nat}

law ss_limite_acima_do_teto:
  {N.clampLimit(False{}, True{}, 7n) == 50n : Nat}

law ss_limite_dentro:
  {N.clampLimit(False{}, False{}, 7n) == 7n : Nat}

# ---------- textos ----------

law ss_titulo:
  {N.dialogTitle() == M.msg("search.title") : String}

law ss_vazio_cita_fontes:
  {N.emptyText() == M.msg("search.empty") : String}

law ss_filtro_conteudo:
  {N.sourcesLabel() == M.msg("search.sources") : String}

law ss_todos_conteudos:
  {N.allSourcesLabel() == M.msg("search.allSources") : String}

law ss_limpar_filtros:
  {N.clearFiltersLabel() == M.msg("search.clear") : String}

law ss_pdf_escolher_materia:
  {N.pdfScopeHint() == M.msg("search.pdfScope") : String}

law ss_contagem_singular:
  {N.countText(1n) == M.msg1("search.count", "count", "1") : String}

law ss_contagem_plural:
  {N.countText(3n) == M.msg1("search.count", "count", "3") : String}

law ss_pagina:
  {N.pageLabel(7n) == M.msg1("common.pageShort", "page", "7") : String}

law ss_curta:
  {N.shortQueryText() == M.msg("search.short") : String}

law ss_botao_buscar:
  {N.searchButton() == M.msg("common.search") : String}
