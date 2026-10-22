import Base
import ../msg.bend as M
import ../toolmentions.bend as T
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato das menções `@` das ferramentas do tutor (ticket #53). Prefixo
# `tmen_`.
#
#   1. quem aparece na lista: `geogebra` só onde o motor oferece; as outras
#      ferramentas do tutor aparecem sempre, na ordem do catálogo;
#   2. chips: sem repetir, no máximo `maxChips()`, remover tira só o pedido;
#   3. a instrução vai marcada com um cabeçalho fixo (o mesmo em qualquer
#      idioma), com os ids na ordem;
#   4. o menu e os chips têm o DOM/ARIA que o host e os testes de janela fixam.
#
# O que o enunciado NÃO prova: o gatilho `@` no campo, o filtro pelo nome no
# idioma da tela, o índice ativo com wrap, o posicionamento e a troca do slot
# de ícone (mundo do host); as frases (catálogos de idioma).
# ---------------------------------------------------------------------------

def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

def kind(n: V.ViewNode, i: Nat) -> V.ViewNode:
  at(V.kidsOf(n), i)

def attrOf(n: V.ViewNode, name: String) -> Maybe<&2, String>:
  V.attrGet(V.attrsOf(n), name)

def toolId(tool: T.MentionTool) -> String:
  match tool:
    case T.MentionTool{id, icon}:
      id

def toolIds(xs: List<&2, T.MentionTool>) -> List<&2, String>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{toolId(h), toolIds(t)}

def geogebraTool() -> T.MentionTool:
  T.MentionTool{"geogebra", "graph"}

def pdfTool() -> T.MentionTool:
  T.MentionTool{"pdf", "book"}

def twoTools() -> List<&2, T.MentionTool>:
  [geogebraTool(), pdfTool()]

def firstRow(activeKey: String) -> V.ViewNode:
  at(T.itemViews(twoTools(), activeKey), 0n)

# ---------- quem aparece ----------

law tmen_com_geogebra_lista_tudo_na_ordem:
  {toolIds(T.offered(True{})) == ["geogebra", "visualizar", "atividade", "pdf"] : List<&2, String>}

law tmen_sem_geogebra_a_ferramenta_some:
  {toolIds(T.offered(False{})) == ["visualizar", "atividade", "pdf"] : List<&2, String>}

law tmen_o_teto_de_chips:
  {T.maxChips() == 3n : Nat}

# ---------- chips ----------

law tmen_chip_novo_entra_no_fim:
  {T.addId(["geogebra"], "pdf") == ["geogebra", "pdf"] : List<&2, String>}

law tmen_chip_repetido_nao_entra:
  {T.addId(["geogebra", "pdf"], "geogebra") == ["geogebra", "pdf"] : List<&2, String>}

law tmen_primeiro_chip:
  {T.addId([], "visualizar") == ["visualizar"] : List<&2, String>}

law tmen_chip_acima_do_teto_nao_entra:
  {T.addId(["geogebra", "visualizar", "pdf"], "atividade") == ["geogebra", "visualizar", "pdf"] : List<&2, String>}

law tmen_remover_tira_so_o_pedido:
  {T.removeId(["geogebra", "visualizar", "pdf"], "visualizar") == ["geogebra", "pdf"] : List<&2, String>}

law tmen_remover_ausente_mantem:
  {T.removeId(["geogebra"], "pdf") == ["geogebra"] : List<&2, String>}

law tmen_tem_o_chip:
  {T.hasId(["geogebra", "pdf"], "pdf") == True{} : Bool}

law tmen_nao_tem_o_chip:
  {T.hasId(["geogebra"], "pdf") == False{} : Bool}

law tmen_conta_os_chips:
  {T.idCount(["a", "b"]) == 2n : Nat}

# ---------- instrução ----------

law tmen_marca_fixa:
  {T.blockMark() == "[Ferramenta pedida na Mesa:" : String}

law tmen_cabecalho_leva_os_ids_em_ordem:
  {T.blockHeader(["geogebra", "visualizar"]) == "\n\n[Ferramenta pedida na Mesa: geogebra, visualizar]" : String}

law tmen_bloco_junta_as_instrucoes_numa_linha:
  {T.instructionBlock(["pdf"], ["Use A.", "Use B."]) == "\n\n[Ferramenta pedida na Mesa: pdf]\nUse A. Use B." : String}

# ---------- chaves do catálogo ----------

law tmen_chave_do_nome:
  {T.nameMsg("geogebra") == M.msg("mention.geogebra.name") : String}

law tmen_chave_da_descricao:
  {T.descMsg("pdf") == M.msg("mention.pdf.desc") : String}

law tmen_chave_da_instrucao:
  {T.instructionMsg("visualizar") == M.msg("mention.visualizar.instruction") : String}

# ---------- casca do menu ----------

law tmen_menu_id:
  {attrOf(T.menuView(True{}, Nil{}, ""), "id") == Some{"mention-menu"} : Maybe<&2, String>}

law tmen_menu_reusa_o_visual_do_slash:
  {attrOf(T.menuView(True{}, Nil{}, ""), "class") == Some{"slash-pop mention-pop"} : Maybe<&2, String>}

law tmen_menu_aberto_sem_hidden:
  {attrOf(T.menuView(True{}, Nil{}, ""), "hidden") == None{} : Maybe<&2, String>}

law tmen_menu_fechado_com_hidden:
  {attrOf(T.menuView(False{}, Nil{}, ""), "hidden") == Some{""} : Maybe<&2, String>}

law tmen_menu_tem_cabeca_lista_e_rodape:
  {List.length(&2, V.ViewNode, V.kidsOf(T.menuView(True{}, twoTools(), "pdf"))) == 3n : Nat}

law tmen_lista_e_listbox:
  {attrOf(kind(T.menuView(True{}, Nil{}, ""), 1n), "role") == Some{"listbox"} : Maybe<&2, String>}

law tmen_lista_id:
  {attrOf(kind(T.menuView(True{}, Nil{}, ""), 1n), "id") == Some{"mention-list"} : Maybe<&2, String>}

# ---------- linha ----------

law tmen_linha_id_segue_a_ordem:
  {T.itemId(1n) == "mention-opt-1" : String}

law tmen_linha_ativa_classe:
  {attrOf(firstRow("geogebra"), "class") == Some{"slash-item mention-item active"} : Maybe<&2, String>}

law tmen_linha_ociosa_classe:
  {attrOf(firstRow("pdf"), "class") == Some{"slash-item mention-item"} : Maybe<&2, String>}

law tmen_linha_ativa_aria:
  {attrOf(firstRow("geogebra"), "aria-selected") == Some{"true"} : Maybe<&2, String>}

law tmen_linha_ociosa_aria:
  {attrOf(firstRow("pdf"), "aria-selected") == Some{"false"} : Maybe<&2, String>}

law tmen_linha_papel_de_opcao:
  {attrOf(firstRow(""), "role") == Some{"option"} : Maybe<&2, String>}

law tmen_linha_clique_escolhe:
  {attrOf(firstRow(""), "on:click") == Some{"pick"} : Maybe<&2, String>}

law tmen_linha_nao_rouba_o_foco:
  {attrOf(firstRow(""), "on:mousedown") == Some{"hold"} : Maybe<&2, String>}

law tmen_linha_icone_pedido_ao_host:
  {attrOf(kind(firstRow(""), 0n), "data-icon") == Some{"graph"} : Maybe<&2, String>}

# O ícone do `@visualizar` é o quadro (#70): o "shapes" de antes não se lia
# na lista de menções.
def toolIcon(tool: T.MentionTool) -> String:
  match tool:
    case T.MentionTool{id, icon}:
      icon

def toolIcons(xs: List<&2, T.MentionTool>) -> List<&2, String>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{toolIcon(h), toolIcons(t)}

law tmen_icones_do_catalogo:
  {toolIcons(T.catalog()) == ["graph", "board", "sparkles", "book"] : List<&2, String>}

# ---------- chip ----------

law tmen_chip_classe:
  {attrOf(at(T.chipViews([geogebraTool()]), 0n), "class") == Some{"mention-chip"} : Maybe<&2, String>}

law tmen_chip_leva_o_id_da_ferramenta:
  {attrOf(at(T.chipViews([geogebraTool()]), 0n), "data-tool") == Some{"geogebra"} : Maybe<&2, String>}

law tmen_chip_remover_aria:
  {attrOf(kind(at(T.chipViews([geogebraTool()]), 0n), 2n), "aria-label") == Some{M.msg1("mention.removeAria", "name", "mention.geogebra.name")} : Maybe<&2, String>}

law tmen_chip_remover_handler:
  {attrOf(kind(at(T.chipViews([geogebraTool()]), 0n), 2n), "on:click") == Some{"remove"} : Maybe<&2, String>}

law tmen_chips_um_por_ferramenta:
  {List.length(&2, V.ViewNode, T.chipViews(twoTools())) == 2n : Nat}
