import Base
import ../laws/findbar.bend as Laws

# Provas das leis da barra da busca na conversa. Aceitador:
# `bend proofs/findbar.bend`. Textos, classes, ARIA, `disabled` e a ordem dos
# filhos são cenários concretos; as leis com `for` cobrem os fatos simbólicos
# (índice livre, consulta livre, sucessor do total).

# ---------- contador ----------

def Laws.fb_vazio():
  {==}

def Laws.fb_sem_consulta_ignora_indice(index):
  {==}

def Laws.fb_sem_resultados(index):
  {==}

def Laws.fb_posicao_primeira():
  {==}

def Laws.fb_posicao_meio():
  {==}

def Laws.fb_posicao_ultima():
  {==}

def Laws.fb_posicao_estrutural(index):
  {==}

# ---------- fatos derivados ----------

def Laws.fb_none_zero(hasQuery):
  {==}

def Laws.fb_none_sucessor(hasQuery, t):
  {==}

def Laws.fb_dead_zero():
  {==}

def Laws.fb_dead_sucessor(t):
  {==}

# ---------- input ----------

def Laws.fb_input_valor():
  {==}

def Laws.fb_input_sem_texto():
  {==}

def Laws.fb_input_tipo():
  {==}

def Laws.fb_input_placeholder():
  {==}

def Laws.fb_input_rotulo():
  {==}

def Laws.fb_input_eventos():
  {==}

def Laws.fb_input_tecla():
  {==}

# ---------- contador (nó) ----------

def Laws.fb_contador_texto():
  {==}

def Laws.fb_contador_vazio_classe():
  {==}

def Laws.fb_contador_none_classe():
  {==}

def Laws.fb_contador_resultado_classe():
  {==}

def Laws.fb_contador_aria():
  {==}

def Laws.fb_contador_atomico():
  {==}

# ---------- botões ----------

def Laws.fb_anterior_desabilitado():
  {==}

def Laws.fb_anterior_habilitado():
  {==}

def Laws.fb_anterior_dir():
  {==}

def Laws.fb_anterior_rotulo():
  {==}

def Laws.fb_anterior_titulo():
  {==}

def Laws.fb_proxima_dir():
  {==}

def Laws.fb_proxima_titulo():
  {==}

def Laws.fb_proxima_desabilitada():
  {==}

def Laws.fb_fechar_sem_dir():
  {==}

def Laws.fb_fechar_rotulo():
  {==}

def Laws.fb_fechar_titulo():
  {==}

def Laws.fb_anterior_clique():
  {==}

def Laws.fb_proxima_clique():
  {==}

def Laws.fb_fechar_clique():
  {==}

# ---------- casca ----------

def Laws.fb_casca_classe():
  {==}

def Laws.fb_casca_saindo_classe():
  {==}

def Laws.fb_casca_fechada_escondida():
  {==}

def Laws.fb_casca_aberta_visivel():
  {==}

def Laws.fb_casca_saindo_visivel():
  {==}

def Laws.fb_casca_papel():
  {==}

def Laws.fb_casca_rotulo():
  {==}

def Laws.fb_casca_cinco_filhos():
  {==}

def Laws.fb_casca_tags():
  {==}

def Laws.fb_casca_valor():
  {==}

def Laws.fb_casca_contador():
  {==}

def Laws.fb_casca_botoes_habilitados():
  {==}

def Laws.fb_casca_botoes_desabilitados():
  {==}

def Laws.fb_casca_ultimo_e_fechar():
  {==}
