import Base
import freeworkspaces.bend as F

# ---------------------------------------------------------------------------
# Notas do tutor (Mesa, #91): o tutor grava uma nota em `Notas/` dentro da
# matéria (ou da sessão Livre) e NUNCA escreve fora dela.
#
# O host faz o I/O: resolve a raiz com realpath, recusa link, cria a pasta
# `Notas/`, grava um temporário com `O_EXCL` e publica com link/rename
# exclusivo. Aqui fica a decisão pura:
#
#   - o título é aparado e cortado no teto;
#   - título vazio, com `..`, separador (`/` ou `\`), quebra de linha ou acima
#     do teto é recusado;
#   - o caminho devolvido é SEMPRE relativo e começa em `Notas/`; a raiz entra
#     no resultado só para o host montar o absoluto sem tocar na forma;
#   - a sequência `-2`, `-3`, … vem de `freeworkspaces.candidateName`, a mesma
#     da Livre: tentativas distintas nunca devolvem o mesmo nome, então o host
#     avança sem sobrescrever.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type NoteTarget is Data:
  NoteTarget.Ok{root: String, rel: String}
  NoteTarget.Refused{}

# ---------- tetos (o host compara; o núcleo documenta) ----------

def maxTitle() -> Nat:
  120n

def maxContent() -> Nat:
  100000n

def folder() -> String:
  "Notas"

# ---------- título seguro ----------

# `\n` e `\r` quebram a linha do caminho; `..` sai da pasta; `/` e `\` criam
# subpasta ou caminho absoluto. O título aparado não pode ficar vazio.
def unsafeTitle(+title: String) -> Bool:
  Bool.or(
    String.is_empty(title),
    Bool.or(
      Nat.is_gt(String.length(title), maxTitle()),
      Bool.or(
        String.contains(title, ".."),
        Bool.or(
          String.contains(title, "/"),
          Bool.or(
            String.contains(title, "\\"),
            Bool.or(String.contains(title, "\n"), String.contains(title, "\r"))
          )
        )
      )
    )
  )

# ---------- caminho ----------

# Uma tentativa: `0n` é `Notas/<título>.md`; as seguintes ganham `-2`, `-3`, …
def targetIf(root: String, +clean: String, +n: Nat, unsafe: Bool) -> NoteTarget:
  match unsafe:
    case True{}:
      NoteTarget.Refused{}
    case False{}:
      NoteTarget.Ok{root, folder() ++ "/" ++ F.candidateName(clean, ".md", n)}

def noteTargetAt(root: String, +title: String, n: Nat) -> NoteTarget:
  +clean = String.trim(title)
  targetIf(root, clean, n, unsafeTitle(clean))

def noteTarget(root: String, +title: String) -> NoteTarget:
  noteTargetAt(root, title, 0n)
