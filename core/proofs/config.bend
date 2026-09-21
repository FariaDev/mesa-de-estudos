import Base
import ../laws/config.bend as Laws

# Provas das leis da configuração. Aceitador: `bend proofs/config.bend` deve
# imprimir "All terms check.". As leis são cenários concretos que o host
# exercita; a igualdade fecha por computação (`{==}`). As duas genéricas
# (needsSetup com vault True / com um curso qualquer) fecham porque o Bool.and
# decide pelo primeiro lado e a lista literal reduz na cabeça.

# ---------- vazio ⇒ defaults ----------

def Laws.config_vazio():
  {==}

def Laws.config_desk_ausente():
  {==}

def Laws.config_desk_vazio():
  {==}

def Laws.config_desk_delegado():
  {==}

# ---------- flags ----------

def Laws.config_flags_default_true():
  {==}

def Laws.config_flags_false():
  {==}

def Laws.config_flags_parciais():
  {==}

def Laws.config_flag_ausente():
  {==}

def Laws.config_flag_true():
  {==}

def Laws.config_flag_false():
  {==}

# ---------- campo inválido ⇒ default ----------

def Laws.config_titulo_vazio():
  {==}

def Laws.config_titulo_ausente():
  {==}

def Laws.config_titulo_trim():
  {==}

def Laws.config_painel_label_vazio():
  {==}

def Laws.config_painel_toggle_vazio():
  {==}

def Laws.config_painel_prefer_invalido():
  {==}

# ---------- strings aparadas ----------

def Laws.config_prefer_limpa():
  {==}

def Laws.config_prefer_so_vazios_default():
  {==}

def Laws.config_prefer_limpo_vence_slot():
  {==}

def Laws.config_toggle_trim():
  {==}

# ---------- 1 painel ----------

def Laws.config_um_painel():
  {==}

def Laws.config_um_painel_defaults():
  {==}

def Laws.config_nenhum_painel_default():
  {==}

# ---------- 2 painéis ----------

def Laws.config_dois_paineis():
  {==}

def Laws.config_dois_paineis_toggle_herdado():
  {==}

# ---------- 3+ painéis ⇒ corta em 2 ----------

def Laws.config_tres_paineis_corta():
  {==}

# ---------- cursos ----------

def Laws.config_cursos_vazio():
  {==}

def Laws.config_curso_basename():
  {==}

def Laws.config_curso_name_herda_id():
  {==}

def Laws.config_curso_sem_id_cai():
  {==}

def Laws.config_curso_path_vazio_cai():
  {==}

def Laws.config_curso_trim():
  {==}

def Laws.config_cursos_preserva_ordem_e_filtra():
  {==}

def Laws.config_normalize_cursos():
  {==}

# ---------- needsSetup ----------

def Laws.config_needsSetup_vazio():
  {==}

def Laws.config_needsSetup_com_vault():
  {==}

def Laws.config_needsSetup_com_curso():
  {==}

def Laws.config_needsSetup_vault_generico(courses):
  {==}

def Laws.config_needsSetup_curso_generico(c):
  {==}

# ---------- quirk: paths do topo não são aparados ----------

def Laws.config_vault_sem_trim():
  {==}

def Laws.config_paths_presentes():
  {==}
