import Base
import ../agentdelivery.bend as D

# ---------------------------------------------------------------------------
# Contrato da entrega do motor (prefixo `agentdelivery_`). Cenários concretos
# com os Bools que o host resolve; a lei fixa:
#   - aceite comprovado domina "pode ter enviado";
#   - sem aceite, só "pode ter enviado" vira incerto (o resto é recusa);
#   - reenvio automático só na recusa;
#   - a fila não anda com execução/permissão/incerteza/cancelamento;
#   - começar exige ocioso e sem incerteza.
#
# O que não sai (e por quê): uma lei genérica `outcome(accepted, may)` com
# Bools simbólicos não reduz (Bool.and decide pelo primeiro lado); o teste do
# I/O real (escrita, stream, processo) é do host — aqui só a decisão.
# ---------------------------------------------------------------------------

# ---------- veredito ----------

# Aceite vence "pode ter enviado": não vira incerto.
law agentdelivery_aceite_domina:
  {D.outcome(True{}, True{}) == D.DeliveryOutcome.Accepted{} : D.DeliveryOutcome}

law agentdelivery_aceite_sem_envio:
  {D.outcome(True{}, False{}) == D.DeliveryOutcome.Accepted{} : D.DeliveryOutcome}

# Sem aceite, "pode ter enviado" é a única porta da incerteza.
law agentdelivery_incerto:
  {D.outcome(False{}, True{}) == D.DeliveryOutcome.Uncertain{} : D.DeliveryOutcome}

law agentdelivery_recusa:
  {D.outcome(False{}, False{}) == D.DeliveryOutcome.Refused{} : D.DeliveryOutcome}

# ---------- reenvio ----------

law agentdelivery_retry_recusa:
  {D.mayRetry(D.DeliveryOutcome.Refused{}) == True{} : Bool}

law agentdelivery_retry_incerto:
  {D.mayRetry(D.DeliveryOutcome.Uncertain{}) == False{} : Bool}

law agentdelivery_retry_aceito:
  {D.mayRetry(D.DeliveryOutcome.Accepted{}) == False{} : Bool}

# ---------- fila ----------

law agentdelivery_fila_livre:
  {D.mayAdvanceQueue(False{}, False{}, False{}, False{}) == True{} : Bool}

law agentdelivery_fila_ocupada:
  {D.mayAdvanceQueue(True{}, False{}, False{}, False{}) == False{} : Bool}

law agentdelivery_fila_permissao:
  {D.mayAdvanceQueue(False{}, True{}, False{}, False{}) == False{} : Bool}

law agentdelivery_fila_incerta:
  {D.mayAdvanceQueue(False{}, False{}, True{}, False{}) == False{} : Bool}

law agentdelivery_fila_cancelada:
  {D.mayAdvanceQueue(False{}, False{}, False{}, True{}) == False{} : Bool}

law agentdelivery_fila_parada_total:
  {D.mayAdvanceQueue(True{}, True{}, True{}, True{}) == False{} : Bool}

# ---------- começar ----------

law agentdelivery_comecar_livre:
  {D.canBegin(False{}, False{}) == True{} : Bool}

law agentdelivery_comecar_ocupado:
  {D.canBegin(True{}, False{}) == False{} : Bool}

law agentdelivery_comecar_incerto:
  {D.canBegin(False{}, True{}) == False{} : Bool}

law agentdelivery_identidade_preservada:
  {D.sameNativeIdentity("11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111111") == True{} : Bool}

law agentdelivery_identidade_nao_redireciona:
  {D.sameNativeIdentity("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222") == False{} : Bool}

law agentdelivery_controle_livre:
  {D.canChangeControls(False{}, False{}, False{}, False{}) == True{} : Bool}

law agentdelivery_controle_envio:
  {D.canChangeControls(True{}, False{}, False{}, False{}) == False{} : Bool}

law agentdelivery_controle_turno:
  {D.canChangeControls(False{}, True{}, False{}, False{}) == False{} : Bool}

law agentdelivery_controle_permissao:
  {D.canChangeControls(False{}, False{}, True{}, False{}) == False{} : Bool}

law agentdelivery_controle_incerto:
  {D.canChangeControls(False{}, False{}, False{}, True{}) == False{} : Bool}
