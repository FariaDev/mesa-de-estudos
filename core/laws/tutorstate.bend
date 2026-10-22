import Base
import ../msg.bend as M
import ../tutorstate.bend as T
import ../resume.bend as R
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato dos estados do tutor na coluna (ticket #17). Prefixo `tutorstate_`.
#
# O bloco `#tutor-state` diz uma coisa de cada vez, pelos fatos do host:
#   - ligando e sem resposta vêm antes da retomada guardada;
#   - desligado mostra a retomada (se há) ou o convite;
#   - ligado mostra a retomada (se há) ou nada.
# Os estados com ações têm a mesma casca (texto, depois ações): é o que faz a
# distância entre texto, botões e caixa de mensagem ser uma só no CSS.
#
# As leis fecham em valores concretos: `String.trim`/`String.take` de uma
# variável livre não reduzem, então o que se prova é o caso que importa — motivo
# vazio, motivo normal e árvore montada.
# ---------------------------------------------------------------------------

# Filho de um nó pelo índice (o texto de dentro de um botão é o ViewText).
def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

def kidAt(n: V.ViewNode, i: Nat) -> V.ViewNode:
  at(V.kidsOf(n), i)

def attrOf(n: V.ViewNode, name: String) -> Maybe<&2, String>:
  V.attrGet(V.attrsOf(n), name)

# ---------- motivo ----------

law tutorstate_reason_cap:
  {T.maxReason() == 160n : Nat}

law tutorstate_reason_vazio:
  {T.reasonLine("") == M.msg("tutor.reason.fallback") : String}

law tutorstate_reason_so_espaco:
  {T.reasonLine("   \t ") == M.msg("tutor.reason.fallback") : String}

law tutorstate_reason_apara:
  {T.reasonLine("  Pi não encontrado.  ") == "Pi não encontrado." : String}

# ---------- escolha do estado ----------

# Desligado sem retomada: o convite.
law tutorstate_off_convite:
  {T.stateView("off", "", False{}, "", "", "") == T.inviteView() : V.ViewNode}

# Desligado com retomada: a retomada.
law tutorstate_off_retomada:
  {T.stateView("off", "", True{}, "Lista 2", "travei na 3", "fazer a 4")
    == T.resumeView("Lista 2", "travei na 3", "fazer a 4") : V.ViewNode}

# Ligando vem antes da retomada.
law tutorstate_ligando_vence_retomada:
  {T.stateView("connecting", "", True{}, "Lista 2", "travei na 3", "fazer a 4")
    == T.connectingView() : V.ViewNode}

law tutorstate_ligando_sem_retomada:
  {T.stateView("connecting", "", False{}, "", "", "") == T.connectingView() : V.ViewNode}

# Sem resposta vem antes da retomada e leva o motivo.
law tutorstate_erro_vence_retomada:
  {T.stateView("error", "Pi não encontrado.", True{}, "Lista 2", "travei na 3", "fazer a 4")
    == T.failedView("Pi não encontrado.") : V.ViewNode}

law tutorstate_erro_sem_retomada:
  {T.stateView("error", "Pi não encontrado.", False{}, "", "", "")
    == T.failedView("Pi não encontrado.") : V.ViewNode}

# Ligado: com retomada ela segue à vista; sem retomada o bloco some.
law tutorstate_online_retomada:
  {T.stateView("online", "", True{}, "Lista 2", "travei na 3", "fazer a 4")
    == T.resumeView("Lista 2", "travei na 3", "fazer a 4") : V.ViewNode}

law tutorstate_online_sem_retomada:
  {T.stateView("online", "", False{}, "", "", "") == T.noneView() : V.ViewNode}

# Um fato que o núcleo não conhece vale desligado: nunca um bloco vazio.
law tutorstate_desconhecido_vale_off:
  {T.stateView("qualquer", "", False{}, "", "", "") == T.inviteView() : V.ViewNode}

law tutorstate_vazio_vale_off:
  {T.stateView("", "", True{}, "Lista 2", "travei na 3", "fazer a 4")
    == T.resumeView("Lista 2", "travei na 3", "fazer a 4") : V.ViewNode}

# ---------- casca comum ----------

# Texto e depois ações, nos três estados com botões: é o que o CSS mede.
law tutorstate_casca_retomada:
  {V.kidsOf(T.resumeView("Lista 2", "travei na 3", "fazer a 4")) ==
    [ T.textView(T.leadView(R.resumeLeadKids("Lista 2", "travei na 3")), [T.fineView(M.msg1("resume.next", "next", "fazer a 4"))])
    , T.actionsView([ T.button("resume-go", "ts-primary", M.msg("resume.go"), R.resumeGoTitle(), "Resume")
                    , T.button("resume-new", "ts-secondary", M.msg("resume.new"), R.resumeNewTitle(), "NewSession")
                    , T.button("resume-forget", "ts-ghost", M.msg("resume.forget"), R.resumeForgetTitle(), "Forget")
                    ])
    ] : List<&2, V.ViewNode>}

law tutorstate_casca_texto_primeiro:
  {attrOf(kidAt(T.connectingView(), 0n), "class") == Some{"ts-text"} : Maybe<&2, String>}

law tutorstate_casca_acoes_depois:
  {attrOf(kidAt(T.connectingView(), 1n), "class") == Some{"ts-actions"} : Maybe<&2, String>}

law tutorstate_casca_erro_texto:
  {attrOf(kidAt(T.failedView("x"), 0n), "class") == Some{"ts-text"} : Maybe<&2, String>}

law tutorstate_casca_erro_acoes:
  {attrOf(kidAt(T.failedView("x"), 1n), "class") == Some{"ts-actions"} : Maybe<&2, String>}

law tutorstate_casca_retomada_texto:
  {attrOf(kidAt(T.resumeView("a", "b", "c"), 0n), "class") == Some{"ts-text"} : Maybe<&2, String>}

law tutorstate_casca_retomada_acoes:
  {attrOf(kidAt(T.resumeView("a", "b", "c"), 1n), "class") == Some{"ts-actions"} : Maybe<&2, String>}

# ---------- identidade do bloco ----------

law tutorstate_id:
  {attrOf(T.inviteView(), "id") == Some{"tutor-state"} : Maybe<&2, String>}

law tutorstate_estado_off:
  {attrOf(T.inviteView(), "data-state") == Some{"off"} : Maybe<&2, String>}

law tutorstate_estado_resume:
  {attrOf(T.resumeView("a", "b", "c"), "data-state") == Some{"resume"} : Maybe<&2, String>}

law tutorstate_estado_connecting:
  {attrOf(T.connectingView(), "data-state") == Some{"connecting"} : Maybe<&2, String>}

law tutorstate_estado_error:
  {attrOf(T.failedView("x"), "data-state") == Some{"error"} : Maybe<&2, String>}

law tutorstate_estado_none:
  {attrOf(T.noneView(), "data-state") == Some{"none"} : Maybe<&2, String>}

# Escondido e sem filhos: ocupa lugar nenhum na coluna.
law tutorstate_none_escondido:
  {attrOf(T.noneView(), "hidden") == Some{""} : Maybe<&2, String>}

law tutorstate_none_sem_filhos:
  {V.kidsOf(T.noneView()) == Nil{} : List<&2, V.ViewNode>}

# Ligando é uma região de status (o leitor de tela anuncia a chamada).
law tutorstate_connecting_status:
  {attrOf(T.connectingView(), "role") == Some{"status"} : Maybe<&2, String>}

# ---------- botões ----------

law tutorstate_convite_botao:
  {at(V.kidsOf(kidAt(T.inviteView(), 1n)), 0n)
    == T.button("connect", "ts-primary", M.msg("tutor.connect"), M.msg("tutor.connectTitle"), "Connect") : V.ViewNode}

law tutorstate_cancelar:
  {at(V.kidsOf(kidAt(T.connectingView(), 1n)), 0n)
    == T.button("connect-cancel", "ts-secondary", M.msg("tutor.cancel"), M.msg("tutor.cancelTitle"), "Cancel") : V.ViewNode}

law tutorstate_cancelar_unico:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(T.connectingView(), 1n))) == 1n : Nat}

law tutorstate_erro_tres_acoes:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(T.failedView("x"), 1n))) == 3n : Nat}

law tutorstate_erro_chamar_de_novo:
  {at(V.kidsOf(kidAt(T.failedView("x"), 1n)), 0n)
    == T.button("connect", "ts-primary", M.msg("tutor.retry"), M.msg("tutor.retryTitle"), "Connect") : V.ViewNode}

law tutorstate_erro_ver_log:
  {at(V.kidsOf(kidAt(T.failedView("x"), 1n)), 1n)
    == T.button("state-log", "ts-secondary", M.msg("tutor.log"), M.msg("tutor.logTitle"), "OpenLog") : V.ViewNode}

law tutorstate_erro_ajustes_do_pi:
  {at(V.kidsOf(kidAt(T.failedView("x"), 1n)), 2n)
    == T.button("state-pi", "ts-ghost", M.msg("tutor.piSettings"), M.msg("tutor.piSettingsTitle"), "OpenPiSettings") : V.ViewNode}

law tutorstate_retomada_tres_acoes:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(T.resumeView("a", "b", "c"), 1n))) == 3n : Nat}

# ---------- textos ----------

law tutorstate_motivo_na_linha_de_apoio:
  {V.kidsOf(kidAt(kidAt(T.failedView("Pi não encontrado."), 0n), 1n))
    == [V.viewText("Pi não encontrado.")] : List<&2, V.ViewNode>}

law tutorstate_motivo_vazio_na_linha_de_apoio:
  {V.kidsOf(kidAt(kidAt(T.failedView("  "), 0n), 1n))
    == [V.viewText(M.msg("tutor.reason.fallback"))] : List<&2, V.ViewNode>}

law tutorstate_erro_destaque:
  {V.kidsOf(kidAt(kidAt(T.failedView("x"), 0n), 0n))
    == [V.viewText(M.msg("tutor.failed.lead"))] : List<&2, V.ViewNode>}

law tutorstate_apoio_da_retomada:
  {V.kidsOf(kidAt(kidAt(T.resumeView("Lista 2", "travei na 3", "fazer a 4"), 0n), 1n))
    == [V.viewText(M.msg1("resume.next", "next", "fazer a 4"))] : List<&2, V.ViewNode>}

# Sem apoio no ligando: só a linha em destaque e o Cancelar.
law tutorstate_ligando_so_destaque:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(T.connectingView(), 0n))) == 1n : Nat}

law tutorstate_ligando_destaque:
  {V.kidsOf(kidAt(kidAt(T.connectingView(), 0n), 0n))
    == [T.dotsView(), V.viewText(M.msg("tutor.connecting"))] : List<&2, V.ViewNode>}

# ---------- texto da retomada (resume.bend) ----------

law tutorstate_lead_com_questao:
  {R.resumeLeadKids("Lista 2 · 7b", "travei na 3")
    == [ V.viewText(M.msg("resume.stoppedAt"))
       , V.viewEl("strong", Nil{}, [V.viewText("Lista 2 · 7b")])
       , V.viewText(": travei na 3")
       ] : List<&2, V.ViewNode>}

law tutorstate_lead_sem_questao:
  {R.resumeLeadKids("", "travei na 3")
    == [V.viewText(M.msg("resume.stoppedPrefix")), V.viewText("travei na 3")] : List<&2, V.ViewNode>}

law tutorstate_lead_questao_so_espaco:
  {R.resumeLeadKids("   ", "travei na 3")
    == [V.viewText(M.msg("resume.stoppedPrefix")), V.viewText("travei na 3")] : List<&2, V.ViewNode>}

# ---------- motivo traduzido e "Ajustes do Pi" (#27) ----------

# O código de saída não vai para a tela: o número fica no log da Mesa.
law tutorstate_reason_saida_com_codigo:
  {T.reasonLine(M.msg1("tutor.error.stopped", "code", "7")) == M.msg("tutor.reason.exit") : String}

law tutorstate_reason_saida_com_sinal:
  {T.reasonLine(M.msg1("tutor.error.stopped", "code", "SIGKILL")) == M.msg("tutor.reason.exit") : String}

law tutorstate_reason_saida_no_meio_da_sessao:
  {T.reasonLine(M.msg1("tutor.error.lost", "reason", M.msg1("tutor.error.stopped", "code", "1"))) == M.msg("tutor.reason.exit") : String}

# Outro motivo segue como o motor devolveu.
law tutorstate_reason_outro_motivo_intacto:
  {T.reasonLine(M.msg("tutor.error.timeout")) == M.msg("tutor.error.timeout") : String}

law tutorstate_erro_saida_texto:
  {V.kidsOf(kidAt(kidAt(T.failedView(M.msg1("tutor.error.stopped", "code", "7")), 0n), 1n))
    == [V.viewText(M.msg("tutor.reason.exit"))] : List<&2, V.ViewNode>}

law tutorstate_pi_ausente_marca:
  {T.piMissing(M.msg("tutor.error.piMissing")) == True{} : Bool}

law tutorstate_pi_presente_nao_marca:
  {T.piMissing(M.msg1("tutor.error.stopped", "code", "7")) == False{} : Bool}

# Pi não encontrado: Ajustes do Pi é a ação principal, como na primeira abertura.
law tutorstate_pi_ausente_ajustes_principal:
  {at(V.kidsOf(kidAt(T.failedView(M.msg("tutor.error.piMissing")), 1n)), 0n)
    == T.button("state-pi", "ts-primary", M.msg("tutor.piSettings"), M.msg("tutor.piSettingsTitle"), "OpenPiSettings") : V.ViewNode}

law tutorstate_pi_ausente_chamar_secundario:
  {at(V.kidsOf(kidAt(T.failedView(M.msg("tutor.error.piMissing")), 1n)), 1n)
    == T.button("connect", "ts-secondary", M.msg("tutor.retry"), M.msg("tutor.retryTitle"), "Connect") : V.ViewNode}

law tutorstate_pi_ausente_tres_acoes:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(T.failedView(M.msg("tutor.error.piMissing")), 1n))) == 3n : Nat}

# ---------- texto da caixa por estado (#27) ----------

law tutorstate_dica_ligado:
  {T.composerHint("online") == M.msg("composer.hint.online") : String}

law tutorstate_dica_desligado:
  {T.composerHint("off") == M.msg("composer.hint.off") : String}

law tutorstate_dica_vazio_vale_desligado:
  {T.composerHint("") == M.msg("composer.hint.off") : String}

law tutorstate_dica_ligando:
  {T.composerHint("connecting") == M.msg("composer.hint.calling") : String}

law tutorstate_dica_sem_resposta:
  {T.composerHint("error") == M.msg("composer.hint.calling") : String}

# ---------- Claude Code fora da faixa (#51) ----------

# O motivo de exemplo é a mensagem do catálogo como o host a recebe (chave +
# argumentos); o núcleo a entrega inteira, sem corte.
def foraDaFaixa() -> String:
  M.msg3("claude.version.below", "found", "2.1.246", "minimum", "2.1.296", "series", "2.1.x")

# Sem conserto, `stateViewFix` é exatamente o `stateView` de sempre.
law tutorstate_sem_conserto_e_o_erro_de_sempre:
  {T.stateViewFix("error", "Pi não encontrado.", "", False{}, "", "", "")
    == T.stateView("error", "Pi não encontrado.", False{}, "", "", "") : V.ViewNode}

law tutorstate_conserto_vale_so_no_erro:
  {T.stateViewFix("connecting", foraDaFaixa(), "update", False{}, "", "", "")
    == T.connectingView() : V.ViewNode}

law tutorstate_conserto_vence_a_retomada:
  {T.stateViewFix("error", foraDaFaixa(), "update", True{}, "Lista 2", "travei na 3", "fazer a 4")
    == T.claudeFixView("update", foraDaFaixa()) : V.ViewNode}

law tutorstate_claude_estado_error:
  {attrOf(T.claudeFixView("update", foraDaFaixa()), "data-state") == Some{"error"} : Maybe<&2, String>}

law tutorstate_claude_marca_o_conserto:
  {attrOf(T.claudeFixView("about", foraDaFaixa()), "data-fix") == Some{"about"} : Maybe<&2, String>}

law tutorstate_claude_motivo_inteiro:
  {V.kidsOf(kidAt(kidAt(T.claudeFixView("update", foraDaFaixa()), 0n), 1n))
    == [V.viewText(foraDaFaixa())] : List<&2, V.ViewNode>}

law tutorstate_claude_tres_acoes:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(T.claudeFixView("update", foraDaFaixa()), 1n))) == 3n : Nat}

law tutorstate_claude_atualizar_na_frente:
  {at(V.kidsOf(kidAt(T.claudeFixView("update", foraDaFaixa()), 1n)), 0n)
    == T.button("state-claude-update", "ts-primary", M.msg("tutor.claude.update"), M.msg("tutor.claude.updateTitle"), "UpdateClaude") : V.ViewNode}

law tutorstate_claude_serie_nova_abre_o_sobre:
  {at(V.kidsOf(kidAt(T.claudeFixView("about", foraDaFaixa()), 1n)), 0n)
    == T.button("state-claude-about", "ts-primary", M.msg("tutor.claude.about"), M.msg("tutor.claude.aboutTitle"), "OpenAbout") : V.ViewNode}

law tutorstate_claude_chamar_de_novo:
  {at(V.kidsOf(kidAt(T.claudeFixView("update", foraDaFaixa()), 1n)), 1n)
    == T.button("connect", "ts-secondary", M.msg("tutor.retry"), M.msg("tutor.retryTitle"), "Connect") : V.ViewNode}

law tutorstate_claude_ver_log:
  {at(V.kidsOf(kidAt(T.claudeFixView("update", foraDaFaixa()), 1n)), 2n)
    == T.button("state-log", "ts-ghost", M.msg("tutor.log"), M.msg("tutor.logTitle"), "OpenLog") : V.ViewNode}
