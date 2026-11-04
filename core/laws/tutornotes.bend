import Base
import ../tutornotes.bend as N

# ---------------------------------------------------------------------------
# Contrato das notas do tutor (#91). Prefixo `tn_`.
#
# A lei fixa o invariante do domínio: o caminho de uma nota é SEMPRE relativo
# e começa em `Notas/`; título vazio, com `..`, com separador ou com quebra de
# linha é recusado; a raiz não muda a forma relativa. A sequência de nomes é a
# mesma da Livre e nunca repete um nome.
#
# O que não cabe aqui: realpath da raiz, recusa de symlink, `O_EXCL`, `rename`
# e a mensagem ao tutor (host e catálogo).
# ---------------------------------------------------------------------------

# ---------- tetos ----------

law tn_max_title:
  {N.maxTitle() == 120n : Nat}

law tn_max_content:
  {N.maxContent() == 100000n : Nat}

law tn_folder:
  {N.folder() == "Notas" : String}

# ---------- caminho feliz ----------

law tn_target_base:
  {N.noteTarget("/curso", "Derivadas") == N.NoteTarget.Ok{"/curso", "Notas/Derivadas.md"} : N.NoteTarget}

law tn_target_trims:
  {N.noteTarget("/curso", "  Derivadas  ") == N.NoteTarget.Ok{"/curso", "Notas/Derivadas.md"} : N.NoteTarget}

def relOf(t: N.NoteTarget) -> String:
  match t:
    case N.NoteTarget.Ok{_, +rel}:
      rel
    case N.NoteTarget.Refused{}:
      ""

# A raiz vai no resultado, mas não muda a forma relativa: o caminho nunca é
# absoluto por conta própria.
law tn_target_root_does_not_change_rel:
  {String.eq(relOf(N.noteTargetAt("/a", "Derivadas", 0n)), relOf(N.noteTargetAt("/b", "Derivadas", 0n))) == True{} : Bool}

law tn_target_two:
  {N.noteTargetAt("/curso", "Derivadas", 1n) == N.NoteTarget.Ok{"/curso", "Notas/Derivadas-2.md"} : N.NoteTarget}

law tn_target_three:
  {N.noteTargetAt("/curso", "Derivadas", 2n) == N.NoteTarget.Ok{"/curso", "Notas/Derivadas-3.md"} : N.NoteTarget}

# ---------- recusas ----------

law tn_empty_refused:
  {N.noteTarget("/curso", "   ") == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_dotdot_refused:
  {N.noteTarget("/curso", "..") == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_dotdot_inside_refused:
  {N.noteTarget("/curso", "Notas/../../fora") == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_slash_refused:
  {N.noteTarget("/curso", "a/b") == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_backslash_refused:
  {N.noteTarget("/curso", "a\\b") == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_absolute_refused:
  {N.noteTarget("/curso", "/etc/passwd") == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_newline_refused:
  {N.noteTarget("/curso", "a\nb") == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_carriage_refused:
  {N.noteTarget("/curso", "a\rb") == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_long_refused:
  {N.noteTarget("/curso", String.from_list(List.replicate(Char, 121n, 'x'))) == N.NoteTarget.Refused{} : N.NoteTarget}

law tn_limit_accepted:
  {N.noteTarget("/curso", String.from_list(List.replicate(Char, 120n, 'x'))) == N.NoteTarget.Ok{"/curso", String.append("Notas/", String.append(String.from_list(List.replicate(Char, 120n, 'x')), ".md"))} : N.NoteTarget}
