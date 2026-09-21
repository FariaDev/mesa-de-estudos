import Base
import ../study.bend as S

# ---------------------------------------------------------------------------
# Contrato da restauração do rascunho Xournal. Prefixo `study_`.
#
# O host manda o fato `exists`; o núcleo mede o sufixo `.xopp`. Leis
# genéricas casam nos Bool; o sufixo em si fecha em cenários concretos
# (String.ends_with não reduz numa String livre).
# ---------------------------------------------------------------------------

# Sem o arquivo, o caminho some — independente do nome.
law study_restaura_ausente:
  for path: String
  {S.restoreXopp(path, False{}) == "" : String}

# O fato exists=False recusa mesmo que o fato xopp seja livre.
law study_ausente_ignora_xopp:
  for path: String
  for xopp: Bool
  {S.restore.if(path, False{}, xopp) == "" : String}

# Fato "não é xopp": recusa, mesmo que exista.
law study_rejeita_nao_xopp:
  for path: String
  {S.restore.xopp(path, False{}) == "" : String}

# Fatos existe+xopp: devolve o caminho persistido.
law study_aceita_fatos:
  for +path: String
  {S.restore.if(path, True{}, True{}) == path : String}

# Existe, mas não é xopp: recusa.
law study_existe_sem_xopp:
  for path: String
  {S.restore.if(path, True{}, False{}) == "" : String}

# Caminho que não termina em .xopp é recusado mesmo com exists True.
law study_rejeita_ext:
  {S.restoreXopp("/tmp/tentativa.pdf", True{}) == "" : String}

# .xopp no meio do nome não basta.
law study_rejeita_nao_sufixo:
  {S.restoreXopp("/tmp/foo.xopp.pdf", True{}) == "" : String}

# O caminho persistido volta quando o arquivo existe e é .xopp.
law study_aceita_persistido:
  {S.restoreXopp("/tmp/tentativa.xopp", True{}) == "/tmp/tentativa.xopp" : String}

# Extensão em caixa alta ainda é Xournal.
law study_caixa:
  {S.restoreXopp("/tmp/A.XOPP", True{}) == "/tmp/A.XOPP" : String}

# Título vazio permanece vazio.
law study_titulo_vazio:
  {S.cleanTitle("") == "" : String}

# Espaços nas pontas saem.
law study_titulo_trim:
  {S.cleanTitle("  Lista 2  ") == "Lista 2" : String}

# cleanStudy junta título e restauração (cenário do teste).
law study_clean_aceita:
  {S.cleanStudy("Lista 2 · 7b", "/tmp/tentativa.xopp", True{})
    == S.Study{"Lista 2 · 7b", "/tmp/tentativa.xopp"} : S.Study}

# PDF existente não é reautorizado.
law study_clean_rejeita:
  {S.cleanStudy("x", "/tmp/tentativa.pdf", True{})
    == S.Study{"x", ""} : S.Study}
