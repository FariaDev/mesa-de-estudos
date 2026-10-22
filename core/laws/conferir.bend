import Base
import ../msg.bend as M
import ../conferir.bend as C
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato do Conferir com outros programas (ticket #35). Prefixo `conferir_`.
#
# Quatro garantias, nesta ordem:
#   1. o padrão de sempre fica: sem escolha salva, a Mesa procura o Xournal++
#      (as grafias do macOS e do Windows) e mais nada;
#   2. com escolha salva, só o app escolhido vale — nunca o Xournal++ no lugar;
#   3. app ausente é `ConfAbsent`: o núcleo NUNCA devolve outra janela nem a
#      tela inteira;
#   4. a Mesa, o sistema e as janelas sem tamanho de janela ficam fora, e
#      entre várias janelas do mesmo app vale a da frente (a primeira).
#
# O que o enunciado NÃO prova: a medida da janela (o host entrega `usable`),
# as minúsculas/aparo do nome (o host entrega `key`) e listar/capturar (mundo).
# Os nomes são concretos porque String.eq não reduz em String livre.
# ---------------------------------------------------------------------------

# Atalhos de construção: id, app, key, título, usable, self.
def win(id: String, app: String, key: String, title: String) -> C.ConfWin:
  C.ConfWin{id, app, key, title, True{}, False{}}

def tiny(id: String, app: String, key: String, title: String) -> C.ConfWin:
  C.ConfWin{id, app, key, title, False{}, False{}}

def mesa(id: String, app: String, key: String, title: String) -> C.ConfWin:
  C.ConfWin{id, app, key, title, True{}, True{}}

def onenote() -> C.ConfChoice:
  C.ConfChoice{"OneNote", "onenote"}

# ---------- identidade do app ----------

law conferir_padrao_xournal_macos:
  {C.defaultKey("xournal++") == True{} : Bool}

law conferir_padrao_xournal_windows:
  {C.defaultKey("xournalpp") == True{} : Bool}

law conferir_padrao_xournal_curto:
  {C.defaultKey("xournal") == True{} : Bool}

law conferir_padrao_nao_e_onenote:
  {C.defaultKey("onenote") == False{} : Bool}

law conferir_padrao_nao_e_vazio:
  {C.defaultKey("") == False{} : Bool}

law conferir_sistema_dock:
  {C.systemKey("dock") == True{} : Bool}

law conferir_sistema_central_de_controle:
  {C.systemKey("control center") == True{} : Bool}

law conferir_sistema_nao_e_onenote:
  {C.systemKey("onenote") == False{} : Bool}

# ---------- elegibilidade ----------

law conferir_elegivel_janela_normal:
  {C.eligible(win("1", "OneNote", "onenote", "Aula 3")) == True{} : Bool}

law conferir_inelegivel_sem_tamanho:
  {C.eligible(tiny("1", "OneNote", "onenote", "Aula 3")) == False{} : Bool}

law conferir_inelegivel_a_propria_mesa:
  {C.eligible(mesa("1", "Mesa de Estudos", "mesa de estudos", "Mesa")) == False{} : Bool}

law conferir_inelegivel_sem_nome_de_app:
  {C.eligible(win("1", "", "", "Aula 3")) == False{} : Bool}

law conferir_inelegivel_do_sistema:
  {C.eligible(win("1", "Dock", "dock", "")) == False{} : Bool}

law conferir_lista_so_com_elegiveis:
  {C.eligibleWins([
    win("1", "Dock", "dock", ""),
    win("2", "OneNote", "onenote", "Aula 3"),
    mesa("3", "Mesa de Estudos", "mesa de estudos", "Mesa"),
    tiny("4", "Krita", "krita", "x"),
    win("5", "Krita", "krita", "Esboço")
  ]) == [win("2", "OneNote", "onenote", "Aula 3"), win("5", "Krita", "krita", "Esboço")] : List<&2, C.ConfWin>}

# ---------- o padrão: sem escolha salva ----------

law conferir_sem_escolha_acha_o_xournal_macos:
  {C.decide([
    win("10", "Preview", "preview", "Lista.pdf"),
    win("11", "Xournal++", "xournal++", "Lista 3 - Xournal++")
  ], None{}) == C.ConfCapture{"11", "Xournal++", "Lista 3 - Xournal++"} : C.ConfDecision}

# No Windows o app é o processo `xournalpp`; o nome para mostrar é um só.
law conferir_sem_escolha_acha_o_xournal_windows:
  {C.decide([
    win("20", "xournalpp", "xournalpp", "Lista 3")
  ], None{}) == C.ConfCapture{"20", "Xournal++", "Lista 3"} : C.ConfDecision}

# Sem o Xournal++ e sem escolha: ausente, e nunca outra janela no lugar.
law conferir_sem_escolha_e_sem_xournal_nao_captura_outra:
  {C.decide([
    win("10", "OneNote", "onenote", "Aula 3"),
    win("11", "Preview", "preview", "Lista.pdf")
  ], None{}) == C.ConfAbsent{"Xournal++", False{}} : C.ConfDecision}

law conferir_sem_janelas_e_ausente:
  {C.decide([], None{}) == C.ConfAbsent{"Xournal++", False{}} : C.ConfDecision}

# ---------- escolha salva ----------

law conferir_escolha_presente_vence_o_xournal:
  {C.decide([
    win("30", "Xournal++", "xournal++", "Lista 3"),
    win("31", "OneNote", "onenote", "Aula 3")
  ], Some{onenote()}) == C.ConfCapture{"31", "OneNote", "Aula 3"} : C.ConfDecision}

# O app salvo está ausente: diz isso, marca que há escolha salva e não cai no
# Xournal++ (que está aberto).
law conferir_escolha_ausente_nao_cai_no_xournal:
  {C.decide([
    win("30", "Xournal++", "xournal++", "Lista 3")
  ], Some{onenote()}) == C.ConfAbsent{"OneNote", True{}} : C.ConfDecision}

law conferir_escolha_sem_janelas_e_ausente:
  {C.decide([], Some{onenote()}) == C.ConfAbsent{"OneNote", True{}} : C.ConfDecision}

# Escolher o próprio Xournal++ também vale (volta ao padrão pela escolha).
law conferir_escolha_xournal_vale:
  {C.decide([
    win("30", "Xournal++", "xournal++", "Lista 3")
  ], Some{C.ConfChoice{"Xournal++", "xournal++"}}) == C.ConfCapture{"30", "Xournal++", "Lista 3"} : C.ConfDecision}

# ---------- várias janelas, a Mesa e o sistema ----------

# Várias janelas do mesmo app: a da frente (a primeira da lista).
law conferir_varias_janelas_vale_a_da_frente:
  {C.decide([
    win("40", "OneNote", "onenote", "Aula 3"),
    win("41", "OneNote", "onenote", "Aula 2")
  ], Some{onenote()}) == C.ConfCapture{"40", "OneNote", "Aula 3"} : C.ConfDecision}

# O mesmo vale para o Xournal++ sem escolha (antes era um erro).
law conferir_varias_janelas_do_xournal_vale_a_da_frente:
  {C.decide([
    win("40", "Xournal++", "xournal++", "Lista 3"),
    win("41", "Xournal++", "xournal++", "Lista 2")
  ], None{}) == C.ConfCapture{"40", "Xournal++", "Lista 3"} : C.ConfDecision}

# A janela da frente sem tamanho de janela não conta: vale a próxima do app.
law conferir_pula_janela_sem_tamanho:
  {C.decide([
    tiny("40", "OneNote", "onenote", ""),
    win("41", "OneNote", "onenote", "Aula 2")
  ], Some{onenote()}) == C.ConfCapture{"41", "OneNote", "Aula 2"} : C.ConfDecision}

# A Mesa na lista fica fora, mesmo que a escolha salva seja o nome dela.
law conferir_a_mesa_fica_fora:
  {C.decide([
    mesa("50", "Mesa de Estudos", "mesa de estudos", "Mesa")
  ], Some{C.ConfChoice{"Mesa de Estudos", "mesa de estudos"}}) == C.ConfAbsent{"Mesa de Estudos", True{}} : C.ConfDecision}

law conferir_a_mesa_nao_atrapalha_o_xournal:
  {C.decide([
    mesa("50", "Mesa de Estudos", "mesa de estudos", "Mesa"),
    win("51", "Xournal++", "xournal++", "Lista 3")
  ], None{}) == C.ConfCapture{"51", "Xournal++", "Lista 3"} : C.ConfDecision}

# Janela do sistema nunca é capturada, nem por escolha salva.
law conferir_sistema_nunca_e_capturado:
  {C.decide([
    win("60", "Dock", "dock", "")
  ], Some{C.ConfChoice{"Dock", "dock"}}) == C.ConfAbsent{"Dock", True{}} : C.ConfDecision}

# ---------- rótulos e textos ----------

law conferir_rotulo_padrao:
  {C.buttonLabel(C.defaultApp()) == M.msg1("check.label", "app", "Xournal++") : String}

law conferir_rotulo_onenote:
  {C.buttonLabel("OneNote") == M.msg1("check.label", "app", "OneNote") : String}

law conferir_rotulo_curto:
  {C.shortLabel() == M.msg("check.short") : String}

law conferir_dica_padrao_mantem_a_redacao:
  {C.buttonHint("Xournal++", "⌘⇧C") == M.msg1("check.hint.default", "shortcut", "⌘⇧C") : String}

law conferir_dica_do_app_escolhido:
  {C.buttonHint("OneNote", "⌘⇧C") == M.msg2("check.hint.app", "app", "OneNote", "shortcut", "⌘⇧C") : String}

law conferir_anexada:
  {C.attachedText("OneNote") == M.msg1("check.attached.app", "app", "OneNote") : String}

law conferir_anexada_padrao_mantem_a_redacao:
  {C.attachedText("Xournal++") == M.msg("check.attached.default") : String}

law conferir_ausente_padrao_mantem_a_frase:
  {C.absentText("Xournal++", False{}) == M.msg("check.absent.default") : String}

law conferir_ausente_escolhido_nomeia_o_app:
  {C.absentText("OneNote", True{}) == M.msg1("check.absent.app", "app", "OneNote") : String}

law conferir_titulo_vazio_vira_rotulo:
  {C.titleOrUntitled("   ") == M.msg("conferir.untitled") : String}

law conferir_titulo_e_aparado:
  {C.titleOrUntitled("  Aula 3 ") == "Aula 3" : String}

# ---------- o seletor ----------

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

# O botão de uma janela: handler `Pick` e o id da janela como chave.
law conferir_linha_aciona_pick:
  {V.attrGet(V.attrsOf(kidAt(C.row(win("77", "OneNote", "onenote", "Aula 3")), 0n)), "on:click") == Some{"Pick"} : Maybe<&2, String>}

law conferir_linha_leva_o_id_da_janela:
  {V.attrGet(V.attrsOf(kidAt(C.row(win("77", "OneNote", "onenote", "Aula 3")), 0n)), "key") == Some{"77"} : Maybe<&2, String>}

# A lista vazia mostra a frase, não um painel em branco.
law conferir_lista_vazia_tem_frase:
  {C.rowsOrEmpty([]) == [C.emptyItem()] : List<&2, V.ViewNode>}


# ---------- a escolha nas Configurações (ticket #38) ----------

law conferir_campo_rotulo:
  {C.fieldLabel() == M.msg("conferir.fieldLabel") : String}

law conferir_campo_botao_escolher:
  {C.chooseLabel() == M.msg("conferir.choose") : String}

law conferir_campo_legenda:
  {C.fieldHint() == M.msg("conferir.fieldHint") : String}

law conferir_campo_legenda_sem_captura_diz_o_motivo:
  {C.fieldHintFor(False{}) == M.msg("conferir.unavailable") : String}

law conferir_campo_legenda_com_captura_e_a_de_sempre:
  {C.fieldHintFor(True{}) == C.fieldHint() : String}

# O campo: rótulo, a linha (programa, Escolher…, Voltar) e a legenda.
def fieldRow(app: String, back: Bool, available: Bool) -> V.ViewNode:
  kidAt(C.fieldView(app, back, available), 1n)

law conferir_campo_mostra_o_programa_de_agora:
  {V.textOf(kidAt(kidAt(fieldRow("OneNote", True{}, True{}), 0n), 0n)) == "OneNote" : String}

law conferir_campo_escolher_aciona_choose:
  {V.attrGet(V.attrsOf(kidAt(fieldRow("Xournal++", False{}, True{}), 1n)), "on:click") == Some{"Choose"} : Maybe<&2, String>}

law conferir_campo_escolher_habilitado_com_captura:
  {V.attrGet(V.attrsOf(kidAt(fieldRow("Xournal++", False{}, True{}), 1n)), "disabled") == None{} : Maybe<&2, String>}

law conferir_campo_escolher_desabilitado_sem_captura:
  {V.attrGet(V.attrsOf(kidAt(fieldRow("Xournal++", False{}, False{}), 1n)), "disabled") == Some{""} : Maybe<&2, String>}

# "Voltar ao Xournal++" só aparece com outro programa escolhido.
law conferir_campo_voltar_some_sem_escolha:
  {V.attrGet(V.attrsOf(kidAt(fieldRow("Xournal++", False{}, True{}), 2n)), "hidden") == Some{""} : Maybe<&2, String>}

law conferir_campo_voltar_aparece_com_escolha:
  {V.attrGet(V.attrsOf(kidAt(fieldRow("OneNote", True{}, True{}), 2n)), "hidden") == None{} : Maybe<&2, String>}

law conferir_campo_voltar_aciona_back:
  {V.attrGet(V.attrsOf(kidAt(fieldRow("OneNote", True{}, True{}), 2n)), "on:click") == Some{"Back"} : Maybe<&2, String>}

law conferir_campo_voltar_diz_xournal:
  {V.textOf(kidAt(kidAt(fieldRow("OneNote", True{}, True{}), 2n), 0n)) == M.msg("conferir.back") : String}

# A lista que o Escolher… abre: uma linha por janela elegível e Atualizar.
law conferir_lista_so_tem_atualizar_no_pe:
  {V.attrGet(V.attrsOf(kidAt(kidAt(C.listView("x", []), 2n), 0n)), "on:click") == Some{"Refresh"} : Maybe<&2, String>}

law conferir_lista_traz_a_explicacao:
  {V.textOf(kidAt(kidAt(C.listView("explicação", []), 0n), 0n)) == "explicação" : String}

# ---------- app ausente: a frase e a ação ----------

law conferir_ausente_lead_e_so_a_frase_padrao:
  {C.absentLead("Xournal++", False{}) == M.msg("check.absent.default") : String}

law conferir_ausente_lead_e_so_a_frase_escolhido:
  {C.absentLead("OneNote", True{}) == M.msg1("check.absent.app", "app", "OneNote") : String}

law conferir_ausente_acao_e_escolher_outro_programa:
  {C.chooseOtherLabel() == M.msg("conferir.chooseOther") : String}

law conferir_ausente_mostra_a_frase:
  {V.textOf(kidAt(kidAt(C.absentView("OneNote", True{}), 0n), 0n)) == M.msg1("check.absent.app", "app", "OneNote") : String}

law conferir_ausente_botao_aciona_choose_other:
  {V.attrGet(V.attrsOf(kidAt(C.absentView("OneNote", True{}), 1n)), "on:click") == Some{"ChooseOther"} : Maybe<&2, String>}

law conferir_ausente_botao_diz_escolher_outro_programa:
  {V.textOf(kidAt(kidAt(C.absentView("OneNote", True{}), 1n), 0n)) == M.msg("conferir.chooseOther") : String}

# ---------- travado durante a resposta (#42) ----------

# Ocupado, a dica diz por que o botão não age — vale para qualquer programa.
law conferir_ocupado_diz_o_motivo:
  for app: String
  {C.hintFor(True{}, app, "⌘⇧C") == M.msg("check.busy") : String}

# Livre, a dica é a de sempre.
law conferir_livre_dica_de_sempre:
  {C.hintFor(False{}, "Xournal++", "⌘⇧C") == M.msg1("check.hint.default", "shortcut", "⌘⇧C") : String}

law conferir_livre_dica_do_programa:
  {C.hintFor(False{}, "OneNote", "⌘⇧C") == M.msg2("check.hint.app", "app", "OneNote", "shortcut", "⌘⇧C") : String}
