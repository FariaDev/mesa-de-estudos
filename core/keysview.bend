import Base
import view.bend as V

# Editor de atalhos da Conversa. O host entrega o catálogo já resolvido
# (tecla efetiva, override, captura e conflito); esta view decide somente a
# árvore DOM, classes, ARIA, eventos e estados hidden/disabled.

type KeymapAction is Data:
  KeymapAction{id: String, label: String, keyText: String, fixed: Bool, overridden: Bool}

type KeymapGroup is Data:
  KeymapGroup{id: String, label: String, actions: +List<KeymapAction>}

def kv_keyClass(+keyText: String) -> String:
  V.classValue([
    V.classOn("keys-kbd", True{}),
    V.classOn("empty", String.is_empty(keyText))
  ])

def kv_keyLabel.if(keyText: String, empty: Bool) -> String:
  match empty:
    case True{}:
      "Sem atalho"
    case False{}:
      keyText

def kv_keyLabel(+keyText: String) -> String:
  kv_keyLabel.if(keyText, String.is_empty(keyText))

def kv_keyAria.if(keyText: String, empty: Bool) -> String:
  match empty:
    case True{}:
      "Sem atalho"
    case False{}:
      "Atalho atual: " ++ keyText

def kv_keyAria(+keyText: String) -> String:
  kv_keyAria.if(keyText, String.is_empty(keyText))

def kv_recordLabel(recording: Bool) -> String:
  match recording:
    case True{}:
      "Pressione…"
    case False{}:
      "Gravar"

def kv_recordAria(+label: String, recording: Bool) -> String:
  match recording:
    case True{}:
      "Gravando atalho de " ++ label ++ "; Esc cancela"
    case False{}:
      "Gravar novo atalho para " ++ label

def kv_fixedNote() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("keys-note")], [V.viewText("contextual — não editável nesta versão")])

def kv_editActions(+id: String, +label: String, overridden: Bool, +recording: Bool) -> List<&2, V.ViewNode>:
  [ V.viewKey("button", "record-" ++ id, [
      V.attrType("button"),
      V.attrClass("keys-rec"),
      V.attrData("role", "rec"),
      V.attrAria("pressed", V.boolStr(recording)),
      V.attrAria("label", kv_recordAria(label, recording)),
      V.attrOn("click", "record")
    ], [V.viewText(kv_recordLabel(recording))])
  , V.viewKey("button", "reset-" ++ id, V.attrConcat([
      V.attrType("button"),
      V.attrClass("keys-reset"),
      V.attrData("role", "reset"),
      V.attrOn("click", "reset")
    ], V.attrWhen(Bool.not(overridden), V.attr("hidden", ""))), [V.viewText("Restaurar padrão")])
  ]

def kv_rowBase(+id: String, label: String, +keyText: String) -> List<&2, V.ViewNode>:
  [
    V.viewEl("span", [V.attrClass("keys-label"), V.attrId("keys-label-" ++ id)], [V.viewText(label)]),
    V.viewEl("kbd", [V.attrClass(kv_keyClass(keyText)), V.attrAria("label", kv_keyAria(keyText))], [V.viewText(kv_keyLabel(keyText))])
  ]

def kv_rowKids(fixed: Bool, +id: String, +label: String, +keyText: String, overridden: Bool, recording: Bool) -> List<&2, V.ViewNode>:
  match fixed:
    case True{}:
      V.viewConcat(kv_rowBase(id, label, keyText), [kv_fixedNote()])
    case False{}:
      V.viewConcat(kv_rowBase(id, label, keyText), kv_editActions(id, label, overridden, recording))

def kv_row(action: KeymapAction, +capturing: String) -> V.ViewNode:
  match action:
    case KeymapAction{+id, +label, +keyText, +fixed, overridden}:
      +recording = String.eq(id, capturing)
      V.viewKey("div", id, [
        V.classes([
          V.classOn("keys-row", True{}),
          V.classOn("recording", recording),
          V.classOn("is-fixed", fixed)
        ]),
        V.attrData("action", id),
        V.attr("role", "group"),
        V.attrAria("labelledby", "keys-label-" ++ id)
      ], kv_rowKids(fixed, id, label, keyText, overridden, recording))

def kv_rows.go(xs: List<&2, KeymapAction>, +capturing: String) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{kv_row(h, capturing), kv_rows.go(t, capturing)}

def kv_rows(xs: List<&2, KeymapAction>, capturing: String) -> List<&2, V.ViewNode>:
  kv_rows.go(xs, capturing)

def kv_group(group: KeymapGroup, capturing: String) -> V.ViewNode:
  match group:
    case KeymapGroup{+id, label, actions}:
      V.viewEl("section", [
        V.attrClass("keys-group"),
        V.attrAria("labelledby", "keys-group-" ++ id)
      ], V.viewConcat([
        V.viewEl("h3", [V.attrId("keys-group-" ++ id)], [V.viewText(label)])
      ], kv_rows(actions, capturing)))

def kv_groups.go(xs: List<&2, KeymapGroup>, +capturing: String) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{kv_group(h, capturing), kv_groups.go(t, capturing)}

def kv_groups(xs: List<&2, KeymapGroup>, capturing: String) -> List<&2, V.ViewNode>:
  kv_groups.go(xs, capturing)

def kv_head() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("keys-head")], [
    V.viewEl("h2", [V.attrId("keys-title")], [V.viewText("Personalizar atalhos")]),
    V.viewEl("p", [V.attrClass("keys-sub")], [V.viewText("Clique em Gravar e pressione a combinação. Esc cancela a gravação.")])
  ])

def kv_status(+text: String, kind: String) -> V.ViewNode:
  V.viewEl("p", [
    V.attrClass("keys-status"),
    V.attrId("keys-status"),
    V.attr("role", "status"),
    V.attrAria("live", "polite"),
    V.attrData("kind", kind)
  ], V.viewWhen(Bool.not(String.is_empty(text)), V.viewText(text)))

def kv_footer(anyOverride: Bool) -> V.ViewNode:
  V.viewEl("menu", Nil{}, [
    V.viewEl("button", V.attrConcat([
      V.attrType("button"),
      V.attrId("keys-reset-all"),
      V.attrOn("click", "resetAll")
    ], V.attrWhen(Bool.not(anyOverride), V.attr("disabled", ""))), [V.viewText("Restaurar todos")]),
    V.viewEl("button", [
      V.attrType("button"),
      V.attrId("keys-done"),
      V.attrOn("click", "done")
    ], [V.viewText("Fechar")])
  ])

def keysDialog(groups: List<&2, KeymapGroup>, capturing: String, status: String, statusKind: String, opened: Bool, anyOverride: Bool) -> V.ViewNode:
  V.viewEl("dialog", V.attrConcat([
    V.attrId("keys-dialog"),
    V.attrAria("labelledby", "keys-title")
  ], V.attrWhen(opened, V.attr("open", ""))), [
    kv_head(),
    V.viewEl("div", [V.attrClass("keys-groups")], kv_groups(groups, capturing)),
    kv_status(status, statusKind),
    kv_footer(anyOverride)
  ])
