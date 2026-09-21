import Base
import ../laws/searchview.bend as Laws
import ../searchview.bend as S

# Provas das leis da view da busca. Aceitador: `bend proofs/searchview.bend`.
# Cenários concretos e igualdades de atributos reduzem por computação; as
# contagens são indução no comprimento da lista de trechos (fatos alinhados
# fabricados por `falses`/`trues`).

def Laws.sv_papel_user():
  {==}

def Laws.sv_papel_pi():
  {==}

def Laws.sv_papel_vazio():
  {==}

def Laws.sv_titulo_vazio():
  {==}

def Laws.sv_titulo_ok():
  {==}

def Laws.sv_id_primeiro():
  {==}

def Laws.sv_id_decimo():
  {==}

def Laws.sv_dica_curta():
  {==}

def Laws.sv_carregando():
  {==}

def Laws.sv_dica_rodape():
  {==}

def Laws.sv_erro_padrao():
  {==}

def Laws.sv_erro_mensagem():
  {==}

def Laws.sv_info_simples():
  {==}

def Laws.sv_info_singular():
  {==}

def Laws.sv_info_completo():
  {==}

def Laws.sv_info_grande():
  {==}

def Laws.sv_linhas_um():
  {==}

def Laws.sv_linhas_mesmo_grupo():
  {==}

def Laws.sv_linhas_grupos():
  {==}

def Laws.sv_linhas_titulo_vazio():
  {==}

def Laws.sv_linhas_desalinhadas(h):
  {==}

# Indução: cada trecho vira uma linha de item; `i` não muda a contagem.
# `h` é destruído para a cabeça/linha saírem construtores (sem isso o match
# do contador fica preso num valor computado).
def Laws.sv_conta_trechos(hits, i):
  match hits:
    case Nil{}:
      {==}
    case Con{h, t}:
      match h:
        case S.ResultHit{+title, +when, isUser, isAssistant, pieces}:
          %Equal.sym(Nat, S.hitCount(S.rows.go(t, Laws.falses(t), Laws.trues(t), Nat.add(i, 1n))), List.length(&2, S.ResultHit, t), Laws.sv_conta_trechos(t, Nat.add(i, 1n))) : {Nat.add(1n, _) == Nat.add(1n, List.length(&2, S.ResultHit, t)) : Nat}
          {==}

# Indução: conversas sempre diferentes ⇒ uma cabeça por trecho.
def Laws.sv_conta_cabecas_todas(hits, i):
  match hits:
    case Nil{}:
      {==}
    case Con{h, t}:
      match h:
        case S.ResultHit{+title, +when, isUser, isAssistant, pieces}:
          %Equal.sym(Nat, S.headCount(S.rows.go(t, Laws.falses(t), Laws.trues(t), Nat.add(i, 1n))), List.length(&2, S.ResultHit, t), Laws.sv_conta_cabecas_todas(t, Nat.add(i, 1n))) : {Nat.add(1n, _) == Nat.add(1n, List.length(&2, S.ResultHit, t)) : Nat}
          {==}

# Indução: tudo da mesma conversa ⇒ nenhuma cabeça.
def Laws.sv_conta_cabecas_nenhuma(hits, i):
  match hits:
    case Nil{}:
      {==}
    case Con{h, t}:
      match h:
        case S.ResultHit{+title, +when, isUser, isAssistant, pieces}:
          Laws.sv_conta_cabecas_nenhuma(t, Nat.add(i, 1n))

def Laws.sv_conta_cabeca_vazia():
  {==}

def Laws.sv_item_atributos_ativo():
  {==}

def Laws.sv_item_atributos_inativo():
  {==}

def Laws.sv_item_id():
  {==}

def Laws.sv_item_classes_ativo():
  {==}

def Laws.sv_item_classes_inativo():
  {==}

def Laws.sv_papel_classe_user():
  {==}

def Laws.sv_papel_classe_pi():
  {==}

def Laws.sv_marca_tag():
  {==}

def Laws.sv_texto_tag():
  {==}

def Laws.sv_grupo_com_quando():
  {==}

def Laws.sv_grupo_sem_quando():
  {==}

def Laws.sv_estado_curto():
  {==}

def Laws.sv_estado_vazio():
  {==}

def Laws.sv_estado_erro():
  {==}

def Laws.sv_estado_classe():
  {==}

def Laws.sv_estado_linhas():
  {==}

def Laws.sv_painel_classe():
  {==}

def Laws.sv_painel_escondido():
  {==}

def Laws.sv_lista_id():
  {==}

def Laws.sv_lista_papel():
  {==}

def Laws.sv_input_controles():
  {==}

def Laws.sv_input_eventos():
  {==}
