import Base
import ../msg.bend as M
import ../shortcutview.bend as S
import ../view.bend as V

def editable(overridden: Bool) -> S.ShortcutRowFact:
  S.skRow("check", "Conferir Xournal++", "⌘⇧C", False{}, "", overridden)

def fixed() -> S.ShortcutRowFact:
  S.skRow("stop", "Parar a resposta", "Esc", True{}, "", False{})

def sections() -> List<&2, S.ShortcutSectionFact>:
  [S.skSection("keys-group-0", "Estudar", [editable(True{}), fixed()])]

def dialog(open: Bool, capturing: String, conflict: Bool, hasOverrides: Bool) -> S.ShortcutDialogFact:
  S.skDialog(open, capturing, conflict, "mensagem", "info", hasOverrides, sections())

def first(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

def second(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      first(t)

law sk_kbd_efetivo:
  {V.textOf(first(V.kidsOf(S.skKbdNode("Ação", "⌘K", False{})))) == "⌘K" : String}

law sk_kbd_gravando:
  {V.textOf(first(V.kidsOf(S.skKbdNode("Ação", "⌘K", True{})))) == M.msg("keys.recording") : String}

law sk_kbd_vazio:
  {V.attrGet(V.attrsOf(S.skKbdNode("Ação", "", False{})), "class") == Some{"keys-kbd empty"} : Maybe<&2, String>}

law sk_linha_key:
  {V.attrGet(V.attrsOf(S.skRowNode(editable(False{}), "")), "key") == Some{"check"} : Maybe<&2, String>}

law sk_linha_gravando:
  {V.attrGet(V.attrsOf(S.skRowNode(editable(False{}), "check")), "class") == Some{"keys-row recording"} : Maybe<&2, String>}

law sk_reset_visivel:
  {V.attrGet(V.attrsOf(S.skResetNode("check", True{})), "hidden") == None{} : Maybe<&2, String>}

law sk_reset_escondido:
  {V.attrGet(V.attrsOf(S.skResetNode("check", False{})), "hidden") == Some{""} : Maybe<&2, String>}

law sk_fixo_tem_nota:
  {V.textOf(first(V.kidsOf(S.skNoteNode("")))) == M.msg("keys.fixed") : String}

law sk_secao_rotulada:
  {V.attrGet(V.attrsOf(S.skSectionNode(S.skSection("keys-group-0", "Estudar", [editable(False{})]), "")), "aria-labelledby") == Some{"keys-group-0"} : Maybe<&2, String>}

law sk_conflito_forca_erro:
  {V.attrGet(V.attrsOf(S.skStatusNode("Conflito", "info", True{})), "data-kind") == Some{"error"} : Maybe<&2, String>}

law sk_sem_override_desabilita:
  {V.attrGet(V.attrsOf(first(V.kidsOf(S.skFooterNode(False{})))), "disabled") == Some{""} : Maybe<&2, String>}

law sk_com_override_habilita:
  {V.attrGet(V.attrsOf(first(V.kidsOf(S.skFooterNode(True{})))), "disabled") == None{} : Maybe<&2, String>}

law sk_dialogo_fechado:
  {V.attrGet(V.attrsOf(S.shortcutDialog(dialog(False{}, "", False{}, True{}))), "open") == None{} : Maybe<&2, String>}

law sk_dialogo_aberto:
  {V.attrGet(V.attrsOf(S.shortcutDialog(dialog(True{}, "", False{}, True{}))), "open") == Some{""} : Maybe<&2, String>}

law sk_dialogo_ordem:
  {V.attrGet(V.attrsOf(second(V.kidsOf(S.shortcutDialog(dialog(False{}, "", False{}, True{}))))), "class") == Some{"keys-groups"} : Maybe<&2, String>}

# O × do cabeçalho: 28px sem borda (classes do padrão dos diálogos), nomeado e
# ligado a `Done`. O rodapé não repete "Fechar".
def head() -> V.ViewNode:
  first(V.kidsOf(S.shortcutDialog(dialog(False{}, "", False{}, True{}))))

law sk_cabecalho_tem_o_x_de_fechar:
  {V.textOf(first(V.kidsOf(S.skCloseNode()))) == "×" : String}

law sk_x_aciona_done:
  {V.attrGet(V.attrsOf(S.skCloseNode()), "on:click") == Some{"Done"} : Maybe<&2, String>}

law sk_x_tem_nome_acessivel:
  {V.attrGet(V.attrsOf(S.skCloseNode()), "aria-label") == Some{M.msg("keys.closeAria")} : Maybe<&2, String>}

law sk_x_usa_a_classe_do_padrao:
  {V.attrGet(V.attrsOf(S.skCloseNode()), "class") == Some{"icon-btn dialog-close"} : Maybe<&2, String>}

law sk_cabecalho_leva_o_x_depois_do_titulo:
  {V.attrGet(V.attrsOf(second(V.kidsOf(S.skHeadNode()))), "id") == Some{"keys-done"} : Maybe<&2, String>}

law sk_rodape_so_tem_restaurar:
  {V.attrGet(V.attrsOf(second(V.kidsOf(S.skFooterNode(True{})))), "id") == None{} : Maybe<&2, String>}
