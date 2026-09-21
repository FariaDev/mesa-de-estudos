import Base
import ../courses.bend as C

# ---------------------------------------------------------------------------
# Contrato do núcleo de matérias. Prefixo `courses_` para não colidir.
#
# O que não saiu (e por quê): unicidade geral de id/canônico para listas
# livres — String.eq é valor computado, o Bend não deixa casar nela; as
# leis de "nunca duplica" ficam em cenários que reduzem. Ordenação
# localeCompare também não: o núcleo usa codepoint (String.is_le).
# ---------------------------------------------------------------------------

# Config vazio não mexe nos descobertos.
law courses_merge_config_vazio:
  for +xs: List<&2, C.Course>
  {C.mergeCourses(xs, Nil{}) == xs : List<&2, C.Course>}

# Rótulo do config vence o descoberto (cenário do teste de overlay).
law courses_rotulo_vence:
  {C.mergeCourses(
    [C.Course{"Calculus I", "Cálculo I", "/c"}],
    [C.Course{"Calculus I", "Calc", "/c"}]
  ) == [C.Course{"Calculus I", "Calc", "/c"}] : List<&2, C.Course>}

# Path do config substitui o descoberto.
law courses_path_vence:
  {C.mergeCourses(
    [C.Course{"a", "A", "/old"}],
    [C.Course{"a", "A", "/new"}]
  ) == [C.Course{"a", "A", "/new"}] : List<&2, C.Course>}

# Nome vazio no config mantém o rótulo descoberto.
law courses_rotulo_vazio_mantem:
  {C.mergeCourses(
    [C.Course{"a", "velho", "/p"}],
    [C.Course{"a", "", "/p2"}]
  ) == [C.Course{"a", "velho", "/p2"}] : List<&2, C.Course>}

# Merge nunca duplica o id quando config e descoberto falam do mesmo.
law courses_sem_dup_id:
  {C.uniqueIds(C.mergeCourses(
    [C.Course{"Calculus I", "Cálculo I", "/c"}],
    [C.Course{"Calculus I", "Calc", "/c"}]
  )) == True{} : Bool}

# Ordem: descobertos, depois ids novos do config; update não reordena.
law courses_ordem:
  {C.ids(C.mergeCourses(
    [C.Course{"a", "A", "/a"}, C.Course{"b", "B", "/b"}],
    [C.Course{"c", "C", "/c"}, C.Course{"b", "B2", "/b2"}]
  )) == ["a", "b", "c"] : List<&2, String>}

# Pasta só no config (sem _state.md) entra.
law courses_so_config:
  {C.mergeCourses(Nil{}, [C.Course{"mine", "Minha matéria", "/f"}])
    == [C.Course{"mine", "Minha matéria", "/f"}] : List<&2, C.Course>}

# Nome não-vazio do config vence, para qualquer id/path.
law courses_overlay_nome:
  for +id: String
  for prev: String
  for oldPath: String
  for newPath: String
  {C.nameOf(C.overlay(C.Course{id, prev, oldPath}, C.Course{id, "Calc", newPath}))
    == "Calc" : String}

# Biblioteca vazia permanece vazia.
law courses_biblioteca_vazia:
  {C.courseLibrary(Nil{}) == Nil{} : List<&2, C.Pdf>}

# Primeira ocorrência do canônico vence; o resultado sai por nome.
law courses_biblioteca_dedupa_ordena:
  {C.names(C.courseLibrary([
    C.Pdf{"b.pdf", "/p/b", "/real/b"},
    C.Pdf{"a.pdf", "/p/a", "/real/a"},
    C.Pdf{"b2.pdf", "/q/b", "/real/b"}
  ])) == ["a.pdf", "b.pdf"] : List<&2, String>}

# Depois do núcleo, não há canônico repetido.
law courses_biblioteca_canonicos_unicos:
  {C.uniqueCanonicals(C.courseLibrary([
    C.Pdf{"b.pdf", "/p/b", "/real/b"},
    C.Pdf{"a.pdf", "/p/a", "/real/a"},
    C.Pdf{"b2.pdf", "/q/b", "/real/b"}
  ])) == True{} : Bool}
