import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Visualizações e atividades no chat (#42, parte B). Módulo só da Mesa: a
# Conversa não importa daqui.
#
# Desenho e comportamento reescritos a partir do T3 Code (pingdotgg/t3code,
# MIT, © T3 Tools Inc.): o quadro fica solto na conversa, sem cartão; a altura
# inicial vem de medições feitas antes de aparecer; os tokens de tema chegam
# completos, com paleta de gráfico e os nomes padrão do MCP Apps.
#
# O que mora aqui:
#   - o tipo do que o tutor mostra (`visualizacao` × `atividade`) e que
#     controles cada um tem;
#   - as larguras em que a prévia mede e a escolha da altura inicial a partir
#     dos pares largura→altura medidos e da largura da coluna;
#   - o teto e o piso da altura no quadro;
#   - nomes e valores-base dos tokens por tema e acento, com a paleta
#     categórica e o espelho nos nomes do MCP Apps;
#   - os textos visíveis.
#
# Medir, a janela invisível da prévia e a ponte de mensagens são do host
# (`desk/activity-runtime.cjs`, `activity-preview.cjs`, `src/activity.mjs`).
# Nada aqui lê DOM, mede ou fala IPC. `String.eq` só reduz em literal concreto:
# as leis usam nomes concretos.
# ---------------------------------------------------------------------------

type HeightPair is Data:
  HeightPair{width: Nat, height: Nat}

type Token is Data:
  Token{name: String, value: String}

# ---------- helpers ----------

def strIf(hit: Bool, found: String, rest: String) -> String:
  match hit:
    case True{}:
      found
    case False{}:
      rest

def natIf(hit: Bool, found: Nat, rest: Nat) -> Nat:
  match hit:
    case True{}:
      found
    case False{}:
      rest

def listIf(hit: Bool, found: List<&2, String>, rest: List<&2, String>) -> List<&2, String>:
  match hit:
    case True{}:
      found
    case False{}:
      rest

def natMax(+a: Nat, +b: Nat) -> Nat:
  natIf(Nat.is_gt(a, b), a, b)

# ---------- tipo: visualização × atividade ----------

def vizKind() -> String:
  "visualizacao"

def activityKind() -> String:
  "atividade"

# O que não é `visualizacao` é atividade — inclusive as atividades salvas antes
# do #42, que não têm o campo.
def kindOf(+raw: String) -> String:
  strIf(String.eq(raw, vizKind()), vizKind(), activityKind())

def isViz(+kind: String) -> Bool:
  String.eq(kindOf(kind), vizKind())

# Visualização (gráfico, tabela, diagrama, comparação) não tem estado do aluno:
# só a tela cheia, no canto, ao passar o mouse. Atividade tem também recomeçar
# e parar (um laço no exercício para com o quadro) no mesmo canto, e ganha a
# linha discreta com "Levar ao tutor".
def showsBring(+kind: String) -> Bool:
  Bool.not(isViz(kind))

def controlIds(+kind: String) -> List<&2, String>:
  listIf(isViz(kind), ["fullscreen"], ["fullscreen", "restart", "stop", "bring"])

def restartLabel() -> String:
  M.msg("activity.restart")

def stopLabel() -> String:
  M.msg("activity.stop")

def openLabel() -> String:
  M.msg("activity.open")

# ---------- textos ----------

# Chave do catálogo do tipo; `frameTitle` a passa como `{kind:key}` porque uma
# mensagem não entra como argumento de outra.
def kindKey(+kind: String) -> String:
  strIf(isViz(kind), "activity.kind.viz", "activity.kind.activity")

def kindLabel(+kind: String) -> String:
  M.msg(kindKey(kind))

def fullscreenLabel() -> String:
  M.msg("activity.fullscreen")

def exitFullscreenLabel() -> String:
  M.msg("activity.exitFullscreen")

def bringLabel() -> String:
  M.msg("activity.bring")

def bringDone() -> String:
  M.msg("activity.bringDone")

def descriptionLabel() -> String:
  M.msg("activity.description")

def frameTitle(+kind: String, +title: String) -> String:
  M.msg2("activity.frameTitle", "kind", kindKey(kind), "title", title)

# ---------- altura ----------

# Piso e teto do quadro na conversa. Com a tela cheia à mão, o teto subiu de
# 720 para 1200 px: um gráfico alto não precisa rolar por dentro; o que passa
# disso rola no quadro ou abre em tela cheia (que não tem teto).
def heightMin() -> Nat:
  48n

def heightMax() -> Nat:
  1200n

def clampHeight(+h: Nat) -> Nat:
  natIf(Nat.is_lt(h, heightMin()), heightMin(), natIf(Nat.is_gt(h, heightMax()), heightMax(), h))

# Larguras em que a prévia mede a altura do documento (as do T3 Code: do
# celular à coluna larga).
def measureWidths() -> List<&2, Nat>:
  [320n, 375n, 430n, 520n, 640n, 728n, 860n, 1000n, 1144n]

# A mais alta das alturas medidas nas larguras vizinhas, de cada lado: um
# ponto de quebra entre duas larguras medidas pode deixar o documento tão alto
# quanto qualquer uma delas. Pares em ordem crescente de largura; largura
# acima da maior medida usa a maior.
def heightAt.hit(+prev: Nat, +w: Nat, +ht: Nat, +width: Nat) -> Nat:
  natIf(Nat.is_eq(w, width), ht, natMax(prev, ht))

def heightAt.go(pairs: List<&2, HeightPair>, +prev: Nat, +width: Nat) -> Nat:
  match pairs:
    case Nil{}:
      prev
    case Con{h, t}:
      match h:
        case HeightPair{+w, +ht}:
          natIf(Nat.is_ge(w, width), heightAt.hit(prev, w, ht, width), heightAt.go(t, ht, width))

def heightAt(pairs: List<&2, HeightPair>, width: Nat) -> Nat:
  heightAt.go(pairs, 0n, width)

# Altura com que o quadro nasce: a medida para a largura da coluna, dentro do
# piso e do teto. Sem medição (atividade antiga, prévia indisponível), 0: o
# host usa a reserva de sempre e segue a medição viva.
def initialHeight(pairs: List<&2, HeightPair>, width: Nat) -> Nat:
  +raw = heightAt(pairs, width)
  natIf(Nat.is_eq(raw, 0n), 0n, clampHeight(raw))

# ---------- tokens de tema ----------

def isDark(+theme: String) -> Bool:
  String.eq(theme, "dark")

def byTheme(+theme: String, light: String, dark: String) -> String:
  strIf(isDark(theme), dark, light)

def accentIds() -> List<&2, String>:
  ["blue", "violet", "green", "orange", "pink", "graphite"]

def accentOf(+accent: String) -> String:
  strIf(String.eq(accent, "violet"), "violet",
  strIf(String.eq(accent, "green"), "green",
  strIf(String.eq(accent, "orange"), "orange",
  strIf(String.eq(accent, "pink"), "pink",
  strIf(String.eq(accent, "graphite"), "graphite", "blue")))))

# Preenchimento do acento (ação principal), por tema — os mesmos da Mesa.
def accentFill(+theme: String, +accent: String) -> String:
  strIf(String.eq(accentOf(accent), "violet"), byTheme(theme, "#6d28d9", "#7c3aed"),
  strIf(String.eq(accentOf(accent), "green"), byTheme(theme, "#0f7b55", "#12805a"),
  strIf(String.eq(accentOf(accent), "orange"), byTheme(theme, "#c2410c", "#c2410c"),
  strIf(String.eq(accentOf(accent), "pink"), byTheme(theme, "#c02667", "#c2255c"),
  strIf(String.eq(accentOf(accent), "graphite"), byTheme(theme, "#27272a", "#ededed"),
  byTheme(theme, "#2548c7", "#3b5bdb"))))))

# Tom de texto, link e glifo do acento (no escuro, mais claro que o fill).
def accentText(+theme: String, +accent: String) -> String:
  strIf(String.eq(accentOf(accent), "violet"), byTheme(theme, "#6d28d9", "#a78bfa"),
  strIf(String.eq(accentOf(accent), "green"), byTheme(theme, "#0f7b55", "#5fd3a4"),
  strIf(String.eq(accentOf(accent), "orange"), byTheme(theme, "#c2410c", "#fb9a6b"),
  strIf(String.eq(accentOf(accent), "pink"), byTheme(theme, "#c02667", "#f783ac"),
  strIf(String.eq(accentOf(accent), "graphite"), byTheme(theme, "#27272a", "#ededed"),
  byTheme(theme, "#2548c7", "#8fa8ff"))))))

# Texto sobre o preenchimento: branco, menos no grafite escuro (fill claro).
def accentFg(+theme: String, +accent: String) -> String:
  strIf(String.eq(accentOf(accent), "graphite"), byTheme(theme, "#ffffff", "#181818"), "#ffffff")

# ---------- paleta categórica ----------
#
# `--mesa-chart-1` é o acento (o tom de texto, legível sobre o fundo). As
# outras cinco têm lugar fixo e luminosidade fixa, alternando claro e escuro,
# para as vizinhas se separarem também em luminosidade (e na impressão em
# cinza): no claro, alto · baixo · alto · baixo · médio; no escuro, baixo · alto
# · baixo · alto · médio. Quando a família de um lugar é a do acento, entra a
# reserva do mesmo lugar (outro matiz, a mesma luminosidade). O teste do host
# mede contraste ≥ 3:1 contra o fundo e ΔL* ≥ 10 entre vizinhas, nos 12 casos.

def slot(+theme: String, +accent: String, family: String, light: String, dark: String, spareLight: String, spareDark: String) -> String:
  strIf(String.eq(accentOf(accent), family), byTheme(theme, spareLight, spareDark), byTheme(theme, light, dark))

def chartColors(+theme: String, +accent: String) -> List<&2, String>:
  [ accentText(theme, accent)
  , slot(theme, accent, "orange", "#c77700", "#d9480f", "#0b9b8f", "#0d9488")
  , slot(theme, accent, "violet", "#3b1782", "#c4b5fd", "#13423e", "#99f6e4")
  , slot(theme, accent, "pink", "#e0508a", "#db2777", "#1a8aa8", "#0d9488")
  , slot(theme, accent, "green", "#2f4a10", "#a3e635", "#1b2f78", "#93c5fd")
  , slot(theme, accent, "blue", "#3d6fd0", "#60a5fa", "#8a5a06", "#f59e0b")
  ]

# ---------- os tokens ----------

def fontSans() -> String:
  "-apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, sans-serif"

# A serifa dos PDFs do tutor (#39).
def fontSerif() -> String:
  "\"STIX Two Text\", \"Latin Modern Roman\", \"CMU Serif\", Palatino, \"Palatino Linotype\", \"Times New Roman\", serif"

def fontMono() -> String:
  "\"SF Mono\", SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace"

def radius() -> String:
  "8px"

def chartTokens.go(colors: List<&2, String>, +i: Nat) -> List<&2, Token>:
  match colors:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{Token{String.append("--mesa-chart-", Nat.show(i)), h}, chartTokens.go(t, Nat.add(i, 1n))}

def chartTokens(+theme: String, +accent: String) -> List<&2, Token>:
  chartTokens.go(chartColors(theme, accent), 1n)

# `--mesa-bg` é o fundo da coluna do tutor: o quadro some na conversa. Os nomes
# antigos (`--mesa-surface`, `--mesa-hover`, `--mesa-good`, `--mesa-bad`)
# continuam valendo para as atividades salvas.
def baseTokens(+theme: String, +accent: String) -> List<&2, Token>:
  [ Token{"--mesa-bg", byTheme(theme, "#f4f4f4", "#242424")}
  , Token{"--mesa-fg", byTheme(theme, "#272727", "#e4e4e4")}
  , Token{"--mesa-muted", byTheme(theme, "#525252", "#a6a6a6")}
  , Token{"--mesa-card", byTheme(theme, "#ffffff", "#2c2c2c")}
  , Token{"--mesa-surface", byTheme(theme, "#ffffff", "#2c2c2c")}
  , Token{"--mesa-hover", byTheme(theme, "#e8e8e8", "#333333")}
  , Token{"--mesa-border", byTheme(theme, "#dadada", "#3a3a3a")}
  , Token{"--mesa-input", byTheme(theme, "#c7c7c7", "#4a4a4a")}
  , Token{"--mesa-ring", accentText(theme, accent)}
  , Token{"--mesa-accent", accentFill(theme, accent)}
  , Token{"--mesa-accent-fg", accentFg(theme, accent)}
  , Token{"--mesa-accent-text", accentText(theme, accent)}
  , Token{"--mesa-good", byTheme(theme, "#15803d", "#34d399")}
  , Token{"--mesa-good-surface", byTheme(theme, "#e6f4ea", "#1d3a2c")}
  , Token{"--mesa-warn", byTheme(theme, "#b45309", "#fbbf24")}
  , Token{"--mesa-warn-surface", byTheme(theme, "#fdf2dc", "#3d3220")}
  , Token{"--mesa-bad", byTheme(theme, "#c4281c", "#f08a80")}
  , Token{"--mesa-bad-surface", byTheme(theme, "#fbe9e7", "#432624")}
  , Token{"--mesa-code-bg", byTheme(theme, "#ffffff", "#2c2c2c")}
  , Token{"--mesa-code-fg", byTheme(theme, "#272727", "#e4e4e4")}
  , Token{"--mesa-radius", radius()}
  , Token{"--mesa-font-sans", fontSans()}
  , Token{"--mesa-font-serif", fontSerif()}
  , Token{"--mesa-font-mono", fontMono()}
  ]

def mesaTokens(+theme: String, +accent: String) -> List<&2, Token>:
  List.append(&2, Token, baseTokens(theme, accent), chartTokens(theme, accent))

def valueOf(+name: String, tokens: List<&2, Token>) -> String:
  match tokens:
    case Nil{}:
      ""
    case Con{h, t}:
      match h:
        case Token{n, v}:
          strIf(String.eq(n, name), v, valueOf(name, t))

# Os nomes padrão do MCP Apps (ext-apps), espelhando os da Mesa — o mapeamento
# segue o `mcpAppStyleVariables` do T3 Code. Apps escritos para qualquer host
# MCP Apps pegam as cores e fontes da conversa.
def mcpPairs() -> List<&2, Token>:
  [ Token{"--color-background-primary", "--mesa-bg"}
  , Token{"--color-background-secondary", "--mesa-card"}
  , Token{"--color-background-tertiary", "--mesa-hover"}
  , Token{"--color-background-inverse", "--mesa-fg"}
  , Token{"--color-background-info", "--mesa-accent"}
  , Token{"--color-background-danger", "--mesa-bad-surface"}
  , Token{"--color-background-warning", "--mesa-warn-surface"}
  , Token{"--color-background-success", "--mesa-good-surface"}
  , Token{"--color-text-primary", "--mesa-fg"}
  , Token{"--color-text-secondary", "--mesa-muted"}
  , Token{"--color-text-tertiary", "--mesa-muted"}
  , Token{"--color-text-inverse", "--mesa-bg"}
  , Token{"--color-text-info", "--mesa-accent-text"}
  , Token{"--color-text-danger", "--mesa-bad"}
  , Token{"--color-text-success", "--mesa-good"}
  , Token{"--color-text-warning", "--mesa-warn"}
  , Token{"--color-border-primary", "--mesa-border"}
  , Token{"--color-border-secondary", "--mesa-input"}
  , Token{"--color-border-danger", "--mesa-bad"}
  , Token{"--color-ring-primary", "--mesa-ring"}
  , Token{"--font-sans", "--mesa-font-sans"}
  , Token{"--font-mono", "--mesa-font-mono"}
  , Token{"--border-radius-md", "--mesa-radius"}
  ]

def mcpTokens.go(pairs: List<&2, Token>, +mesa: List<&2, Token>) -> List<&2, Token>:
  match pairs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match h:
        case Token{name, from}:
          Con{Token{name, valueOf(from, mesa)}, mcpTokens.go(t, mesa)}

def mcpTokens(+theme: String, +accent: String) -> List<&2, Token>:
  mcpTokens.go(mcpPairs(), mesaTokens(theme, accent))

# Tudo o que o quadro recebe no `:root`: os da Mesa e o espelho MCP Apps.
def themeTokens(+theme: String, +accent: String) -> List<&2, Token>:
  List.append(&2, Token, mesaTokens(theme, accent), mcpTokens(theme, accent))

def schemeOf(+theme: String) -> String:
  byTheme(theme, "light", "dark")

def declarations(tokens: List<&2, Token>) -> String:
  match tokens:
    case Nil{}:
      ""
    case Con{h, t}:
      match h:
        case Token{n, v}:
          String.append(String.append(String.append(String.append(n, ":"), v), ";"), declarations(t))

# A regra `:root` pronta, para o documento já nascer pintado.
def rootCss(+theme: String, +accent: String) -> String:
  String.append(
    String.append(String.append(":root{color-scheme:", schemeOf(theme)), ";"),
    String.append(declarations(themeTokens(theme, accent)), "}")
  )
