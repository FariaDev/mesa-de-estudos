import Base
import ../laws/search.bend as Laws
import ../search.bend as S

# Constantes e cenários concretos reduzem por computação.

def Laws.busca_min_query():
  {==}

def Laws.busca_default_30():
  {==}

def Laws.busca_teto_50():
  {==}

def Laws.busca_teto_arquivos():
  {==}

def Laws.fold_vazio():
  {==}

def Laws.fold_acento():
  {==}

def Laws.fold_combinante():
  {==}

def Laws.fold_misto():
  {==}

def Laws.fold_go_acumula():
  {==}

def Laws.busca_formulario():
  {==}

def Laws.busca_acao():
  {==}

def Laws.busca_atencao():
  {==}

def Laws.busca_calculo():
  {==}

def Laws.busca_combinante():
  {==}

def Laws.busca_caixa():
  {==}

def Laws.busca_agulha_vazia():
  {==}

def Laws.busca_agulha_espaco():
  {==}

def Laws.busca_hay_vazio():
  {==}

def Laws.busca_nao_casa():
  {==}

def Laws.trecho_inteiro(s):
  {==}

def Laws.trecho_pontas():
  {==}

def Laws.trecho_so_comeco():
  {==}

def Laws.limite_invalido(overMax, n):
  {==}

def Laws.limite_teto(n):
  {==}

def Laws.limite_pedido(n):
  {==}

def Laws.papel_outro():
  {==}

def Laws.papel_user():
  {==}

def Laws.papel_assistant():
  {==}

def Laws.arquivo_cheio_para(timedOut, atFileCap, tooLarge):
  {==}

def Laws.arquivo_timeout_para(atFileCap, tooLarge):
  {==}

def Laws.arquivo_300_para(tooLarge):
  {==}

def Laws.arquivo_grande_pula():
  {==}

def Laws.arquivo_livre_varre():
  {==}

def Laws.cortado_parcial(was, timedOut, atFileCap, tooLarge):
  {==}

def Laws.timeout_parcial(was, atFileCap, tooLarge):
  {==}

def Laws.grande_nao_corta(was):
  {==}

def Laws.scan_mantem_parcial(was):
  {==}

def Laws.cap_primeiro(h, t, fs):
  {==}

def Laws.cap_cabeca(h, t, fs):
  {==}

# Indução: nenhum cheio ⇒ a lista passa inteira.
def Laws.cap_identidade(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Laws.cap_identidade(t) : {h <> S.takeUntilFull(t, S.noneFull(t)) == h <> _ : List<&2, S.SearchHit>}
      {==}

def Laws.cap_nenhum_parcial(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      Laws.cap_nenhum_parcial(t)

def Laws.cheio_parcial(xs, fs, h):
  h

def Laws.consulta_curta(xs, fs):
  {==}

def Laws.grupo_vazio():
  {==}

def Laws.grupo_um():
  {==}

def Laws.grupo_mesma():
  {==}

def Laws.grupo_separa():
  {==}
