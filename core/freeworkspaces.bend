import Base

# ---------------------------------------------------------------------------
# Aba Livre (Mesa): o workspace de sessão avulsa. Tudo aqui é decisão pura —
# tetos, recortes e a sequência de nomes que nunca pode sobrescrever um arquivo
# ou uma pasta existentes do usuário. O host faz o I/O: lista os nomes que já
# existem, varre a sequência com `candidateName`/`candidateFolder`, valida
# caminhos e grava de forma atômica.
#
# Convenções:
#   - o id reservado da matéria Livre é `mesa-free` e o rótulo é `Livre` (o
#     config do usuário nunca é consultado para isso);
#   - título vazio vira o título padrão; nada é gravado em branco;
#   - `candidateName(stem, ext, n)` é a sequência determinística de nomes:
#     `stem+ext`, `stem-2+ext`, `stem-3+ext`, … — o `n` é a tentativa e o host
#     só passa para o próximo quando o nome já existe no disco;
#   - `candidateFolder(stem, n)` é a mesma sequência para a pasta nova da
#     matéria promovida (pasta existente nunca é reusada).
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

# ---------- tetos (o host compara; o núcleo documenta) ----------

def maxTitle() -> Nat:
  120n

def maxName() -> Nat:
  240n

# O rascunho é o único texto grande daqui e o corte de verdade é do host com
# `String.prototype.slice` (o `String.take` da Base estoura a pilha por volta
# de 10k chars — ver README do core). O núcleo pina o teto; o host corta.
def maxDraftChars() -> Nat:
  262144n

def maxMaterials() -> Nat:
  200n

def maxSlug() -> Nat:
  60n

# ---------- a matéria reservada ----------

def freeCourseId() -> String:
  "mesa-free"

def freeCourseName() -> String:
  "Livre"

def defaultTitle() -> String:
  "Conversa livre"

# ---------- recorte (aparar antes de cortar) ----------

def cut.if(text: String, limit: Nat, over: Bool) -> String:
  match over:
    case False{}:
      text
    case True{}:
      String.take(text, limit)

def cut(+text: String, +limit: Nat) -> String:
  cut.if(text, limit, Nat.is_gt(String.length(text), limit))

def fitTitle(+text: String) -> String:
  cut(String.trim(text), maxTitle())

def fitName(+text: String) -> String:
  cut(String.trim(text), maxName())

# Título vazio vira o padrão: o workspace nunca nasce em branco nem aceita um
# rename que apague o título.
def fitTitleOr.if(text: String, blank: Bool) -> String:
  match blank:
    case True{}:
      defaultTitle()
    case False{}:
      fitTitle(text)

def fitTitleOr(+text: String) -> String:
  fitTitleOr.if(String.trim(text), String.is_empty(String.trim(text)))

# ---------- fatos do host ----------

def isFreeCourseId(id: String) -> Bool:
  String.eq(id, freeCourseId())

# Workspace já promovido (tem matéria de destino): a conversa não pode seguir
# em dois escopos.
def isPromoted(+promotedCourseId: String) -> Bool:
  Bool.not(String.is_empty(String.trim(promotedCourseId)))

# ---------- sequência de nomes únicos ----------

# `base` diz se é a primeira tentativa (`stem+ext`) ou a numerada
# (`stem-N+ext`, com N começando em 2).
def numberedName.if(stem: String, +ext: String, base: Bool, n: Nat) -> String:
  match base:
    case True{}:
      stem ++ ext
    case False{}:
      stem ++ "-" ++ Nat.show(n) ++ ext

def candidateName(stem: String, +ext: String, n: Nat) -> String:
  match n:
    case 0n:
      numberedName.if(stem, ext, True{}, 0n)
    case 1n+p:
      numberedName.if(stem, ext, False{}, Nat.add(p, 2n))

# Pasta da matéria nova: mesma sequência, sem extensão.
def candidateFolder(stem: String, n: Nat) -> String:
  candidateName(stem, "", n)
