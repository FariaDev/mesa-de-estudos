import Base
import ../msg.bend as M
import ../readersheet.bend as S
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da folha do leitor sem material (ticket #12, revisto na #90).
# Prefixo `readersheet_`.
#
# A folha diz uma coisa só — como pôr um material naquele leitor — com a zona
# tracejada "Solte um PDF aqui" e três atalhos pequenos embaixo. Os atalhos
# nomeiam handlers da tabela do host (`OpenFile`, `RevealFolder`, `AskTutor`);
# o primeiro caminho (arrastar) não tem botão, a zona é o atalho.
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

law readersheet_pedido_ao_tutor:
  {S.tutorSeed("Cálculo I") == M.msg1("sheet.seed", "course", "Cálculo I") : String}

law readersheet_pedido_ao_tutor_sem_nome:
  {S.tutorSeed("  ") == M.msg("sheet.seedBlank") : String}

law readersheet_aria:
  {S.sheetAria("Cálculo I") == M.msg1("sheet.aria", "course", "Cálculo I") : String}

law readersheet_rotulos_dos_atalhos:
  {[S.openLabel(), S.folderLabel(), S.tutorLabel()] == [M.msg("sheet.openLabel"), M.msg("sheet.folderLabel"), M.msg("sheet.tutorLabel")] : List<&2, String>}

law readersheet_quadro_texto:
  {S.dropTitle() == M.msg("sheet.dropTitle") : String}

# ---------- a folha ----------

law readersheet_raiz_tag:
  {V.tagOf(S.sheet("Cálculo I")) == "article" : String}

law readersheet_raiz_classe:
  {attrOf(S.sheet("Cálculo I"), "class") == Some{"reader-sheet"} : Maybe<&2, String>}

law readersheet_raiz_aria:
  {attrOf(S.sheet("Cálculo I"), "aria-label") == Some{M.msg1("sheet.aria", "course", "Cálculo I")} : Maybe<&2, String>}

# Zona de soltar e a linha de atalhos — nessa ordem.
law readersheet_ordem:
  {V.kidsOf(S.sheet("Cálculo I")) ==
    [ S.dropZone()
    , V.viewEl("div", [V.attrClass("sheet-links")], S.items())
    ] : List<&2, V.ViewNode>}

# ---------- os três atalhos, separados por "·" ----------

law readersheet_item_abrir_atalho:
  {kidAt(kidAt(S.sheet("x"), 1n), 0n) == S.link(M.msg("sheet.openLabel"), "OpenFile") : V.ViewNode}

law readersheet_item_sep_um:
  {kidAt(kidAt(S.sheet("x"), 1n), 1n) == S.separator() : V.ViewNode}

law readersheet_item_pasta_atalho:
  {kidAt(kidAt(S.sheet("x"), 1n), 2n) == S.link(M.msg("sheet.folderLabel"), "RevealFolder") : V.ViewNode}

law readersheet_item_sep_dois:
  {kidAt(kidAt(S.sheet("x"), 1n), 3n) == S.separator() : V.ViewNode}

law readersheet_item_tutor_atalho:
  {kidAt(kidAt(S.sheet("x"), 1n), 4n) == S.link(M.msg("sheet.tutorLabel"), "AskTutor") : V.ViewNode}

law readersheet_item_so_tres:
  {kidAt(kidAt(S.sheet("x"), 1n), 5n) == V.viewText("") : V.ViewNode}

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

# ---------- separador ----------

law readersheet_separador_classe:
  {attrOf(S.separator(), "class") == Some{"sheet-sep"} : Maybe<&2, String>}

law readersheet_separador_aria:
  {attrOf(S.separator(), "aria-hidden") == Some{"true"} : Maybe<&2, String>}

law readersheet_separador_texto:
  {V.kidsOf(S.separator()) == [V.viewText("·")] : List<&2, V.ViewNode>}

# ---------- quadro de soltar ----------

law readersheet_quadro_classe:
  {attrOf(S.dropZone(), "class") == Some{"sheet-drop"} : Maybe<&2, String>}

# Ícone (andaime, escondido do leitor de tela) e a frase em destaque.
law readersheet_quadro_filhos:
  {V.kidsOf(S.dropZone()) ==
    [ V.viewEl("span", [V.attrClass("sheet-drop-icon"), V.attrData("icon", "download"), V.attrAria("hidden", "true")], Nil{})
    , V.viewEl("strong", Nil{}, [V.viewText(M.msg("sheet.dropTitle"))])
    ] : List<&2, V.ViewNode>}
