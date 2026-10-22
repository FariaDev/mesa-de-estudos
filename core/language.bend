import Base

# ---------------------------------------------------------------------------
# Idioma da interface e idioma do tutor (#41). Módulo só da Mesa.
#
# Dois valores, os dois guardados no estado de interface (`desk.json`), fora do
# `config.json`:
#
#   - idioma da interface: "pt-BR" ou "en". Ausente (nunca escolhido) acompanha
#     o sistema: `pt*` abre em português e qualquer outro em inglês. Escolher na
#     primeira abertura ou nas Configurações grava a escolha.
#   - idioma do tutor: "follow" (acompanhar as mensagens da pessoa; o padrão),
#     "pt-BR" ou "en". Valor desconhecido volta ao padrão.
#
# Fronteira de host: o main lê o locale do sistema (`app.getLocale()`) e o
# valor guardado e entrega os dois como texto; nada aqui lê arquivo nem relógio.
# ---------------------------------------------------------------------------

def pt() -> String:
  "pt-BR"

def en() -> String:
  "en"

def follow() -> String:
  "follow"

# Bend só deixa `match` sobre parâmetro: cada decisão tem seu def.
def isPortugueseLocale(+locale: String) -> Bool:
  Bool.or(
    Bool.or(String.starts_with(locale, "pt"), String.starts_with(locale, "PT")),
    Bool.or(String.starts_with(locale, "Pt"), String.starts_with(locale, "pT"))
  )

def fromSystem.pick(portuguese: Bool) -> String:
  match portuguese:
    case True{}:
      pt()
    case False{}:
      en()

# Português para qualquer locale que comece por "pt" (pt, pt-BR, pt_PT, PT);
# qualquer outro, inclusive vazio, inglês.
def fromSystem(+locale: String) -> String:
  fromSystem.pick(isPortugueseLocale(locale))

def storedUi.pickEn(isEn: Bool) -> String:
  match isEn:
    case True{}:
      en()
    case False{}:
      ""

def storedUi.pick(isPt: Bool, isEn: Bool) -> String:
  match isPt:
    case True{}:
      pt()
    case False{}:
      storedUi.pickEn(isEn)

# O valor guardado, se for um dos dois idiomas; senão "" (nunca escolhido).
def storedUi(+stored: String) -> String:
  storedUi.pick(String.eq(stored, pt()), String.eq(stored, en()))

def resolveUi.pickIf(empty: Bool, chosen: String, system: String) -> String:
  match empty:
    case True{}:
      fromSystem(system)
    case False{}:
      chosen

def resolveUi.pick(+chosen: String, system: String) -> String:
  resolveUi.pickIf(String.is_empty(chosen), chosen, system)

# O idioma da interface em uso: a escolha guardada, ou o do sistema.
def resolveUi(+stored: String, +system: String) -> String:
  resolveUi.pick(storedUi(stored), system)

def tutor.pickEn(isEn: Bool) -> String:
  match isEn:
    case True{}:
      en()
    case False{}:
      follow()

def tutor.pick(isPt: Bool, isEn: Bool) -> String:
  match isPt:
    case True{}:
      pt()
    case False{}:
      tutor.pickEn(isEn)

# O idioma do tutor guardado: um dos três valores, ou "follow".
def tutor(+stored: String) -> String:
  tutor.pick(String.eq(stored, pt()), String.eq(stored, en()))

# Opções do seletor "Idioma do tutor", na ordem em que a pessoa as vê.
def tutorChoices() -> List<&2, String>:
  [follow(), pt(), en()]

def uiChoices() -> List<&2, String>:
  [pt(), en()]
