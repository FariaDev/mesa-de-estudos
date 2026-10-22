import Base
import ../laws/tabsview.bend as Laws
import ../tabsview.bend as T
import ../view.bend as V

# Provas das leis das abas/menus. Aceitador: `bend proofs/tabsview.bend` deve
# imprimir "All terms check.". Os cenários concretos fecham por computação
# (`{==}`); o comprimento das abas é a única indução na lista (mesmo padrão de
# `proofs/view.bend`: a hipótese entra pelo buraco do `%Equal.sym`).

def Laws.tabs_comprimento(cs, activeId, ggb, dis, rc):
  match cs:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Equal.sym(
        Nat,
        List.length(&2, V.ViewNode, T.courseTabs(t, activeId, ggb, dis, rc)),
        Nat.add(List.length(&2, T.Tab, t), 4n),
        Laws.tabs_comprimento(t, activeId, ggb, dis, rc)
      ) : {1n+_ == 1n+Nat.add(List.length(&2, T.Tab, t), 4n) : Nat}
      {==}

# ---------- abas: forma e ordem ----------

def Laws.tabs_duas_materias_ordem():
  {==}

def Laws.tabs_sem_materias():
  {==}

def Laws.tabs_caderno_ativo():
  {==}

def Laws.tabs_ggb_desativa_caderno():
  {==}

def Laws.tabs_desabilitadas_juntas():
  {==}

# ---------- abas: matéria ativa ----------

def Laws.tabs_ativa():
  {==}

def Laws.tabs_outra_inativa():
  {==}

# Roving tabindex: a ativa é tabulável (0), as demais só pelas setas (-1).
def Laws.tabs_roving_ativa():
  {==}

def Laws.tabs_roving_inativa():
  {==}

def Laws.tabs_ativa_tabindex(id):
  {==}

def Laws.tabs_inativa_tabindex(id):
  {==}

def Laws.tabs_ggb_desativa(id):
  {==}

def Laws.tabs_ativa_aria(id):
  {==}

def Laws.tabs_inativa_aria(id):
  {==}

def Laws.tabs_ativa_classe(id):
  {==}

def Laws.tabs_inativa_classe(id):
  {==}

def Laws.tabs_id(id):
  {==}

def Laws.tabs_papel(id):
  {==}

def Laws.tabs_tag(id):
  {==}

def Laws.tabs_rotulo(id, name):
  {==}

def Laws.tabs_clique(id):
  {==}

def Laws.tabs_livre(id):
  {==}

def Laws.tabs_desabilitada(id):
  {==}

def Laws.tabs_travada_dica(id):
  {==}

def Laws.tabs_livre_sem_dica(id):
  {==}

def Laws.tabs_seletor_travado_dica():
  {==}

def Laws.tabs_seletor_travado():
  {==}

# ---------- aba GeoGebra ----------

def Laws.tabs_ggb_tag():
  {==}

def Laws.tabs_ggb_id():
  {==}

def Laws.tabs_ggb_classe():
  {==}

def Laws.tabs_ggb_ativa_classe():
  {==}

def Laws.tabs_ggb_ativa_aria():
  {==}

def Laws.tabs_ggb_ativa_tabindex():
  {==}

def Laws.tabs_ggb_inativa_tabindex():
  {==}

def Laws.tabs_ggb_rotulo():
  {==}

def Laws.tabs_ggb_clique():
  {==}

# ---------- separador e botão "+" ----------

def Laws.tabs_sep():
  {==}

def Laws.tabs_sep_classe():
  {==}

def Laws.tabs_nova_id():
  {==}

def Laws.tabs_nova_rotulo():
  {==}

def Laws.tabs_nova_acessivel():
  {==}

def Laws.tabs_nova_clique():
  {==}

# ---------- menu Estudar ----------

def Laws.tabs_menu_estudar():
  {==}

def Laws.tabs_menu_estudar_comprimento():
  {==}

def Laws.tabs_menu_estudar_desligado():
  {==}

def Laws.tabs_ref_rotulo_vazio():
  {==}

def Laws.tabs_ref_rotulo_toggle():
  {==}

def Laws.tabs_ref_id():
  {==}

def Laws.tabs_ref_visivel():
  {==}

def Laws.tabs_ref_aria():
  {==}

def Laws.tabs_ref_um_painel():
  {==}

def Laws.tabs_xournal_flag_desligada(win32, has):
  {==}

def Laws.tabs_xournal_win_sem_caminho():
  {==}

def Laws.tabs_xournal_win_com_caminho():
  {==}

def Laws.tabs_xournal_mac(has):
  {==}

def Laws.tabs_xournal_item_oculto():
  {==}

def Laws.tabs_xournal_item_visivel():
  {==}

def Laws.tabs_xournal_rotulo():
  {==}

# ---------- Caderno ----------

def Laws.tabs_caderno_id():
  {==}

def Laws.tabs_caderno_data_id():
  {==}

def Laws.tabs_caderno_papel():
  {==}

def Laws.tabs_caderno_clique():
  {==}

def Laws.tabs_caderno_rotulo():
  {==}

def Laws.tabs_caderno_ativo_aria():
  {==}

def Laws.tabs_caderno_inativo_aria():
  {==}

def Laws.tabs_caderno_ativo_tabindex():
  {==}

def Laws.tabs_caderno_inativo_tabindex():
  {==}

def Laws.tabs_caderno_vazio_classe():
  {==}

def Laws.tabs_caderno_com_itens_classe():
  {==}

def Laws.tabs_caderno_ativo_com_itens_classe():
  {==}

def Laws.tabs_caderno_titulo_vazio():
  {==}

def Laws.tabs_caderno_titulo_um():
  {==}

def Laws.tabs_caderno_titulo_varios():
  {==}

def Laws.tabs_caderno_titulo_attr():
  {==}

def Laws.tabs_caderno_aria_label():
  {==}

# ---------- menu Ajustes ----------

def Laws.tabs_menu_ajustes():
  {==}

def Laws.tabs_menu_ajustes_comprimento():
  {==}

def Laws.tabs_atalhos_id():
  {==}

def Laws.tabs_atalhos_rotulo():
  {==}

def Laws.tabs_atalhos_clique():
  {==}

def Laws.tabs_atalhos_icone():
  {==}

def Laws.tabs_ajuda_id():
  {==}

def Laws.tabs_config_id():
  {==}

def Laws.tabs_sobre_id():
  {==}

def Laws.tabs_ajuda_rotulo():
  {==}

def Laws.tabs_config_rotulo():
  {==}

def Laws.tabs_sobre_rotulo():
  {==}

def Laws.tabs_item_papel():
  {==}

# ---------- andaime dos ícones ----------

def Laws.tabs_icone_ajuda():
  {==}

def Laws.tabs_icone_xournal():
  {==}

def Laws.tabs_icone_ggb():
  {==}

# ---------- seletor único (janela estreita) ----------

def Laws.tabs_seletor_ordem():
  {==}

def Laws.tabs_seletor_vazio():
  {==}

def Laws.tabs_seletor_comprimento(cs, activeId, ggb, dis):
  match cs:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Equal.sym(
        Nat,
        List.length(&2, V.ViewNode, T.courseMenuItems(t, activeId, ggb, dis)),
        List.length(&2, T.Tab, t),
        Laws.tabs_seletor_comprimento(t, activeId, ggb, dis)
      ) : {1n+_ == 1n+List.length(&2, T.Tab, t) : Nat}
      {==}

def Laws.tabs_opcao_id():
  {==}

def Laws.tabs_opcao_data_id():
  {==}

def Laws.tabs_opcao_papel():
  {==}

def Laws.tabs_opcao_clique():
  {==}

def Laws.tabs_opcao_rotulo():
  {==}

def Laws.tabs_opcao_ativa_icone():
  {==}

def Laws.tabs_opcao_inativa_sem_icone():
  {==}

def Laws.tabs_opcao_ggb_sem_icone():
  {==}

def Laws.tabs_opcao_livre():
  {==}

def Laws.tabs_opcao_desabilitada():
  {==}

def Laws.tabs_atual_livre_na_resposta():
  {==}

def Laws.tabs_at_livre():
  {==}

def Laws.tabs_at_sem_atual():
  {==}

def Laws.tabs_travada_so_outras(locked):
  match locked:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tabs_seletor_atual_livre():
  {==}
