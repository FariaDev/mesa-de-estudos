import Base
import ../laws/sessions.bend as Laws
import ../sessions.bend as S

# Fatos Bool e cenários concretos reduzem por computação. A indução é só
# no walker do preview (achado já feito se mantém).

# ---------- caminho ----------

def Laws.sess_path_nao_jsonl(path):
  {==}

def Laws.sess_path_casa():
  {==}

def Laws.sess_path_sem_pi():
  {==}

def Laws.sess_path_sufixo():
  {==}

def Laws.sess_path_sem_digito():
  {==}

def Laws.sess_path_vazio():
  {==}

def Laws.sess_path_basename():
  {==}

# ---------- preview ----------

def Laws.sess_preview_vazio(cuts):
  {==}

def Laws.sess_preview_achado_mantem(msgs, cuts, v):
  match msgs:
    case Nil{}:
      {==}
    case Con{h, t}:
      Laws.sess_preview_achado_mantem(t, cuts, v)

def Laws.sess_preview_primeira():
  {==}

def Laws.sess_preview_pula_nao_user():
  {==}

def Laws.sess_preview_pula_vazia():
  {==}

def Laws.sess_preview_campo_text():
  {==}

def Laws.sess_partes_junta():
  {==}

def Laws.sess_preview_partes():
  {==}

def Laws.sess_marcador_buscar():
  {==}

def Laws.sess_marcador_anexo():
  {==}

def Laws.sess_marcador_contexto():
  {==}

def Laws.sess_marcador_refs():
  {==}

def Laws.sess_marcador_conferir():
  {==}

def Laws.sess_conferir_off():
  {==}

def Laws.sess_preview_corta_48():
  {==}

def Laws.sess_preview_limpa_antes_de_cortar():
  {==}

def Laws.sess_nota_corta_40():
  {==}

# ---------- helpers tail (accumulator) ----------

def Laws.sess_colapso_espacos():
  {==}

def Laws.sess_colapso_sem_espaco():
  {==}

def Laws.sess_corte_marcador():
  {==}

def Laws.sess_corte_sem_marcador():
  {==}

def Laws.sess_take_trail():
  {==}

def Laws.sess_take_trail_sem_digito():
  {==}

# ---------- rótulos ----------

def Laws.sess_rotulo_titulo(preview, nova, valid, day, month, hour, minute):
  {==}

def Laws.sess_rotulo_titulo_trim():
  {==}

def Laws.sess_rotulo_nova():
  {==}

def Laws.sess_rotulo_conversa():
  {==}

def Laws.sess_rotulo_nota_sem_data():
  {==}

def Laws.sess_rotulo_data():
  {==}

def Laws.sess_rotulo_data_meia_noite():
  {==}

def Laws.sess_rotulo_valid_false(day, month, hour, minute):
  {==}

def Laws.sess_rotulo_com_nota():
  {==}

def Laws.sess_rotulo_colapsa():
  {==}

# ---------- grupos ----------

def Laws.sess_grupo_hoje(yest):
  {==}

def Laws.sess_grupo_ontem():
  {==}

def Laws.sess_grupo_antes():
  {==}

def Laws.sess_grupo_rotulo_hoje():
  {==}

def Laws.sess_grupo_rotulo_ontem():
  {==}

def Laws.sess_grupo_rotulo_antes():
  {==}

def Laws.sess_grupo_vazio():
  {==}

def Laws.sess_grupo_so_hoje():
  {==}

def Laws.sess_grupo_mistura():
  {==}

def Laws.sess_grupo_so_antes():
  {==}
