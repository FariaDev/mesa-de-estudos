import Base
import ../state.bend as S

# Contrato do estado persistido. Fatos de faixa numérica vêm do host; os casos
# de enum concretos reduzem no núcleo. Inputs fechados tornam explícitas as
# chaves aceitas e impedem que lixo do JSON alcance o estado normalizado.

# Valor ausente/inválido usa o default.
law invalid_draft_default:
  for fallback: String
  for cut: String
  for over: Bool
  {S.draftOrDefault(None{}, cut, over, fallback) == fallback : String}

law invalid_bool_default:
  for fallback: Bool
  {S.boolOrDefault(None{}, fallback) == fallback : Bool}

law invalid_number_default:
  for under: Bool
  for over: Bool
  for low: F32
  for high: F32
  for fallback: F32
  {S.clampOrDefault(None{}, under, over, low, high, fallback) == fallback : F32}

# Seleção do corte, não a medição: com o fato `overLimit` já resolvido pelo
# host, as leis fixam qual dos dois valores sai (o texto livre entra por `for`).
# Quem mede (`length > teto`) e corta (`slice(0, teto)`) continua sendo o host —
# `desk/state-adapter.cjs` e `chat/state-adapter.cjs` —, mas o teto vem de
# `S.maxDraftChars()` (lei abaixo), não de um literal repetido.
law draft_short_preserved:
  for cut: String
  {S.cleanDraft(False{}, "rascunho", cut) == "rascunho" : String}

law draft_cut:
  for original: String
  {S.cleanDraft(True{}, original, "cortado") == "cortado" : String}

# LAW: o teto do rascunho. Os hosts leem `S.maxDraftChars()` daqui em vez de
# repetir o número (`core/state.bend`; U32 porque Nat unário não expande 100k).
law limit_draft_chars:
  {S.maxDraftChars() == (100000 : U32) : U32}

law trim_and_cut:
  {S.trimTake("  abcdef  ", 4n) == "abcd" : String}

# --- take em loop (correção #798; helpers cobertos) ---

law take_quatro:
  {S.take.go("abcdef", 4n, "") == "abcd" : String}

law take_menor_que_limite:
  {S.take.go("ab", 5n, "") == "ab" : String}

law take_zero:
  {S.take.go("abc", 0n, "") == "" : String}

# `take` puro corta mas NÃO apara (o trim é do trimTake).
law take_sem_trim:
  {S.take("  abcdef  ", 4n) == "  ab" : String}

law trim_take_curto:
  {S.trimTake("  abc  ", 10n) == "abc" : String}

# Enum aceito e recusado.
law theme_auto:
  for fallback: S.StateTheme
  {S.parseTheme("auto", fallback) == S.StateThemeAuto{} : S.StateTheme}

law theme_light:
  for fallback: S.StateTheme
  {S.parseTheme("light", fallback) == S.StateThemeLight{} : S.StateTheme}

law theme_dark:
  for fallback: S.StateTheme
  {S.parseTheme("dark", fallback) == S.StateThemeDark{} : S.StateTheme}

law theme_invalid_default:
  for fallback: S.StateTheme
  {S.parseTheme("rouge", fallback) == fallback : S.StateTheme}

# Booleanos válidos são preservados.
law bool_true_preserved:
  for fallback: Bool
  {S.boolOrDefault(Some{True{}}, fallback) == True{} : Bool}

law bool_false_preserved:
  for fallback: Bool
  {S.boolOrDefault(Some{False{}}, fallback) == False{} : Bool}

# Clamp: válido fica, abaixo/acima encosta no limite.
law number_valid_preserved:
  for value: F32
  for low: F32
  for high: F32
  for fallback: F32
  {S.clampOrDefault(Some{value}, False{}, False{}, low, high, fallback) == value : F32}

law number_low_clamped:
  for value: F32
  for low: F32
  for high: F32
  for fallback: F32
  {S.clampOrDefault(Some{value}, True{}, False{}, low, high, fallback) == low : F32}

law number_high_clamped:
  for value: F32
  for low: F32
  for high: F32
  for fallback: F32
  {S.clampOrDefault(Some{value}, False{}, True{}, low, high, fallback) == high : F32}

# Vazio ⇒ defaults.
law chat_empty_defaults:
  {S.normalizeChat(S.ChatInput{None{}, "", False{}, None{}, None{}}) == S.chatDefaults() : S.ChatState}

law desk_empty_defaults:
  {S.normalizeDesk(S.DeskInput{
      None{}, "", False{}, None{}, None{},
      None{}, False{}, False{},
      None{}, False{}, False{},
      None{}, False{}, False{}
    }) == S.deskDefaults() : S.DeskState}

# Merge preserva os válidos e completa os ausentes com o estado-base.
law chat_merge_valid_and_missing:
  {S.mergeChat(
      S.ChatState{"antigo", S.StateThemeDark{}, False{}},
      S.ChatInput{Some{"novo"}, "novo", False{}, None{}, Some{True{}}}
    ) == S.ChatState{"novo", S.StateThemeDark{}, True{}} : S.ChatState}

law desk_merge_valid_and_missing:
  {S.mergeDesk(
      S.DeskState{"antigo", S.StateThemeDark{}, True{}, 410.0, 230.0, 0.6},
      S.DeskInput{
        Some{"novo"}, "novo", False{}, Some{"light"}, Some{False{}},
        Some{420.0}, False{}, False{},
        None{}, False{}, False{},
        Some{0.05}, True{}, False{}
      }
    ) == S.DeskState{"novo", S.StateThemeLight{}, False{}, 420.0, 230.0, 0.2} : S.DeskState}
