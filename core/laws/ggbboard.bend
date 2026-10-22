import Base
import ../msg.bend as M
import ../ggbboard.bend as B

# ---------------------------------------------------------------------------
# Contrato do quadro limpo do GeoGebra por uso do tutor (ticket #53). Prefixo
# `ggbb_`.
#
#   1. executar na primeira vez da resposta, com algo no quadro, limpa;
#   2. ler (estado, print) nunca limpa;
#   3. continuar, repetir na mesma resposta ou quadro vazio não limpam;
#   4. a origem do que sai é do tutor só se nada mudou desde o último comando
#      dele; o que o aluno fez (ou mexeu) é do aluno;
#   5. o histórico guarda no máximo `keptLimit()` e voltar troca, não perde.
#
# O que o enunciado NÃO prova: ler o applet, comparar desenhos, gravar em disco
# e chamar `setBase64` (mundo do host).
# ---------------------------------------------------------------------------

# ---------- quando limpar ----------

law ggbb_executar_primeira_vez_com_conteudo_limpa:
  {B.boardPlan(B.UseRun{}, False{}, False{}, False{}) == B.PlanFresh{} : B.BoardPlan}

law ggbb_ler_nunca_limpa:
  {B.boardPlan(B.UseRead{}, False{}, False{}, False{}) == B.PlanKeep{} : B.BoardPlan}

law ggbb_continuar_nao_limpa:
  {B.boardPlan(B.UseRun{}, True{}, False{}, False{}) == B.PlanKeep{} : B.BoardPlan}

law ggbb_segunda_chamada_da_mesma_resposta_nao_limpa:
  {B.boardPlan(B.UseRun{}, False{}, True{}, False{}) == B.PlanKeep{} : B.BoardPlan}

law ggbb_quadro_vazio_nao_limpa:
  {B.boardPlan(B.UseRun{}, False{}, False{}, True{}) == B.PlanKeep{} : B.BoardPlan}

law ggbb_ler_com_tudo_ligado_nao_limpa:
  {B.boardPlan(B.UseRead{}, True{}, True{}, True{}) == B.PlanKeep{} : B.BoardPlan}

# ---------- origem ----------

law ggbb_origem_tutor_se_nada_mudou:
  {B.originOf(True{}, True{}) == B.FromTutor{} : B.KeptOrigin}

law ggbb_origem_aluno_se_mexeu_depois_do_tutor:
  {B.originOf(True{}, False{}) == B.FromStudent{} : B.KeptOrigin}

law ggbb_origem_aluno_se_o_tutor_nunca_desenhou:
  {B.originOf(False{}, True{}) == B.FromStudent{} : B.KeptOrigin}

law ggbb_origem_aluno_se_o_tutor_nunca_desenhou_e_mudou:
  {B.originOf(False{}, False{}) == B.FromStudent{} : B.KeptOrigin}

# ---------- histórico ----------

law ggbb_limite_do_historico:
  {B.keptLimit() == 3n : Nat}

law ggbb_guardar_cresce:
  {B.keptAfterPush(0n) == 1n : Nat}

law ggbb_guardar_ate_o_limite:
  {B.keptAfterPush(2n) == 3n : Nat}

law ggbb_guardar_no_limite_descarta_a_mais_antiga:
  {B.keptAfterPush(3n) == 3n : Nat}

# ---------- voltar ----------

law ggbb_sem_historico_nao_volta:
  {B.canGoBack(0n) == False{} : Bool}

law ggbb_com_historico_volta:
  {B.canGoBack(2n) == True{} : Bool}

law ggbb_restaurar_sem_nada_guardado:
  {B.restorePlan(0n, False{}) == B.RestoreNone{} : B.RestorePlan}

law ggbb_restaurar_com_quadro_vazio_so_tira_do_historico:
  {B.restorePlan(2n, True{}) == B.RestoreOnly{} : B.RestorePlan}

law ggbb_restaurar_com_quadro_cheio_troca:
  {B.restorePlan(2n, False{}) == B.RestoreSwap{} : B.RestorePlan}

law ggbb_restaurar_com_quadro_vazio_gasta_um:
  {B.keptAfterRestore(2n, True{}) == 1n : Nat}

law ggbb_restaurar_com_quadro_cheio_mantem_a_conta:
  {B.keptAfterRestore(2n, False{}) == 2n : Nat}

law ggbb_restaurar_sem_nada_mantem_zero:
  {B.keptAfterRestore(0n, False{}) == 0n : Nat}

# ---------- textos ----------

law ggbb_aviso_do_tutor:
  {B.freshNote(B.FromTutor{}) == M.msg("ggb.board.freshTutor") : String}

law ggbb_aviso_do_aluno:
  {B.freshNote(B.FromStudent{}) == M.msg("ggb.board.freshStudent") : String}

law ggbb_rotulo_de_voltar:
  {B.backLabel() == M.msg("ggb.board.back") : String}

law ggbb_dica_de_voltar_leva_a_conta:
  {B.backTitle(2n) == M.msg1("ggb.board.backTitle", "count", "2") : String}

law ggbb_aviso_de_restaurada:
  {B.restoredNote() == M.msg("ggb.board.restored") : String}

law ggbb_aviso_sem_nada_a_restaurar:
  {B.nothingToRestoreNote() == M.msg("ggb.board.nothingToRestore") : String}
