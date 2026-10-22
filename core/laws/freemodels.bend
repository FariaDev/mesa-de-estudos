import Base
import ../msg.bend as M
import ../freemodels.bend as F

# ---------------------------------------------------------------------------
# Contrato dos modelos grátis do OpenCode Zen pelo Pi (#44). Prefixo `free_`.
#
#   1. chave: o que vale como chave na área de transferência (prefixo `sk-` e só
#      letras, números, `-` e `_`, de 20 a 200 caracteres) e no campo manual
#      (o mesmo, sem exigir o prefixo); texto que não pode ser chave (frase,
#      URL, espaço, quebra de linha) nunca é oferecido; a chave é mostrada
#      mascarada, com o prefixo e os quatro últimos caracteres;
#   2. teste: formato inválido, falha de rede, 200, 401, 402/403 e outro código
#      dão seis resultados distintos, cada um com a sua frase, e só o 200 guarda a chave;
#   3. grátis: provedor `opencode` com custo zero, id terminado em `-free` ou
#      `big-pickle`; nenhum outro provedor é grátis por isso. No OpenRouter
#      (ajustes do seletor), grátis é o sufixo `:free` ou custo zero
#      comprovado, nunca o roteador automático; fora do Zen e do OpenRouter,
#      nem sufixo nem custo zero dão a marca (`isFreeModel`);
#   4. política: cada valor da tabela tem a sua frase; valor desconhecido diz
#      que não há informação, e só `zero` vale como retenção zero;
#   5. seletor: a marca Grátis e a política vêm antes do aviso "pode ter saído";
#      modelo pago não ganha nada; o aviso só existe com a lista ao vivo
#      conferida;
#   6. padrão: o primeiro da lista de retenção zero que o Pi oferece; nenhum
#      oferecido, nenhum escolhido; um que treina nunca entra por aqui porque
#      a lista de preferência só tem retenção zero (conferido no teste do JSON);
#   7. confirmação: um modelo pago do Zen pede uma confirmação, uma vez.
#
# O que o enunciado NÃO prova: ler a área de transferência, o arquivo do
# OpenCode, o cofre do sistema, a rede e o catálogo do Pi (mundo do host); a
# tabela de política por modelo (`desk/free-models.json`, com teste próprio); o
# formato real da chave do Zen (não publicado: os tetos são folgados e o teste
# na lista de modelos decide); as frases (catálogos de idioma).
# ---------------------------------------------------------------------------

# ---------- chave ----------

law free_chave_da_area_de_transferencia_vale:
  {F.clipboardKey("sk-FAKE0123456789abcdefGHIJ") == True{} : Bool}

law free_chave_com_sublinhado_e_hifen_vale:
  {F.clipboardKey("sk-FAKE_01234-56789_abcdefGHIJ") == True{} : Bool}

law free_area_de_transferencia_sem_prefixo_nao_vale:
  {F.clipboardKey("FAKE0123456789abcdefGHIJ0123") == False{} : Bool}

law free_area_de_transferencia_frase_nao_vale:
  {F.clipboardKey("sk- esta e uma frase qualquer copiada") == False{} : Bool}

law free_area_de_transferencia_url_nao_vale:
  {F.clipboardKey("https://opencode.ai/auth/chaves-de-api") == False{} : Bool}

law free_area_de_transferencia_quebra_de_linha_nao_vale:
  {F.clipboardKey("sk-FAKE0123456789abcdef\nGHIJ") == False{} : Bool}

law free_area_de_transferencia_vazia_nao_vale:
  {F.clipboardKey("") == False{} : Bool}

law free_chave_curta_demais_nao_vale:
  {F.clipboardKey("sk-FAKE0123456789ab") == False{} : Bool}

law free_chave_com_vinte_caracteres_vale:
  {F.clipboardKey("sk-FAKE0123456789abc") == True{} : Bool}

law free_chave_comprida_demais_nao_vale:
  {F.clipboardKey("sk-FAKE0123456789abcdefGHIJFAKE0123456789abcdefGHIJFAKE0123456789abcdefGHIJFAKE0123456789abcdefGHIJFAKE0123456789abcdefGHIJFAKE0123456789abcdefGHIJFAKE0123456789abcdefGHIJFAKE0123456789abcdefGHIJFAKE0123456789abcdefGHIJ") == False{} : Bool}

law free_chave_com_duzentos_caracteres_vale:
  {F.clipboardKey("sk-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") == True{} : Bool}

law free_campo_manual_aceita_sem_prefixo:
  {F.typedKey("FAKE0123456789abcdefGHIJ0123") == True{} : Bool}

law free_campo_manual_recusa_espaco:
  {F.typedKey("FAKE0123456789 abcdefGHIJ0123") == False{} : Bool}

law free_campo_manual_recusa_curta:
  {F.typedKey("sk-curta") == False{} : Bool}

law free_chave_mascarada_mostra_prefixo_e_final:
  {F.mask("sk-FAKE0123456789abcdefGHIJ") == "sk-••••GHIJ" : String}

law free_mascara_de_texto_que_nao_e_chave_esconde_tudo:
  {F.mask("segredo") == "••••" : String}

# ---------- teste da chave ----------

law free_teste_200_vale:
  {F.outcome(False{}, 200n) == "ok" : String}

law free_teste_401_chave_recusada:
  {F.outcome(False{}, 401n) == "invalid" : String}

law free_teste_402_conta_sem_cobranca:
  {F.outcome(False{}, 402n) == "billing" : String}

law free_teste_403_conta_sem_cobranca:
  {F.outcome(False{}, 403n) == "billing" : String}

law free_teste_500_inesperado:
  {F.outcome(False{}, 500n) == "unexpected" : String}

# Falha de rede vence qualquer código: sem resposta não há código a ler.
law free_teste_rede_vence_o_codigo:
  {F.outcome(True{}, 200n) == "network" : String}

law free_teste_cada_resultado_tem_a_sua_frase:
  {[F.outcomeMsg("ok"), F.outcomeMsg("invalid"), F.outcomeMsg("billing"), F.outcomeMsg("network"), F.outcomeMsg("shape"), F.outcomeMsg("unexpected")] == [M.msg("freeModels.test.ok"), M.msg("freeModels.test.invalid"), M.msg("freeModels.test.billing"), M.msg("freeModels.test.network"), M.msg("freeModels.test.shape"), M.msg("freeModels.test.unexpected")] : List<&2, String>}

# Texto que não pode ser chave para antes da rede, qualquer que seja o código.
law free_teste_formato_invalido_vence_a_rede:
  {F.outcomeFor(False{}, True{}, 200n) == "shape" : String}

law free_teste_formato_valido_segue_para_a_rede:
  {[F.outcomeFor(True{}, False{}, 200n), F.outcomeFor(True{}, True{}, 0n), F.outcomeFor(True{}, False{}, 401n)] == ["ok", "network", "invalid"] : List<&2, String>}

law free_teste_resultado_desconhecido_vira_inesperado:
  {F.outcomeMsg("qualquer coisa") == M.msg("freeModels.test.unexpected") : String}

law free_so_o_ok_guarda_a_chave:
  {[F.keepsKey("ok"), F.keepsKey("invalid"), F.keepsKey("billing"), F.keepsKey("network"), F.keepsKey("shape"), F.keepsKey("unexpected")] == [True{}, False{}, False{}, False{}, False{}, False{}] : List<&2, Bool>}

# ---------- modelo grátis ----------

law free_custo_zero_do_zen_e_gratis:
  {F.isFree("opencode", "qualquer-nome", True{}) == True{} : Bool}

law free_sufixo_free_do_zen_e_gratis:
  {F.isFree("opencode", "deepseek-v4.1-flash-free", False{}) == True{} : Bool}

law free_big_pickle_e_gratis:
  {F.isFree("opencode", "big-pickle", False{}) == True{} : Bool}

law free_modelo_pago_do_zen_nao_e_gratis:
  {F.isFree("opencode", "gpt-5.5", False{}) == False{} : Bool}

# Gratuidade é do Zen: o id de outro provedor com `-free` ou custo zero (um
# modelo local, por exemplo) não ganha a marca.
law free_outro_provedor_nunca_e_gratis:
  {[F.isFree("anthropic", "x-free", True{}), F.isFree("openai", "big-pickle", True{}), F.isFree("opencode-go", "x-free", True{})] == [False{}, False{}, False{}] : List<&2, Bool>}

law free_openrouter_sufixo_free_e_gratis:
  {F.isRouterFree("openrouter", "deepseek/deepseek-v4.1-flash:free", False{}) == True{} : Bool}

law free_openrouter_custo_zero_comprovado_e_gratis:
  {F.isRouterFree("openrouter", "qwen/qwen3.5-32b", True{}) == True{} : Bool}

# Sem o sufixo e sem preço zero comprovado (preço ausente inclusive), é pago.
law free_openrouter_sem_sufixo_nem_custo_zero_e_pago:
  {[F.isRouterFree("openrouter", "deepseek/deepseek-v4.1-flash", False{}), F.isRouterFree("openrouter", "x:free-trial", False{})] == [False{}, False{}] : List<&2, Bool>}

law free_openrouter_roteador_automatico_nunca_e_gratis:
  {[F.isRouterFree("openrouter", "openrouter/auto", True{}), F.isFreeModel("openrouter", "openrouter/auto", True{})] == [False{}, False{}] : List<&2, Bool>}

# Custo zero de assinatura ou modelo local não é grátis, nem o sufixo `:free`
# fora do OpenRouter.
law free_selo_so_no_zen_e_no_openrouter:
  {[F.isFreeModel("github-copilot", "gpt-5.5", True{}), F.isFreeModel("openai-codex", "gpt-5.5-codex", True{}), F.isFreeModel("xai", "grok-5:free", False{}), F.isFreeModel("opencode-go", "kimi-k3:free", True{})] == [False{}, False{}, False{}, False{}] : List<&2, Bool>}

law free_selo_vale_para_o_zen_e_o_openrouter:
  {[F.isFreeModel("opencode", "big-pickle", False{}), F.isFreeModel("opencode", "gpt-5.5", False{}), F.isFreeModel("openrouter", "meta-llama/llama-5-scout:free", False{})] == [True{}, False{}, True{}] : List<&2, Bool>}

law free_pago_do_zen_pede_confirmacao_uma_vez:
  {[F.paidNeedsConfirm("opencode", False{}, False{}), F.paidNeedsConfirm("opencode", False{}, True{})] == [True{}, False{}] : List<&2, Bool>}

law free_gratis_e_outros_provedores_nao_pedem_confirmacao:
  {[F.paidNeedsConfirm("opencode", True{}, False{}), F.paidNeedsConfirm("anthropic", False{}, False{})] == [False{}, False{}] : List<&2, Bool>}

law free_aviso_saiu_do_plano_so_com_lista_ao_vivo:
  {[F.mayHaveLeft(True{}, True{}, False{}), F.mayHaveLeft(True{}, False{}, False{}), F.mayHaveLeft(True{}, True{}, True{}), F.mayHaveLeft(False{}, True{}, False{})] == [True{}, False{}, False{}, False{}] : List<&2, Bool>}

# ---------- política de dados ----------

law free_politica_cada_valor_tem_a_sua_frase:
  {[F.policyMsg("zero"), F.policyMsg("retained"), F.policyMsg("improve"), F.policyMsg("trial"), F.policyMsg("train")] == [M.msg("freeModels.policy.zero"), M.msg("freeModels.policy.retained"), M.msg("freeModels.policy.improve"), M.msg("freeModels.policy.trial"), M.msg("freeModels.policy.train")] : List<&2, String>}

law free_politica_desconhecida_sem_informacao:
  {[F.policyMsg(""), F.policyMsg("outra")] == [M.msg("freeModels.policy.unknown"), M.msg("freeModels.policy.unknown")] : List<&2, String>}

law free_so_zero_e_retencao_zero:
  {[F.isZeroRetention("zero"), F.isZeroRetention("retained"), F.isZeroRetention("improve"), F.isZeroRetention("trial"), F.isZeroRetention("train"), F.isZeroRetention("")] == [True{}, False{}, False{}, False{}, False{}, False{}] : List<&2, Bool>}

# ---------- seletor ----------

law free_seletor_gratis_tem_marca_e_politica:
  {F.optionTail(True{}, "zero", False{}) == [M.msg("freeModels.badge"), M.msg("freeModels.policy.zero")] : List<&2, String>}

law free_seletor_gratis_sem_politica_conhecida:
  {F.optionTail(True{}, "", False{}) == [M.msg("freeModels.badge"), M.msg("freeModels.policy.unknown")] : List<&2, String>}

law free_seletor_aviso_de_saida_vai_por_ultimo:
  {F.optionTail(True{}, "improve", True{}) == [M.msg("freeModels.badge"), M.msg("freeModels.policy.improve"), M.msg("freeModels.maybeLeft")] : List<&2, String>}

law free_seletor_pago_nao_ganha_nada:
  {F.optionTail(False{}, "zero", True{}) == [] : List<&2, String>}

# ---------- padrão recomendado ----------

law free_padrao_e_o_primeiro_oferecido:
  {F.pickDefault(["a-free", "b-free", "c-free"], ["c-free", "b-free", "x"]) == "b-free" : String}

law free_padrao_segue_a_ordem_de_preferencia_nao_a_do_catalogo:
  {F.pickDefault(["a-free", "b-free"], ["b-free", "a-free"]) == "a-free" : String}

law free_padrao_sem_oferta_nao_escolhe:
  {F.pickDefault(["a-free", "b-free"], ["x", "y"]) == "" : String}

law free_padrao_sem_preferencia_nao_escolhe:
  {F.pickDefault([], ["a-free"]) == "" : String}

law free_padrao_catalogo_vazio_nao_escolhe:
  {F.pickDefault(["a-free"], []) == "" : String}

law free_frase_do_fim_com_padrao:
  {F.doneMsg("a-free") == M.msg("freeModels.done.zero") : String}

law free_frase_do_fim_sem_padrao:
  {F.doneMsg("") == M.msg("freeModels.done.none") : String}
