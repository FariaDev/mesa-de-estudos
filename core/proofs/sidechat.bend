import Base
import ../laws/sidechat.bend as Laws
import ../sidechat.bend as S

# Provas das leis do chat lateral. Aceitador: `bend proofs/sidechat.bend`.
# Todas as leis são cenários concretos (strings, construtores e Bools
# literais), cada uma com `{==}`.

# --- escopo ---

def Laws.sidechat_mesma_conversa_mesma_materia():
  {==}

def Laws.sidechat_conversa_diferente_recusa():
  {==}

def Laws.sidechat_materia_diferente_recusa():
  {==}

def Laws.sidechat_conversa_vazia_recusa():
  {==}

# --- evento ---

def Laws.sidechat_evento_do_ativo():
  {==}

def Laws.sidechat_evento_de_canal_antigo():
  {==}

def Laws.sidechat_evento_sem_ativo():
  {==}

# --- recuperação ---

def Laws.sidechat_transmitting_vira_incerto():
  {==}

def Laws.sidechat_aceito_nao_regride():
  {==}

def Laws.sidechat_recusa_continua_recusavel():
  {==}

def Laws.sidechat_incerto_e_pegajoso():
  {==}

def Laws.sidechat_ocioso_continua_ocioso():
  {==}

def Laws.sidechat_settled_nao_regride():
  {==}

# --- reenvio automático ---

def Laws.sidechat_sem_reenvio_transmitting():
  {==}

def Laws.sidechat_sem_reenvio_incerto():
  {==}

def Laws.sidechat_sem_reenvio_aceito():
  {==}

def Laws.sidechat_sem_reenvio_recusado():
  {==}

# --- prompt ---

def Laws.sidechat_prompt_livre():
  {==}

def Laws.sidechat_prompt_com_turno():
  {==}

def Laws.sidechat_prompt_com_envio_em_voo():
  {==}

def Laws.sidechat_prompt_tudo_ocupado():
  {==}

# --- contexto ---

def Laws.sidechat_contexto_igual_nao_reenvia():
  {==}

def Laws.sidechat_contexto_novo_reenvia():
  {==}

def Laws.sidechat_contexto_nunca_entregue_reenvia():
  {==}
