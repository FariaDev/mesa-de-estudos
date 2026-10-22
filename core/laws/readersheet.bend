import Base
import ../msg.bend as M
import ../readersheet.bend as S
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da folha "Lista 0" do leitor sem material (ticket #12). Prefixo
# `readersheet_`.
#
# A folha diz uma coisa só — como pôr um material naquele leitor — e tem a
# mesma forma para qualquer matéria: título, matéria, abertura, quatro itens e
# o quadro de soltar. Os três atalhos nomeiam handlers da tabela do host
# (`OpenFile`, `RevealFolder`, `AskTutor`); o primeiro caminho (arrastar) não
# tem botão, o quadro é o atalho.
#
# `String.trim` de uma variável livre não reduz: o que se prova do nome da
# matéria são os casos que importam — nome normal, com espaços e vazio.
# ---------------------------------------------------------------------------

# Filho de um nó pelo índice.
def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

def kidAt(n: V.ViewNode, i: Nat) -> V.ViewNode:
  at(V.kidsOf(n), i)

def attrOf(n: V.ViewNode, name: String) -> Maybe<&2, String>:
  V.attrGet(V.attrsOf(n), name)

# ---------- textos ----------

law readersheet_titulo:
  {S.sheetTitle() == M.msg("sheet.title") : String}

law readersheet_materia_com_nome:
  {S.courseLine("Cálculo I") == M.msg1("sheet.course", "course", "Cálculo I") : String}

law readersheet_materia_apara:
  {S.courseLine("  Cálculo I  ") == M.msg1("sheet.course", "course", "Cálculo I") : String}

law readersheet_materia_sem_nome:
  {S.courseLine("") == M.msg("sheet.courseBlank") : String}

law readersheet_materia_so_espaco:
  {S.courseLine("   ") == M.msg("sheet.courseBlank") : String}

law readersheet_pedido_ao_tutor:
  {S.tutorSeed("Cálculo I") == M.msg1("sheet.seed", "course", "Cálculo I") : String}

law readersheet_pedido_ao_tutor_sem_nome:
  {S.tutorSeed("  ") == M.msg("sheet.seedBlank") : String}

law readersheet_aria:
  {S.sheetAria("Cálculo I") == M.msg1("sheet.aria", "course", "Cálculo I") : String}

law readersheet_rotulos_dos_atalhos:
  {[S.openLabel(), S.folderLabel(), S.tutorLabel()] == [M.msg("sheet.openLabel"), M.msg("sheet.folderLabel"), M.msg("sheet.tutorLabel")] : List<&2, String>}

law readersheet_quadro_texto:
  {[S.dropTitle(), S.dropHelp()] == [M.msg("sheet.dropTitle"), M.msg("sheet.dropHelp")] : List<&2, String>}

# ---------- a folha ----------

law readersheet_raiz_tag:
  {V.tagOf(S.sheet("Cálculo I")) == "article" : String}

law readersheet_raiz_classe:
  {attrOf(S.sheet("Cálculo I"), "class") == Some{"reader-sheet"} : Maybe<&2, String>}

law readersheet_raiz_aria:
  {attrOf(S.sheet("Cálculo I"), "aria-label") == Some{M.msg1("sheet.aria", "course", "Cálculo I")} : Maybe<&2, String>}

# Título, matéria, abertura, itens, quadro — nessa ordem.
law readersheet_ordem:
  {V.kidsOf(S.sheet("Cálculo I")) ==
    [ V.viewEl("h1", [V.attrClass("sheet-title")], [V.viewText(M.msg("sheet.title"))])
    , V.viewEl("p", [V.attrClass("sheet-course")], [V.viewText(M.msg1("sheet.course", "course", "Cálculo I"))])
    , V.viewEl("p", [V.attrClass("sheet-intro")], [V.viewText(S.introText())])
    , V.viewEl("ol", [V.attrClass("sheet-items")], S.items())
    , S.dropZone()
    ] : List<&2, V.ViewNode>}

# ---------- os quatro itens ----------

# Arrastar: só o texto; o quadro tracejado abaixo é o atalho.
law readersheet_item_arrastar:
  {kidAt(kidAt(S.sheet("x"), 3n), 0n) == V.viewEl("li", [V.attrClass("sheet-item")], [V.viewText(S.dragText())]) : V.ViewNode}

law readersheet_item_abrir_texto:
  {kidAt(kidAt(kidAt(S.sheet("x"), 3n), 1n), 0n) == V.viewText(S.openText()) : V.ViewNode}

# O espaço entre o texto e o atalho é um nó à parte: a frase traduzida não é concatenada (#41).
law readersheet_item_abrir_espaco:
  {kidAt(kidAt(kidAt(S.sheet("x"), 3n), 1n), 1n) == V.viewText(" ") : V.ViewNode}

law readersheet_item_abrir_atalho:
  {kidAt(kidAt(kidAt(S.sheet("x"), 3n), 1n), 2n) == S.link(M.msg("sheet.openLabel"), "OpenFile") : V.ViewNode}

law readersheet_item_pasta_atalho:
  {kidAt(kidAt(kidAt(S.sheet("x"), 3n), 2n), 2n) == S.link(M.msg("sheet.folderLabel"), "RevealFolder") : V.ViewNode}

law readersheet_item_tutor_atalho:
  {kidAt(kidAt(kidAt(S.sheet("x"), 3n), 3n), 2n) == S.link(M.msg("sheet.tutorLabel"), "AskTutor") : V.ViewNode}

law readersheet_item_so_quatro:
  {kidAt(kidAt(S.sheet("x"), 3n), 4n) == V.viewText("") : V.ViewNode}

# ---------- atalho ----------

law readersheet_atalho_tag:
  {V.tagOf(S.link(M.msg("sheet.openLabel"), "OpenFile")) == "button" : String}

law readersheet_atalho_tipo:
  {attrOf(S.link(M.msg("sheet.openLabel"), "OpenFile"), "type") == Some{"button"} : Maybe<&2, String>}

law readersheet_atalho_classe:
  {attrOf(S.link(M.msg("sheet.openLabel"), "OpenFile"), "class") == Some{"sheet-link"} : Maybe<&2, String>}

law readersheet_atalho_handler:
  {attrOf(S.link(M.msg("sheet.openLabel"), "OpenFile"), "on:click") == Some{"OpenFile"} : Maybe<&2, String>}

law readersheet_atalho_texto:
  {V.kidsOf(S.link(M.msg("sheet.openLabel"), "OpenFile")) == [V.viewText(M.msg("sheet.openLabel"))] : List<&2, V.ViewNode>}

# ---------- quadro de soltar ----------

law readersheet_quadro_classe:
  {attrOf(S.dropZone(), "class") == Some{"sheet-drop"} : Maybe<&2, String>}

# Ícone (andaime, escondido do leitor de tela), a frase em destaque e a dica.
law readersheet_quadro_filhos:
  {V.kidsOf(S.dropZone()) ==
    [ V.viewEl("span", [V.attrClass("sheet-drop-icon"), V.attrData("icon", "download"), V.attrAria("hidden", "true")], Nil{})
    , V.viewEl("strong", Nil{}, [V.viewText(M.msg("sheet.dropTitle"))])
    , V.viewEl("small", Nil{}, [V.viewText(M.msg("sheet.dropHelp"))])
    ] : List<&2, V.ViewNode>}
