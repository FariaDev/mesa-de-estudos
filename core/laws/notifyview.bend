import Base
import ../view.bend as V
import ../notifyview.bend as N

law tooltip_aberto:
  {V.attrGet(V.attrsOf(N.tooltipView(True{}, "dica", False{})), "hidden") == None{} : Maybe<&2, String>}

law tooltip_fechado:
  {V.attrGet(V.attrsOf(N.tooltipView(False{}, "dica", False{})), "hidden") == Some{""} : Maybe<&2, String>}

law tooltip_abaixo:
  {V.classValue(N.tooltipClasses(True{})) == "tip below" : String}

law notify_aberto:
  {V.classValue(N.notifyClasses("", False{})) == "toast-item" : String}

law notify_tom_saindo:
  {V.classValue(N.notifyClasses("error", True{})) == "toast-item error out" : String}

law notify_item_tag:
  for item: N.NotifyItem
  {V.tagOf(N.notifyItemView(item)) == "div" : String}

law notify_items_len:
  for items: List<&2, N.NotifyItem>
  {List.length(&2, V.ViewNode, N.notifyItems(items)) == List.length(&2, N.NotifyItem, items) : Nat}

law settings_id:
  {V.attrGet(V.attrsOf(N.settingsGroup()), "id") == Some{"notify-mode"} : Maybe<&2, String>}

law settings_quatro_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(N.settingsGroup())) == 4n : Nat}
