import Base

# ---------------------------------------------------------------------------
# Núcleo da restauração do rascunho Xournal (referência: cleanStudy de
# desk/study.cjs).
#
# O host entrega o título, o caminho persistido na sessão e o fato `exists`
# (o arquivo está lá). O núcleo:
#   - aparar o título e cortar em 240 caracteres;
#   - só devolve o caminho se existe e termina em `.xopp` (caixa irrelevante).
# I/O e o conjunto `allowedXopp` ficam no adaptador.
#
# Sem referência para frente: helpers vêm antes de quem chama.
# ---------------------------------------------------------------------------

type Study is Data:
  Study{title: String, xopp: String}

# Sufixo `.xopp`, ignorando caixa — o mesmo que extname(...).toLowerCase().
def endsXopp(path: String) -> Bool:
  String.ends_with(String.to_lower(path), ".xopp")

# Dado o fato "é xopp": devolve o caminho ou vazio.
def restore.xopp(path: String, xopp: Bool) -> String:
  match xopp:
    case False{}:
      ""
    case True{}:
      path

# Fatos já resolvidos: existe? é xopp? O match é nos Bool, então a lei fecha.
def restore.if(path: String, exists: Bool, xopp: Bool) -> String:
  match exists:
    case False{}:
      ""
    case True{}:
      restore.xopp(path, xopp)

# Com o arquivo presente, o núcleo ainda exige o sufixo `.xopp`.
def restore.whenExists(+path: String) -> String:
  restore.xopp(path, endsXopp(path))

# O fato `exists` vem do host; o sufixo o núcleo mede.
def restoreXopp(path: String, exists: Bool) -> String:
  match exists:
    case False{}:
      ""
    case True{}:
      restore.whenExists(path)

# Título: trim + no máximo 240, como o host faz hoje.
def cleanTitle(title: String) -> String:
  String.take(String.trim(title), 240n)

def cleanStudy(title: String, xopp: String, exists: Bool) -> Study:
  Study{cleanTitle(title), restoreXopp(String.trim(xopp), exists)}
