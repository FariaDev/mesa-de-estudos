import Base
import ../laws/handoff.bend as Laws

# Os cenários são concretos (String e Bool reduzem), então todas as leis fecham
# por reflexão. `optional`, `accepted` e `cleanGoal`/`cleanQuestion` recebem
# argumentos fixos; as leis genéricas recebem o binding livre do `for`.

def Laws.handoff_vazio_recusa():
  {==}

def Laws.handoff_objetivo_aceita():
  {==}

def Laws.handoff_pergunta_aceita():
  {==}

def Laws.handoff_objetivo_so_espaco_recusa():
  {==}

def Laws.handoff_pergunta_so_espaco_recusa():
  {==}

def Laws.handoff_referencia_sozinha_recusa():
  {==}

def Laws.handoff_cabecalho():
  {==}

def Laws.handoff_linha_objetivo():
  {==}

def Laws.handoff_linha_pergunta():
  {==}

def Laws.handoff_linha_referencia():
  {==}

def Laws.handoff_cabecalho_referencias():
  {==}

def Laws.handoff_linha_marcada():
  {==}

def Laws.handoff_objetivo_trim():
  {==}

def Laws.handoff_objetivo_vazio():
  {==}

def Laws.handoff_pergunta_trim():
  {==}

def Laws.handoff_opcional_vazio():
  {==}

def Laws.handoff_opcional_presente():
  {==}

def Laws.handoff_antigo_avisa():
  {==}

def Laws.handoff_recente_nao_avisa():
  {==}

def Laws.handoff_recusado_sem_bloco():
  {==}

def Laws.handoff_recusado_sem_bloco_recente():
  {==}
