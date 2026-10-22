import Base
import ../msg.bend as M
import ../updatenotice.bend as U
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato dos avisos de atualização do Pi e do Claude Code (ticket #45).
# Prefixo `upd_`.
#
# O que se garante, nesta ordem:
#   1. "mais nova" é estrita e nunca mente sem versão;
#   2. sem rede NÃO é erro nem aviso (`unreachable`, sem linha, sem ponto);
#   3. a linha e o ponto acendem com versão disponível; a versão VISTA apaga o
#      ponto (e só ele) e uma mais nova que a vista o acende de novo;
#   4. "Ignorar esta versão" cala a versão e as menores; uma mais nova acorda;
#   5. "Lembrar depois" cala até o dia combinado e, ao voltar, volta como
#      novidade (o ponto reacende);
#   6. "mais nova que a testada" olha a versão oferecida (ou, em dia, a
#      instalada) contra a tabela desta Mesa — e nunca bloqueia nada.
#
# O que o enunciado NÃO prova: ler `X.Y.Z` do texto (o host entrega `Ver`), o
# dia de hoje (o host entrega o número) e rodar o comando (mundo). Os nomes e as
# versões são concretos porque String.eq não reduz em String livre.
# ---------------------------------------------------------------------------

def v120() -> U.Ver:
  U.Ver{1, 2, 0}

def v130() -> U.Ver:
  U.Ver{1, 3, 0}

def v131() -> U.Ver:
  U.Ver{1, 3, 1}

def v140() -> U.Ver:
  U.Ver{1, 4, 0}

def v2100() -> U.Ver:
  U.Ver{2, 1, 0}

def mem(seen: U.Ver, ignored: U.Ver, remind: U32) -> U.Memory:
  U.Memory{seen, ignored, remind}

# ---------- versões ----------

law upd_menor_para_maior_e_mais_nova:
  {U.verNewer(v130(), v120()) == True{} : Bool}

law upd_patch_conta:
  {U.verNewer(v131(), v130()) == True{} : Bool}

law upd_major_vence_minor_maior:
  {U.verNewer(v2100(), v140()) == True{} : Bool}

law upd_igual_nao_e_mais_nova:
  {U.verNewer(v130(), v130()) == False{} : Bool}

law upd_menor_nao_e_mais_nova:
  {U.verNewer(v120(), v130()) == False{} : Bool}

law upd_sem_versao_nunca_e_mais_nova:
  {U.verNewer(U.NoVer{}, v120()) == False{} : Bool}

law upd_nada_e_mais_novo_que_sem_versao:
  {U.verNewer(v130(), U.NoVer{}) == False{} : Bool}

law upd_maior_de_duas:
  {U.verMax(v120(), v130()) == v130() : U.Ver}

law upd_maior_de_duas_ordem_inversa:
  {U.verMax(v140(), v130()) == v140() : U.Ver}

law upd_maior_com_sem_versao:
  {U.verMax(U.NoVer{}, v130()) == v130() : U.Ver}

# ---------- a decisão ----------

# Disponível, sem memória, testada até a oferecida: linha e ponto, sem "mais nova".
law upd_disponivel_acende_linha_e_ponto:
  {U.noticeOf(v120(), v130(), v130(), U.emptyMemory(), 100)
    == U.Notice{True{}, False{}, True{}, True{}, False{}} : U.Notice}

# Sem rede: nada de aviso, nada de erro.
law upd_sem_rede_nao_avisa:
  {U.noticeOf(v120(), U.NoVer{}, v130(), U.emptyMemory(), 100)
    == U.Notice{False{}, True{}, False{}, False{}, False{}} : U.Notice}

law upd_sem_rede_nem_com_memoria_antiga:
  {U.noticeOf(v120(), U.NoVer{}, v130(), mem(v130(), v130(), 0), 100)
    == U.Notice{False{}, True{}, False{}, False{}, False{}} : U.Notice}

law upd_em_dia_nao_avisa:
  {U.noticeOf(v130(), v130(), v130(), U.emptyMemory(), 100)
    == U.Notice{False{}, False{}, False{}, False{}, False{}} : U.Notice}

# Instalada mais nova que a do registro (versão de teste do usuário): em dia.
law upd_instalada_a_frente_do_registro_nao_avisa:
  {U.noticeOf(v140(), v130(), v130(), U.emptyMemory(), 100)
    == U.Notice{False{}, False{}, False{}, False{}, True{}} : U.Notice}

# ---------- versão vista ----------

law upd_vista_apaga_o_ponto_e_mantem_a_linha:
  {U.noticeOf(v120(), v130(), v130(), mem(v130(), U.NoVer{}, 0), 100)
    == U.Notice{True{}, False{}, True{}, False{}, False{}} : U.Notice}

law upd_mais_nova_que_a_vista_acende_de_novo:
  {U.noticeOf(v120(), v140(), v140(), mem(v130(), U.NoVer{}, 0), 100)
    == U.Notice{True{}, False{}, True{}, True{}, False{}} : U.Notice}

law upd_abrir_o_sobre_registra_a_vista:
  {U.afterOpen(U.emptyMemory(), v120(), v130()) == mem(v130(), U.NoVer{}, 0) : U.Memory}

# Sem versão disponível, abrir o Sobre não inventa "vista".
law upd_abrir_sem_disponivel_nao_registra:
  {U.afterOpen(U.emptyMemory(), v130(), v130()) == U.emptyMemory() : U.Memory}

law upd_abrir_sem_rede_nao_registra:
  {U.afterOpen(mem(v130(), U.NoVer{}, 0), v120(), U.NoVer{}) == mem(v130(), U.NoVer{}, 0) : U.Memory}

# A memória nunca desce: ver uma versão menor não apaga a maior já vista.
law upd_abrir_nao_desfaz_a_vista:
  {U.afterOpen(mem(v140(), U.NoVer{}, 0), v120(), v130()) == mem(v140(), U.NoVer{}, 0) : U.Memory}

law upd_abrir_apaga_o_ponto:
  {U.noticeOf(v120(), v130(), v130(), U.afterOpen(U.emptyMemory(), v120(), v130()), 100)
    == U.Notice{True{}, False{}, True{}, False{}, False{}} : U.Notice}

law upd_depois_de_aberto_uma_mais_nova_reacende:
  {U.noticeOf(v120(), v140(), v140(), U.afterOpen(U.emptyMemory(), v120(), v130()), 100)
    == U.Notice{True{}, False{}, True{}, True{}, False{}} : U.Notice}

# ---------- ignorar esta versão ----------

law upd_ignorar_cala_a_versao:
  {U.noticeOf(v120(), v130(), v130(), mem(U.NoVer{}, v130(), 0), 100)
    == U.Notice{True{}, False{}, False{}, False{}, False{}} : U.Notice}

law upd_ignorar_cala_as_menores:
  {U.noticeOf(v120(), v130(), v130(), mem(U.NoVer{}, v140(), 0), 100)
    == U.Notice{True{}, False{}, False{}, False{}, False{}} : U.Notice}

law upd_ignorar_acorda_com_mais_nova:
  {U.noticeOf(v120(), v131(), v131(), mem(U.NoVer{}, v130(), 0), 100)
    == U.Notice{True{}, False{}, True{}, True{}, False{}} : U.Notice}

law upd_ignorar_guarda_a_oferecida:
  {U.afterIgnore(mem(v120(), U.NoVer{}, 5), v130()) == mem(v120(), v130(), 5) : U.Memory}

law upd_ignorar_nao_desce:
  {U.afterIgnore(mem(U.NoVer{}, v140(), 0), v130()) == mem(U.NoVer{}, v140(), 0) : U.Memory}

law upd_ignorar_apaga_linha_e_ponto:
  {U.noticeOf(v120(), v130(), v130(), U.afterIgnore(U.emptyMemory(), v130()), 100)
    == U.Notice{True{}, False{}, False{}, False{}, False{}} : U.Notice}

# ---------- lembrar depois ----------

law upd_adiado_cala_antes_do_dia:
  {U.noticeOf(v120(), v130(), v130(), mem(U.NoVer{}, U.NoVer{}, 101), 100)
    == U.Notice{True{}, False{}, False{}, False{}, False{}} : U.Notice}

law upd_adiado_volta_no_dia:
  {U.noticeOf(v120(), v130(), v130(), mem(U.NoVer{}, U.NoVer{}, 101), 101)
    == U.Notice{True{}, False{}, True{}, True{}, False{}} : U.Notice}

law upd_adiar_marca_amanha_e_esquece_a_vista:
  {U.afterPostpone(mem(v130(), v120(), 0), 100) == mem(U.NoVer{}, v120(), 101) : U.Memory}

# Adiar depois de ver: o ponto some hoje e, no dia, volta como novidade.
law upd_adiar_cala_hoje:
  {U.noticeOf(v120(), v130(), v130(), U.afterPostpone(mem(v130(), U.NoVer{}, 0), 100), 100)
    == U.Notice{True{}, False{}, False{}, False{}, False{}} : U.Notice}

law upd_adiar_reacende_o_ponto_no_dia:
  {U.noticeOf(v120(), v130(), v130(), U.afterPostpone(mem(v130(), U.NoVer{}, 0), 100), 101)
    == U.Notice{True{}, False{}, True{}, True{}, False{}} : U.Notice}

# ---------- testada com esta Mesa ----------

law upd_oferecida_passa_da_testada:
  {U.noticeOf(v120(), v130(), v120(), U.emptyMemory(), 100)
    == U.Notice{True{}, False{}, True{}, True{}, True{}} : U.Notice}

law upd_oferecida_igual_a_testada_nao_passa:
  {U.noticeOf(v120(), v130(), v130(), U.emptyMemory(), 100)
    == U.Notice{True{}, False{}, True{}, True{}, False{}} : U.Notice}

# Sem tabela (versão da testada ilegível) nada é "mais nova que a testada".
law upd_sem_testada_nao_passa:
  {U.noticeOf(v120(), v130(), U.NoVer{}, U.emptyMemory(), 100)
    == U.Notice{True{}, False{}, True{}, True{}, False{}} : U.Notice}

# Em dia, mas a instalada já passou da tabela: o aviso é sobre a instalada.
law upd_instalada_passa_da_testada:
  {U.noticeOf(v140(), v140(), v130(), U.emptyMemory(), 100)
    == U.Notice{False{}, False{}, False{}, False{}, True{}} : U.Notice}

# "mais nova que a testada" não cala nem esconde a linha: nunca bloqueia.
law upd_mais_nova_que_a_testada_nao_cala_a_linha:
  {U.noticeOf(v120(), v140(), v120(), U.emptyMemory(), 100)
    == U.Notice{True{}, False{}, True{}, True{}, True{}} : U.Notice}

# ---------- texto ----------

law upd_texto_da_linha:
  {U.noticeText("Pi", "1.3.0") == M.msg2("update.noticeAvailable", "name", "Pi", "version", "1.3.0") : String}

law upd_texto_do_claude_code:
  {U.noticeText("Claude Code", "2.1.301") == M.msg2("update.noticeAvailable", "name", "Claude Code", "version", "2.1.301") : String}

law upd_textos_curtos:
  {U.aheadText() ++ "|" ++ U.offlineText() ++ "|" ++ U.remindLabel() ++ "|" ++ U.ignoreLabel()
    == M.msg("update.ahead") ++ "|" ++ M.msg("update.offline") ++ "|" ++ M.msg("update.remind") ++ "|" ++ M.msg("update.ignore")
    : String}

law upd_aviso_de_versao_mais_nova:
  {U.aheadWarning("1.4.0", "1.3.0")
    == M.msg2("update.aheadWarning", "version", "1.4.0", "tested", "1.3.0")
    : String}

law upd_titulo_do_ajustes_sem_ponto:
  {U.settingsTitle(False{}) == M.msg("chrome.settings") : String}

law upd_titulo_do_ajustes_com_ponto:
  {U.settingsTitle(True{}) == M.msg("chrome.settings.withUpdate") : String}

law upd_resultado_atualizou_e_religou:
  {U.doneSentence("Pi", True{}, v120(), v130(), "1.2.0", "1.3.0", True{})
    == M.msg2("update.updatedRelinked", "name", "Pi", "version", "1.3.0") : String}

law upd_resultado_atualizou_sem_religar:
  {U.doneSentence("Claude Code", True{}, v120(), v130(), "1.2.0", "1.3.0", False{})
    == M.msg2("update.updated", "name", "Claude Code", "version", "1.3.0") : String}

# O comando terminou, mas nada mudou: não se chama de sucesso.
law upd_resultado_comando_ok_versao_igual:
  {U.doneSentence("Pi", True{}, v120(), v120(), "1.2.0", "1.2.0", True{})
    == M.msg2("update.sameVersion", "name", "Pi", "version", "1.2.0")
    : String}

law upd_resultado_comando_ok_sem_ler_versao:
  {U.doneSentence("Pi", True{}, v120(), U.NoVer{}, "1.2.0", "", True{})
    == M.msg1("update.unreadable", "name", "Pi") : String}

law upd_resultado_falha:
  {U.doneSentence("Pi", False{}, v120(), v120(), "1.2.0", "1.2.0", False{})
    == M.msg1("update.failedRun", "name", "Pi") : String}

# ---------- nós ----------

law upd_linha_do_topo:
  {U.noticeLineNode(U.NoticeLine{"pi", "Pi", "1.3.0", False{}})
    == V.viewEl("div", [V.attrClass("about-notice"), V.attrData("id", "pi")], Con{
      V.viewEl("span", [
        V.attrClass("update-icon"),
        V.ViewAttr{"data-state", "new"},
        V.ViewAttr{"aria-hidden", "true"}
      ], Con{V.viewText("↑"), Nil{}}),
      Con{
        V.viewEl("p", [V.attrClass("update-text")], Con{
          V.viewEl("span", [V.attrClass("update-main")], Con{V.viewText(M.msg2("update.noticeAvailable", "name", "Pi", "version", "1.3.0")), Nil{}}),
          Nil{}
        }),
        Con{
          V.viewEl("button", [
            V.attrType("button"),
            V.attrClass("notice-btn"),
            V.ViewAttr{"data-id", "pi"},
            V.ViewAttr{"on:click", "PostponeNotice"}
          ], Con{V.viewText(M.msg("update.remind")), Nil{}}),
          Con{
            V.viewEl("button", [
              V.attrType("button"),
              V.attrClass("notice-btn"),
              V.ViewAttr{"data-id", "pi"},
              V.ViewAttr{"on:click", "IgnoreNotice"}
            ], Con{V.viewText(M.msg("update.ignore")), Nil{}}),
            Nil{}
          }
        }
      }
    }) : V.ViewNode}

law upd_linha_do_topo_com_mais_nova_que_a_testada:
  {U.noticeLineText("Claude Code", "2.1.302", True{})
    == V.viewEl("p", [V.attrClass("update-text")], Con{
      V.viewEl("span", [V.attrClass("update-main")], Con{V.viewText(M.msg2("update.noticeAvailable", "name", "Claude Code", "version", "2.1.302")), Nil{}}),
      Con{
        V.viewEl("span", [V.attrClass("update-muted")], Con{V.viewText(" · "), Con{V.viewText(M.msg("update.ahead")), Nil{}}}),
        Nil{}
      }
    }) : V.ViewNode}

law upd_sem_linhas_sem_nos:
  {U.noticeLines(Nil{}) == Nil{} : List<&2, V.ViewNode>}

law upd_sem_acao_sem_nos:
  {U.hasAction(U.ToolNone{}) == False{} : Bool}

law upd_acao_local_e_o_botao_de_sempre:
  {U.actionNodes(U.ToolLocal{}) == Con{
    V.viewEl("button", [
      V.attrId("update-pi"),
      V.attrType("button"),
      V.attrClass("component-update"),
      V.ViewAttr{"on:click", "UpdatePi"}
    ], Con{V.viewText(M.msg("update.pi")), Nil{}}),
    Nil{}
  } : List<&2, V.ViewNode>}

law upd_acao_com_confirmacao_leva_o_comando:
  {U.actionNodes(U.ToolAsk{"claude update"}) == Con{
    V.viewEl("button", [
      V.attrType("button"),
      V.attrClass("component-update tool-ask"),
      V.ViewAttr{"data-command", "claude update"},
      V.ViewAttr{"on:click", "AskUpdate"}
    ], Con{V.viewText(M.msg("update.update")), Nil{}}),
    Nil{}
  } : List<&2, V.ViewNode>}

# Tutor respondendo: o botão fica desligado e a dica está à vista e no título.
law upd_acao_espera_o_tutor:
  {U.actionNodes(U.ToolWait{"claude update"}) == Con{
    V.viewEl("button", [
      V.attrType("button"),
      V.attrClass("component-update tool-ask"),
      V.ViewAttr{"disabled", ""},
      V.ViewAttr{"title", M.msg("update.waitHint")},
      V.ViewAttr{"aria-describedby", "tool-wait-hint"}
    ], Con{V.viewText(M.msg("update.update")), Nil{}}),
    Con{
      V.viewEl("small", [V.attrClass("component-wait"), V.attrId("tool-wait-hint")], Con{V.viewText(M.msg("update.waitShort")), Nil{}}),
      Nil{}
    }
  } : List<&2, V.ViewNode>}

law upd_acao_copiar_so_o_comando:
  {U.actionNodes(U.ToolCopy{"npm i -g @earendil-works/pi-coding-agent"}) == Con{
    V.viewEl("button", [
      V.attrType("button"),
      V.attrClass("component-update tool-copy"),
      V.ViewAttr{"data-command", "npm i -g @earendil-works/pi-coding-agent"},
      V.ViewAttr{"aria-label", M.msg1("update.copyAria", "command", "npm i -g @earendil-works/pi-coding-agent")},
      V.ViewAttr{"on:click", "CopyCommand"}
    ], Con{V.viewText(M.msg("common.copy")), Nil{}}),
    Nil{}
  } : List<&2, V.ViewNode>}

law upd_sem_execucao_sem_nos:
  {U.runNodes(U.RunNone{}) == Nil{} : List<&2, V.ViewNode>}

law upd_confirmacao_com_aviso:
  {U.runNodes(U.RunConfirm{"brew upgrade pi-coding-agent", "A 1.4.0 é mais nova."})
    == Con{
      V.viewEl("div", [
        V.attrClass("component-run"),
        V.ViewAttr{"data-phase", "confirm"},
        V.ViewAttr{"role", "group"}
      ], Con{
        V.viewEl("p", [V.attrClass("run-line")], Con{
          V.viewText(M.msg("update.willRun")),
          Con{V.viewEl("code", [V.attrClass("run-command")], Con{V.viewText("brew upgrade pi-coding-agent"), Nil{}}), Nil{}}
        }),
        Con{
          V.viewEl("p", [V.attrClass("run-warn")], Con{V.viewText("A 1.4.0 é mais nova."), Nil{}}),
          Con{
            V.viewEl("div", [V.attrClass("run-actions")], Con{
              V.viewEl("button", [
                V.attrType("button"),
                V.attrClass("run-cancel"),
                V.ViewAttr{"on:click", "CancelRun"}
              ], Con{V.viewText(M.msg("common.cancel")), Nil{}}),
              Con{
                V.viewEl("button", [
                  V.attrType("button"),
                  V.attrClass("primary run-confirm"),
                  V.ViewAttr{"on:click", "ConfirmRun"}
                ], Con{V.viewText(M.msg("update.update")), Nil{}}),
                Nil{}
              }
            }),
            Nil{}
          }
        }
      }),
      Nil{}
    } : List<&2, V.ViewNode>}

# Sem aviso de versão, a confirmação é só o comando e os dois botões.
law upd_confirmacao_sem_aviso_tem_dois_filhos:
  {U.confirmNodes("claude update", "")
    == V.viewEl("div", [
      V.attrClass("component-run"),
      V.ViewAttr{"data-phase", "confirm"},
      V.ViewAttr{"role", "group"}
    ], Con{
      V.viewEl("p", [V.attrClass("run-line")], Con{
        V.viewText(M.msg("update.willRun")),
        Con{V.viewEl("code", [V.attrClass("run-command")], Con{V.viewText("claude update"), Nil{}}), Nil{}}
      }),
      Con{
        V.viewEl("div", [V.attrClass("run-actions")], Con{
          V.viewEl("button", [
            V.attrType("button"),
            V.attrClass("run-cancel"),
            V.ViewAttr{"on:click", "CancelRun"}
          ], Con{V.viewText(M.msg("common.cancel")), Nil{}}),
          Con{
            V.viewEl("button", [
              V.attrType("button"),
              V.attrClass("primary run-confirm"),
              V.ViewAttr{"on:click", "ConfirmRun"}
            ], Con{V.viewText(M.msg("update.update")), Nil{}}),
            Nil{}
          }
        }),
        Nil{}
      }
    }) : V.ViewNode}

# Rodando: a saída que já chegou, numa área rolável com nome acessível.
law upd_rodando_mostra_a_saida:
  {U.busyNodes("claude update", "baixando…")
    == V.viewEl("div", [
      V.attrClass("component-run"),
      V.ViewAttr{"data-phase", "busy"},
      V.ViewAttr{"role", "group"},
      V.ViewAttr{"aria-live", "polite"}
    ], Con{
      V.viewEl("p", [V.attrClass("run-line")], Con{
        V.viewText(M.msg("update.running")),
        Con{V.viewEl("code", [V.attrClass("run-command")], Con{V.viewText("claude update"), Nil{}}), Nil{}}
      }),
      Con{
        V.viewEl("pre", [
          V.attrClass("run-output"),
          V.ViewAttr{"tabindex", "0"},
          V.ViewAttr{"role", "log"},
          V.ViewAttr{"aria-label", M.msg("update.outputAria")}
        ], Con{V.viewText("baixando…"), Nil{}}),
        Nil{}
      }
    }) : V.ViewNode}

# Sem saída ainda, não há área rolável vazia.
law upd_rodando_sem_saida_nao_tem_area:
  {U.busyNodes("claude update", "")
    == V.viewEl("div", [
      V.attrClass("component-run"),
      V.ViewAttr{"data-phase", "busy"},
      V.ViewAttr{"role", "group"},
      V.ViewAttr{"aria-live", "polite"}
    ], Con{
      V.viewEl("p", [V.attrClass("run-line")], Con{
        V.viewText(M.msg("update.running")),
        Con{V.viewEl("code", [V.attrClass("run-command")], Con{V.viewText("claude update"), Nil{}}), Nil{}}
      }),
      Nil{}
    }) : V.ViewNode}

law upd_fim_com_falha:
  {U.doneNodes(False{}, M.msg1("update.failedRun", "name", "Pi"), "erro")
    == V.viewEl("div", [
      V.attrClass("component-run"),
      V.ViewAttr{"data-phase", "failed"},
      V.ViewAttr{"role", "group"}
    ], Con{
      V.viewEl("p", [V.attrClass("run-line run-result"), V.ViewAttr{"role", "status"}], Con{
        V.viewText(M.msg1("update.failedRun", "name", "Pi")),
        Nil{}
      }),
      Con{
        V.viewEl("pre", [
          V.attrClass("run-output"),
          V.ViewAttr{"tabindex", "0"},
          V.ViewAttr{"role", "log"},
          V.ViewAttr{"aria-label", M.msg("update.outputAria")}
        ], Con{V.viewText("erro"), Nil{}}),
        Con{
          V.viewEl("div", [V.attrClass("run-actions")], Con{
            V.viewEl("button", [
              V.attrType("button"),
              V.attrClass("run-close"),
              V.ViewAttr{"on:click", "CloseRun"}
            ], Con{V.viewText(M.msg("common.close")), Nil{}}),
            Nil{}
          }),
          Nil{}
        }
      }
    }) : V.ViewNode}

law upd_fim_ok_marca_done:
  {U.donePhase(True{}) ++ "|" ++ U.donePhase(False{}) == "done|failed" : String}

# ---------- onde a linha mora (#52) ----------

# O Sobre segue com a linha de sempre.
law upd_sobre_tem_a_linha_de_sempre:
  {U.noticeLineFor(U.About{}, U.NoticeLine{"pi", "Pi", "1.3.0", False{}})
    == U.noticeLineNode(U.NoticeLine{"pi", "Pi", "1.3.0", False{}}) : V.ViewNode}

# As Configurações mostram a MESMA linha com um "Ver no Sobre" entre o texto e
# os botões de sempre.
law upd_configuracoes_tem_a_linha_com_ver_no_sobre:
  {U.noticeLineFor(U.Settings{}, U.NoticeLine{"pi", "Pi", "1.3.0", False{}})
    == V.viewEl("div", [V.attrClass("about-notice"), V.attrData("id", "pi")], Con{
      V.viewEl("span", [
        V.attrClass("update-icon"),
        V.ViewAttr{"data-state", "new"},
        V.ViewAttr{"aria-hidden", "true"}
      ], Con{V.viewText("↑"), Nil{}}),
      Con{
        V.viewEl("p", [V.attrClass("update-text")], Con{
          V.viewEl("span", [V.attrClass("update-main")], Con{V.viewText(M.msg2("update.noticeAvailable", "name", "Pi", "version", "1.3.0")), Nil{}}),
          Nil{}
        }),
        Con{
          V.viewEl("button", [
            V.attrType("button"),
            V.attrClass("notice-btn"),
            V.ViewAttr{"data-id", "pi"},
            V.ViewAttr{"on:click", "OpenAboutFromNotice"}
          ], Con{V.viewText(M.msg("update.seeAbout")), Nil{}}),
          Con{
            V.viewEl("button", [
              V.attrType("button"),
              V.attrClass("notice-btn"),
              V.ViewAttr{"data-id", "pi"},
              V.ViewAttr{"on:click", "PostponeNotice"}
            ], Con{V.viewText(M.msg("update.remind")), Nil{}}),
            Con{
              V.viewEl("button", [
                V.attrType("button"),
                V.attrClass("notice-btn"),
                V.ViewAttr{"data-id", "pi"},
                V.ViewAttr{"on:click", "IgnoreNotice"}
              ], Con{V.viewText(M.msg("update.ignore")), Nil{}}),
              Nil{}
            }
          }
        }
      }
    }) : V.ViewNode}

law upd_sem_linhas_nas_configuracoes_sem_nos:
  {U.noticeLinesFor(U.Settings{}, Nil{}) == Nil{} : List<&2, V.ViewNode>}

# O ponto leva a quem abre as Configurações: a linha mora lá e abrir uma
# superfície com a linha visível é "ver" — nas duas.
law upd_configuracoes_mostram_o_aviso:
  {U.showsNotice(U.Settings{}) == True{} : Bool}

law upd_sobre_mostra_o_aviso:
  {U.showsNotice(U.About{}) == True{} : Bool}

law upd_abrir_configuracoes_com_linha_visivel_e_ver:
  {U.seesLine(U.Settings{}, True{}) == True{} : Bool}

law upd_abrir_sobre_com_linha_visivel_e_ver:
  {U.seesLine(U.About{}, True{}) == True{} : Bool}

# Sem linha (ignorada, adiada, sem versão nova) abrir não "vê" nada.
law upd_abrir_configuracoes_sem_linha_nao_ve:
  {U.seesLine(U.Settings{}, False{}) == False{} : Bool}

law upd_abrir_sobre_sem_linha_nao_ve:
  {U.seesLine(U.About{}, False{}) == False{} : Bool}

# Ver pelas Configurações apaga o ponto como ver pelo Sobre: a memória é a mesma.
law upd_ver_nas_configuracoes_apaga_o_ponto:
  {U.noticeOf(v120(), v130(), v130(), U.afterOpen(U.emptyMemory(), v120(), v130()), 100)
    == U.Notice{True{}, False{}, True{}, False{}, False{}} : U.Notice}
