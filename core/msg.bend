import Base

# ---------------------------------------------------------------------------
# Mensagem traduzível (#41): onde um núcleo devolvia uma frase pronta, passa a
# devolver a CHAVE do catálogo (`desk/src/locales/*.json`) e os argumentos. Quem
# traduz é o host (`desk/src/i18n.mjs`), no idioma da interface naquele
# momento. Módulo só da Mesa; a Conversa não importa daqui.
#
# Por que chave + argumentos num `String`, e não um tipo novo ou um `lang`:
#   - todos os núcleos de tela já falam `String` (`V.viewText`, `V.attr*`,
#     rótulos); uma mensagem que cabe num `String` atravessa árvores, leis e
#     provas sem mudar uma assinatura, e `view.bend` — gerado também para a
#     Conversa — fica como está;
#   - uma tabela por idioma dentro do Bend duplicaria o catálogo: as frases
#     têm UMA fonte (os JSON), com um teste que confere chave e argumentos nos
#     dois idiomas;
#   - o idioma muda em tempo de execução (Configurações, na hora); um núcleo
#     que recebe `lang` precisaria ser reavaliado em cada tela, e este só
#     reavalia a tradução.
#
# Forma no fio: `MARK key SEP nome SEP valor SEP nome SEP valor …`. MARK e SEP
# são caracteres de uso privado (U+E000 e U+E001), que não aparecem em texto
# de verdade; o host só traduz o que começa por MARK e devolve o resto como
# veio. Os argumentos são pares nome/valor em ordem; o catálogo usa `{nome}`.
# Um núcleo não faz conta com a mensagem (tamanho, corte, junção): ela é
# entregue inteira ao host.
# ---------------------------------------------------------------------------

def mark() -> String:
  "\u{E000}"

def sep() -> String:
  "\u{E001}"

def pack(parts: List<&2, String>) -> String:
  String.append(mark(), String.join(parts, sep()))

# Frase sem argumentos.
def msg(key: String) -> String:
  pack([key])

def msg1(key: String, n1: String, v1: String) -> String:
  pack([key, n1, v1])

def msg2(key: String, n1: String, v1: String, n2: String, v2: String) -> String:
  pack([key, n1, v1, n2, v2])

def msg3(key: String, n1: String, v1: String, n2: String, v2: String, n3: String, v3: String) -> String:
  pack([key, n1, v1, n2, v2, n3, v3])

def msg4(key: String, n1: String, v1: String, n2: String, v2: String, n3: String, v3: String, n4: String, v4: String) -> String:
  pack([key, n1, v1, n2, v2, n3, v3, n4, v4])

# O host pergunta isto antes de traduzir.
def isMsg(s: String) -> Bool:
  String.starts_with(s, mark())
