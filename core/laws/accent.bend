import Base
import ../accent.bend as A

# Contrato da cor de acento: seis nomes válidos, o azul como padrão, e qualquer
# outra coisa (ausente, tipo errado, caixa diferente, espaço) cai no fallback.
# Os nomes são concretos porque String.eq não reduz em String livre.

law accent_default_is_blue:
  {A.accentDefault() == A.AccentBlue{} : A.Accent}

law accent_blue:
  for fallback: A.Accent
  {A.parseAccent("blue", fallback) == A.AccentBlue{} : A.Accent}

law accent_violet:
  for fallback: A.Accent
  {A.parseAccent("violet", fallback) == A.AccentViolet{} : A.Accent}

law accent_green:
  for fallback: A.Accent
  {A.parseAccent("green", fallback) == A.AccentGreen{} : A.Accent}

law accent_orange:
  for fallback: A.Accent
  {A.parseAccent("orange", fallback) == A.AccentOrange{} : A.Accent}

law accent_pink:
  for fallback: A.Accent
  {A.parseAccent("pink", fallback) == A.AccentPink{} : A.Accent}

law accent_graphite:
  for fallback: A.Accent
  {A.parseAccent("graphite", fallback) == A.AccentGraphite{} : A.Accent}

# Nome desconhecido, outra caixa e espaço sobrando: fallback.
law accent_unknown_falls_back:
  for fallback: A.Accent
  {A.parseAccent("rouge", fallback) == fallback : A.Accent}

law accent_case_sensitive:
  for fallback: A.Accent
  {A.parseAccent("BLUE", fallback) == fallback : A.Accent}

law accent_padded_falls_back:
  for fallback: A.Accent
  {A.parseAccent("pink ", fallback) == fallback : A.Accent}

law accent_empty_falls_back:
  for fallback: A.Accent
  {A.parseAccent("", fallback) == fallback : A.Accent}

# Ausente ou de tipo errado (o host entrega `None`) usa o fallback.
law accent_missing_uses_fallback:
  for fallback: A.Accent
  {A.accentOrDefault(None{}, fallback) == fallback : A.Accent}

law accent_present_is_parsed:
  for fallback: A.Accent
  {A.accentOrDefault(Some{"green"}, fallback) == A.AccentGreen{} : A.Accent}

# Quem nunca escolheu vê azul; quem escolheu, o que escolheu.
law accent_never_chosen_is_blue:
  {A.normalizeAccent(None{}) == A.AccentBlue{} : A.Accent}

law accent_garbage_is_blue:
  {A.normalizeAccent(Some{"roxo"}) == A.AccentBlue{} : A.Accent}

law accent_choice_is_kept:
  {A.normalizeAccent(Some{"graphite"}) == A.AccentGraphite{} : A.Accent}
