import Base
import ../laws/overlay.bend as Laws

# Provas da view nativa diante das sobreposições (ticket #52). Aceitador:
# `bend proofs/overlay.bend`. Cenários concretos: fecham por computação.

def Laws.ovl_aba_inativa_fica_fora():
  {==}

def Laws.ovl_aba_inativa_fica_fora_com_tela_cheia():
  {==}

def Laws.ovl_aba_ativa_sem_sobreposicao_aparece():
  {==}

def Laws.ovl_aba_ativa_com_uma_sobreposicao_se_esconde():
  {==}

def Laws.ovl_aba_ativa_com_duas_sobreposicoes_se_esconde():
  {==}

def Laws.ovl_aba_ativa_com_muitas_sobreposicoes_se_esconde():
  {==}
