import Base
import ../agentcaps.bend as A

# ---------------------------------------------------------------------------
# Contrato das capacidades do motor (prefixo `caps_`). Cenários concretos: o
# host escolhe `piCaps`/`claudeCaps`/`opencodeCaps` pelo motor da conversa (e
# `unknownCaps` para o resto) e consulta
# `canSteer`/`canSend`/`controlVisible`.
#
# O que não saiu (e por quê): uma lei genérica "toda capacidade de claude é
# false exceto imagens/permissões" não reduz por igualdade de lista/Data; as
# leis listam cada controle que a UI consulta. Nada aqui prova processo,
# login ou transporte — só a decisão sobre os fatos.
# ---------------------------------------------------------------------------

# ---------- fatos ----------

# Tudo ligado. O bilhete saiu com a Conversa (#50) e do contrato na #49.
law caps_pi_fatos:
  {A.piCaps() == A.Caps{
    True{}, True{}, True{}, True{}, True{}, True{}, True{},
    True{}, True{}, True{}, True{}, True{}
  } : A.Caps}

law caps_claude_estrutural:
  {A.claudeCaps() == A.Caps{
    True{}, True{}, True{}, True{}, False{}, False{}, False{},
    True{}, True{}, True{}, True{}, True{}
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
  {A.controlVisible(A.claudeCaps(), A.ControlSteer{}) == True{} : Bool}

law caps_claude_compacto:
  {A.controlVisible(A.claudeCaps(), A.ControlCompact{}) == True{} : Bool}

law caps_claude_auto_compactacao:
  {A.controlVisible(A.claudeCaps(), A.ControlAutoCompaction{}) == False{} : Bool}

law caps_claude_modelo:
  {A.controlVisible(A.claudeCaps(), A.ControlModelSelection{}) == False{} : Bool}

law caps_claude_esforco:
  {A.controlVisible(A.claudeCaps(), A.ControlEffort{}) == False{} : Bool}

law caps_claude_rascunho:
  {A.controlVisible(A.claudeCaps(), A.ControlReviewDraft{}) == True{} : Bool}

law caps_claude_comandos:
  {A.controlVisible(A.claudeCaps(), A.ControlCommands{}) == True{} : Bool}

law caps_claude_geogebra:
  {A.controlVisible(A.claudeCaps(), A.ControlGeogebra{}) == True{} : Bool}

law caps_claude_quiz:
  {A.controlVisible(A.claudeCaps(), A.ControlQuiz{}) == True{} : Bool}

law caps_claude_contexto:
  {A.controlVisible(A.claudeCaps(), A.ControlContextUsage{}) == True{} : Bool}

# Com o catálogo (#58): as funções do motor não dependem do catálogo de
# modelos; compactação automática continua fechada.
law caps_claude_steer_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, False{}), A.ControlSteer{}) == True{} : Bool}

law caps_claude_compacto_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, False{}), A.ControlCompact{}) == True{} : Bool}

law caps_claude_rascunho_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, False{}), A.ControlReviewDraft{}) == True{} : Bool}

law caps_claude_comandos_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, False{}), A.ControlCommands{}) == True{} : Bool}

law caps_claude_quiz_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, False{}), A.ControlQuiz{}) == True{} : Bool}

law caps_claude_contexto_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, False{}), A.ControlContextUsage{}) == True{} : Bool}

law caps_claude_imagens_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, True{}), A.ControlImages{}) == True{} : Bool}

law caps_claude_permissoes_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, True{}), A.ControlPermissions{}) == True{} : Bool}

law caps_claude_auto_compactacao_catalogo:
  {A.controlVisible(A.claudeControlCaps(True{}, True{}), A.ControlAutoCompaction{}) == False{} : Bool}

# Amostras do Pi: o comportamento de hoje.
law caps_pi_quiz:
  {A.controlVisible(A.piCaps(), A.ControlQuiz{}) == True{} : Bool}

law caps_pi_geogebra:
  {A.controlVisible(A.piCaps(), A.ControlGeogebra{}) == True{} : Bool}

law caps_pi_contexto:
  {A.controlVisible(A.piCaps(), A.ControlContextUsage{}) == True{} : Bool}

# ---------- steer ----------

law caps_steer_pi_ocupado:
  {A.canSteer(A.piCaps(), True{}) == True{} : Bool}

law caps_steer_pi_livre:
  {A.canSteer(A.piCaps(), False{}) == False{} : Bool}

law caps_steer_claude_ocupado:
  {A.canSteer(A.claudeCaps(), True{}) == True{} : Bool}

law caps_steer_claude_livre:
  {A.canSteer(A.claudeCaps(), False{}) == False{} : Bool}

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

# Com o steer (#58), ocupado passa: a mensagem entra na consulta viva.
law caps_send_claude_ocupado:
  {A.canSend(A.claudeCaps(), True{}, False{}) == True{} : Bool}

# Claude aceita imagem, inclusive no steer.
law caps_send_claude_imagem:
  {A.canSend(A.claudeCaps(), False{}, True{}) == True{} : Bool}

law caps_send_claude_imagem_ocupado:
  {A.canSend(A.claudeCaps(), True{}, True{}) == True{} : Bool}

# ---------- OpenCode (#57) ----------

law caps_opencode_estrutural:
  {A.opencodeCaps() == A.Caps{
    True{}, True{}, True{}, True{}, False{}, False{}, False{},
    False{}, True{}, True{}, True{}, True{}
  } : A.Caps}

law caps_opencode_catalogo_ausente:
  {A.opencodeControlCaps(False{}, True{}) == A.opencodeCaps() : A.Caps}

law caps_opencode_catalogo_modelo:
  {A.controlVisible(A.opencodeControlCaps(True{}, False{}), A.ControlModelSelection{}) == True{} : Bool}

law caps_opencode_esforco_sem_metadado:
  {A.controlVisible(A.opencodeControlCaps(True{}, False{}), A.ControlEffort{}) == False{} : Bool}

law caps_opencode_esforco_com_metadado:
  {A.controlVisible(A.opencodeControlCaps(True{}, True{}), A.ControlEffort{}) == True{} : Bool}

law caps_opencode_modelo_sem_catalogo:
  {A.controlVisible(A.opencodeCaps(), A.ControlModelSelection{}) == False{} : Bool}

law caps_opencode_auto_compactacao:
  {A.controlVisible(A.opencodeControlCaps(True{}, True{}), A.ControlAutoCompaction{}) == False{} : Bool}

# O rascunho não foi portado: continua fechado mesmo com o catálogo.
law caps_opencode_rascunho:
  {A.controlVisible(A.opencodeControlCaps(True{}, True{}), A.ControlReviewDraft{}) == False{} : Bool}

# Ferramentas e medidor não dependem do catálogo de modelos.
law caps_opencode_comandos_catalogo:
  {A.controlVisible(A.opencodeControlCaps(True{}, False{}), A.ControlCommands{}) == True{} : Bool}

law caps_opencode_geogebra_catalogo:
  {A.controlVisible(A.opencodeControlCaps(True{}, False{}), A.ControlGeogebra{}) == True{} : Bool}

law caps_opencode_quiz_catalogo:
  {A.controlVisible(A.opencodeControlCaps(True{}, False{}), A.ControlQuiz{}) == True{} : Bool}

law caps_opencode_contexto_catalogo:
  {A.controlVisible(A.opencodeControlCaps(True{}, False{}), A.ControlContextUsage{}) == True{} : Bool}

law caps_opencode_compacto_catalogo:
  {A.controlVisible(A.opencodeControlCaps(True{}, False{}), A.ControlCompact{}) == True{} : Bool}

law caps_steer_opencode_ocupado:
  {A.canSteer(A.opencodeCaps(), True{}) == True{} : Bool}

law caps_steer_opencode_livre:
  {A.canSteer(A.opencodeCaps(), False{}) == False{} : Bool}

law caps_send_opencode_ocupado_imagem:
  {A.canSend(A.opencodeCaps(), True{}, True{}) == True{} : Bool}

# ---------- motor desconhecido ----------

# Fora dos três motores, nada do Pi vaza: nem envio com imagem, nem steer.
law caps_desconhecido_fechado:
  {A.unknownCaps() == A.Caps{
    False{}, False{}, False{}, False{}, False{}, False{}, False{},
    False{}, False{}, False{}, False{}, False{}
  } : A.Caps}

law caps_send_desconhecido_imagem:
  {A.canSend(A.unknownCaps(), False{}, True{}) == False{} : Bool}

law caps_steer_desconhecido_ocupado:
  {A.canSteer(A.unknownCaps(), True{}) == False{} : Bool}
