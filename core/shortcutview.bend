import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View pura do editor de atalhos da Mesa.
#
# O host mantém catálogo, mapa comando→tecla, captura, conflitos, persistência,
# foco e o ciclo modal do <dialog>. Aqui entram apenas esses fatos já resolvidos
# e saem os mesmos ids/classes/aria/data-* consumidos pelo CSS e pelos testes.
# ---------------------------------------------------------------------------

type ShortcutRowFact is Data:
  ShortcutRowFact{id: String, label: String, effective: String, fixed: Bool, note: String, overridden: Bool}

type ShortcutSectionFact is Data:
  ShortcutSectionFact{id: String, title: String, rows: +List<ShortcutRowFact>}

type ShortcutDialogFact is Data:
  ShortcutDialogFact{open: Bool, capturing: String, conflict: Bool, status: String, statusKind: String, hasOverrides: Bool, sections: +List<ShortcutSectionFact>}

def skRow(id: String, label: String, effective: String, fixed: Bool, note: String, overridden: Bool) -> ShortcutRowFact:
  ShortcutRowFact{id, label, effective, fixed, note, overridden}

def skSection(id: String, title: String, rows: List<&2, ShortcutRowFact>) -> ShortcutSectionFact:
  ShortcutSectionFact{id, title, rows}

def skDialog(open: Bool, capturing: String, conflict: Bool, status: String, statusKind: String, hasOverrides: Bool, sections: List<&2, ShortcutSectionFact>) -> ShortcutDialogFact:
  ShortcutDialogFact{open, capturing, conflict, status, statusKind, hasOverrides, sections}

def skTextOr.if(raw: String, fallback: String, empty: Bool) -> String:
  match empty:
    case True{}:
      fallback
    case False{}:
      raw

def skTextOr(+raw: String, fallback: String) -> String:
  skTextOr.if(raw, fallback, String.is_empty(raw))

def skKbdText(effective: String, recording: Bool) -> String:
  match recording:
    case True{}:
      "Gravando…"
    case False{}:
      skTextOr(effective, "Sem atalho")

def skKbdEmpty(effective: String, recording: Bool) -> Bool:
  match recording:
    case True{}:
      False{}
    case False{}:
      String.is_empty(effective)

def skKbdAria.if(effective: String, empty: Bool) -> String:
  match empty:
    case True{}:
      "Sem atalho"
    case False{}:
      "Atalho atual: " ++ effective

def skKbdAria(+label: String, +effective: String, recording: Bool) -> String:
  match recording:
    case True{}:
      "Gravando novo atalho para " ++ label
    case False{}:
      skKbdAria.if(effective, String.is_empty(effective))

def skLabelNode(id: String, label: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("keys-label"), V.attrId("keys-label-" ++ id)], [V.viewText(label)])

def skKbdNode(+label: String, +effective: String, +recording: Bool) -> V.ViewNode:
  V.viewEl("kbd", [
    V.classes([
      V.classOn("keys-kbd", True{}),
      V.classOn("empty", skKbdEmpty(effective, recording))
    ]),
    V.attrAria("label", skKbdAria(label, effective, recording))
  ], [V.viewText(skKbdText(effective, recording))])

def skNoteNode(+note: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("keys-note")], [V.viewText(skTextOr(note, "fixo"))])

def skRecordLabel(recording: Bool) -> String:
  match recording:
    case True{}:
      "Cancelar"
    case False{}:
      "Gravar"

def skRecordAria(label: String, recording: Bool) -> String:
  match recording:
    case True{}:
      "Cancelar a gravação do atalho de " ++ label
    case False{}:
      "Gravar novo atalho para " ++ label

def skRecordNode(+id: String, label: String, +recording: Bool) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("keys-rec"),
    V.attrData("role", "rec"),
    V.attrKey("keys-rec-" ++ id),
    V.attrAria("pressed", V.boolStr(recording)),
    V.attrAria("label", skRecordAria(label, recording)),
    V.attrOn("click", "Record")
  ], [V.viewText(skRecordLabel(recording))])

def skResetNode(+id: String, overridden: Bool) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [ V.attrType("button")
    , V.attrClass("keys-reset")
    , V.attrData("role", "reset")
    , V.attrKey("keys-reset-" ++ id)
    , V.attrOn("click", "Reset")
    ],
    V.attrWhen(Bool.not(overridden), V.attr("hidden", ""))
  ]), [V.viewText("Resetar")])

def skRowKids.editable(+id: String, +label: String, +effective: String, note: String, overridden: Bool, +recording: Bool, fixed: Bool) -> List<&2, V.ViewNode>:
  match fixed:
    case True{}:
      [skLabelNode(id, label), skKbdNode(label, effective, recording), skNoteNode(note)]
    case False{}:
      [skLabelNode(id, label), skKbdNode(label, effective, recording), skRecordNode(id, label, recording), skResetNode(id, overridden)]

def skRowNode.record(row: ShortcutRowFact, +recording: Bool) -> V.ViewNode:
  match row:
    case ShortcutRowFact{+id, +label, +effective, +fixed, note, overridden}:
      V.viewKey("div", id, [
        V.classes([
          V.classOn("keys-row", True{}),
          V.classOn("recording", recording),
          V.classOn("is-fixed", fixed)
        ]),
        V.attrData("action", id),
        V.attr("role", "group"),
        V.attrAria("labelledby", "keys-label-" ++ id)
      ], skRowKids.editable(id, label, effective, note, overridden, recording, fixed))

def skRowNode(row: ShortcutRowFact, capturing: String) -> V.ViewNode:
  match row:
    case ShortcutRowFact{+id, +label, +effective, fixed, +note, overridden}:
      skRowNode.record(ShortcutRowFact{id, label, effective, fixed, note, overridden}, String.eq(id, capturing))

def skRowNodes.go(xs: List<&2, ShortcutRowFact>, +capturing: String) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{skRowNode(h, capturing), skRowNodes.go(t, capturing)}

def skRowNodes(xs: List<&2, ShortcutRowFact>, capturing: String) -> List<&2, V.ViewNode>:
  skRowNodes.go(xs, capturing)

def skSectionNode(section: ShortcutSectionFact, capturing: String) -> V.ViewNode:
  match section:
    case ShortcutSectionFact{+id, title, rows}:
      V.viewEl("section", [
        V.attrClass("keys-group"),
        V.attrAria("labelledby", id)
      ], Con{
        V.viewEl("h3", [V.attrId(id)], [V.viewText(title)]),
        skRowNodes(rows, capturing)
      })

def skSectionNodes.go(xs: List<&2, ShortcutSectionFact>, +capturing: String) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{skSectionNode(h, capturing), skSectionNodes.go(t, capturing)}

def skSectionNodes(xs: List<&2, ShortcutSectionFact>, capturing: String) -> List<&2, V.ViewNode>:
  skSectionNodes.go(xs, capturing)

def skHeadNode() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("keys-head")], [
    V.viewEl("h2", [V.attrId("keys-title")], [V.viewText("Atalhos de teclado")]),
    V.viewEl("p", [V.attrClass("keys-sub")], [V.viewText("Clique em Gravar e pressione a combinação nova. Esc cancela a gravação. As escolhas ficam guardadas neste computador.")])
  ])

def skGroupsNode(sections: List<&2, ShortcutSectionFact>, capturing: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("keys-groups")], skSectionNodes(sections, capturing))

def skStatusKind(kind: String, conflict: Bool) -> String:
  match conflict:
    case True{}:
      "error"
    case False{}:
      skTextOr(kind, "info")

def skStatusNode(+status: String, kind: String, conflict: Bool) -> V.ViewNode:
  V.viewEl("p", [
    V.attrClass("keys-status"),
    V.attrId("keys-status"),
    V.attr("role", "status"),
    V.attrAria("live", "polite"),
    V.attrData("kind", skStatusKind(kind, conflict))
  ], V.viewWhen(Bool.not(String.is_empty(status)), V.viewText(status)))

def skFooterNode(hasOverrides: Bool) -> V.ViewNode:
  V.viewEl("menu", Nil{}, [
    V.viewEl("button", V.attrJoin([
      [ V.attrType("button")
      , V.attrId("keys-reset-all")
      , V.attrKey("keys-reset-all")
      , V.attrOn("click", "ResetAll")
      ],
      V.attrWhen(Bool.not(hasOverrides), V.attr("disabled", ""))
    ]), [V.viewText("Restaurar padrões")]),
    V.viewEl("button", [
      V.attrType("button"),
      V.attrId("keys-done"),
      V.attrKey("keys-done"),
      V.attrOn("click", "Done")
    ], [V.viewText("Fechar")])
  ])

def skDialogChildren(fact: ShortcutDialogFact) -> List<&2, V.ViewNode>:
  match fact:
    case ShortcutDialogFact{+open, +capturing, +conflict, +status, +statusKind, +hasOverrides, +sections}:
      [ skHeadNode()
      , skGroupsNode(sections, capturing)
      , skStatusNode(status, statusKind, conflict)
      , skFooterNode(hasOverrides)
      ]

def shortcutDialog(fact: ShortcutDialogFact) -> V.ViewNode:
  match fact:
    case ShortcutDialogFact{+open, +capturing, +conflict, +status, +statusKind, +hasOverrides, +sections}:
      V.viewEl("dialog", V.attrConcat([
        V.attrId("keys-dialog"),
        V.attrAria("labelledby", "keys-title")
      ], V.attrWhen(open, V.attr("open", ""))), skDialogChildren(ShortcutDialogFact{open, capturing, conflict, status, statusKind, hasOverrides, sections}))
