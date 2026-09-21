import Base
import ../dialogsview.bend as D
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato dos diálogos da Mesa. Prefixo `dlg_`.
#
# Tudo é cenário concreto (igual a `laws/pdfview.bend`): os fatos entram já
# resolvidos e a lei fecha por computação. O que se fixa aqui é o DOM que o
# aplicador cola no `index.html` (ids, classes, aria, valores e ordem).
# ---------------------------------------------------------------------------

# ---------- pi-dialog: título, ok, campos ----------

law dlg_pi_titulo_vazio:
  {D.piTitle("") == "Pi" : String}

law dlg_pi_titulo:
  {D.piTitle("Escolha o modelo") == "Escolha o modelo" : String}

law dlg_pi_msg_crua:
  {D.piMessage("Veja a equação a seguir") == "Veja a equação a seguir" : String}

law dlg_pi_ok_vazio:
  {D.dialogOkLabel("") == "Continuar" : String}

law dlg_pi_ok_label:
  {D.dialogOkLabel("Enviar") == "Enviar" : String}

law dlg_pi_ok_node:
  {D.piOkNode("") == V.viewEl("button", [
    V.attrId("dialog-ok"),
    V.ViewAttr{"value", "ok"},
    V.attrClass("primary")
  ], Con{V.viewText("Continuar"), Nil{}}) : V.ViewNode}

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
    == "Encerrar por hoje|Salve na conversa um ponto curto para retomar depois.|Onde parei|Próximo passo|Cancelar|Salvar na conversa"
    : String}

law dlg_endday_campo:
  {D.endDayField("end-where", "Onde parei", "foo") == V.viewEl("label", Nil{}, Con{
    V.viewText("Onde parei"),
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
  {D.endDayField("end-next", "Próximo passo", "") == V.viewEl("label", Nil{}, Con{
    V.viewText("Próximo passo"),
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
    ], Con{V.viewText("Cancelar"), Nil{}}),
    Con{
      V.viewEl("button", [
        V.attrId("end-day-save"),
        V.ViewAttr{"value", "ok"},
        V.attrClass("primary")
      ], Con{V.viewText("Salvar na conversa"), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

law dlg_endday_ordem:
  {D.endDayChildren("a", "b") == Con{
    V.viewEl("h2", Nil{}, Con{V.viewText("Encerrar por hoje"), Nil{}}),
    Con{
      V.viewEl("p", [V.attrClass("help-lead")], Con{
        V.viewText("Salve na conversa um ponto curto para retomar depois."),
        Nil{}
      }),
      Con{D.endDayField("end-where", "Onde parei", "a"), Con{
        D.endDayField("end-next", "Próximo passo", "b"),
        Con{D.endDayActions(), Nil{}}
      }}
    }
  } : List<&2, V.ViewNode>}

# ---------- image-dialog ----------

law dlg_image_titulo_vazio:
  {D.imageTitle("") == "Imagem" : String}

law dlg_image_titulo:
  {D.imageTitle("plot.png") == "plot.png" : String}

law dlg_image_titulo_unix:
  {D.imageTitle("/tmp/mesa/curva.png") == "curva.png" : String}

law dlg_image_titulo_win:
  {D.imageTitle("C:\\Users\\would\\plot.png") == "plot.png" : String}

law dlg_image_acoes_sem_arquivo:
  {D.imageActions(False{}) == Con{
    V.viewEl("button", [V.attrType("button"), V.attrId("image-copy"), V.attrOn("click", "ImageCopy")], Con{V.viewText("Copiar"), Nil{}}),
    Con{
      V.viewEl("button", [
        V.attrType("button"),
        V.attrId("image-open"),
        V.attrOn("click", "ImageOpen"),
        V.ViewAttr{"hidden", ""}
      ], Con{V.viewText("Abrir no Preview"), Nil{}}),
      Con{
        V.viewEl("button", [
          V.ViewAttr{"value", "cancel"},
          V.attrClass("primary")
        ], Con{V.viewText("Fechar"), Nil{}}),
        Nil{}
      }
    }
  } : List<&2, V.ViewNode>}

law dlg_image_acoes_com_arquivo:
  {D.imageActions(True{}) == Con{
    V.viewEl("button", [V.attrType("button"), V.attrId("image-copy"), V.attrOn("click", "ImageCopy")], Con{V.viewText("Copiar"), Nil{}}),
    Con{
      V.viewEl("button", [V.attrType("button"), V.attrId("image-open"), V.attrOn("click", "ImageOpen")], Con{V.viewText("Abrir no Preview"), Nil{}}),
      Con{
        V.viewEl("button", [
          V.ViewAttr{"value", "cancel"},
          V.attrClass("primary")
        ], Con{V.viewText("Fechar"), Nil{}}),
        Nil{}
      }
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
  {D.aboutLead("0.4.0") == "Mesa de Estudos 0.4.0 · licença MIT" : String}

law dlg_about_node:
  {D.aboutLeadNode("0.4.0") == V.viewText("Mesa de Estudos 0.4.0 · licença MIT") : V.ViewNode}

# ---------- settings-dialog ----------

law dlg_cfg_titulo_primeiro:
  {D.settingsTitle(True{}) == "Bem-vindo à Mesa de Estudos" : String}

law dlg_cfg_titulo:
  {D.settingsTitle(False{}) == "Configurações" : String}

law dlg_cfg_lead_primeiro:
  {D.settingsLead(True{})
    == "Escolha a pasta de dados e pelo menos uma matéria (nome + pasta de PDFs). O Pi pede as credenciais na primeira conexão."
    : String}

law dlg_cfg_lead:
  {D.settingsLead(False{})
    == "Caminhos e nomes desta mesa. As credenciais do modelo continuam no Pi."
    : String}

law dlg_cfg_titulo_node:
  {D.settingsTitleNode(True{}) == V.viewText("Bem-vindo à Mesa de Estudos") : V.ViewNode}

law dlg_cfg_lead_node:
  {D.settingsLeadNode(False{})
    == V.viewText("Caminhos e nomes desta mesa. As credenciais do modelo continuam no Pi.")
    : V.ViewNode}

law dlg_cfg_linha:
  {D.courseRow(D.SettingsCourse{"m1", "Matéria", "/x"}) == V.viewEl("div", [
    V.attrClass("cfg-course"),
    V.attrData("id", "m1")
  ], Con{
    V.viewEl("input", [
      V.attrClass("cfg-name"),
      V.ViewAttr{"placeholder", "Nome"},
      V.ViewAttr{"value", "Matéria"}
    ], Nil{}),
    Con{
      V.viewEl("input", [
        V.attrClass("cfg-path"),
        V.ViewAttr{"placeholder", "Pasta dos PDFs"},
        V.ViewAttr{"spellcheck", "false"},
        V.ViewAttr{"value", "/x"}
      ], Nil{}),
      Con{
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("cfg-browse"),
          V.ViewAttr{"on:click", "BrowseCourse"}
        ], Con{V.viewText("Pasta"), Nil{}}),
        Con{
          V.viewEl("button", [
            V.attrType("button"),
            V.attrClass("cfg-remove icon-btn"),
            V.attrAria("label", "Remover"),
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
    V.viewEl("input", [V.attrClass("cfg-name"), V.ViewAttr{"placeholder", "Nome"}], Nil{}),
    Con{
      V.viewEl("input", [
        V.attrClass("cfg-path"),
        V.ViewAttr{"placeholder", "Pasta dos PDFs"},
        V.ViewAttr{"spellcheck", "false"}
      ], Nil{}),
      Con{
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("cfg-browse"),
          V.ViewAttr{"on:click", "BrowseCourse"}
        ], Con{V.viewText("Pasta"), Nil{}}),
        Con{
          V.viewEl("button", [
            V.attrType("button"),
            V.attrClass("cfg-remove icon-btn"),
            V.attrAria("label", "Remover"),
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

# ---------- welcome-dialog (primeira abertura) ----------
#
# O contrato da boas-vindas é a ESTRUTURA (4 blocos + o botão), os títulos, o
# renderizador genérico e a nota por plataforma. A prosa dos parágrafos é dado
# (`D.welcomeBlocks`) e pode mudar sem tocar em nenhuma lei daqui.

law dlg_welcome_titulo:
  {D.welcomeTitle() == "Bem-vindo à Mesa de Estudos" : String}

law dlg_welcome_secoes:
  {D.welcomeTitles(False{}) == Con{
    "O que é a Mesa",
    Con{"O Pi", Con{"Customização por agentes", Con{"Dicas de uso", Nil{}}}}
  } : List<&2, String>}

law dlg_welcome_secoes_win:
  {D.welcomeTitles(True{}) == Con{
    "O que é a Mesa",
    Con{"O Pi", Con{"Customização por agentes", Con{"Dicas de uso", Nil{}}}}
  } : List<&2, String>}

law dlg_welcome_nota_mac:
  {D.welcomeWorkflowNote(False{})
    == "No macOS, o Conferir Xournal++ anexa a captura da sua resolução no Xournal++ e você envia junto com a mensagem."
    : String}

law dlg_welcome_nota_win:
  {D.welcomeWorkflowNote(True{})
    == "No Windows, o Conferir Xournal++ não existe: cole um print da resolução como anexo e envie com a mensagem."
    : String}

law dlg_welcome_bloco:
  {D.blockNode(D.WelcomeBlock{"Título", Con{"um", Con{"dois", Nil{}}}}) == V.viewEl("section", [
    V.attrClass("welcome-block")
  ], Con{
    V.viewEl("h3", Nil{}, Con{V.viewText("Título"), Nil{}}),
    Con{
      V.viewEl("p", Nil{}, Con{V.viewText("um"), Nil{}}),
      Con{V.viewEl("p", Nil{}, Con{V.viewText("dois"), Nil{}}), Nil{}}
    }
  }) : V.ViewNode}

law dlg_welcome_acoes:
  {D.welcomeActions() == V.viewEl("div", [V.attrClass("dialog-actions")], Con{
    V.viewEl("button", [V.ViewAttr{"value", "cancel"}], Con{V.viewText("Agora não"), Nil{}}),
    Con{
      V.viewEl("button", [
        V.attrId("welcome-settings"),
        V.attrType("button"),
        V.attrClass("primary"),
        V.ViewAttr{"on:click", "WelcomeConfigure"}
      ], Con{V.viewText("Configurar agora"), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

# ---------- about: linha de atualização (updater por clique) ----------
#
# Estrutura provada: textos dos estados, os botões (ids + handlers) e a ordem
# dos filhos do `#about-update`. O corpo da Release é dado (`notes`).

law dlg_upd_textos:
  {D.checkUpdateLabel() ++ "|" ++ D.updateIdleText() ++ "|" ++ D.updateCheckingText() ++ "|"
    ++ D.updateNoneText("0.4.0") ++ "|" ++ D.updateFailedText() ++ "|"
    ++ D.updateReadyPrefix("0.4.1") ++ D.updateReadyJoin() ++ "|" ++ D.updateNotesLabel() ++ "|" ++ D.updateApplyLabel() ++ "|" ++ D.updatePiLabel()
    == "Verificar atualizações|A Mesa verifica atualizações uma vez por dia, sem interromper. Você também pode verificar agora.|Verificando atualizações…|Você está na última versão (v0.4.0).|Não foi possível verificar agora. Tente de novo quando quiser.|v0.4.1 disponível — o que mudou () · |Release notes|Atualizar e reiniciar|Atualizar Pi"
    : String}

law dlg_upd_repouso:
  {D.aboutUpdateChildren(D.UpdateIdle{}) == Con{
    D.updateLineNode(D.updateIdleText()),
    Con{D.checkUpdateButton(), Nil{}}
  } : List<&2, V.ViewNode>}

law dlg_upd_verificando:
  {D.aboutUpdateChildren(D.UpdateChecking{}) == Con{
    D.updateLineNode("Verificando atualizações…"),
    Nil{}
  } : List<&2, V.ViewNode>}

law dlg_upd_ultima:
  {D.aboutUpdateChildren(D.UpdateNone{"0.4.0"}) == Con{
    D.updateLineNode("Você está na última versão (v0.4.0)."),
    Con{D.checkUpdateButton(), Nil{}}
  } : List<&2, V.ViewNode>}

law dlg_upd_falha:
  {D.aboutUpdateChildren(D.UpdateFailed{}) == Con{
    D.updateLineNode(D.updateFailedText()),
    Con{D.checkUpdateButton(), Nil{}}
  } : List<&2, V.ViewNode>}

law dlg_upd_botao_verificar:
  {D.checkUpdateButton() == V.viewEl("button", [
    V.attrId("update-check"),
    V.attrType("button"),
    V.ViewAttr{"on:click", "CheckUpdate"}
  ], Con{V.viewText("Verificar atualizações"), Nil{}}) : V.ViewNode}

law dlg_upd_botao_notas:
  {D.releaseNotesButton("https://github.com/x") == V.viewEl("button", [
    V.attrId("update-notes"),
    V.attrType("button"),
    V.ViewAttr{"on:click", "OpenLink"},
    V.ViewAttr{"data-url", "https://github.com/x"}
  ], Con{V.viewText("Release notes"), Nil{}}) : V.ViewNode}

law dlg_upd_botao_aplicar:
  {D.applyUpdateButton() == V.viewEl("button", [
    V.attrId("update-apply"),
    V.attrType("button"),
    V.attrClass("primary"),
    V.ViewAttr{"on:click", "ApplyUpdate"}
  ], Con{V.viewText("Atualizar e reiniciar"), Nil{}}) : V.ViewNode}

law dlg_upd_pronta:
  {D.aboutUpdateChildren(D.UpdateReady{"0.4.1", "Corpo da Release", "https://github.com/x"}) == Con{
    V.viewEl("div", [V.attrClass("update-line")], Con{
      V.viewText("v0.4.1 disponível — o que mudou ("),
      Con{
        D.releaseNotesButton("https://github.com/x"),
        Con{
          V.viewText(") · "),
          Con{D.applyUpdateButton(), Nil{}}
        }
      }
    }),
    Con{
      V.viewEl("p", [V.attrClass("update-notes")], Con{V.viewText("Corpo da Release"), Nil{}}),
      Nil{}
    }
  } : List<&2, V.ViewNode>}

# ---------- about: painel "Componentes" ----------

law dlg_comp_ids:
  {D.componentIds() == Con{"mesa", Con{"pi", Con{"node", Con{"xournal", Nil{}}}}} : List<&2, String>}

law dlg_comp_estados:
  {D.componentStateText(D.CompOk{}) ++ "|" ++ D.componentStateText(D.CompUnknown{}) ++ "|"
    ++ D.componentStateText(D.CompOutdated{"0.90.0"}) ++ "|" ++ D.componentStateText(D.CompWarn{"abaixo de 22.19"})
    == "✓|desconhecido|→ v0.90.0 disponível|abaixo de 22.19"
    : String}

law dlg_comp_versao_texto:
  {D.componentVersionText("") ++ "|" ++ D.componentVersionText("0.4.0") ++ "|" ++ D.componentLinkLabel("") ++ "|" ++ D.componentLinkLabel("Baixar")
    == "—|0.4.0|Ver página|Baixar"
    : String}

law dlg_comp_node_antigo:
  {D.nodeState(22, 18) == D.CompWarn{"abaixo de 22.19 — o Pi exige Node 22.19+"} : D.ComponentState}

law dlg_comp_node_21:
  {D.nodeState(21, 0) == D.CompWarn{"abaixo de 22.19 — o Pi exige Node 22.19+"} : D.ComponentState}

law dlg_comp_node_limite:
  {D.nodeState(22, 19) == D.CompOk{} : D.ComponentState}

law dlg_comp_node_novo:
  {D.nodeState(24, 5) == D.CompOk{} : D.ComponentState}

law dlg_comp_linha_cheia:
  {D.componentRowNode(D.ComponentRow{"pi", "Pi", "0.86.1", D.CompOutdated{"0.90.0"}, "Em desk/node_modules", "https://y", "", True{}})
    == V.viewEl("div", [V.attrClass("component-row"), V.attrData("id", "pi")], Con{
      V.viewEl("span", [V.attrClass("component-name")], Con{V.viewText("Pi"), Nil{}}),
      Con{
        V.viewEl("span", [V.attrClass("component-version")], Con{V.viewText("0.86.1"), Nil{}}),
        Con{
          V.viewEl("span", [V.attrClass("component-state")], Con{V.viewText("→ v0.90.0 disponível"), Nil{}}),
          Con{
            V.viewEl("small", [V.attrClass("component-hint")], Con{V.viewText("Em desk/node_modules"), Nil{}}),
            Con{
              V.viewEl("button", [
                V.attrClass("component-link"),
                V.attrType("button"),
                V.ViewAttr{"on:click", "OpenLink"},
                V.ViewAttr{"data-url", "https://y"}
              ], Con{V.viewText("Ver página"), Nil{}}),
              Con{
                V.viewEl("button", [
                  V.attrId("update-pi"),
                  V.attrType("button"),
                  V.attrClass("component-update"),
                  V.ViewAttr{"on:click", "UpdatePi"}
                ], Con{V.viewText("Atualizar Pi"), Nil{}}),
                Nil{}
              }
            }
          }
        }
      }
    }) : V.ViewNode}

law dlg_comp_linha_minima:
  {D.componentRowNode(D.ComponentRow{"node", "Node", "24.5.0", D.CompOk{}, "", "", "", False{}})
    == V.viewEl("div", [V.attrClass("component-row"), V.attrData("id", "node")], Con{
      V.viewEl("span", [V.attrClass("component-name")], Con{V.viewText("Node"), Nil{}}),
      Con{
        V.viewEl("span", [V.attrClass("component-version")], Con{V.viewText("24.5.0"), Nil{}}),
        Con{
          V.viewEl("span", [V.attrClass("component-state")], Con{V.viewText("✓"), Nil{}}),
          Nil{}
        }
      }
    }) : V.ViewNode}

law dlg_comp_linhas:
  {D.componentRows(Con{
    D.ComponentRow{"mesa", "Mesa", "0.4.0", D.CompOk{}, "", "", "", False{}},
    Con{D.ComponentRow{"pi", "Pi", "", D.CompUnknown{}, "", "", "", False{}}, Nil{}}
  }) == Con{
    D.componentRowNode(D.ComponentRow{"mesa", "Mesa", "0.4.0", D.CompOk{}, "", "", "", False{}}),
    Con{
      D.componentRowNode(D.ComponentRow{"pi", "Pi", "", D.CompUnknown{}, "", "", "", False{}}),
      Nil{}
    }
  } : List<&2, V.ViewNode>}
