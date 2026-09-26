import Base
import ../pending.bend as P

# ---------------------------------------------------------------------------
# Contrato da fila guardada no disco (Mesa). Prefixo `pending_`.
#
# As leis fecham em valores concretos: `String.length`/`String.trim` de uma
# variável livre não reduzem, então o que se prova é o caso que importa —
# texto vazio, texto acima do teto, índice no limite e os dois lados do teto
# de bytes.
# ---------------------------------------------------------------------------

# ---------- página ----------

law pending_page_zero:
  {P.pageOf(0n) == 1n : Nat}

law pending_page_kept:
  {P.pageOf(7n) == 7n : Nat}

# ---------- vale guardar? ----------

law pending_keep_text:
  {P.keepItem("oi", 0n) == True{} : Bool}

law pending_keep_image:
  {P.keepItem("", 1n) == True{} : Bool}

law pending_drop_empty:
  {P.keepItem("", 0n) == False{} : Bool}

law pending_drop_blank:
  {P.keepItem("   ", 0n) == False{} : Bool}

# ---------- corte do texto ----------

law pending_cut_keeps:
  {P.cutText("abc", 5n) == "abc" : String}

law pending_cut_exact:
  {P.cutText("abc", 3n) == "abc" : String}

law pending_cut_cuts:
  {P.cutText("abcdef", 3n) == "abc" : String}

# ---------- teto de itens (os primeiros ficam) ----------

law pending_keep_first:
  {P.keepAt(0n) == True{} : Bool}

law pending_keep_last:
  {P.keepAt(49n) == True{} : Bool}

law pending_drop_over:
  {P.keepAt(50n) == False{} : Bool}

# ---------- guarda ligada na carga ----------

law pending_held_by_stored:
  {P.heldOnLoad(True{}, False{}) == True{} : Bool}

law pending_held_by_recovered:
  {P.heldOnLoad(False{}, True{}) == True{} : Bool}

law pending_held_both:
  {P.heldOnLoad(True{}, True{}) == True{} : Bool}

law pending_held_none:
  {P.heldOnLoad(False{}, False{}) == False{} : Bool}

# ---------- teto de bytes do arquivo ----------

law pending_stored_bytes:
  {P.maxStoredBytes() == (40 * 1024 * 1024 : U32) : U32}

law pending_stored_fits:
  {P.overStored((40 * 1024 * 1024 : U32)) == False{} : Bool}

law pending_stored_over:
  {P.overStored((41943041 : U32)) == True{} : Bool}
