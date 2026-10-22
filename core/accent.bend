import Base

# ---------------------------------------------------------------------------
# Cor de acento da Mesa (ticket #9 da spec de redesenho).
#
# Estado de interface, como o tema: mora no `desk.json` (nunca no
# `config.json`), vale na hora e é lembrado entre aberturas. O host entrega a
# string crua (ou ausência/tipo inválido como `None`) e o núcleo decide qual dos
# seis acentos vale. Lixo, caixa diferente e nome desconhecido caem no default,
# o azul — quem nunca escolheu vê azul.
#
# Fica num módulo próprio, e não em `state.bend`, porque `state.bend` é gerado
# também para o app Conversa e o acento é só da Mesa (a spec deixa a Conversa
# com o visual atual). As tintas de cada acento (claro/escuro) são papéis de
# cor do `style.css`; este núcleo só decide QUAL acento está valendo.
# ---------------------------------------------------------------------------

type Accent is Data:
  AccentBlue{}
  AccentViolet{}
  AccentGreen{}
  AccentOrange{}
  AccentPink{}
  AccentGraphite{}

def accentDefault() -> Accent:
  AccentBlue{}

def accentIf(hit: Bool, found: Accent, rest: Accent) -> Accent:
  match hit:
    case True{}:
      found
    case False{}:
      rest

# Nomes aceitos, em minúsculas e sem espaço: é o que o `desk.json` grava.
def parseAccent(+raw: String, fallback: Accent) -> Accent:
  accentIf(
    String.eq(raw, "blue"), AccentBlue{},
    accentIf(
      String.eq(raw, "violet"), AccentViolet{},
      accentIf(
        String.eq(raw, "green"), AccentGreen{},
        accentIf(
          String.eq(raw, "orange"), AccentOrange{},
          accentIf(
            String.eq(raw, "pink"), AccentPink{},
            accentIf(String.eq(raw, "graphite"), AccentGraphite{}, fallback)
          )
        )
      )
    )
  )

def accentOrDefault(value: Maybe<&2, String>, fallback: Accent) -> Accent:
  match value:
    case None{}:
      fallback
    case Some{raw}:
      parseAccent(raw, fallback)

# Quem nunca escolheu (ou tem estado antigo, sem o campo) vê o azul padrão.
def normalizeAccent(value: Maybe<&2, String>) -> Accent:
  accentOrDefault(value, accentDefault())
