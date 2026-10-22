import Base
import ../laws/tutorheader.bend as Laws
import ../tutorheader.bend as H
import ../view.bend as V

# Provas das leis dos menus do cabeçalho do tutor. Aceitador: `bend
# proofs/tutorheader.bend` deve imprimir "All terms check.". Os cenários
# concretos fecham por computação (`{==}`); as leis sobre `endDay` abrem a
# flag nos dois casos e fecham cada um por computação.

def Laws.tutor_nova_sessao_tres_itens():
  {==}

def Laws.tutor_nova_sessao_ordem():
  {==}

def Laws.tutor_nova_sessao_padrao_rotulo():
  {==}

def Laws.tutor_nova_sessao_padrao_clique():
  {==}

def Laws.tutor_nova_sessao_claude_rotulo():
  {==}

def Laws.tutor_nova_sessao_claude_clique():
  {==}

def Laws.tutor_nova_sessao_ids_estaveis():
  {==}

def Laws.tutor_nova_sessao_claude_id():
  {==}

def Laws.tutor_nova_sessao_opencode_rotulo():
  {==}

def Laws.tutor_nova_sessao_opencode_clique():
  {==}

def Laws.tutor_nova_sessao_opencode_id():
  {==}

def Laws.tutor_mais_seis_itens(endDay):
  match endDay:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tutor_mais_ordem(endDay):
  match endDay:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tutor_exportar_id():
  {==}

def Laws.tutor_exportar_rotulo():
  {==}

def Laws.tutor_exportar_clique():
  {==}

def Laws.tutor_encerrar_id(endDay):
  match endDay:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tutor_encerrar_rotulo(endDay):
  match endDay:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tutor_encerrar_clique(endDay):
  match endDay:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tutor_encerrar_visivel():
  {==}

def Laws.tutor_encerrar_oculto():
  {==}

def Laws.tutor_demais_itens_sempre_visiveis():
  {==}

def Laws.tutor_recolher_id():
  {==}

def Laws.tutor_recolher_rotulo():
  {==}

def Laws.tutor_recolher_clique():
  {==}

def Laws.tutor_compactacao_id():
  {==}

def Laws.tutor_compactacao_papel():
  {==}

def Laws.tutor_compactacao_desligada_por_padrao():
  {==}

def Laws.tutor_compactacao_clique():
  {==}

def Laws.tutor_contexto_encaixe():
  {==}

def Laws.tutor_contexto_id():
  {==}

def Laws.tutor_itens_nao_enviam_formulario():
  {==}

def Laws.tutor_itens_papel_menuitem():
  {==}

def Laws.tutor_itens_com_icone():
  {==}

def Laws.tutor_resumir_id():
  {==}

def Laws.tutor_resumir_rotulo():
  {==}

def Laws.tutor_resumir_clique():
  {==}

def Laws.tutor_resumir_sempre_visivel():
  {==}

# ---------- indicador de modelo e esforço ----------

def Laws.tutor_indicador_modelo_e_esforco():
  {==}

def Laws.tutor_indicador_sem_prefixo_claude():
  {==}

def Laws.tutor_indicador_esforco_muito_alto():
  {==}

def Laws.tutor_indicador_esforco_padrao():
  {==}

def Laws.tutor_indicador_esforco_desconhecido():
  {==}

def Laws.tutor_indicador_so_modelo():
  {==}

def Laws.tutor_indicador_so_esforco():
  {==}

def Laws.tutor_indicador_ligado_sem_fatos():
  {==}

def Laws.tutor_indicador_desligado_diz_o_estado():
  {==}

def Laws.tutor_indicador_ligando_diz_o_estado():
  {==}

def Laws.tutor_indicador_sem_resposta_diz_o_estado():
  {==}

def Laws.tutor_rotulo_do_ponto_ligado():
  {==}

def Laws.tutor_rotulo_do_ponto_desligado():
  {==}

def Laws.tutor_indicador_sem_rotulo_cai_em_desligado():
  {==}

def Laws.tutor_indicador_id():
  {==}

def Laws.tutor_indicador_nao_envia_formulario():
  {==}

def Laws.tutor_indicador_clique():
  {==}

def Laws.tutor_indicador_controla_o_popover():
  {==}

def Laws.tutor_indicador_abre_dialogo():
  {==}

def Laws.tutor_indicador_estado_ligado():
  {==}

def Laws.tutor_indicador_estado_desligado():
  {==}

def Laws.tutor_indicador_estado_so_do_ligado(online):
  match online:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tutor_indicador_rotulo_ligado():
  {==}

def Laws.tutor_indicador_rotulo_desligado():
  {==}

def Laws.tutor_indicador_balao_igual_ao_rotulo():
  {==}

def Laws.tutor_indicador_texto():
  {==}

# ---------- aviso do popover ----------

def Laws.tutor_aviso_some_quando_escolhe(connecting):
  match connecting:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tutor_aviso_aparece_desligado(canPick):
  match canPick:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.tutor_aviso_aparece_sem_escolha():
  {==}

def Laws.tutor_aviso_chamar_some_ligando():
  {==}

def Laws.tutor_aviso_chamar_visivel_desligado():
  {==}

def Laws.tutor_aviso_chamar_clique():
  {==}

def Laws.tutor_aviso_texto_desligado():
  {==}

def Laws.tutor_aviso_orienta_desligado():
  {==}

def Laws.tutor_aviso_orienta_motor_fixo():
  {==}

def Laws.tutor_aviso_motor_fixo_sem_chamar():
  {==}

def Laws.sessao_nome_assunto():
  {==}

def Laws.sessao_nome_sem_assunto_traz_a_data():
  {==}

def Laws.sessao_nome_duas_sem_assunto_diferem():
  {==}

def Laws.sessao_nome_sem_nada():
  {==}

def Laws.tutor_indicador_texto_so_modelo():
  {==}

def Laws.tutor_indicador_texto_so_esforco():
  {==}

def Laws.tutor_indicador_desligado_texto():
  {==}

def Laws.tutor_cabecalho_controles():
  {==}

def Laws.tutor_cabecalho_quatro_controles():
  {==}

def Laws.tutor_indicador_rotulo_desligado_sem_rotulo():
  {==}

def Laws.tutor_indicador_rotulo_so_modelo():
  {==}

def Laws.tutor_indicador_rotulo_so_esforco():
  {==}
