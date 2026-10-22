import Base
import ../laws/studycontext.bend as Laws

# Os cenários são concretos (String e Bool reduzem), então todas as leis fecham
# por reflexão. As duas que comparam Bools vêm de `String.contains` sobre o
# bloco montado — o sujeito é concreto, então o reducer fecha.

def Laws.sc_vazio():
  {==}

def Laws.sc_vazio_repetido():
  {==}

def Laws.sc_repetido_nao_reenvia():
  {==}

def Laws.sc_primeiro_manda():
  {==}

def Laws.sc_captura_nova_reenvia():
  {==}

def Laws.sc_referencia_nao_lida():
  {==}

def Laws.sc_sem_referencia():
  {==}

def Laws.sc_captura_do_exercicio():
  {==}

def Laws.sc_captura_outro_exercicio():
  {==}

def Laws.sc_fato_captura_presente(t, e, m, a):
  {==}

def Laws.sc_fato_captura_ausente():
  {==}

def Laws.sc_fato_refs_vazio():
  {==}

def Laws.sc_fato_refs_um():
  {==}

def Laws.sc_captura_xournal_mantem_a_redacao():
  {==}

def Laws.sc_captura_sem_app_e_xournal():
  {==}

def Laws.sc_captura_de_outro_programa_nomeia_o_app():
  {==}

def Laws.sc_captura_de_outro_programa_no_bloco():
  {==}

def Laws.sc_captura_de_outro_programa_nao_diz_xournal():
  {==}

def Laws.sc_captura_obsoleta_de_outro_programa():
  {==}
