import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Modelos de PDF do tutor (ticket #39). Módulo só da Mesa: a Conversa não gera
# material e não importa daqui.
#
# O PDF do tutor deixou de ter um casco só: Lista, Apostila, Resumo, Simulado e
# Formulário, mais o `livre` (o casco de sempre — PDFs antigos e pedidos sem
# modelo não mudam). Este núcleo decide o que não pode quebrar; o host só mede
# e aplica:
#
#   - a lista e a ordem dos modelos, com nome e a frase de cada um;
#   - qual modelo vale (pedido do tutor → último escolhido na matéria → livre);
#   - as opções válidas de cada modelo, seus padrões e a limpeza do valor;
#   - quantas colunas o "Auto" escolhe a partir da largura medida do item mais
#     largo (a mesma medição, depois das fontes, de `measureMaterialMath`);
#   - a altura do espaço de resposta do Simulado;
#   - o rótulo "Auto · 3" e a frase de estado do rodapé do diálogo.
#
# Convenções do host (texto puro, nunca caminho nem HTML):
#   - o modelo é uma das strings `lista`, `apostila`, `resumo`, `simulado`,
#     `formulario`, `livre`; qualquer outra coisa (ausente, tipo errado, caixa
#     diferente, espaço sobrando) é "desconhecido" e cai no fallback;
#   - a chave de opção é uma de `colunas`, `gabarito`, `rodape`, `equacoes`,
#     `recuo`, `capitulo`, `regra`, `revisao`, `valor`, `espaco`, `umafolha`;
#   - colunas viajam como string: `auto`, `1`, `2`, `3`;
#   - larguras chegam em px inteiros (o host arredonda para cima).
#
# Sem referência para frente: helpers vêm antes de quem chama. `String.eq` só
# reduz em literal concreto — por isso as leis usam nomes concretos.
# ---------------------------------------------------------------------------

type MaterialModel is Data:
  ModelLista{}
  ModelApostila{}
  ModelResumo{}
  ModelSimulado{}
  ModelFormulario{}
  ModelLivre{}

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

def boolIf(hit: Bool, found: Bool, rest: Bool) -> Bool:
  match hit:
    case True{}:
      found
    case False{}:
      rest

def modelIf(hit: Bool, found: MaterialModel, rest: MaterialModel) -> MaterialModel:
  match hit:
    case True{}:
      found
    case False{}:
      rest

def both(a: Bool, b: Bool) -> Bool:
  boolIf(a, b, False{})

def either(a: Bool, b: Bool) -> Bool:
  boolIf(a, True{}, b)

# ---------- os modelos ----------

def modelCount() -> Nat:
  6n

def modelId(m: MaterialModel) -> String:
  match m:
    case ModelLista{}:
      "lista"
    case ModelApostila{}:
      "apostila"
    case ModelResumo{}:
      "resumo"
    case ModelSimulado{}:
      "simulado"
    case ModelFormulario{}:
      "formulario"
    case ModelLivre{}:
      "livre"

def modelDefault() -> MaterialModel:
  ModelLivre{}

# Cada modelo na ordem do seletor do diálogo; o livre fecha a fila.
def modelAt(+i: Nat) -> MaterialModel:
  modelIf(
    Nat.is_eq(i, 0n), ModelLista{},
    modelIf(
      Nat.is_eq(i, 1n), ModelApostila{},
      modelIf(
        Nat.is_eq(i, 2n), ModelResumo{},
        modelIf(
          Nat.is_eq(i, 3n), ModelSimulado{},
          modelIf(Nat.is_eq(i, 4n), ModelFormulario{}, ModelLivre{})
        )
      )
    )
  )

def modelIdAt(i: Nat) -> String:
  modelId(modelAt(i))

def parseModel(+raw: String, fallback: MaterialModel) -> MaterialModel:
  modelIf(
    String.eq(raw, "lista"), ModelLista{},
    modelIf(
      String.eq(raw, "apostila"), ModelApostila{},
      modelIf(
        String.eq(raw, "resumo"), ModelResumo{},
        modelIf(
          String.eq(raw, "simulado"), ModelSimulado{},
          modelIf(
            String.eq(raw, "formulario"), ModelFormulario{},
            modelIf(String.eq(raw, "livre"), ModelLivre{}, fallback)
          )
        )
      )
    )
  )

def modelOrDefault(value: Maybe<&2, String>, fallback: MaterialModel) -> MaterialModel:
  match value:
    case None{}:
      fallback
    case Some{raw}:
      parseModel(raw, fallback)

# O id é conhecido? (O host usa para recusar `modelo` inválido no pedido.)
def isKnownModel(+raw: String) -> Bool:
  either(
    String.eq(raw, "lista"),
    either(
      String.eq(raw, "apostila"),
      either(
        String.eq(raw, "resumo"),
        either(
          String.eq(raw, "simulado"),
          either(String.eq(raw, "formulario"), String.eq(raw, "livre"))
        )
      )
    )
  )

# Chave do catálogo do nome; `statusPhrase` a passa como `{model:key}` porque
# uma mensagem não entra como argumento de outra.
def modelLabelKey(m: MaterialModel) -> String:
  match m:
    case ModelLista{}:
      "material.model.lista"
    case ModelApostila{}:
      "material.model.apostila"
    case ModelResumo{}:
      "material.model.resumo"
    case ModelSimulado{}:
      "material.model.simulado"
    case ModelFormulario{}:
      "material.model.formulario"
    case ModelLivre{}:
      "material.model.livre"

def modelLabel(m: MaterialModel) -> String:
  M.msg(modelLabelKey(m))

def modelBlurb(m: MaterialModel) -> String:
  match m:
    case ModelLista{}:
      M.msg("material.blurb.lista")
    case ModelApostila{}:
      M.msg("material.blurb.apostila")
    case ModelResumo{}:
      M.msg("material.blurb.resumo")
    case ModelSimulado{}:
      M.msg("material.blurb.simulado")
    case ModelFormulario{}:
      M.msg("material.blurb.formulario")
    case ModelLivre{}:
      M.msg("material.blurb.livre")

# Nome (o que o seletor mostra) e frase de um modelo a partir do id do host.
def labelOf(raw: String) -> String:
  modelLabel(parseModel(raw, modelDefault()))

def labelKeyOf(raw: String) -> String:
  modelLabelKey(parseModel(raw, modelDefault()))

def blurbOf(raw: String) -> String:
  modelBlurb(parseModel(raw, modelDefault()))

# ---------- qual modelo vale ----------
#
# Pedido do tutor (`modelo`) → último escolhido nesta matéria/sessão → livre.
# Valor inválido num degrau cai no degrau seguinte, nunca em erro.

def resolveModel(requested: Maybe<&2, String>, last: Maybe<&2, String>) -> MaterialModel:
  modelOrDefault(requested, modelOrDefault(last, modelDefault()))

def resolveModelId(requested: Maybe<&2, String>, last: Maybe<&2, String>) -> String:
  modelId(resolveModel(requested, last))

# De onde veio o modelo que valeu: `agent`, `last` ou `default`. Alimenta a
# frase do rodapé do diálogo.
def sourceOfValue(value: Maybe<&2, String>) -> Bool:
  match value:
    case None{}:
      False{}
    case Some{raw}:
      isKnownModel(raw)

def resolveSource(requested: Maybe<&2, String>, last: Maybe<&2, String>) -> String:
  strIf(sourceOfValue(requested), "agent", strIf(sourceOfValue(last), "last", "default"))

# ---------- opções de cada modelo ----------

def optionCount(m: MaterialModel) -> Nat:
  match m:
    case ModelLista{}:
      3n
    case ModelApostila{}:
      3n
    case ModelResumo{}:
      2n
    case ModelSimulado{}:
      3n
    case ModelFormulario{}:
      2n
    case ModelLivre{}:
      0n

def optionKeyAt(m: MaterialModel, +i: Nat) -> String:
  match m:
    case ModelLista{}:
      strIf(Nat.is_eq(i, 0n), "colunas", strIf(Nat.is_eq(i, 1n), "gabarito", strIf(Nat.is_eq(i, 2n), "rodape", "")))
    case ModelApostila{}:
      strIf(Nat.is_eq(i, 0n), "equacoes", strIf(Nat.is_eq(i, 1n), "recuo", strIf(Nat.is_eq(i, 2n), "capitulo", "")))
    case ModelResumo{}:
      strIf(Nat.is_eq(i, 0n), "regra", strIf(Nat.is_eq(i, 1n), "revisao", ""))
    case ModelSimulado{}:
      strIf(Nat.is_eq(i, 0n), "valor", strIf(Nat.is_eq(i, 1n), "espaco", strIf(Nat.is_eq(i, 2n), "gabarito", "")))
    case ModelFormulario{}:
      strIf(Nat.is_eq(i, 0n), "colunas", strIf(Nat.is_eq(i, 1n), "umafolha", ""))
    case ModelLivre{}:
      ""

# O tipo do controle: `columns`, `space`, `text` ou `flag` (caixa de marcar).
def optionKind(+key: String) -> String:
  strIf(
    String.eq(key, "colunas"), "columns",
    strIf(
      String.eq(key, "espaco"), "space",
      strIf(
        either(String.eq(key, "rodape"), String.eq(key, "capitulo")), "text",
        "flag"
      )
    )
  )

# "gabarito" é a única chave com texto diferente por modelo.
def optionLabelGabarito(m: MaterialModel) -> String:
  match m:
    case ModelSimulado{}:
      M.msg("material.option.gabaritoSeparate")
    case _:
      M.msg("material.option.gabaritoEnd")

def optionLabel(m: MaterialModel, +key: String) -> String:
  strIf(
    String.eq(key, "colunas"), M.msg("material.option.colunas"),
    strIf(
      String.eq(key, "rodape"), M.msg("material.option.rodape"),
      strIf(
        String.eq(key, "equacoes"), M.msg("material.option.equacoes"),
        strIf(
          String.eq(key, "recuo"), M.msg("material.option.recuo"),
          strIf(
            String.eq(key, "capitulo"), M.msg("material.option.capitulo"),
            strIf(
              String.eq(key, "regra"), M.msg("material.option.regra"),
              strIf(
                String.eq(key, "revisao"), M.msg("material.option.revisao"),
                strIf(
                  String.eq(key, "valor"), M.msg("material.option.valor"),
                  strIf(
                    String.eq(key, "espaco"), M.msg("material.option.espaco"),
                    strIf(
                      String.eq(key, "umafolha"), M.msg("material.option.umafolha"),
                      optionLabelGabarito(m)
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )

# ---------- valores padrão e limpeza ----------

# Caixas de marcar: o padrão de cada uma. Ausente ou de tipo errado entra como
# `None` e vale o padrão — o valor marcado pelo usuário/tutor vem como `Some`.
def flagDefault(m: MaterialModel, +key: String) -> Bool:
  match m:
    case ModelLista{}:
      String.eq(key, "gabarito")
    case ModelApostila{}:
      either(String.eq(key, "equacoes"), String.eq(key, "recuo"))
    case ModelResumo{}:
      either(String.eq(key, "regra"), String.eq(key, "revisao"))
    case ModelSimulado{}:
      either(String.eq(key, "valor"), String.eq(key, "gabarito"))
    case ModelFormulario{}:
      False{}
    case ModelLivre{}:
      False{}

def flagOr(value: Maybe<&2, Bool>, fallback: Bool) -> Bool:
  match value:
    case None{}:
      fallback
    case Some{flag}:
      flag

def maxOptionText() -> Nat:
  80n

# Espaço para responder (Simulado): pequeno, médio ou grande. Padrão: médio.
def spaceDefault() -> String:
  "medio"

def parseSpace(+raw: String) -> String:
  strIf(
    String.eq(raw, "pequeno"), "pequeno",
    strIf(
      String.eq(raw, "medio"), "medio",
      strIf(String.eq(raw, "grande"), "grande", spaceDefault())
    )
  )

def spaceChoice(value: Maybe<&2, String>) -> String:
  match value:
    case None{}:
      spaceDefault()
    case Some{raw}:
      parseSpace(raw)

def spaceLabel(+raw: String) -> String:
  strIf(
    String.eq(raw, "pequeno"), M.msg("material.space.pequeno"),
    strIf(String.eq(raw, "grande"), M.msg("material.space.grande"), M.msg("material.space.medio"))
  )

# Colunas: `auto` (a Mesa mede) ou um número fixo. Lista aceita 1, 2 e 3;
# Formulário só 2 e 3 (uma coluna não é formulário). Fora disso: `auto`.
def columnsDefault() -> String:
  "auto"

def columnsAllowed(m: MaterialModel, +raw: String) -> Bool:
  match m:
    case ModelLista{}:
      either(
        String.eq(raw, "auto"),
        either(String.eq(raw, "1"), either(String.eq(raw, "2"), String.eq(raw, "3")))
      )
    case ModelFormulario{}:
      either(String.eq(raw, "auto"), either(String.eq(raw, "2"), String.eq(raw, "3")))
    case _:
      False{}

def columnsKeep(m: MaterialModel, +raw: String) -> String:
  strIf(columnsAllowed(m, raw), raw, columnsDefault())

def columnsChoice(m: MaterialModel, value: Maybe<&2, String>) -> String:
  match value:
    case None{}:
      columnsDefault()
    case Some{raw}:
      columnsKeep(m, raw)

# ---------- Auto: colunas pela largura do item mais largo ----------
#
# O host mede o item mais largo (px, depois das fontes), a largura útil da
# folha e o vão entre colunas. N colunas cabem quando
# `N * largura + (N - 1) * vão <= disponível`. Vale a maior contagem permitida
# que cabe; se nem a menor cabe, fica a menor (Lista 1, Formulário 2).

def columnsMax(m: MaterialModel) -> Nat:
  match m:
    case ModelLista{}:
      3n
    case ModelFormulario{}:
      3n
    case _:
      1n

def columnsMin(m: MaterialModel) -> Nat:
  match m:
    case ModelFormulario{}:
      2n
    case _:
      1n

def colsFit(+n: Nat, widest: Nat, available: Nat, gap: Nat) -> Bool:
  Nat.is_le(Nat.add(Nat.mul(n, widest), Nat.mul(Nat.sub(n, 1n), gap)), available)

def autoPick(+max: Nat, min: Nat, +widest: Nat, +available: Nat, +gap: Nat) -> Nat:
  natIf(
    both(Nat.is_ge(max, 3n), colsFit(3n, widest, available, gap)), 3n,
    natIf(both(Nat.is_ge(max, 2n), colsFit(2n, widest, available, gap)), 2n, min)
  )

def autoColumns(+m: MaterialModel, +widest: Nat, +available: Nat, +gap: Nat) -> Nat:
  autoPick(columnsMax(m), columnsMin(m), widest, available, gap)

# Número de colunas que vale: o fixo escolhido ou o que o Auto mediu.
def columnsLabel(+choice: String, +auto: Nat) -> String:
  strIf(String.eq(choice, "auto"), String.append("Auto · ", Nat.show(auto)), choice)

# ---------- Simulado: altura do espaço de resposta ----------
#
# Em mm da folha. Grande deixa duas questões por página (2 × (80 + enunciado)
# cabem nos 259 mm úteis; três não). "Resposta longa" marca a questão e sobe um
# degrau; no Grande vai a 110 mm — uma questão por página.

def answerHeightMm(+size: String, +long: Bool) -> Nat:
  natIf(
    String.eq(size, "pequeno"), natIf(long, 36n, 22n),
    natIf(String.eq(size, "grande"), natIf(long, 110n, 80n), natIf(long, 80n, 36n))
  )

# ---------- frases do rodapé do diálogo ----------

def phrasePedido(+label: String) -> String:
  M.msg1("material.status.agent", "model", label)

def phraseLast(+label: String) -> String:
  M.msg1("material.status.last", "model", label)

def phraseDefault(+label: String) -> String:
  M.msg1("material.status.default", "model", label)

def phraseChanged(+label: String) -> String:
  M.msg1("material.status.changed", "model", label)

# `source`: `agent`, `last` ou `default` (de `resolveSource`) ou `changed`
# quando o usuário trocou o cartão. Desconhecido cai na frase de padrão.
def statusPhrase(+source: String, +model: String) -> String:
  strIf(
    String.eq(source, "agent"), phrasePedido(labelKeyOf(model)),
    strIf(
      String.eq(source, "last"), phraseLast(labelKeyOf(model)),
      strIf(
        String.eq(source, "changed"), phraseChanged(labelKeyOf(model)),
        phraseDefault(labelKeyOf(model))
      )
    )
  )

# "página 2 de 5": o contador da prévia rolável.
def pageOf(page: Nat, total: Nat) -> String:
  M.msg2("material.pageOf", "page", Nat.show(page), "total", Nat.show(total))

# ---------- Formulário: caber numa folha ----------
#
# O host mede a altura do conteúdo e, enquanto passa da folha, pede o próximo
# passo de escala (em %). Parte de 100, desce de 4 em 4 e para no piso de 60:
# abaixo disso a letra deixa de ser legível e o host só avisa que não coube.

def fitStart() -> Nat:
  100n

def fitFloor() -> Nat:
  60n

def fitStep() -> Nat:
  4n

def fitNext(+p: Nat) -> Nat:
  natIf(Nat.is_le(p, Nat.add(fitFloor(), fitStep())), fitFloor(), Nat.sub(p, fitStep()))

def fitDone(p: Nat) -> Bool:
  Nat.is_le(p, fitFloor())
