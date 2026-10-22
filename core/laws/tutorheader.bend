import Base
import ../msg.bend as M
import ../tutorheader.bend as H
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato dos menus do cabeçalho do tutor (ticket #13 da spec de redesenho).
# Prefixo `tutor_`.
#
# O cabeçalho é uma linha de 40px: título da sessão, botão do chat lateral,
# sessão nova e mais opções. O título e os três botões são do `index.html`; o
# que o núcleo decide são os dois menus que abrem dali:
#   - sessão nova: o motor padrão e o Claude (experimental), nessa ordem;
#     a sessão que já está aberta nunca troca de motor (o host só cria);
#   - mais opções: exportar em Markdown, Encerrar por hoje, o uso de contexto,
#     a compactação automática e recolher o tutor, nessa ordem. O Encerrar por
#     hoje some só pela flag `desk.endDay`.
#
# O que não cabe aqui: medir, abrir, enviar. Cada item só nomeia o handler; o
# host decide o que acontece e revalida a ação no IPC.
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

# ---------- o cabeçalho (#42) ----------

# Título, chat lateral, sessão nova e Mais opções — o indicador de modelo e
# esforço não mora mais aqui (foi para a caixa de mensagem).
law tutor_cabecalho_controles:
  {H.headIds() == ["session-title", "sidechat-toggle", "new-session", "chat-more"] : List<&2, String>}

law tutor_cabecalho_quatro_controles:
  {List.length(&2, String, H.headIds()) == 4n : Nat}

# ---------- sessão nova ----------

# O motor padrão primeiro, o Claude (experimental) depois e o OpenCode (#57) por último.
law tutor_nova_sessao_tres_itens:
  {List.length(&2, V.ViewNode, H.newSessionItems()) == 3n : Nat}

law tutor_nova_sessao_ordem:
  {H.newSessionItems() == [H.newSessionDefault(), H.newSessionClaude(), H.newSessionOpenCode()] : List<&2, V.ViewNode>}

law tutor_nova_sessao_padrao_rotulo:
  {V.kidsOf(H.newSessionDefault()) == [V.viewText(M.msg("header.newSession"))] : List<&2, V.ViewNode>}

law tutor_nova_sessao_padrao_clique:
  {V.attrGet(V.attrsOf(H.newSessionDefault()), "on:click") == Some{"NewSession"} : Maybe<&2, String>}

# O rótulo diz o motor e que é experimental (vocabulário do `CONTEXT.md`).
law tutor_nova_sessao_claude_rotulo:
  {V.kidsOf(H.newSessionClaude())
    == [V.viewText(M.msg("header.newSessionClaude"))] : List<&2, V.ViewNode>}

law tutor_nova_sessao_claude_clique:
  {V.attrGet(V.attrsOf(H.newSessionClaude()), "on:click") == Some{"NewSessionClaude"} : Maybe<&2, String>}

# Os dois cliques acima fixam handlers diferentes: escolher o motor é o único
# papel do item.

law tutor_nova_sessao_ids_estaveis:
  {V.attrGet(V.attrsOf(H.newSessionDefault()), "id") == Some{"new-session-default"} : Maybe<&2, String>}

law tutor_nova_sessao_claude_id:
  {V.attrGet(V.attrsOf(H.newSessionClaude()), "id") == Some{"new-session-claude"} : Maybe<&2, String>}

law tutor_nova_sessao_opencode_rotulo:
  {V.kidsOf(H.newSessionOpenCode())
    == [V.viewText(M.msg("header.newSessionOpenCode"))] : List<&2, V.ViewNode>}

law tutor_nova_sessao_opencode_clique:
  {V.attrGet(V.attrsOf(H.newSessionOpenCode()), "on:click") == Some{"NewSessionOpenCode"} : Maybe<&2, String>}

law tutor_nova_sessao_opencode_id:
  {V.attrGet(V.attrsOf(H.newSessionOpenCode()), "id") == Some{"new-session-opencode"} : Maybe<&2, String>}

# ---------- mais opções ----------

# Seis itens, na ordem em que o usuário os procura.
law tutor_mais_seis_itens:
  for endDay: Bool
  {List.length(&2, V.ViewNode, H.moreItems(endDay)) == 6n : Nat}

law tutor_mais_ordem:
  for endDay: Bool
  {H.moreItems(endDay)
    == [ H.exportItem()
       , H.endDayItem(endDay)
       , H.contextRow()
       , H.autoCompactItem()
       , H.compactNowItem()
       , H.collapseItem()
       ] : List<&2, V.ViewNode>}

law tutor_exportar_id:
  {V.attrGet(V.attrsOf(H.exportItem()), "id") == Some{"export-chat"} : Maybe<&2, String>}

law tutor_exportar_rotulo:
  {V.kidsOf(H.exportItem()) == [V.viewText(M.msg("header.export"))] : List<&2, V.ViewNode>}

law tutor_exportar_clique:
  {V.attrGet(V.attrsOf(H.exportItem()), "on:click") == Some{"ExportSession"} : Maybe<&2, String>}

law tutor_encerrar_id:
  for endDay: Bool
  {V.attrGet(V.attrsOf(H.endDayItem(endDay)), "id") == Some{"end-day"} : Maybe<&2, String>}

law tutor_encerrar_rotulo:
  for endDay: Bool
  {V.kidsOf(H.endDayItem(endDay)) == [V.viewText(M.msg("header.endDay"))] : List<&2, V.ViewNode>}

law tutor_encerrar_clique:
  for endDay: Bool
  {V.attrGet(V.attrsOf(H.endDayItem(endDay)), "on:click") == Some{"OpenEndDay"} : Maybe<&2, String>}

# A flag `desk.endDay` é o único motivo para o item sumir.
law tutor_encerrar_visivel:
  {V.attrGet(V.attrsOf(H.endDayItem(True{})), "hidden") == None{} : Maybe<&2, String>}

law tutor_encerrar_oculto:
  {V.attrGet(V.attrsOf(H.endDayItem(False{})), "hidden") == Some{""} : Maybe<&2, String>}

# Nenhum outro item de Mais opções some por flag.
law tutor_demais_itens_sempre_visiveis:
  {V.attrGet(V.attrsOf(H.exportItem()), "hidden") == None{} : Maybe<&2, String>}

law tutor_recolher_id:
  {V.attrGet(V.attrsOf(H.collapseItem()), "id") == Some{"chat-collapse"} : Maybe<&2, String>}

law tutor_recolher_rotulo:
  {V.kidsOf(H.collapseItem()) == [V.viewText(M.msg("header.collapse"))] : List<&2, V.ViewNode>}

law tutor_recolher_clique:
  {V.attrGet(V.attrsOf(H.collapseItem()), "on:click") == Some{"ToggleTutor"} : Maybe<&2, String>}

# A compactação automática é um interruptor: papel e estado próprios.
law tutor_compactacao_id:
  {V.attrGet(V.attrsOf(H.autoCompactItem()), "id") == Some{"more-auto-compact"} : Maybe<&2, String>}

law tutor_compactacao_papel:
  {V.attrGet(V.attrsOf(H.autoCompactItem()), "role") == Some{"menuitemcheckbox"} : Maybe<&2, String>}

law tutor_compactacao_desligada_por_padrao:
  {V.attrGet(V.attrsOf(H.autoCompactItem()), "aria-checked") == Some{"false"} : Maybe<&2, String>}

law tutor_compactacao_clique:
  {V.attrGet(V.attrsOf(H.autoCompactItem()), "on:click") == Some{"ToggleAutoCompact"} : Maybe<&2, String>}

# O uso de contexto não é botão: o host põe o medidor vivo no encaixe.
law tutor_contexto_encaixe:
  {V.tagOf(H.contextRow()) == "div" : String}

law tutor_contexto_id:
  {V.attrGet(V.attrsOf(H.contextRow()), "id") == Some{"more-context"} : Maybe<&2, String>}

# Resumir agora é a ação manual que saiu do painel "Contexto da sessão".
law tutor_resumir_id:
  {V.attrGet(V.attrsOf(H.compactNowItem()), "id") == Some{"more-compact-now"} : Maybe<&2, String>}

law tutor_resumir_rotulo:
  {V.kidsOf(H.compactNowItem()) == [V.viewText(M.msg("header.compactNow"))] : List<&2, V.ViewNode>}

law tutor_resumir_clique:
  {V.attrGet(V.attrsOf(H.compactNowItem()), "on:click") == Some{"CompactNow"} : Maybe<&2, String>}

# Não some por flag: quem a desliga pela capacidade do motor é o host.
law tutor_resumir_sempre_visivel:
  {V.attrGet(V.attrsOf(H.compactNowItem()), "hidden") == None{} : Maybe<&2, String>}

# ---------- itens são botões de menu, nunca submit ----------

law tutor_itens_nao_enviam_formulario:
  {V.attrGet(V.attrsOf(H.exportItem()), "type") == Some{"button"} : Maybe<&2, String>}

law tutor_itens_papel_menuitem:
  {V.attrGet(V.attrsOf(H.exportItem()), "role") == Some{"menuitem"} : Maybe<&2, String>}

# Cada ação de menu leva o glifo do host em `data-icon` (o host injeta o SVG).
law tutor_itens_com_icone:
  {V.attrGet(V.attrsOf(H.exportItem()), "data-icon") == Some{"download"} : Maybe<&2, String>}

# ---------- indicador de modelo e esforço (ticket #14) ----------
#
# Um botão no cabeçalho do tutor diz o modelo e o esforço em uso e abre o
# popover onde se trocam. O ponto de conexão e os dois `<select>` são nós
# vivos do host; o núcleo decide o texto, o rótulo acessível e o aviso.

# Ligado, com modelo e esforço: "modelo · esforço", o esforço em palavra curta.
law tutor_indicador_modelo_e_esforco:
  {H.indicatorLabel(True{}, "Tutor ligado", "Sonnet", "medium")
    == M.msg2("indicator.pair", "model", "Sonnet", "level", "level.medium") : String}

# O prefixo "Claude " é ruído no cabeçalho; o provedor nunca entra.
law tutor_indicador_sem_prefixo_claude:
  {H.indicatorLabel(True{}, "Tutor ligado", "Claude Sonnet 4.5", "high")
    == M.msg2("indicator.pair", "model", "Sonnet 4.5", "level", "level.high") : String}

law tutor_indicador_esforco_muito_alto:
  {H.indicatorLabel(True{}, "Tutor ligado", "Opus", "xhigh")
    == M.msg2("indicator.pair", "model", "Opus", "level", "level.xhigh") : String}

law tutor_indicador_esforco_padrao:
  {H.indicatorLabel(True{}, "Tutor ligado", "Sonnet", "default")
    == M.msg2("indicator.pair", "model", "Sonnet", "level", "level.default") : String}

# Esforço que o núcleo não conhece segue como veio (nunca some em silêncio).
law tutor_indicador_esforco_desconhecido:
  {H.indicatorLabel(True{}, "Tutor ligado", "Sonnet", "ultra")
    == M.msg2("indicator.pair", "model", "Sonnet", "level", "ultra") : String}

# Só o modelo ou só o esforço: nenhum separador sobra.
law tutor_indicador_so_modelo:
  {H.indicatorLabel(True{}, "Tutor ligado", "Sonnet", "") == "Sonnet" : String}

law tutor_indicador_so_esforco:
  {H.indicatorLabel(True{}, "Tutor ligado", "", "high")
    == M.msg1("indicator.level", "level", "level.high") : String}

# Ligado sem nada conhecido: diz o estado.
law tutor_indicador_ligado_sem_fatos:
  {H.indicatorLabel(True{}, "Tutor ligado", "", "") == "Tutor ligado" : String}

# Desligado (ou ligando, ou sem resposta): diz o estado, nunca o modelo antigo.
law tutor_indicador_desligado_diz_o_estado:
  {H.indicatorLabel(False{}, "Tutor desligado", "Sonnet", "medium") == "Tutor desligado" : String}

law tutor_indicador_ligando_diz_o_estado:
  {H.indicatorLabel(False{}, "Chamando o tutor", "Sonnet", "medium") == "Chamando o tutor" : String}

law tutor_indicador_sem_resposta_diz_o_estado:
  {H.indicatorLabel(False{}, "Tutor sem resposta", "", "") == "Tutor sem resposta" : String}

# O rótulo do ponto de conexão sem texto do host: ligado × desligado.
law tutor_rotulo_do_ponto_ligado:
  {H.linkLabel(True{}) == M.msg("tutor.link.on") : String}

law tutor_rotulo_do_ponto_desligado:
  {H.linkLabel(False{}) == M.msg("tutor.link.off") : String}

# Sem rótulo de estado, o indicador ainda diz "desligado".
law tutor_indicador_sem_rotulo_cai_em_desligado:
  {H.indicatorLabel(False{}, "", "", "") == M.msg("tutor.link.off") : String}

# O indicador é um botão que abre o popover; o texto é o do rótulo.
law tutor_indicador_id:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium")), "id")
    == Some{"model-indicator"} : Maybe<&2, String>}

law tutor_indicador_nao_envia_formulario:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium")), "type")
    == Some{"button"} : Maybe<&2, String>}

law tutor_indicador_clique:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium")), "on:click")
    == Some{"ToggleModelPop"} : Maybe<&2, String>}

law tutor_indicador_controla_o_popover:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium")), "aria-controls")
    == Some{"model-pop"} : Maybe<&2, String>}

law tutor_indicador_abre_dialogo:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium")), "aria-haspopup")
    == Some{"dialog"} : Maybe<&2, String>}

law tutor_indicador_estado_ligado:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium")), "data-state")
    == Some{"on"} : Maybe<&2, String>}

law tutor_indicador_estado_desligado:
  {V.attrGet(V.attrsOf(H.indicator(False{}, "Tutor desligado", "", "")), "data-state")
    == Some{"off"} : Maybe<&2, String>}

# O estado do ponto nunca depende do modelo: só de estar ligado.
law tutor_indicador_estado_so_do_ligado:
  for online: Bool
  {V.attrGet(V.attrsOf(H.indicator(online, "x", "Sonnet", "medium")), "data-state")
    == Some{H.indicatorState(online)} : Maybe<&2, String>}

# O rótulo acessível diz que o tutor está ligado e o que foi escolhido; o balão
# (`data-tip`) repete o mesmo texto.
law tutor_indicador_rotulo_ligado:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium")), "aria-label")
    == Some{M.msg2("indicator.hint.pair", "model", "Sonnet", "level", "level.medium")} : Maybe<&2, String>}

law tutor_indicador_rotulo_desligado:
  {V.attrGet(V.attrsOf(H.indicator(False{}, "Tutor desligado", "Sonnet", "medium")), "aria-label")
    == Some{M.msg1("indicator.hint.status", "status", "Tutor desligado")} : Maybe<&2, String>}

# Sem rótulo do host, o aviso do desligado vem do catálogo.
law tutor_indicador_rotulo_desligado_sem_rotulo:
  {V.attrGet(V.attrsOf(H.indicator(False{}, "", "", "")), "aria-label")
    == Some{M.msg("indicator.hint.off")} : Maybe<&2, String>}

# Só o modelo, ou só o esforço: a dica fala do que há.
law tutor_indicador_rotulo_so_modelo:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "")), "aria-label")
    == Some{M.msg1("indicator.hint.model", "model", "Sonnet")} : Maybe<&2, String>}

law tutor_indicador_rotulo_so_esforco:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "", "high")), "aria-label")
    == Some{M.msg1("indicator.hint.level", "level", "level.high")} : Maybe<&2, String>}

law tutor_indicador_balao_igual_ao_rotulo:
  {V.attrGet(V.attrsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium")), "data-tip")
    == Some{M.msg2("indicator.hint.pair", "model", "Sonnet", "level", "level.medium")} : Maybe<&2, String>}

# O texto visível é um único filho: modelo e esforço em duas partes, para o
# esforço ceder primeiro em coluna estreita (#27).
law tutor_indicador_texto:
  {V.kidsOf(H.indicator(True{}, "Tutor ligado", "Sonnet", "medium"))
    == [V.viewEl("span", [V.attrClass("mi-text")], [
         V.viewEl("span", [V.attrClass("mi-model")], [V.viewText("Sonnet")]),
         V.viewEl("span", [V.attrClass("mi-level")], [V.viewText(" · "), V.viewText(M.msg1("indicator.level", "level", "level.medium"))])
       ])] : List<&2, V.ViewNode>}

# Sem esforço conhecido só o modelo aparece, sem separador solto.
law tutor_indicador_texto_so_modelo:
  {V.kidsOf(H.indicator(True{}, "Tutor ligado", "Claude Sonnet 4.5", ""))
    == [V.viewEl("span", [V.attrClass("mi-text")], [
         V.viewEl("span", [V.attrClass("mi-model")], [V.viewText("Sonnet 4.5")]),
         V.viewEl("span", [V.attrClass("mi-level")], Nil{})
       ])] : List<&2, V.ViewNode>}

# Sem modelo o esforço ocupa a parte do modelo (nunca fica só o separador).
law tutor_indicador_texto_so_esforco:
  {V.kidsOf(H.indicator(True{}, "Tutor ligado", "", "high"))
    == [V.viewEl("span", [V.attrClass("mi-text")], [
         V.viewEl("span", [V.attrClass("mi-model")], [V.viewText(M.msg1("indicator.level", "level", "level.high"))]),
         V.viewEl("span", [V.attrClass("mi-level")], Nil{})
       ])] : List<&2, V.ViewNode>}

# Desligado o indicador fala do estado do tutor, em um texto só.
law tutor_indicador_desligado_texto:
  {V.kidsOf(H.indicator(False{}, "Tutor desligado", "Sonnet", "medium"))
    == [V.viewEl("span", [V.attrClass("mi-text")], [
         V.viewEl("span", [V.attrClass("mi-model")], [V.viewText("Tutor desligado")])
       ])] : List<&2, V.ViewNode>}

# ---------- aviso do popover ----------

# Ligado e com o que escolher: o aviso some (os campos aparecem).
law tutor_aviso_some_quando_escolhe:
  for connecting: Bool
  {V.attrGet(V.attrsOf(H.popNote(True{}, connecting, True{}, "Tutor ligado")), "hidden")
    == Some{""} : Maybe<&2, String>}

# Desligado: o aviso aparece, qualquer que seja o estado da escolha.
law tutor_aviso_aparece_desligado:
  for canPick: Bool
  {V.attrGet(V.attrsOf(H.popNote(False{}, False{}, canPick, "Tutor desligado")), "hidden")
    == None{} : Maybe<&2, String>}

# Ligado num motor que não troca nada: o aviso aparece em vez de uma lista vazia.
law tutor_aviso_aparece_sem_escolha:
  {V.attrGet(V.attrsOf(H.popNote(True{}, False{}, False{}, "Tutor ligado")), "hidden")
    == None{} : Maybe<&2, String>}

# Enquanto o tutor liga, o botão de chamar some (não se chama duas vezes).
law tutor_aviso_chamar_some_ligando:
  {V.attrGet(V.attrsOf(kidAt(H.popNote(False{}, True{}, True{}, "Chamando o tutor"), 2n)), "hidden")
    == Some{""} : Maybe<&2, String>}

law tutor_aviso_chamar_visivel_desligado:
  {V.attrGet(V.attrsOf(kidAt(H.popNote(False{}, False{}, True{}, "Tutor desligado"), 2n)), "hidden")
    == None{} : Maybe<&2, String>}

law tutor_aviso_chamar_clique:
  {V.attrGet(V.attrsOf(kidAt(H.popNote(False{}, False{}, True{}, "Tutor desligado"), 2n)), "on:click")
    == Some{"ConnectTutor"} : Maybe<&2, String>}

# O aviso diz o estado do tutor e o que fazer.
law tutor_aviso_texto_desligado:
  {V.kidsOf(kidAt(H.popNote(False{}, False{}, True{}, "Tutor desligado"), 0n))
    == [V.viewText("Tutor desligado")] : List<&2, V.ViewNode>}

law tutor_aviso_orienta_desligado:
  {V.kidsOf(kidAt(H.popNote(False{}, False{}, True{}, "Tutor desligado"), 1n))
    == [V.viewText(M.msg("popnote.offBody"))] : List<&2, V.ViewNode>}

law tutor_aviso_orienta_motor_fixo:
  {V.kidsOf(kidAt(H.popNote(True{}, False{}, False{}, "Tutor ligado"), 1n))
    == [V.viewText(M.msg("popnote.fixedBody"))] : List<&2, V.ViewNode>}

# Ligado num motor fixo: o botão de chamar nunca aparece (já está ligado).
law tutor_aviso_motor_fixo_sem_chamar:
  {V.attrGet(V.attrsOf(kidAt(H.popNote(True{}, False{}, False{}, "Tutor ligado"), 2n)), "hidden")
    == Some{""} : Maybe<&2, String>}

# O nome da sessão (#27): assunto vence; sem assunto, a data e a hora distinguem
# duas sessões; sem nada, "Sessão".
law sessao_nome_assunto:
  {H.sessionName("Limites laterais", "10/10, 13:27") == "Limites laterais" : String}

law sessao_nome_sem_assunto_traz_a_data:
  {H.sessionName("", "10/10, 13:27") == M.msg1("session.dated", "when", "10/10, 13:27") : String}

law sessao_nome_duas_sem_assunto_diferem:
  {Bool.not(String.eq(H.sessionName("", "10/10, 13:27"), H.sessionName("", "10/10, 13:41"))) == True{} : Bool}

law sessao_nome_sem_nada:
  {H.sessionName("", "") == M.msg("session.untitled") : String}
