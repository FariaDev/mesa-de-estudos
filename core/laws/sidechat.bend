import Base
import ../sidechat.bend as S

# ---------------------------------------------------------------------------
# Contrato do chat lateral. Prefixo `sidechat_`.
#
# As leis fixam o que o IPC não pode deixar passar:
#   - escopo por conversa principal E matéria;
#   - evento só do canal ativo;
#   - recuperação de envio em voo vira incerteza e nunca reenvia sozinho;
#   - prompt exige envio em voo concluído e (quando o motor exige) turno ocioso;
#   - contexto só é reenviado quando a chave mudou.
#
# O que não sai daqui: o I/O (arquivos, processos, IPC) é do host; a igualdade
# de strings e o `match` sobre o estado de entrega fecham por computação.
# ---------------------------------------------------------------------------

# --- escopo ---

law sidechat_mesma_conversa_mesma_materia:
  {S.scoped("pi-1.jsonl", "pi-1.jsonl", "Calculo", "Calculo") == True{} : Bool}

law sidechat_conversa_diferente_recusa:
  {S.scoped("pi-1.jsonl", "pi-2.jsonl", "Calculo", "Calculo") == False{} : Bool}

law sidechat_materia_diferente_recusa:
  {S.scoped("pi-1.jsonl", "pi-1.jsonl", "Calculo", "Algebra") == False{} : Bool}

law sidechat_conversa_vazia_recusa:
  {S.scoped("", "pi-1.jsonl", "Calculo", "Calculo") == False{} : Bool}

# --- evento ---

law sidechat_evento_do_ativo:
  {S.eventAllowed("sc-a", "sc-a") == True{} : Bool}

law sidechat_evento_de_canal_antigo:
  {S.eventAllowed("sc-a", "sc-b") == False{} : Bool}

law sidechat_evento_sem_ativo:
  {S.eventAllowed("sc-a", "") == False{} : Bool}

# --- recuperação ---

law sidechat_transmitting_vira_incerto:
  {S.recoversTo(S.SidechatStatus.Transmitting{}) == S.SidechatStatus.Uncertain{} : S.SidechatStatus}

law sidechat_aceito_nao_regride:
  {S.recoversTo(S.SidechatStatus.Accepted{}) == S.SidechatStatus.Accepted{} : S.SidechatStatus}

law sidechat_recusa_continua_recusavel:
  {S.recoversTo(S.SidechatStatus.Refused{}) == S.SidechatStatus.Refused{} : S.SidechatStatus}

law sidechat_incerto_e_pegajoso:
  {S.recoversTo(S.SidechatStatus.Uncertain{}) == S.SidechatStatus.Uncertain{} : S.SidechatStatus}

law sidechat_ocioso_continua_ocioso:
  {S.recoversTo(S.SidechatStatus.Idle{}) == S.SidechatStatus.Idle{} : S.SidechatStatus}

law sidechat_settled_nao_regride:
  {S.recoversTo(S.SidechatStatus.Settled{}) == S.SidechatStatus.Settled{} : S.SidechatStatus}

# --- reenvio automático: nunca ---

law sidechat_sem_reenvio_transmitting:
  {S.autoResend(S.SidechatStatus.Transmitting{}) == False{} : Bool}

law sidechat_sem_reenvio_incerto:
  {S.autoResend(S.SidechatStatus.Uncertain{}) == False{} : Bool}

law sidechat_sem_reenvio_aceito:
  {S.autoResend(S.SidechatStatus.Accepted{}) == False{} : Bool}

law sidechat_sem_reenvio_recusado:
  {S.autoResend(S.SidechatStatus.Refused{}) == False{} : Bool}

# --- prompt ---

law sidechat_prompt_livre:
  {S.canPrompt(False{}, False{}) == True{} : Bool}

law sidechat_prompt_com_turno:
  {S.canPrompt(True{}, False{}) == False{} : Bool}

law sidechat_prompt_com_envio_em_voo:
  {S.canPrompt(False{}, True{}) == False{} : Bool}

law sidechat_prompt_tudo_ocupado:
  {S.canPrompt(True{}, True{}) == False{} : Bool}

# --- contexto ---

law sidechat_contexto_igual_nao_reenvia:
  {S.contextChanged("chave-1", "chave-1") == False{} : Bool}

law sidechat_contexto_novo_reenvia:
  {S.contextChanged("chave-1", "chave-2") == True{} : Bool}

law sidechat_contexto_nunca_entregue_reenvia:
  {S.contextChanged("", "chave-1") == True{} : Bool}
