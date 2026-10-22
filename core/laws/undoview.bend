import Base
import ../msg.bend as M
import ../undoview.bend as U

# ---------------------------------------------------------------------------
# Contrato do Desfazer (Caderno e Anotações). Prefixo `undo_`.
#
# As leis fecham em valores concretos: os prazos, o token (vazio, no teto e
# acima do teto), a posição de reinserção clampada e a ordem da decisão
# (desconhecido → vencido → outro escopo → material bloqueado → pronto).
# ---------------------------------------------------------------------------

# ---------- prazos e tetos ----------

law undo_ttl:
  {U.ttlMs() == 60000n : Nat}

law undo_notice:
  {U.noticeMs() == 25000n : Nat}

# O relógio do aviso termina MUITO antes de o token vencer: esconder a tela não
# apaga os dados de recuperação.
law undo_notice_dentro_do_prazo:
  {U.isExpired(U.noticeMs(), U.ttlMs()) == False{} : Bool}

law undo_max_token:
  {U.maxToken() == 64n : Nat}

law undo_max_entries:
  {U.maxEntries() == 64n : Nat}

law undo_expiry_from:
  {U.expiryFrom(1000n, 60000n) == 61000n : Nat}

# ---------- vencimento ----------

law undo_nao_vencido:
  {U.isExpired(999n, 1000n) == False{} : Bool}

law undo_vencido_no_prazo:
  {U.isExpired(1000n, 1000n) == True{} : Bool}

law undo_vencido_depois:
  {U.isExpired(1001n, 1000n) == True{} : Bool}

law undo_restante:
  {U.remainingMs(400n, 1000n) == 600n : Nat}

law undo_restante_no_prazo:
  {U.remainingMs(1000n, 1000n) == 0n : Nat}

law undo_restante_depois:
  {U.remainingMs(1500n, 1000n) == 0n : Nat}

law undo_segundos:
  {U.secondsLeft(1000n, 26000n) == 25n : Nat}

law undo_segundos_vencido:
  {U.secondsLeft(30000n, 26000n) == 0n : Nat}

# ---------- forma do token ----------

law undo_token_ok:
  {U.validToken("u-abc123") == True{} : Bool}

law undo_token_vazio:
  {U.validToken("   ") == False{} : Bool}

law undo_token_longo:
  {U.validToken("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") == False{} : Bool}

law undo_token_no_teto:
  {U.validToken("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") == True{} : Bool}

# ---------- posição de reinserção ----------

law undo_clamp_dentro:
  {U.clampIndex(2n, 5n) == 2n : Nat}

law undo_clamp_no_fim:
  {U.clampIndex(5n, 5n) == 5n : Nat}

law undo_clamp_fora:
  {U.clampIndex(9n, 5n) == 5n : Nat}

law undo_clamp_vazio:
  {U.clampIndex(1n, 0n) == 0n : Nat}

# ---------- decisão ----------

law undo_desconhecido:
  {U.decide(False{}, True{}, False{}, False{}) == U.UndoUnknown{} : U.UndoDecision}

law undo_desconhecido_vence:
  {U.decide(False{}, False{}, True{}, True{}) == U.UndoUnknown{} : U.UndoDecision}

law undo_vencido_decision:
  {U.decide(True{}, True{}, True{}, True{}) == U.UndoExpired{} : U.UndoDecision}

law undo_outro_escopo:
  {U.decide(True{}, False{}, False{}, True{}) == U.UndoForeign{} : U.UndoDecision}

law undo_escopo_antes_material:
  {U.decide(True{}, False{}, False{}, False{}) == U.UndoForeign{} : U.UndoDecision}

law undo_material_bloqueado:
  {U.decide(True{}, False{}, True{}, False{}) == U.UndoBlocked{} : U.UndoDecision}

law undo_pronto:
  {U.decide(True{}, False{}, True{}, True{}) == U.UndoReady{} : U.UndoDecision}

# ---------- rótulos ----------

law undo_rotulo:
  {U.undoLabel() == M.msg("undo.label") : String}

law undo_contagem:
  {U.countdownLabel(7n) == M.msg1("undo.countdown", "seconds", "7") : String}

law undo_texto_outro_escopo:
  {U.foreignText() == M.msg("undo.foreign") : String}
