import Base
import ../laws/notifyview.bend as Laws
import ../notifyview.bend as N
import ../view.bend as V

def Laws.tooltip_aberto():
  {==}

def Laws.tooltip_fechado():
  {==}

def Laws.tooltip_abaixo():
  {==}

def Laws.notify_aberto():
  {==}

def Laws.notify_tom_saindo():
  {==}

def Laws.notify_item_tag(item):
  match item:
    case N.NotifyItem{key, text, tone, closing}:
      {==}

def Laws.notify_items_len(items):
  match items:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Equal.sym(Nat, List.length(&2, V.ViewNode, N.notifyItems(t)), List.length(&2, N.NotifyItem, t), Laws.notify_items_len(t)) : {1n+_ == 1n+List.length(&2, N.NotifyItem, t) : Nat}
      {==}

def Laws.settings_id():
  {==}

def Laws.settings_quatro_filhos():
  {==}
