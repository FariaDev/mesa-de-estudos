import Base
import ../msg.bend as M
import ../activityview.bend as A

# ---------------------------------------------------------------------------
# Contrato das visualizações e atividades no chat (#42, parte B). Prefixo
# `quadro_`. Cenários concretos: `String.eq` só reduz em texto fechado.
# ---------------------------------------------------------------------------

# Nenhuma cor repetida numa lista (a paleta categórica).
def member(+x: String, xs: List<&2, String>) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, t}:
      Bool.or(String.eq(x, h), member(x, t))

def distinct(xs: List<&2, String>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{+h, +t}:
      Bool.and(Bool.not(member(h, t)), distinct(t))

def paletteOk(+theme: String, +accent: String) -> Bool:
  Bool.and(
    distinct(A.chartColors(theme, accent)),
    Nat.is_eq(List.length(&2, String, A.chartColors(theme, accent)), 6n)
  )

def palettesOk.go(+theme: String, accents: List<&2, String>) -> Bool:
  match accents:
    case Nil{}:
      True{}
    case Con{+h, t}:
      Bool.and(paletteOk(theme, h), palettesOk.go(theme, t))

# ---------- tipo ----------

law quadro_tipo_visualizacao:
  {A.kindOf("visualizacao") == "visualizacao" : String}

# Sem o campo (atividades salvas antes do #42) ou com outro valor: atividade.
law quadro_tipo_vazio_e_atividade:
  {A.kindOf("") == "atividade" : String}

law quadro_tipo_outro_e_atividade:
  {A.kindOf("grafico") == "atividade" : String}

# Visualização: só a tela cheia. Atividade: tela cheia, recomeçar, parar e
# "Levar ao tutor".
law quadro_controles_visualizacao:
  {A.controlIds("visualizacao") == ["fullscreen"] : List<&2, String>}

law quadro_controles_atividade:
  {A.controlIds("atividade") == ["fullscreen", "restart", "stop", "bring"] : List<&2, String>}

law quadro_controles_antiga:
  {A.controlIds("") == ["fullscreen", "restart", "stop", "bring"] : List<&2, String>}

law quadro_visualizacao_sem_levar:
  {A.showsBring("visualizacao") == False{} : Bool}

law quadro_atividade_leva:
  {A.showsBring("atividade") == True{} : Bool}

# ---------- textos ----------

law quadro_texto_tela_cheia:
  {A.fullscreenLabel() == M.msg("activity.fullscreen") : String}

law quadro_texto_levar:
  {A.bringLabel() == M.msg("activity.bring") : String}

law quadro_texto_descricao:
  {A.descriptionLabel() == M.msg("activity.description") : String}

law quadro_titulo_do_quadro:
  {A.frameTitle("visualizacao", "Derivada") == M.msg2("activity.frameTitle", "kind", "activity.kind.viz", "title", "Derivada") : String}

# ---------- altura ----------

law quadro_altura_piso:
  {A.clampHeight(10n) == 48n : Nat}

law quadro_altura_teto:
  {A.clampHeight(2000n) == 1200n : Nat}

law quadro_altura_dentro:
  {A.clampHeight(300n) == 300n : Nat}

law quadro_larguras_medidas:
  {A.measureWidths() == [320n, 375n, 430n, 520n, 640n, 728n, 860n, 1000n, 1144n] : List<&2, Nat>}

def pairs() -> List<&2, A.HeightPair>:
  [A.HeightPair{320n, 500n}, A.HeightPair{728n, 300n}, A.HeightPair{1144n, 200n}]

# Largura medida: a altura dela.
law quadro_altura_largura_exata:
  {A.heightAt(pairs(), 728n) == 300n : Nat}

# Entre duas larguras medidas: a mais alta das duas vizinhas.
law quadro_altura_entre_vizinhas:
  {A.heightAt(pairs(), 600n) == 500n : Nat}

law quadro_altura_entre_vizinhas_acima:
  {A.heightAt(pairs(), 900n) == 300n : Nat}

# Fora da faixa medida: a ponta mais próxima.
law quadro_altura_acima_da_maior:
  {A.heightAt(pairs(), 1400n) == 200n : Nat}

law quadro_altura_abaixo_da_menor:
  {A.heightAt(pairs(), 300n) == 500n : Nat}

# Sem medição: 0, e o host segue a medição viva.
law quadro_altura_sem_medicao:
  for width: Nat
  {A.initialHeight([], width) == 0n : Nat}

law quadro_altura_inicial_no_teto:
  {A.initialHeight([A.HeightPair{390n, 2400n}], 390n) == 1200n : Nat}

law quadro_altura_inicial:
  {A.initialHeight(pairs(), 728n) == 300n : Nat}

# ---------- tokens ----------

# O fundo do quadro é o da coluna do tutor: some na conversa.
law quadro_fundo_claro:
  {A.valueOf("--mesa-bg", A.mesaTokens("light", "blue")) == "#f4f4f4" : String}

law quadro_fundo_escuro:
  {A.valueOf("--mesa-bg", A.mesaTokens("dark", "blue")) == "#242424" : String}

law quadro_serifa_dos_pdfs:
  {A.valueOf("--mesa-font-serif", A.mesaTokens("light", "blue")) == A.fontSerif() : String}

law quadro_raio:
  {A.valueOf("--mesa-radius", A.mesaTokens("dark", "pink")) == "8px" : String}

# O acento segue a escolha da Mesa; desconhecido cai no azul.
law quadro_acento_verde_escuro:
  {A.valueOf("--mesa-accent", A.mesaTokens("dark", "green")) == "#12805a" : String}

law quadro_acento_desconhecido:
  {A.accentOf("ciano") == "blue" : String}

law quadro_grafite_texto_sobre_acento:
  {A.valueOf("--mesa-accent-fg", A.mesaTokens("dark", "graphite")) == "#181818" : String}

# Paleta: a primeira cor é o acento (tom de texto) e nenhuma se repete, nos
# dois temas e nos seis acentos.
law quadro_paleta_comeca_no_acento:
  {A.valueOf("--mesa-chart-1", A.mesaTokens("dark", "violet")) == "#a78bfa" : String}

law quadro_paleta_seis_distintas_claro:
  {palettesOk.go("light", A.accentIds()) == True{} : Bool}

law quadro_paleta_seis_distintas_escuro:
  {palettesOk.go("dark", A.accentIds()) == True{} : Bool}

# A família do acento cede o lugar à reserva, sem mexer nos outros lugares.
law quadro_paleta_reserva_no_lugar_do_acento:
  {A.chartColors("light", "orange")
    == ["#c2410c", "#0b9b8f", "#3b1782", "#e0508a", "#2f4a10", "#3d6fd0"] : List<&2, String>}

law quadro_paleta_escuro_azul:
  {A.chartColors("dark", "blue")
    == ["#8fa8ff", "#d9480f", "#c4b5fd", "#db2777", "#a3e635", "#f59e0b"] : List<&2, String>}

# Os nomes do MCP Apps espelham os da Mesa.
law quadro_mcp_fundo:
  {A.valueOf("--color-background-primary", A.themeTokens("dark", "green")) == "#242424" : String}

law quadro_mcp_texto:
  {A.valueOf("--color-text-primary", A.themeTokens("light", "blue")) == "#272727" : String}

law quadro_mcp_anel:
  {A.valueOf("--color-ring-primary", A.themeTokens("dark", "pink")) == "#f783ac" : String}

law quadro_css_comeca_pelo_esquema:
  {String.starts_with(A.rootCss("dark", "blue"), ":root{color-scheme:dark;--mesa-bg:#242424;") == True{} : Bool}
