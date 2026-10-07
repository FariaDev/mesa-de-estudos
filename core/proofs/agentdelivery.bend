import Base
import ../laws/agentdelivery.bend as Laws
import ../agentdelivery.bend as D

# Provas das leis da entrega do motor. Aceitador: `bend proofs/agentdelivery.bend`.
# Todas as leis são cenários concretos (Bools e construtores literais; a
# igualdade e o Bool.and fecham por computação), cada uma com `{==}`.

# ---------- veredito ----------

def Laws.agentdelivery_aceite_domina():
  {==}

def Laws.agentdelivery_aceite_sem_envio():
  {==}

def Laws.agentdelivery_incerto():
  {==}

def Laws.agentdelivery_recusa():
  {==}

# ---------- reenvio ----------

def Laws.agentdelivery_retry_recusa():
  {==}

def Laws.agentdelivery_retry_incerto():
  {==}

def Laws.agentdelivery_retry_aceito():
  {==}

# ---------- fila ----------

def Laws.agentdelivery_fila_livre():
  {==}

def Laws.agentdelivery_fila_ocupada():
  {==}

def Laws.agentdelivery_fila_permissao():
  {==}

def Laws.agentdelivery_fila_incerta():
  {==}

def Laws.agentdelivery_fila_cancelada():
  {==}

def Laws.agentdelivery_fila_parada_total():
  {==}

# ---------- começar ----------

def Laws.agentdelivery_comecar_livre():
  {==}

def Laws.agentdelivery_comecar_ocupado():
  {==}

def Laws.agentdelivery_comecar_incerto():
  {==}

def Laws.agentdelivery_identidade_preservada():
  {==}

def Laws.agentdelivery_identidade_nao_redireciona():
  {==}

def Laws.agentdelivery_controle_livre():
  {==}

def Laws.agentdelivery_controle_envio():
  {==}

def Laws.agentdelivery_controle_turno():
  {==}

def Laws.agentdelivery_controle_permissao():
  {==}

def Laws.agentdelivery_controle_incerto():
  {==}
