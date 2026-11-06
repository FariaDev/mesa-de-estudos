import Base
import ../msg.bend as M
import ../dialogsview.bend as D
import ../view.bend as V
import ../updatenotice.bend as U

# ---------------------------------------------------------------------------
# Contrato dos diálogos da Mesa. Prefixo `dlg_`.
#
# Tudo é cenário concreto (igual a `laws/pdfview.bend`): os fatos entram já
# resolvidos e a lei fecha por computação. O que se fixa aqui é o DOM que o
# aplicador cola no `index.html` (ids, classes, aria, valores e ordem).
# ---------------------------------------------------------------------------

# ---------- pi-dialog: título, ok, campos ----------

def kidAt(xs: List<&2, V.ViewNode>, n: Nat) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      match n:
        case 0n:
          h
        case 1n+p:
          kidAt(t, p)

def first(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

def bkKids() -> List<&2, V.ViewNode>:
  D.bookmarkChildren("Revisão", "Limites.pdf, p. 12")

def bkKid(n: Nat) -> V.ViewNode:
  kidAt(bkKids(), n)

def bkActions() -> V.ViewNode:
  bkKid(3n)

def bkAction(n: Nat) -> V.ViewNode:
  kidAt(V.kidsOf(bkActions()), n)

law dlg_bookmark_kids:
  {List.length(&2, V.ViewNode, bkKids()) == 4n : Nat}

law dlg_bookmark_titulo:
  {V.textOf(first(V.kidsOf(bkKid(0n)))) == M.msg("pdf.nav.dialogTitle") : String}

law dlg_bookmark_dica:
  {V.textOf(first(V.kidsOf(bkKid(1n)))) == "Limites.pdf, p. 12" : String}

law dlg_bookmark_campo_id:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(bkKid(2n)), 1n)), "id") == Some{"bookmark-name"} : Maybe<&2, String>}

law dlg_bookmark_campo_valor:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(bkKid(2n)), 1n)), "value") == Some{"Revisão"} : Maybe<&2, String>}

law dlg_bookmark_salvar_id:
  {V.attrGet(V.attrsOf(bkAction(1n)), "id") == Some{"bookmark-save"} : Maybe<&2, String>}

law dlg_bookmark_salvar_texto:
  {V.textOf(first(V.kidsOf(bkAction(1n)))) == M.msg("common.save") : String}

law dlg_bookmark_cancelar:
  {V.textOf(first(V.kidsOf(bkAction(0n)))) == M.msg("common.cancel") : String}

law dlg_bookmark_cancelar_valor:
  {V.attrGet(V.attrsOf(bkAction(0n)), "value") == Some{"cancel"} : Maybe<&2, String>}

law dlg_pi_titulo_vazio:
  {D.piTitle("") == M.msg("dialog.tutor") : String}

law dlg_pi_titulo:
  {D.piTitle("Escolha o modelo") == "Escolha o modelo" : String}

law dlg_pi_msg_crua:
  {D.piMessage("Veja a equação a seguir") == "Veja a equação a seguir" : String}

law dlg_pi_ok_vazio:
  {D.dialogOkLabel("") == M.msg("dialog.continue") : String}

law dlg_pi_ok_label:
  {D.dialogOkLabel("Enviar") == "Enviar" : String}

law dlg_pi_ok_node:
  {D.piOkNode("") == V.viewEl("button", [
    V.attrId("dialog-ok"),
    V.ViewAttr{"value", "ok"},
    V.attrClass("primary")
  ], Con{V.viewText(M.msg("dialog.continue")), Nil{}}) : V.ViewNode}

law dlg_pi_campo_texto:
  {D.fieldControl(D.FieldText{"Rótulo", "valor", "dica"}) == V.viewEl("input", [
    V.attrId("dialog-value"),
    V.attrType("text"),
    V.attrAria("label", "Rótulo"),
    V.ViewAttr{"value", "valor"},
    V.ViewAttr{"placeholder", "dica"}
  ], Nil{}) : V.ViewNode}

law dlg_pi_campo_texto_vazio:
  {D.fieldControl(D.FieldText{"", "", ""}) == V.viewEl("input", [
    V.attrId("dialog-value"),
    V.attrType("text")
  ], Nil{}) : V.ViewNode}

law dlg_pi_campo_editor:
  {D.fieldControl(D.FieldEditor{"", "linha 1", ""}) == V.viewEl("textarea", [
    V.attrId("dialog-value")
  ], Con{V.viewText("linha 1"), Nil{}}) : V.ViewNode}

law dlg_pi_campo_editor_vazio:
  {D.fieldControl(D.FieldEditor{"", "", "escreva"}) == V.viewEl("textarea", [
    V.attrId("dialog-value"),
    V.ViewAttr{"placeholder", "escreva"}
  ], Nil{}) : V.ViewNode}

law dlg_pi_campo_selecao:
  {D.fieldControl(D.FieldPick{"", "b", Con{
    D.DialogOption{"A", "a"},
    Con{D.DialogOption{"B", "b"}, Nil{}}
  }}) == V.viewEl("select", [V.attrId("dialog-value")], Con{
    V.viewEl("option", [V.ViewAttr{"value", "a"}], Con{V.viewText("A"), Nil{}}),
    Con{
      V.viewEl("option", [V.ViewAttr{"value", "b"}, V.ViewAttr{"selected", ""}], Con{V.viewText("B"), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

law dlg_pi_campo_check:
  {D.fieldControl(D.FieldCheck{"Marcar", "sim", True{}}) == V.viewEl("label", Nil{}, Con{
    V.viewEl("input", [
      V.attrId("dialog-value"),
      V.attrType("checkbox"),
      V.ViewAttr{"value", "sim"},
      V.ViewAttr{"checked", ""}
    ], Nil{}),
    Con{V.viewText("Marcar"), Nil{}}
  }) : V.ViewNode}

law dlg_pi_campo_check_off:
  {V.attrGet(V.attrsOf(D.fieldControl(D.FieldCheck{"", "", False{}})), "checked") == None{} : Maybe<&2, String>}

law dlg_pi_campos_vazios:
  {D.piFields(Nil{}) == Nil{} : List<&2, V.ViewNode>}

law dlg_pi_campos_um:
  {D.piFields(Con{D.FieldText{"", "x", ""}, Nil{}}) == Con{
    V.viewEl("input", [V.attrId("dialog-value"), V.attrType("text"), V.ViewAttr{"value", "x"}], Nil{}),
    Nil{}
  } : List<&2, V.ViewNode>}

# ---------- end-day-dialog ----------

law dlg_endday_rotulos:
  {D.endDayTitle() ++ "|" ++ D.endDayLead() ++ "|" ++ D.endDayWhereLabel() ++ "|"
    ++ D.endDayNextLabel() ++ "|" ++ D.endDayCancelLabel() ++ "|" ++ D.endDaySaveLabel()
    == M.msg("dialogs.endDay.title") ++ "|" ++ M.msg("dialogs.endDay.lead") ++ "|" ++ M.msg("dialogs.endDay.where") ++ "|" ++ M.msg("dialogs.endDay.next") ++ "|" ++ M.msg("common.cancel") ++ "|" ++ M.msg("dialogs.endDay.save")
    : String}

law dlg_endday_campo:
  {D.endDayField("end-where", M.msg("dialogs.endDay.where"), "foo") == V.viewEl("label", Nil{}, Con{
    V.viewText(M.msg("dialogs.endDay.where")),
    Con{
      V.viewEl("textarea", [
        V.attrId("end-where"),
        V.ViewAttr{"rows", "2"},
        V.ViewAttr{"required", ""}
      ], Con{V.viewText("foo"), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

law dlg_endday_campo_vazio:
  {D.endDayField("end-next", M.msg("dialogs.endDay.next"), "") == V.viewEl("label", Nil{}, Con{
    V.viewText(M.msg("dialogs.endDay.next")),
    Con{
      V.viewEl("textarea", [
        V.attrId("end-next"),
        V.ViewAttr{"rows", "2"},
        V.ViewAttr{"required", ""}
      ], Nil{}),
      Nil{}
    }
  }) : V.ViewNode}

law dlg_endday_acoes:
  {D.endDayActions() == V.viewEl("div", [V.attrClass("dialog-actions")], Con{
    V.viewEl("button", [
      V.ViewAttr{"value", "cancel"},
      V.ViewAttr{"formnovalidate", ""}
    ], Con{V.viewText(M.msg("common.cancel")), Nil{}}),
    Con{
      V.viewEl("button", [
        V.attrId("end-day-save"),
        V.ViewAttr{"value", "ok"},
        V.attrClass("primary")
      ], Con{V.viewText(M.msg("dialogs.endDay.save")), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

law dlg_endday_ordem:
  {D.endDayChildren("a", "b") == Con{
    V.viewEl("h2", Nil{}, Con{V.viewText(M.msg("dialogs.endDay.title")), Nil{}}),
    Con{
      V.viewEl("p", [V.attrClass("help-lead")], Con{
        V.viewText(M.msg("dialogs.endDay.lead")),
        Nil{}
      }),
      Con{D.endDayField("end-where", M.msg("dialogs.endDay.where"), "a"), Con{
        D.endDayField("end-next", M.msg("dialogs.endDay.next"), "b"),
        Con{D.endDayActions(), Nil{}}
      }}
    }
  } : List<&2, V.ViewNode>}

# ---------- image-dialog ----------

law dlg_image_titulo_vazio:
  {D.imageTitle("") == M.msg("dialogs.image.fallback") : String}

law dlg_image_titulo:
  {D.imageTitle("plot.png") == "plot.png" : String}

law dlg_image_titulo_unix:
  {D.imageTitle("/tmp/mesa/curva.png") == "curva.png" : String}

law dlg_image_titulo_win:
  {D.imageTitle("C:\\Users\\would\\plot.png") == "plot.png" : String}

law dlg_image_acoes_sem_arquivo:
  {D.imageActions(False{}) == Con{
    V.viewEl("button", [V.attrType("button"), V.attrId("image-copy"), V.attrOn("click", "ImageCopy")], Con{V.viewText(M.msg("common.copy")), Nil{}}),
    Con{
      V.viewEl("button", [
        V.attrType("button"),
        V.attrId("image-open"),
        V.attrOn("click", "ImageOpen"),
        V.ViewAttr{"hidden", ""}
      ], Con{V.viewText(M.msg("dialogs.image.openPreview")), Nil{}}),
      Nil{}
    }
  } : List<&2, V.ViewNode>}

# O rodapé da imagem não repete "Fechar": o × do cabeçalho e o Esc fecham.
law dlg_image_acoes_com_arquivo:
  {D.imageActions(True{}) == Con{
    V.viewEl("button", [V.attrType("button"), V.attrId("image-copy"), V.attrOn("click", "ImageCopy")], Con{V.viewText(M.msg("common.copy")), Nil{}}),
    Con{
      V.viewEl("button", [V.attrType("button"), V.attrId("image-open"), V.attrOn("click", "ImageOpen")], Con{V.viewText(M.msg("dialogs.image.openPreview")), Nil{}}),
      Nil{}
    }
  } : List<&2, V.ViewNode>}

# ---------- help-dialog ----------

law dlg_help_versao_vazia:
  {D.helpVersion("") == "" : String}

law dlg_help_versao:
  {D.helpVersion("0.4.0") == "Mesa de Estudos 0.4.0" : String}

law dlg_help_versao_node:
  {D.helpVersionNode("0.4.0") == V.viewText("Mesa de Estudos 0.4.0") : V.ViewNode}

law dlg_help_fatos_ligados:
  {D.helpChrome("0.4.0", D.helpFlags(True{}, True{}, True{}, True{}))
    == D.HelpChrome{"Mesa de Estudos 0.4.0", False{}, False{}, False{}, False{}} : D.HelpChrome}

law dlg_help_fatos_desligados:
  {D.helpChrome("", D.helpFlags(False{}, False{}, False{}, False{}))
    == D.HelpChrome{"", True{}, True{}, True{}, True{}} : D.HelpChrome}

# ---------- about-dialog ----------

law dlg_about_sem_versao:
  {D.aboutLead("") == "" : String}

law dlg_about_com_versao:
  {D.aboutLead("0.4.0") == M.msg1("about.lead", "version", "0.4.0") : String}

law dlg_about_node:
  {D.aboutLeadNode("0.4.0") == V.viewText(M.msg1("about.lead", "version", "0.4.0")) : V.ViewNode}

# #109: a linha de origem não aparece rodando do código; o normal não tem
# caminho, o clone/worktree tem o dele e a origem inválida é outro rótulo.
law dlg_about_origem_do_codigo:
  {D.originShown(D.OriginSource{}) == False{} : Bool}

law dlg_about_origem_visivel:
  {D.originShown(D.OriginNormal{}) == True{} : Bool}

law dlg_about_origem_do_codigo_node:
  {D.originChildren(D.OriginSource{}) == Nil{} : List<&2, V.ViewNode>}

law dlg_about_origem_normal:
  {D.originLabel(D.OriginNormal{}) == M.msg("about.origin.normal") : String}

law dlg_about_origem_dev:
  {D.originLabel(D.OriginDev{False{}, "~/mesa"}) == M.msg("about.origin.dev") : String}

law dlg_about_origem_worktree:
  {D.originLabel(D.OriginDev{True{}, "~/mesa"}) == M.msg("about.origin.worktree") : String}

law dlg_about_origem_indisponivel:
  {D.originLabel(D.OriginUnavailable{"~/mesa"}) == M.msg("about.origin.unavailable") : String}

law dlg_about_origem_caminho:
  {D.originPath(D.OriginDev{True{}, "~/mesa"}) ++ "|" ++ D.originPath(D.OriginUnavailable{"~/sumiu"}) ++ "|" ++ D.originPath(D.OriginNormal{})
    == "~/mesa" ++ "|" ++ "~/sumiu" ++ "|" ++ ""
    : String}

law dlg_about_origem_normal_node:
  {D.originChildren(D.OriginNormal{}) == Con{
    V.viewEl("span", [V.attrClass("about-origin-label")], Con{V.viewText(M.msg("about.origin.normal")), Nil{}}),
    Nil{}
  } : List<&2, V.ViewNode>}

law dlg_about_origem_dev_node:
  {D.originChildren(D.OriginDev{True{}, "~/mesa"}) == Con{
    V.viewEl("span", [V.attrClass("about-origin-label")], Con{V.viewText(M.msg("about.origin.worktree")), Nil{}}),
    Con{
      V.viewText(" · "),
      Con{
        V.viewEl("code", [V.attrClass("about-origin-path"), V.attrTitle("~/mesa")], Con{V.viewText("~/mesa"), Nil{}}),
        Nil{}
      }
    }
  } : List<&2, V.ViewNode>}

# ---------- settings-dialog ----------

law dlg_cfg_linha:
  {D.courseRow(D.SettingsCourse{"m1", "Matéria", "/x"}) == V.viewEl("div", [
    V.attrClass("cfg-course"),
    V.attrData("id", "m1")
  ], Con{
    V.viewEl("input", [
      V.attrClass("cfg-name"),
      V.ViewAttr{"placeholder", M.msg("settings.course.nameColumn")},
      V.attrAria("label", M.msg("settings.course.nameLabel")),
      V.ViewAttr{"value", "Matéria"}
    ], Nil{}),
    Con{
      V.viewEl("input", [
        V.attrClass("cfg-path"),
        V.ViewAttr{"placeholder", M.msg("settings.course.folderColumn")},
        V.ViewAttr{"spellcheck", "false"},
        V.attrAria("label", M.msg("settings.course.folderLabel")),
        V.ViewAttr{"value", "/x"}
      ], Nil{}),
      Con{
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("cfg-browse"),
          V.ViewAttr{"on:click", "BrowseCourse"}
        ], Con{V.viewText(M.msg("settings.course.choose")), Nil{}}),
        Con{
          V.viewEl("button", [
            V.attrType("button"),
            V.attrClass("cfg-remove icon-btn"),
            V.attrAria("label", M.msg("settings.course.remove")),
            V.attrTitle(M.msg("settings.courses.removeNote")),
            V.ViewAttr{"on:click", "RemoveCourse"}
          ], Con{V.viewText("×"), Nil{}}),
          Nil{}
        }
      }
    }
  }) : V.ViewNode}

law dlg_cfg_linha_vazia:
  {D.courseRow(D.emptyCourse()) == V.viewEl("div", [
    V.attrClass("cfg-course"),
    V.attrData("id", "")
  ], Con{
    V.viewEl("input", [
      V.attrClass("cfg-name"),
      V.ViewAttr{"placeholder", M.msg("settings.course.nameColumn")},
      V.attrAria("label", M.msg("settings.course.nameLabel"))
    ], Nil{}),
    Con{
      V.viewEl("input", [
        V.attrClass("cfg-path"),
        V.ViewAttr{"placeholder", M.msg("settings.course.folderColumn")},
        V.ViewAttr{"spellcheck", "false"},
        V.attrAria("label", M.msg("settings.course.folderLabel"))
      ], Nil{}),
      Con{
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("cfg-browse"),
          V.ViewAttr{"on:click", "BrowseCourse"}
        ], Con{V.viewText(M.msg("settings.course.choose")), Nil{}}),
        Con{
          V.viewEl("button", [
            V.attrType("button"),
            V.attrClass("cfg-remove icon-btn"),
            V.attrAria("label", M.msg("settings.course.remove")),
            V.attrTitle(M.msg("settings.courses.removeNote")),
            V.ViewAttr{"on:click", "RemoveCourse"}
          ], Con{V.viewText("×"), Nil{}}),
          Nil{}
        }
      }
    }
  }) : V.ViewNode}

law dlg_cfg_linhas_vazio:
  {D.courseRows(Nil{}) == Con{D.courseRow(D.emptyCourse()), Nil{}} : List<&2, V.ViewNode>}

law dlg_cfg_linhas:
  {D.courseRows(Con{D.SettingsCourse{"a", "A", "/a"}, Con{D.SettingsCourse{"b", "B", "/b"}, Nil{}}})
    == Con{D.courseRow(D.SettingsCourse{"a", "A", "/a"}), Con{D.courseRow(D.SettingsCourse{"b", "B", "/b"}), Nil{}}}
    : List<&2, V.ViewNode>}

# #27 B9: o cabeçalho das colunas é só rótulo visual e vem antes das linhas.
law dlg_cfg_cabecalho:
  {D.courseHead() == V.viewEl("div", [
    V.attrClass("cfg-course-head"),
    V.attrAria("hidden", "true")
  ], [
    V.viewEl("span", Nil{}, [V.viewText(M.msg("settings.course.nameColumn"))]),
    V.viewEl("span", Nil{}, [V.viewText(M.msg("settings.course.folderColumn"))])
  ]) : V.ViewNode}

law dlg_cfg_lista_com_cabecalho:
  {D.courseList(Nil{}) == Con{D.courseHead(), D.courseRows(Nil{})} : List<&2, V.ViewNode>}

# ---------- about: linha de atualização (updater por clique) ----------
#
# Estrutura provada: textos dos estados, o ícone de estado, os botões (ids +
# handlers) e a ordem dos filhos do `#about-update`. O corpo da Release é dado
# (`notes`) e "Conferido hoje às 9:40." é fato do host (`checked`).

law dlg_upd_textos:
  {D.checkUpdateLabel() ++ "|" ++ D.updateIdleText() ++ "|" ++ D.updateCheckingText() ++ "|"
    ++ D.updateApplyingText() ++ "|" ++ D.updateNoneText() ++ "|" ++ D.updateFailedText() ++ "|"
    ++ D.updateFailedRest() ++ "|" ++ D.updateReadyText("0.4.1") ++ "|"
    ++ D.updateNotesLabel() ++ "|" ++ D.updateApplyLabel()
    == M.msg("update.check") ++ "|" ++ M.msg("update.idle") ++ "|" ++ M.msg("update.checking") ++ "|" ++ M.msg("update.applying") ++ "|" ++ M.msg("update.none") ++ "|" ++ M.msg("update.failed") ++ "|" ++ M.msg("update.failedRest") ++ "|" ++ M.msg1("update.ready", "version", "0.4.1") ++ "|" ++ M.msg("update.notes") ++ "|" ++ M.msg("update.apply")
    : String}

law dlg_upd_conferido:
  {D.updateNoneRest("0.4.0", M.msg1("update.checked.today", "time", "9:40")) ++ "|" ++ D.updateNoneRest("0.4.0", "")
    == M.msg1("update.checked.today", "time", "9:40") ++ "|" ++ M.msg1("update.youAreOn", "version", "0.4.0")
    : String}

law dlg_upd_icone:
  {D.updateIcon("ok", "✓") == V.viewEl("span", [
    V.attrClass("update-icon"),
    V.ViewAttr{"data-state", "ok"},
    V.ViewAttr{"aria-hidden", "true"}
  ], Con{V.viewText("✓"), Nil{}}) : V.ViewNode}

law dlg_upd_linha_discreta:
  {D.updateLine2(M.msg("update.none"), M.msg1("update.checked.today", "time", "9:40")) == V.viewEl("p", [V.attrClass("update-text")], Con{
    V.viewEl("span", [V.attrClass("update-main")], Con{V.viewText(M.msg("update.none")), Nil{}}),
    Con{
      V.viewEl("span", [V.attrClass("update-muted")], Con{V.viewText(" "), Con{V.viewText(M.msg1("update.checked.today", "time", "9:40")), Nil{}}}),
      Nil{}
    }
  }) : V.ViewNode}

law dlg_upd_repouso:
  {D.aboutUpdateChildren(D.UpdateIdle{}) == Con{
    D.updateIcon("idle", "↻"),
    Con{
      D.updateLineNode(D.updateIdleText()),
      Con{D.checkUpdateButton(), Nil{}}
    }
  } : List<&2, V.ViewNode>}

law dlg_upd_verificando:
  {D.aboutUpdateChildren(D.UpdateChecking{}) == Con{
    D.updateIcon("busy", "…"),
    Con{D.updateLineNode(M.msg("update.checking")), Nil{}}
  } : List<&2, V.ViewNode>}

law dlg_upd_ultima:
  {D.aboutUpdateChildren(D.UpdateNone{"0.4.0", M.msg1("update.checked.today", "time", "9:40")}) == Con{
    D.updateIcon("ok", "✓"),
    Con{
      D.updateLine2(M.msg("update.none"), M.msg1("update.checked.today", "time", "9:40")),
      Con{D.checkUpdateButton(), Nil{}}
    }
  } : List<&2, V.ViewNode>}

law dlg_upd_ultima_sem_hora:
  {D.aboutUpdateChildren(D.UpdateNone{"0.4.0", ""}) == Con{
    D.updateIcon("ok", "✓"),
    Con{
      D.updateLine2(M.msg("update.none"), M.msg1("update.youAreOn", "version", "0.4.0")),
      Con{D.checkUpdateButton(), Nil{}}
    }
  } : List<&2, V.ViewNode>}

law dlg_upd_falha:
  {D.aboutUpdateChildren(D.UpdateFailed{}) == Con{
    D.updateIcon("warn", "!"),
    Con{
      D.updateLine2(M.msg("update.failed"), M.msg("update.failedRest")),
      Con{D.checkUpdateButton(), Nil{}}
    }
  } : List<&2, V.ViewNode>}

# #109: origem que não recebe atualização nunca vira "Atualizada".
law dlg_upd_sem_origem:
  {D.aboutUpdateChildren(D.UpdateUnverifiable{}) == Con{
    D.updateIcon("warn", "!"),
    Con{
      D.updateLineNode(M.msg("update.unverifiable")),
      Con{D.checkUpdateButton(), Nil{}}
    }
  } : List<&2, V.ViewNode>}

# Verificar é ícone: nome acessível e dica dizem a ação inteira.
law dlg_upd_botao_verificar:
  {D.checkUpdateButton() == V.viewEl("button", [
    V.attrId("update-check"),
    V.attrType("button"),
    V.attrClass("icon-btn"),
    V.ViewAttr{"aria-label", M.msg("update.check")},
    V.ViewAttr{"title", M.msg("update.check")},
    V.ViewAttr{"on:click", "CheckUpdate"}
  ], Con{V.viewText("↻"), Nil{}}) : V.ViewNode}

law dlg_upd_botao_notas:
  {D.releaseNotesButton("https://github.com/x") == V.viewEl("button", [
    V.attrId("update-notes"),
    V.attrType("button"),
    V.ViewAttr{"on:click", "OpenLink"},
    V.ViewAttr{"data-url", "https://github.com/x"}
  ], Con{V.viewText(M.msg("update.notes")), Nil{}}) : V.ViewNode}

law dlg_upd_botao_log:
  {D.updateLogButton() == V.viewEl("button", [
    V.attrId("update-log"),
    V.attrType("button"),
    V.ViewAttr{"on:click", "OpenLog"}
  ], Con{V.viewText(M.msg("update.log")), Nil{}}) : V.ViewNode}

law dlg_upd_botao_aplicar:
  {D.applyUpdateButton() == V.viewEl("button", [
    V.attrId("update-apply"),
    V.attrType("button"),
    V.attrClass("primary"),
    V.ViewAttr{"on:click", "ApplyUpdate"}
  ], Con{V.viewText(M.msg("update.apply")), Nil{}}) : V.ViewNode}

law dlg_upd_pronta:
  {D.aboutUpdateChildren(D.UpdateReady{"0.4.1", "Corpo da Release", "https://github.com/x"}) == Con{
    D.updateIcon("new", "↑"),
    Con{
      D.updateLineNode(M.msg1("update.ready", "version", "0.4.1")),
      Con{
        D.releaseNotesButton("https://github.com/x"),
        Con{
          D.applyUpdateButton(),
          Con{
            V.viewEl("p", [V.attrClass("update-notes")], Con{V.viewText("Corpo da Release"), Nil{}}),
            Nil{}
          }
        }
      }
    }
  } : List<&2, V.ViewNode>}

# Fallback de tags: sem URL e sem corpo — sem link de notas (clique morto não
# entra na árvore) e sem parágrafo de notas vazio.
law dlg_upd_pronta_sem_notas:
  {D.aboutUpdateChildren(D.UpdateReady{"0.4.1", "", ""}) == Con{
    D.updateIcon("new", "↑"),
    Con{
      D.updateLineNode(M.msg1("update.ready", "version", "0.4.1")),
      Con{D.applyUpdateButton(), Nil{}}
    }
  } : List<&2, V.ViewNode>}

# Aplicando: a faixa avisa e o clique fica desligado.
law dlg_upd_aplicando:
  {D.aboutUpdateChildren(D.UpdateApplying{}) == Con{
    D.updateIcon("busy", "…"),
    Con{
      D.updateLineNode(M.msg("update.applying")),
      Con{D.applyingUpdateButton(), Nil{}}
    }
  } : List<&2, V.ViewNode>}

law dlg_upd_botao_aplicar_desligado:
  {D.applyingUpdateButton() == V.viewEl("button", [
    V.attrId("update-apply"),
    V.attrType("button"),
    V.attrClass("primary"),
    V.ViewAttr{"on:click", "ApplyUpdate"},
    V.ViewAttr{"disabled", ""}
  ], Con{V.viewText(M.msg("update.apply")), Nil{}}) : V.ViewNode}

# Resultado real na reabertura: atualizada, recuperada (rollback + motivo) e
# recuperação incompleta — os dois últimos com "Ver o log".
law dlg_upd_resultado_textos:
  {D.updateDoneText("0.4.1") ++ "|" ++ D.updateRecoveredText("0.4.1", "npm ci morreu no meio") ++ "|"
    ++ D.updateRecoveredText("0.4.1", "") ++ "|" ++ D.updateIncompleteText("0.4.1", "backup indisponível") ++ "|"
    ++ D.updateIncompleteText("0.4.1", "")
    == M.msg1("update.done", "version", "0.4.1") ++ "|" ++ M.msg2("update.recovered.reason", "version", "0.4.1", "reason", "npm ci morreu no meio") ++ "|" ++ M.msg1("update.recovered", "version", "0.4.1") ++ "|" ++ M.msg2("update.incomplete.reason", "version", "0.4.1", "reason", "backup indisponível") ++ "|" ++ M.msg1("update.incomplete", "version", "0.4.1")
    : String}

law dlg_upd_resultado_atualizada:
  {D.aboutUpdateChildren(D.UpdateDone{"0.4.1"}) == Con{
    D.updateIcon("ok", "✓"),
    Con{
      D.updateLineNode(M.msg1("update.done", "version", "0.4.1")),
      Con{D.checkUpdateButton(), Nil{}}
    }
  } : List<&2, V.ViewNode>}

law dlg_upd_resultado_recuperada:
  {D.aboutUpdateChildren(D.UpdateRecovered{"0.4.1", "npm ci morreu no meio"}) == Con{
    D.updateIcon("warn", "!"),
    Con{
      D.updateLineNode(M.msg2("update.recovered.reason", "version", "0.4.1", "reason", "npm ci morreu no meio")),
      Con{D.updateLogButton(), Con{D.checkUpdateButton(), Nil{}}}
    }
  } : List<&2, V.ViewNode>}

law dlg_upd_resultado_recuperada_sem_motivo:
  {D.aboutUpdateChildren(D.UpdateRecovered{"0.4.1", ""}) == Con{
    D.updateIcon("warn", "!"),
    Con{
      D.updateLineNode(M.msg1("update.recovered", "version", "0.4.1")),
      Con{D.updateLogButton(), Con{D.checkUpdateButton(), Nil{}}}
    }
  } : List<&2, V.ViewNode>}

law dlg_upd_resultado_incompleta:
  {D.aboutUpdateChildren(D.UpdateIncomplete{"0.4.1", "backup indisponível"}) == Con{
    D.updateIcon("warn", "!"),
    Con{
      D.updateLineNode(M.msg2("update.incomplete.reason", "version", "0.4.1", "reason", "backup indisponível")),
      Con{D.updateLogButton(), Con{D.checkUpdateButton(), Nil{}}}
    }
  } : List<&2, V.ViewNode>}

# ---------- about: painel "O que a Mesa usa" ----------

law dlg_comp_ids:
  {D.componentIds() == Con{"claude", Con{"node", Con{"xournal", Nil{}}}} : List<&2, String>}

law dlg_comp_estados:
  {D.componentStateText(D.CompOk{}) ++ "|" ++ D.componentStateText(D.CompUnknown{}) ++ "|"
    ++ D.componentStateText(D.CompOutdated{"0.90.0"}) ++ "|" ++ D.componentStateText(D.CompWarn{"abaixo de 22.19"})
    == M.msg("component.ok") ++ "|" ++ M.msg("component.unknown") ++ "|" ++ M.msg1("component.outdated", "latest", "0.90.0") ++ "|" ++ "abaixo de 22.19"
    : String}

# Painel aberto antes de a checagem responder: a linha nasce verificando.
law dlg_comp_verificando:
  {D.componentStateText(D.CompChecking{}) == M.msg("component.checking") : String}

law dlg_comp_versao_texto:
  {D.componentVersionText("") ++ "|" ++ D.componentVersionText("0.4.0") ++ "|" ++ D.componentLinkLabel("") ++ "|" ++ D.componentLinkLabel("Baixar")
    == "—" ++ "|" ++ "0.4.0" ++ "|" ++ M.msg("component.openSite") ++ "|" ++ "Baixar"
    : String}

law dlg_comp_bolinha:
  {D.componentDot(D.CompOk{}) ++ "|" ++ D.componentDot(D.CompUnknown{}) ++ "|"
    ++ D.componentDot(D.CompOutdated{"1"}) ++ "|" ++ D.componentDot(D.CompWarn{"x"}) ++ "|"
    ++ D.componentDot(D.CompChecking{}) ++ "|" ++ D.componentDot(D.CompOffline{})
    == "ok|muted|new|warn|busy|muted"
    : String}

law dlg_comp_descricao:
  {D.componentDescription("node") ++ "|" ++ D.componentDescription("xournal") ++ "|"
    ++ D.componentDescription("outro") ++ "|" ++ D.componentDescription("claude")
    == M.msg("component.desc.node") ++ "|" ++ M.msg("component.desc.xournal") ++ "|" ++ "" ++ "|" ++ M.msg("component.desc.claude")
    : String}

# A dica do host só entra quando o estado pede ação.
law dlg_comp_nota_em_dia:
  {D.componentNote(M.msg("component.desc.claude"), "Instalado pelo usuário.", D.componentShowsHint(D.CompOk{}))
    == Con{V.viewText(M.msg("component.desc.claude")), Nil{}}
    : List<&2, V.ViewNode>}

law dlg_comp_nota_com_acao:
  {D.componentNote(M.msg("component.desc.claude"), "Instalado pelo usuário.", D.componentShowsHint(D.CompOutdated{"1"}))
    == Con{V.viewText(M.msg("component.desc.claude")), Con{V.viewText(" "), Con{V.viewText("Instalado pelo usuário."), Nil{}}}}
    : List<&2, V.ViewNode>}

law dlg_comp_nota_so_dica:
  {D.componentNote("", "Não configurado.", D.componentShowsHint(D.CompUnknown{})) == Con{V.viewText("Não configurado."), Nil{}} : List<&2, V.ViewNode>}

law dlg_comp_node_antigo:
  {D.nodeState(22, 18) == D.CompWarn{M.msg("component.nodeTooOld")} : D.ComponentState}

law dlg_comp_node_21:
  {D.nodeState(21, 0) == D.CompWarn{M.msg("component.nodeTooOld")} : D.ComponentState}

law dlg_comp_node_limite:
  {D.nodeState(22, 19) == D.CompOk{} : D.ComponentState}

law dlg_comp_node_novo:
  {D.nodeState(24, 5) == D.CompOk{} : D.ComponentState}

law dlg_comp_linha_cheia:
  {D.componentRowNode(D.ComponentRow{"claude", "Claude Code", "2.1.296", D.CompOutdated{"2.1.301"}, "Instalado pelo usuário.", "https://y", "", U.ToolAsk{"claude update"}, False{}, U.RunNone{}})
    == V.viewEl("div", [V.attrClass("component-row"), V.attrData("id", "claude")], Con{
      V.viewEl("div", [V.attrClass("component-main")], Con{
        D.componentHead("Claude Code", "2.1.296", D.CompOutdated{"2.1.301"}, False{}),
        Con{
          D.componentHintNode(Con{V.viewText(M.msg("component.desc.claude")), Con{V.viewText(" "), Con{V.viewText("Instalado pelo usuário."), Nil{}}}}),
          Nil{}
        }
      }),
      Con{
        D.componentActions("https://y", "", U.ToolAsk{"claude update"}),
        Nil{}
      }
    }) : V.ViewNode}

law dlg_comp_cabeca:
  {D.componentHead("Node (sistema)", "24.5.0", D.CompOk{}, False{}) == V.viewEl("div", [V.attrClass("component-head")], Con{
    V.viewEl("span", [V.attrClass("component-name")], Con{V.viewText("Node (sistema)"), Nil{}}),
    Con{
      V.viewEl("span", [V.attrClass("component-version")], Con{V.viewText("24.5.0"), Nil{}}),
      Con{
        V.viewEl("span", [
          V.attrClass("component-dot"),
          V.ViewAttr{"data-state", "ok"},
          V.ViewAttr{"aria-hidden", "true"}
        ], Nil{}),
        Con{
          V.viewEl("span", [V.attrClass("component-state")], Con{V.viewText(M.msg("component.ok")), Nil{}}),
          Nil{}
        }
      }
    }
  }) : V.ViewNode}

law dlg_comp_acoes:
  {D.componentActions("https://y", M.msg("component.openSite"), U.ToolAsk{"claude update"}) == V.viewEl("div", [V.attrClass("component-actions")], Con{
    V.viewEl("button", [
      V.attrClass("component-link"),
      V.attrType("button"),
      V.ViewAttr{"on:click", "OpenLink"},
      V.ViewAttr{"data-url", "https://y"}
    ], Con{V.viewText(M.msg("component.openSite")), Nil{}}),
    Con{
      V.viewEl("button", [
        V.attrType("button"),
        V.attrClass("component-update tool-ask"),
        V.ViewAttr{"data-command", "claude update"},
        V.ViewAttr{"on:click", "AskUpdate"}
      ], Con{V.viewText(M.msg("update.update")), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

# Em dia e sem ação: só a cabeça e a descrição, sem coluna de ações.
law dlg_comp_linha_minima:
  {D.componentRowNode(D.ComponentRow{"node", "Node", "24.5.0", D.CompOk{}, "", "", "", U.ToolNone{}, False{}, U.RunNone{}})
    == V.viewEl("div", [V.attrClass("component-row"), V.attrData("id", "node")], Con{
      V.viewEl("div", [V.attrClass("component-main")], Con{
        D.componentHead("Node", "24.5.0", D.CompOk{}, False{}),
        Con{D.componentHintNode(Con{V.viewText(M.msg("component.desc.node")), Nil{}}), Nil{}}
      }),
      Nil{}
    }) : V.ViewNode}

law dlg_comp_linhas:
  {D.componentRows(Con{
    D.ComponentRow{"node", "Node", "24.5.0", D.CompOk{}, "", "", "", U.ToolNone{}, False{}, U.RunNone{}},
    Con{D.ComponentRow{"claude", "Claude Code", "", D.CompUnknown{}, "", "", "", U.ToolNone{}, False{}, U.RunNone{}}, Nil{}}
  }) == Con{
    D.componentRowNode(D.ComponentRow{"node", "Node", "24.5.0", D.CompOk{}, "", "", "", U.ToolNone{}, False{}, U.RunNone{}}),
    Con{
      D.componentRowNode(D.ComponentRow{"claude", "Claude Code", "", D.CompUnknown{}, "", "", "", U.ToolNone{}, False{}, U.RunNone{}}),
      Nil{}
    }
  } : List<&2, V.ViewNode>}

# ---------- #45: Claude Code, sem rede, "mais nova que a testada" ----------

law dlg_comp_sem_rede_texto:
  {D.componentStateText(D.CompOffline{}) == M.msg("update.offline") : String}

# Sem rede a linha mostra a dica do host (o que fazer), como o desconhecido.
law dlg_comp_sem_rede_dica:
  {D.componentShowsHint(D.CompOffline{}) == True{} : Bool}

law dlg_comp_cabeca_mais_nova_que_a_testada:
  {D.componentHead("Claude Code", "2.1.302", D.CompOk{}, True{}) == V.viewEl("div", [V.attrClass("component-head")], Con{
    V.viewEl("span", [V.attrClass("component-name")], Con{V.viewText("Claude Code"), Nil{}}),
    Con{
      V.viewEl("span", [V.attrClass("component-version")], Con{V.viewText("2.1.302"), Nil{}}),
      Con{
        V.viewEl("span", [
          V.attrClass("component-dot"),
          V.ViewAttr{"data-state", "ok"},
          V.ViewAttr{"aria-hidden", "true"}
        ], Nil{}),
        Con{
          V.viewEl("span", [V.attrClass("component-state")], Con{V.viewText(M.msg("component.ok")), Nil{}}),
          Con{
            V.viewEl("span", [V.attrClass("component-ahead")], Con{V.viewText(M.msg("update.ahead")), Nil{}}),
            Nil{}
          }
        }
      }
    }
  }) : V.ViewNode}

# Com a ação "Atualizar" e uma confirmação aberta, o painel da execução é o
# último filho da linha, depois das ações.
law dlg_comp_linha_com_confirmacao:
  {D.componentRowNode(D.ComponentRow{"claude", "Claude Code", "2.1.296", D.CompOutdated{"2.1.301"}, "", "", "",
      U.ToolAsk{"claude update"}, False{}, U.RunConfirm{"claude update", ""}})
    == V.viewEl("div", [V.attrClass("component-row"), V.attrData("id", "claude")], Con{
      V.viewEl("div", [V.attrClass("component-main")], Con{
        D.componentHead("Claude Code", "2.1.296", D.CompOutdated{"2.1.301"}, False{}),
        Con{D.componentHintNode(Con{V.viewText(M.msg("component.desc.claude")), Nil{}}), Nil{}}
      }),
      Con{
        D.componentActions("", "", U.ToolAsk{"claude update"}),
        Con{U.confirmNodes("claude update", ""), Nil{}}
      }
    }) : V.ViewNode}
