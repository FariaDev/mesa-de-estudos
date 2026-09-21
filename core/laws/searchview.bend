import Base
import ../searchview.bend as S
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da view da busca no conteúdo das conversas.
#
# Fatos do host deixam as leis gerais reduzirem: `falses`/`trues` fabricam os
# fatos alinhados ("toda conversa diferente" / "tudo da mesma conversa") para
# as contagens; cenários concretos travam rótulos, ids, classes e o DOM dos
# estados. O que ficou de fora (dobra com mapa de índices, foco, scroll, IPC,
# relógio do `relativeTime`) é host.
# ---------------------------------------------------------------------------

def hitA() -> S.ResultHit:
  S.ResultHit{"Lista da manhã", "agora", True{}, False{}, [S.PieceText{"notícia de teste"}]}

def hitB() -> S.ResultHit:
  S.ResultHit{"Lista da manhã", "5m", False{}, True{}, [S.PieceMark{"notícia"}, S.PieceText{" de teste"}]}

def hitC() -> S.ResultHit:
  S.ResultHit{"Prova", "", False{}, True{}, []}

def hitSemTitulo() -> S.ResultHit:
  S.ResultHit{"", "", False{}, True{}, []}

def falses(xs: List<&2, S.ResultHit>) -> List<&2, Bool>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{_, t}:
      Con{False{}, falses(t)}

def trues(xs: List<&2, S.ResultHit>) -> List<&2, Bool>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{_, t}:
      Con{True{}, trues(t)}

def firstNode(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

# ---------- rótulos ----------

law sv_papel_user:
  {S.roleLabel(True{}, False{}) == "Você" : String}

law sv_papel_pi:
  {S.roleLabel(False{}, True{}) == "Pi" : String}

law sv_papel_vazio:
  {S.roleLabel(False{}, False{}) == "" : String}

law sv_titulo_vazio:
  {S.titleLabel("") == "Conversa" : String}

law sv_titulo_ok:
  {S.titleLabel("Lista") == "Lista" : String}

law sv_id_primeiro:
  {S.itemId(0n) == "pc-item-1" : String}

law sv_id_decimo:
  {S.itemId(9n) == "pc-item-10" : String}

# ---------- textos dos estados e do rodapé ----------

law sv_dica_curta:
  {S.minQueryHint() == "Digite ao menos 2 caracteres para buscar no conteúdo." : String}

law sv_carregando:
  {S.loadingText() == "Buscando…" : String}

law sv_dica_rodape:
  {S.hintText() == "↑↓ navegar · ⏎ abrir conversa · Esc fechar" : String}

law sv_erro_padrao:
  {S.errorText("") == "Não foi possível buscar agora." : String}

law sv_erro_mensagem:
  {S.errorText("falhou") == "falhou" : String}

law sv_info_simples:
  {S.infoText(3n, 2n, 0n, 0n, False{}) == "3 trechos · 2 arquivos" : String}

law sv_info_singular:
  {S.infoText(1n, 1n, 0n, 0n, False{}) == "1 trecho · 1 arquivo" : String}

law sv_info_completo:
  {S.infoText(10n, 3n, 12n, 2n, True{}) == "10 trechos · 3 arquivos · 12 ms · 2 grandes ignorados · busca parcial" : String}

law sv_info_grande:
  {S.infoText(1n, 0n, 0n, 1n, False{}) == "1 trecho · 0 arquivos · 1 grande ignorado" : String}

# ---------- linhas: cabeça por conversa + item ----------

law sv_linhas_um:
  {S.rows([hitA()], [False{}], [True{}]) == [
    S.ResultRowGroup{"Lista da manhã", "agora"},
    S.ResultRowHit{"pc-item-1", True{}, "Você", [S.PieceText{"notícia de teste"}], True{}}
  ] : List<&2, S.ResultRow>}

# Mesma conversa: uma cabeça só; o ativo vai no item 2.
law sv_linhas_mesmo_grupo:
  {S.rows([hitA(), hitB()], [False{}, True{}], [True{}, False{}]) == [
    S.ResultRowGroup{"Lista da manhã", "agora"},
    S.ResultRowHit{"pc-item-1", True{}, "Você", [S.PieceText{"notícia de teste"}], True{}},
    S.ResultRowHit{"pc-item-2", False{}, "Pi", [S.PieceMark{"notícia"}, S.PieceText{" de teste"}], False{}}
  ] : List<&2, S.ResultRow>}

# Conversa nova: cabeça nova (com `when` vazio escondido na view).
law sv_linhas_grupos:
  {S.rows([hitA(), hitC()], [False{}, False{}], [False{}, True{}]) == [
    S.ResultRowGroup{"Lista da manhã", "agora"},
    S.ResultRowHit{"pc-item-1", True{}, "Você", [S.PieceText{"notícia de teste"}], False{}},
    S.ResultRowGroup{"Prova", ""},
    S.ResultRowHit{"pc-item-2", False{}, "Pi", [], True{}}
  ] : List<&2, S.ResultRow>}

law sv_linhas_titulo_vazio:
  {S.rows([hitSemTitulo()], [False{}], [False{}]) == [
    S.ResultRowGroup{"Conversa", ""},
    S.ResultRowHit{"pc-item-1", False{}, "Pi", [], False{}}
  ] : List<&2, S.ResultRow>}

# Fatos desalinhados não desenham nada.
law sv_linhas_desalinhadas:
  for h: S.ResultHit
  {S.rows([h], Nil{}, Nil{}) == Nil{} : List<&2, S.ResultRow>}

# ---------- contagens ----------

# Todo trecho vira exatamente uma linha de item.
law sv_conta_trechos:
  for hits: List<&2, S.ResultHit>
  for i: Nat
  {S.hitCount(S.rows.go(hits, falses(hits), trues(hits), i)) == List.length(&2, S.ResultHit, hits) : Nat}

# Conversas sempre diferentes: uma cabeça por trecho.
law sv_conta_cabecas_todas:
  for hits: List<&2, S.ResultHit>
  for i: Nat
  {S.headCount(S.rows.go(hits, falses(hits), trues(hits), i)) == List.length(&2, S.ResultHit, hits) : Nat}

# Tudo da mesma conversa: nenhuma cabeça (a lista fica vazia ou só de itens).
law sv_conta_cabecas_nenhuma:
  for hits: List<&2, S.ResultHit>
  for i: Nat
  {S.headCount(S.rows.go(hits, trues(hits), trues(hits), i)) == 0n : Nat}

law sv_conta_cabeca_vazia:
  {S.headCount(Nil{}) == 0n : Nat}

# ---------- árvore: item, papel, marca, grupo ----------

law sv_item_atributos_ativo:
  {V.attrGet(V.attrsOf(S.rowView(S.ResultRowHit{"pc-item-3", True{}, "Você", [], True{}})), "aria-selected") == Some{"true"} : Maybe<&2, String>}

law sv_item_atributos_inativo:
  {V.attrGet(V.attrsOf(S.rowView(S.ResultRowHit{"pc-item-3", True{}, "Você", [], False{}})), "aria-selected") == Some{"false"} : Maybe<&2, String>}

law sv_item_id:
  {V.attrGet(V.attrsOf(S.rowView(S.ResultRowHit{"pc-item-3", True{}, "Você", [], False{}})), "id") == Some{"pc-item-3"} : Maybe<&2, String>}

law sv_item_classes_ativo:
  {V.attrGet(V.attrsOf(S.rowView(S.ResultRowHit{"pc-item-1", False{}, "Pi", [], True{}})), "class") == Some{"palette-item pc-item active"} : Maybe<&2, String>}

law sv_item_classes_inativo:
  {V.attrGet(V.attrsOf(S.rowView(S.ResultRowHit{"pc-item-1", False{}, "Pi", [], False{}})), "class") == Some{"palette-item pc-item"} : Maybe<&2, String>}

law sv_papel_classe_user:
  {V.attrGet(V.attrsOf(S.roleNode(True{}, "Você")), "class") == Some{"pc-role user"} : Maybe<&2, String>}

law sv_papel_classe_pi:
  {V.attrGet(V.attrsOf(S.roleNode(False{}, "Pi")), "class") == Some{"pc-role"} : Maybe<&2, String>}

law sv_marca_tag:
  {V.tagOf(S.pieceView(S.PieceMark{"notícia"})) == "mark" : String}

law sv_texto_tag:
  {V.isText(S.pieceView(S.PieceText{"notícia"})) == True{} : Bool}

law sv_grupo_com_quando:
  {List.length(&2, V.ViewNode, V.kidsOf(S.groupNode("Prova", "5m"))) == 2n : Nat}

law sv_grupo_sem_quando:
  {List.length(&2, V.ViewNode, V.kidsOf(S.groupNode("Prova", ""))) == 1n : Nat}

# ---------- estados ----------

law sv_estado_curto:
  {V.textOf(firstNode(V.kidsOf(firstNode(S.listView(S.StateShort{}))))) == S.minQueryHint() : String}

law sv_estado_vazio:
  {V.textOf(firstNode(V.kidsOf(firstNode(S.listView(S.StateEmpty{"alfa"}))))) == "Nada encontrado para “alfa”." : String}

law sv_estado_erro:
  {V.textOf(firstNode(V.kidsOf(firstNode(S.listView(S.StateError{""}))))) == "Não foi possível buscar agora." : String}

law sv_estado_classe:
  {V.attrGet(V.attrsOf(firstNode(S.listView(S.StateLoading{}))), "class") == Some{"palette-empty pc-state"} : Maybe<&2, String>}

law sv_estado_linhas:
  {List.length(&2, V.ViewNode, S.listView(S.StateRows{[S.ResultRowGroup{"Prova", ""}]})) == 1n : Nat}

# ---------- casca ----------

law sv_painel_classe:
  {V.attrGet(V.attrsOf(S.panelView()), "class") == Some{"palette-backdrop pc-backdrop"} : Maybe<&2, String>}

law sv_painel_escondido:
  {V.attrGet(V.attrsOf(S.panelView()), "hidden") == Some{""} : Maybe<&2, String>}

law sv_lista_id:
  {V.attrGet(V.attrsOf(S.listNode()), "id") == Some{"pc-list"} : Maybe<&2, String>}

law sv_lista_papel:
  {V.attrGet(V.attrsOf(S.listNode()), "role") == Some{"listbox"} : Maybe<&2, String>}

law sv_input_controles:
  {V.attrGet(V.attrsOf(S.inputNode()), "aria-controls") == Some{"pc-list"} : Maybe<&2, String>}

law sv_input_eventos:
  {V.attrGet(V.attrsOf(S.inputNode()), "on:input") == Some{"schedule"} : Maybe<&2, String>}
