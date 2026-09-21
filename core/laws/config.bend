import Base
import ../config.bend as C

# ---------------------------------------------------------------------------
# Contrato do núcleo da configuração da Mesa. Prefixo `config_`.
#
# O host manda fatos (Maybe de presença/valor); o núcleo devolve a forma
# estável. As leis falam das regras que o app de fato exercita:
#   - config vazia/`desk` ausente cai nos defaults do autor;
#   - campo inválido (ausente/vazio) cai no default, não quebra;
#   - flags só desligam com `false` de verdade;
#   - painéis: 1 fica 1, 2 ficam 2 (com toggle), 3+ corta nos 2 primeiros e
#     cada slot herda o default dele;
#   - strings aparadas, `prefer` sem itens vazios;
#   - cursos: id do basename quando falta id, filtro por id+path, nome pode
#     ficar vazio (o `||` do host não cai no path);
#   - needsSetup = sem vault utilizável E sem curso.
#
# O que não saiu (e por quê): igualdade genérica de `Config` para fatos
# arbitrários não reduz (Maybe/String livres são valor computado, o Bend não
# casa neles); as leis viram cenários concretos do host. O trim dos quatro
# paths do topo também não: o app nunca aparou, é quirk preservado — a lei
# fixa o comportamento (espaço nas pontas sobrevive).
# ---------------------------------------------------------------------------

# ---------- vocabulário auxiliar (só para falar do núcleo) ----------

def emptyDeskFacts() -> C.DeskFacts:
  C.DeskFacts{None{}, None{}, None{}, None{}, None{}, None{}, None{}, Nil{}}

def emptyFacts() -> C.ConfigFacts:
  C.ConfigFacts{None{}, None{}, None{}, None{}, Nil{}, None{}}

def deskOf(c: C.Config) -> C.Desk:
  match c:
    case C.Config{vaultPath, runtimePath, piPath, xournalPath, courses, desk}:
      desk

def coursesOf(c: C.Config) -> List<&2, C.Course>:
  match c:
    case C.Config{vaultPath, runtimePath, piPath, xournalPath, courses, desk}:
      courses

def panelToggle(p: C.Panel) -> String:
  match p:
    case C.Panel{label, prefer, toggle}:
      toggle

# ---------- vazio ⇒ defaults ----------

# Config sem nenhum fato = defaults do autor inteiros.
law config_vazio:
  {C.normalize(emptyFacts()) == C.Config{
    "", "", "", "",
    Nil{},
    C.defaultDesk()
  } : C.Config}

# `desk` não-objeto (host manda None) = defaults.
law config_desk_ausente:
  {C.normalizeDesk(None{}) == C.defaultDesk() : C.Desk}

# `desk` objeto porém sem fatos = defaults.
law config_desk_vazio:
  {C.normalizeDesk(Some{emptyDeskFacts()}) == C.defaultDesk() : C.Desk}

# normalize delega o bloco desk inteiro: mesmos fatos, mesmo desk.
law config_desk_delegado:
  {deskOf(C.normalize(C.ConfigFacts{None{}, None{}, None{}, None{}, Nil{}, Some{emptyDeskFacts()}}))
    == C.normalizeDesk(Some{emptyDeskFacts()}) : C.Desk}

# ---------- flags ----------

# Título apara; flags ausentes ficam true; painéis ausentes ficam os dois.
law config_flags_default_true:
  {C.normalizeDesk(Some{C.DeskFacts{
    Some{"  Mesa da Ana  "}, None{}, None{}, None{}, None{}, None{}, None{}, Nil{}
  }}) == C.Desk{
    "Mesa da Ana", True{}, True{}, True{}, True{}, True{}, True{}, C.defaultPanels()
  } : C.Desk}

# `false` de verdade desliga todas.
law config_flags_false:
  {C.normalizeDesk(Some{C.DeskFacts{
    None{},
    Some{False{}}, Some{False{}}, Some{False{}}, Some{False{}}, Some{False{}}, Some{False{}},
    Nil{}
  }}) == C.Desk{
    "Mesa de Estudos", False{}, False{}, False{}, False{}, False{}, False{}, C.defaultPanels()
  } : C.Desk}

# Liga/desliga campo a campo: só o que veio false muda.
law config_flags_parciais:
  {C.normalizeDesk(Some{C.DeskFacts{
    None{}, Some{False{}}, None{}, None{}, Some{False{}}, None{}, None{}, Nil{}
  }}) == C.Desk{
    "Mesa de Estudos", False{}, True{}, True{}, False{}, True{}, True{}, C.defaultPanels()
  } : C.Desk}

law config_flag_ausente:
  {C.flagOf(None{}) == True{} : Bool}

law config_flag_true:
  {C.flagOf(Some{True{}}) == True{} : Bool}

law config_flag_false:
  {C.flagOf(Some{False{}}) == False{} : Bool}

# ---------- campo inválido ⇒ default ----------

law config_titulo_vazio:
  {C.trimmedOr(Some{"   "}, "Mesa de Estudos") == "Mesa de Estudos" : String}

law config_titulo_ausente:
  {C.trimmedOr(None{}, "Mesa de Estudos") == "Mesa de Estudos" : String}

law config_titulo_trim:
  {C.trimmedOr(Some{"  Lista 2  "}, "Mesa de Estudos") == "Lista 2" : String}

# Rótulo vazio no slot 0 cai no default do slot.
law config_painel_label_vazio:
  {C.normalizePanel0(C.PanelFacts{Some{"  "}, Nil{}, None{}}) == C.defaultPanel0() : C.Panel}

# Slot 1 inteiro vazio cai no default do slot (toggle incluso).
law config_painel_toggle_vazio:
  {C.normalizePanel1(C.PanelFacts{None{}, Nil{}, None{}}) == C.defaultPanel1() : C.Panel}

# `prefer` não-array chega como lista vazia e herda o default do slot.
law config_painel_prefer_invalido:
  {C.normalizePanel0(C.PanelFacts{Some{"Lista"}, Nil{}, None{}})
    == C.Panel{"Lista", ["Limites"], ""} : C.Panel}

# ---------- strings aparadas ----------

# Itens aparados; vazios somem (o host manda a lista crua já em String).
law config_prefer_limpa:
  {C.asStringList(["  lista  ", "", "   ", "  form ", "Enunci"])
    == ["lista", "form", "Enunci"] : List<&2, String>}

law config_prefer_so_vazios_default:
  {C.preferOf([" ", ""], ["Limites"]) == ["Limites"] : List<&2, String>}

law config_prefer_limpo_vence_slot:
  {C.preferOf(["  lista "], ["Limites"]) == ["lista"] : List<&2, String>}

law config_toggle_trim:
  {panelToggle(C.normalizePanel1(C.PanelFacts{None{}, Nil{}, Some{"  Tabela  "}})) == "Tabela" : String}

# ---------- 1 painel ----------

law config_um_painel:
  {C.normalizePanels([C.PanelFacts{Some{"Lista"}, ["lista"], None{}}])
    == [C.Panel{"Lista", ["lista"], ""}] : List<&2, C.Panel>}

law config_um_painel_defaults:
  {C.normalizePanels([C.PanelFacts{None{}, Nil{}, None{}}])
    == [C.Panel{"Enunciado", ["Limites"], ""}] : List<&2, C.Panel>}

# Sem painéis (ausente/não-array) ficam os dois defaults.
law config_nenhum_painel_default:
  {C.normalizePanels(Nil{}) == C.defaultPanels() : List<&2, C.Panel>}

# ---------- 2 painéis ----------

# Par label/prefer/toggle válido é preservado (cenário do teste do app).
law config_dois_paineis:
  {C.normalizePanels([
    C.PanelFacts{Some{"Enunciado"}, ["Lista de Limites", "Enunci"], None{}},
    C.PanelFacts{Some{"Apoio"}, ["Tabela"], Some{"Tabela"}}
  ]) == [
    C.Panel{"Enunciado", ["Lista de Limites", "Enunci"], ""},
    C.Panel{"Apoio", ["Tabela"], "Tabela"}
  ] : List<&2, C.Panel>}

# Toggle ausente (o host manda None para '' e para ausente) herda o slot 1.
law config_dois_paineis_toggle_herdado:
  {C.normalizePanels([
    C.PanelFacts{Some{"Lista"}, ["lista"], None{}},
    C.PanelFacts{Some{"Apoio"}, ["tabela"], None{}}
  ]) == [
    C.Panel{"Lista", ["lista"], ""},
    C.Panel{"Apoio", ["tabela"], "Formulário"}
  ] : List<&2, C.Panel>}

# ---------- 3+ painéis ⇒ corta em 2 ----------

# Cenário exato do teste do app: A/B/C viram A e B, cada um herdando o
# default do seu slot (confirmado: slice(0,2) no config.cjs).
law config_tres_paineis_corta:
  {C.normalizePanels([
    C.PanelFacts{Some{"A"}, Nil{}, None{}},
    C.PanelFacts{Some{"B"}, Nil{}, None{}},
    C.PanelFacts{Some{"C"}, Nil{}, None{}}
  ]) == [
    C.Panel{"A", ["Limites"], ""},
    C.Panel{"B", ["Formul"], "Formulário"}
  ] : List<&2, C.Panel>}

# ---------- cursos ----------

law config_cursos_vazio:
  {C.normalizeCourses(Nil{}) == Nil{} : List<&2, C.Course>}

# Sem id, o id vira o basename do path; o nome continua vazio (não herda path).
law config_curso_basename:
  {C.normalizeCourses([C.CourseFacts{None{}, None{}, Some{"/x/Minha Materia"}, Some{"Minha Materia"}}])
    == [C.Course{"Minha Materia", "", "/x/Minha Materia"}] : List<&2, C.Course>}

# Com id cru, o nome herda o id cru (não o aparado, não o basename).
law config_curso_name_herda_id:
  {C.normalizeCourses([C.CourseFacts{Some{"calculo-1"}, None{}, Some{"/p"}, Some{"p"}}])
    == [C.Course{"calculo-1", "calculo-1", "/p"}] : List<&2, C.Course>}

# Sem id e sem basename o curso cai, mesmo com nome.
law config_curso_sem_id_cai:
  {C.normalizeCourses([C.CourseFacts{None{}, Some{"Órfã"}, Some{"/p"}, None{}}])
    == Nil{} : List<&2, C.Course>}

# Path vazio (ou só espaços) derruba o curso.
law config_curso_path_vazio_cai:
  {C.normalizeCourses([C.CourseFacts{Some{"id"}, Some{"Nome"}, Some{"   "}, None{}}])
    == Nil{} : List<&2, C.Course>}

law config_curso_trim:
  {C.courseOf(C.CourseFacts{Some{"  calculo-1 "}, Some{"  Cálculo I "}, Some{" /p/q "}, None{}})
    == C.Course{"calculo-1", "Cálculo I", "/p/q"} : C.Course}

# Ordem preservada; entradas inutilizáveis somem no meio.
law config_cursos_preserva_ordem_e_filtra:
  {C.normalizeCourses([
    C.CourseFacts{Some{"b"}, None{}, Some{"/b"}, Some{"b"}},
    C.CourseFacts{None{}, None{}, None{}, None{}},
    C.CourseFacts{Some{"a"}, Some{"A"}, Some{"/a"}, None{}}
  ]) == [C.Course{"b", "b", "/b"}, C.Course{"a", "A", "/a"}] : List<&2, C.Course>}

# Curso dentro do normalize completo.
law config_normalize_cursos:
  {coursesOf(C.normalize(C.ConfigFacts{None{}, None{}, None{}, None{},
    [C.CourseFacts{None{}, None{}, Some{"/p/Álgebra"}, Some{"Álgebra"}}], None{}}))
    == [C.Course{"Álgebra", "", "/p/Álgebra"}] : List<&2, C.Course>}

# ---------- needsSetup ----------

law config_needsSetup_vazio:
  {C.needsSetup(False{}, Nil{}) == True{} : Bool}

law config_needsSetup_com_vault:
  {C.needsSetup(True{}, Nil{}) == False{} : Bool}

law config_needsSetup_com_curso:
  {C.needsSetup(False{}, [C.Course{"a", "A", "/p"}]) == False{} : Bool}

# Vault utilizável vence qualquer lista de cursos.
law config_needsSetup_vault_generico:
  for courses: List<&2, C.Course>
  {C.needsSetup(True{}, courses) == False{} : Bool}

# Qualquer curso na lista já dispensa o setup.
law config_needsSetup_curso_generico:
  for c: C.Course
  {C.needsSetup(False{}, [c]) == False{} : Bool}

# ---------- quirk: paths do topo não são aparados ----------

# O app sempre fez String(raw.vaultPath||'') sem trim; espaço nas pontas fica.
law config_vault_sem_trim:
  {C.normalize(C.ConfigFacts{Some{" /vault "}, None{}, None{}, None{}, Nil{}, None{}})
    == C.Config{" /vault ", "", "", "", Nil{}, C.defaultDesk()} : C.Config}

law config_paths_presentes:
  {C.normalize(C.ConfigFacts{Some{"/v"}, Some{"/r"}, Some{"/pi"}, Some{"/x"}, Nil{}, None{}})
    == C.Config{"/v", "/r", "/pi", "/x", Nil{}, C.defaultDesk()} : C.Config}
