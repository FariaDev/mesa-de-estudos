import Base
import ../agentcaps.bend as A

# ---------------------------------------------------------------------------
# Contrato das capacidades do motor (prefixo `caps_`). Cenários concretos: o
# host escolhe `piCaps`/`claudeCaps` pelo motor da conversa e consulta
# `canSteer`/`canSend`/`controlVisible`.
#
# O que não saiu (e por quê): uma lei genérica "toda capacidade de claude é
# false exceto imagens/permissões" não reduz por igualdade de lista/Data; as
# leis listam cada controle que a UI consulta. Nada aqui prova processo,
# login ou transporte — só a decisão sobre os fatos.
# ---------------------------------------------------------------------------

# ---------- fatos ----------

law caps_pi_completo:
  {A.piCaps() == A.Caps{
    True{}, True{}, True{}, True{}, True{}, True{}, True{},
    True{}, True{}, True{}, True{}, True{}, True{}
  } : A.Caps}

law caps_claude_estrutural:
  {A.claudeCaps() == A.Caps{
    True{}, True{}, False{}, False{}, False{}, False{}, False{},
    False{}, False{}, False{}, False{}, False{}, False{}
  } : A.Caps}

law caps_claude_catalogo_ausente:
  {A.claudeControlCaps(False{}, True{}) == A.claudeCaps() : A.Caps}

law caps_claude_catalogo_modelo:
  {A.controlVisible(A.claudeControlCaps(True{}, False{}), A.ControlModelSelection{}) == True{} : Bool}

law caps_claude_esforco_sem_metadado:
  {A.controlVisible(A.claudeControlCaps(True{}, False{}), A.ControlEffort{}) == False{} : Bool}

law caps_claude_esforco_com_metadado:
  {A.controlVisible(A.claudeControlCaps(True{}, True{}), A.ControlEffort{}) == True{} : Bool}

# ---------- controles visíveis ----------

law caps_claude_imagens:
  {A.controlVisible(A.claudeCaps(), A.ControlImages{}) == True{} : Bool}

law caps_claude_permissoes:
  {A.controlVisible(A.claudeCaps(), A.ControlPermissions{}) == True{} : Bool}

law caps_claude_steer:
  {A.controlVisible(A.claudeCaps(), A.ControlSteer{}) == False{} : Bool}

law caps_claude_compacto:
  {A.controlVisible(A.claudeCaps(), A.ControlCompact{}) == False{} : Bool}

law caps_claude_auto_compactacao:
  {A.controlVisible(A.claudeCaps(), A.ControlAutoCompaction{}) == False{} : Bool}

law caps_claude_modelo:
  {A.controlVisible(A.claudeCaps(), A.ControlModelSelection{}) == False{} : Bool}

law caps_claude_esforco:
  {A.controlVisible(A.claudeCaps(), A.ControlEffort{}) == False{} : Bool}

law caps_claude_rascunho:
  {A.controlVisible(A.claudeCaps(), A.ControlReviewDraft{}) == False{} : Bool}

law caps_claude_bilhete:
  {A.controlVisible(A.claudeCaps(), A.ControlHandoff{}) == False{} : Bool}

law caps_claude_comandos:
  {A.controlVisible(A.claudeCaps(), A.ControlCommands{}) == False{} : Bool}

law caps_claude_geogebra:
  {A.controlVisible(A.claudeCaps(), A.ControlGeogebra{}) == False{} : Bool}

law caps_claude_quiz:
  {A.controlVisible(A.claudeCaps(), A.ControlQuiz{}) == False{} : Bool}

law caps_claude_contexto:
  {A.controlVisible(A.claudeCaps(), A.ControlContextUsage{}) == False{} : Bool}

# Amostras do Pi: tudo ligado (o comportamento de hoje).
law caps_pi_quiz:
  {A.controlVisible(A.piCaps(), A.ControlQuiz{}) == True{} : Bool}

law caps_pi_geogebra:
  {A.controlVisible(A.piCaps(), A.ControlGeogebra{}) == True{} : Bool}

law caps_pi_contexto:
  {A.controlVisible(A.piCaps(), A.ControlContextUsage{}) == True{} : Bool}

law caps_pi_bilhete:
  {A.controlVisible(A.piCaps(), A.ControlHandoff{}) == True{} : Bool}

# ---------- steer ----------

law caps_steer_pi_ocupado:
  {A.canSteer(A.piCaps(), True{}) == True{} : Bool}

law caps_steer_pi_livre:
  {A.canSteer(A.piCaps(), False{}) == False{} : Bool}

law caps_steer_claude_ocupado:
  {A.canSteer(A.claudeCaps(), True{}) == False{} : Bool}

# ---------- enviar ----------

law caps_send_pi_livre:
  {A.canSend(A.piCaps(), False{}, False{}) == True{} : Bool}

law caps_send_pi_ocupado:
  {A.canSend(A.piCaps(), True{}, False{}) == True{} : Bool}

law caps_send_pi_imagem:
  {A.canSend(A.piCaps(), False{}, True{}) == True{} : Bool}

law caps_send_pi_imagem_ocupado:
  {A.canSend(A.piCaps(), True{}, True{}) == True{} : Bool}

law caps_send_claude_livre:
  {A.canSend(A.claudeCaps(), False{}, False{}) == True{} : Bool}

law caps_send_claude_ocupado:
  {A.canSend(A.claudeCaps(), True{}, False{}) == False{} : Bool}

# Claude aceita imagem (é uma das capacidades ligadas); ocupado continua parado.
law caps_send_claude_imagem:
  {A.canSend(A.claudeCaps(), False{}, True{}) == True{} : Bool}

law caps_send_claude_imagem_ocupado:
  {A.canSend(A.claudeCaps(), True{}, True{}) == False{} : Bool}
