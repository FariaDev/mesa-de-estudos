import Base
import ../overlay.bend as O

# ---------------------------------------------------------------------------
# Contrato da view nativa do GeoGebra diante das sobreposições (ticket #52).
# Prefixo `ovl_`.
#
#   1. aba inativa: a view está fora, com ou sem sobreposição;
#   2. aba ativa e nenhuma sobreposição: a view aparece;
#   3. aba ativa e QUALQUER sobreposição (uma, duas, muitas): a view se
#      esconde sem fechar — ao fechar a última volta no mesmo lugar.
#
# O que o enunciado NÃO prova: contar as sobreposições no DOM (o host entrega o
# número) nem o retângulo da view (mundo).
# ---------------------------------------------------------------------------

law ovl_aba_inativa_fica_fora:
  {O.viewState(False{}, 0) == O.ViewOff{} : O.ViewState}

law ovl_aba_inativa_fica_fora_com_tela_cheia:
  {O.viewState(False{}, 2) == O.ViewOff{} : O.ViewState}

law ovl_aba_ativa_sem_sobreposicao_aparece:
  {O.viewState(True{}, 0) == O.ViewShown{} : O.ViewState}

law ovl_aba_ativa_com_uma_sobreposicao_se_esconde:
  {O.viewState(True{}, 1) == O.ViewCovered{} : O.ViewState}

law ovl_aba_ativa_com_duas_sobreposicoes_se_esconde:
  {O.viewState(True{}, 2) == O.ViewCovered{} : O.ViewState}

law ovl_aba_ativa_com_muitas_sobreposicoes_se_esconde:
  {O.viewState(True{}, 40) == O.ViewCovered{} : O.ViewState}
