import Base
import ../laws/toastview.bend as Laws
import ../toastview.bend as T
import ../view.bend as V

# Provas das leis da fila de toasts e da faixa de atividade.
# Aceitador: `bend proofs/toastview.bend`.

def Laws.toast_classes_aberto():
  {==}

def Laws.toast_classes_saindo():
  {==}

def Laws.toast_item_tag(t):
  match t:
    case T.Toast{text, closing}:
      {==}

def Laws.toast_item_um_filho(t):
  match t:
    case T.Toast{text, closing}:
      {==}

def Laws.toast_box_id(ts):
  {==}

def Laws.toast_box_papel(ts):
  {==}

def Laws.toast_items_len(ts):
  match ts:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Equal.sym(Nat, List.length(&2, V.ViewNode, T.toastItems(t)), List.length(&2, T.Toast, t), Laws.toast_items_len(t)) : {1n+_ == 1n+List.length(&2, T.Toast, t) : Nat}
      {==}

def Laws.activity_texto_vazio():
  {==}

def Laws.activity_texto_um():
  {==}

def Laws.activity_dot_vazio():
  {==}

def Laws.activity_dot_dois():
  {==}

def Laws.activity_pulse_escondido():
  {==}

def Laws.activity_label_classe():
  {==}

def Laws.activity_view_titulo():
  {==}

def Laws.activity_view_titulo_vazio():
  {==}

def Laws.activity_live_titulo():
  {==}

def Laws.activity_live_dois_filhos():
  {==}

def Laws.activity_live_vazio():
  {==}
