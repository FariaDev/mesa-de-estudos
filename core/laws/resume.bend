import Base
import ../resume.bend as R
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato do registro de retomada (Mesa). Prefixo `resume_`.
#
# As leis fecham em valores concretos: `String.trim`/`String.take` de uma
# variável livre não reduzem, então o que se prova é o caso que importa — texto
# vazio ou só espaço, texto acima do teto, página 0, lista de páginas acima do
# limite e a árvore do cartão montada.
# ---------------------------------------------------------------------------

# ---------- tetos ----------

law resume_max_text:
  {R.maxText() == 240n : Nat}

law resume_max_pdfs:
  {R.maxPdfs() == 2n : Nat}

# ---------- vale registrar? ----------

law resume_keep_both:
  {R.keepRecord("travei na 3", "fazer a 4") == True{} : Bool}

law resume_drop_blank_where:
  {R.keepRecord("   ", "fazer a 4") == False{} : Bool}

law resume_drop_blank_next:
  {R.keepRecord("travei na 3", "\t ") == False{} : Bool}

law resume_drop_empty:
  {R.keepRecord("", "") == False{} : Bool}

# ---------- texto ----------

law resume_line_trims:
  {R.line("  travei na 3  ") == "travei na 3" : String}

law resume_cut_keeps:
  {R.cutLine("abc", 5n) == "abc" : String}

law resume_cut_cuts:
  {R.cutLine("abcdef", 3n) == "abc" : String}

law resume_path_trims:
  {R.pathLine("  /tmp/lista.pdf  ") == "/tmp/lista.pdf" : String}

# ---------- páginas ----------

law resume_page_zero:
  {R.pageOf(0n) == 1n : Nat}

law resume_page_kept:
  {R.pageOf(12n) == 12n : Nat}

law resume_page_ref:
  {R.pageRef("/tmp/lista.pdf", 0n) == R.ResumePage{"/tmp/lista.pdf", 1n} : R.ResumePage}

law resume_page_ref_trims:
  {R.pageRef("  /tmp/lista.pdf ", 3n) == R.ResumePage{"/tmp/lista.pdf", 3n} : R.ResumePage}

law resume_keep_page_first:
  {R.keepPage(0n) == True{} : Bool}

law resume_keep_page_second:
  {R.keepPage(1n) == True{} : Bool}

law resume_keep_page_over:
  {R.keepPage(2n) == False{} : Bool}

law resume_pages_keeps:
  {R.takePages([R.ResumePage{"/a.pdf", 1n}]) == [R.ResumePage{"/a.pdf", 1n}] : List<&2, R.ResumePage>}

law resume_pages_caps:
  {R.takePages([R.ResumePage{"/a.pdf", 1n}, R.ResumePage{"/b.pdf", 2n}, R.ResumePage{"/c.pdf", 3n}])
    == [R.ResumePage{"/a.pdf", 1n}, R.ResumePage{"/b.pdf", 2n}] : List<&2, R.ResumePage>}

# ---------- forma do registro ----------

# Os textos entram aparados e o `.xopp` passa pelo teto do caminho.
law resume_record_shape:
  {R.record("  onde  ", "  próximo  ", "  Lista 2 · 7b  ", "  /tmp/l.xopp  ", Nil{})
    == R.ResumeRecord{"onde", "próximo", "Lista 2 · 7b", "/tmp/l.xopp", Nil{}} : R.ResumeRecord}

# O registro inteiro com páginas demais: as duas primeiras ficam.
law resume_record_caps:
  {R.record("onde", "próximo", "Lista 2", "/tmp/l.xopp", [R.ResumePage{"/a.pdf", 1n}, R.ResumePage{"/b.pdf", 2n}, R.ResumePage{"/c.pdf", 3n}])
    == R.ResumeRecord{"onde", "próximo", "Lista 2", "/tmp/l.xopp", [R.ResumePage{"/a.pdf", 1n}, R.ResumePage{"/b.pdf", 2n}]} : R.ResumeRecord}

# ---------- textos do cartão e da retomada ----------

law resume_title_both:
  {R.resumeTitle("Cálculo I", "Lista 2 · 7b") == "Continuar Cálculo I — Lista 2 · 7b" : String}

law resume_title_sem_questao:
  {R.resumeTitle("Cálculo I", "   ") == "Continuar Cálculo I" : String}

law resume_where_label:
  {R.resumeWhereLabel("travei na 3") == "Onde parei: travei na 3" : String}

law resume_next_label:
  {R.resumeNextLabel("fazer a 4") == "Próximo passo: fazer a 4" : String}

law resume_end_day_draft:
  {R.endDayDraft("travei na 3", "fazer a 4")
    == "Encerrar por hoje.\n\nOnde parei: travei na 3\n\nPróximo passo: fazer a 4" : String}

law resume_draft:
  {R.resumeDraft("travei na 3", "fazer a 4")
    == "Continuar de onde parei.\n\nOnde parei: travei na 3\n\nPróximo passo: fazer a 4" : String}

# ---------- cartão ----------

law resume_card_tag:
  {V.tagOf(R.resumeCardView("Continuar Cálculo I", "travei na 3", "fazer a 4")) == "div" : String}

law resume_card_class:
  {V.attrGet(V.attrsOf(R.resumeCardView("Continuar Cálculo I", "travei na 3", "fazer a 4")), "class")
    == Some{"resume-card"} : Maybe<&2, String>}

law resume_card_title_class:
  {V.attrGet(V.attrsOf(R.resumeCardTitleView("Continuar Cálculo I")), "class")
    == Some{"resume-card-title"} : Maybe<&2, String>}

law resume_card_line_class:
  {V.attrGet(V.attrsOf(R.resumeCardLineView("Onde parei: x")), "class")
    == Some{"resume-card-line"} : Maybe<&2, String>}

law resume_go_class:
  {V.attrGet(V.attrsOf(R.resumeGoBtn()), "class") == Some{"resume-go"} : Maybe<&2, String>}

law resume_go_click:
  {V.attrGet(V.attrsOf(R.resumeGoBtn()), "on:click") == Some{"resume"} : Maybe<&2, String>}

law resume_dismiss_class:
  {V.attrGet(V.attrsOf(R.resumeDismissBtn()), "class") == Some{"resume-dismiss"} : Maybe<&2, String>}

law resume_dismiss_click:
  {V.attrGet(V.attrsOf(R.resumeDismissBtn()), "on:click") == Some{"dismiss"} : Maybe<&2, String>}
