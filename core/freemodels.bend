import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Modelos grátis do OpenCode Zen pelo Pi (#44). Módulo só da Mesa.
#
# A pessoa não paga plano de IA: a Mesa guarda a chave do Zen, descobre o que é
# grátis no catálogo do Pi e escolhe um padrão que não guarda nem treina com o
# que ela manda (foto do caderno, material do curso). O que não pode quebrar:
#
#   - o que vale como chave (colar outra coisa da área de transferência não
#     vira "Usar esta chave?") e como ela aparece mascarada;
#   - o que vale como modelo grátis, e a frase de privacidade de cada um;
#   - o padrão: o primeiro da lista de retenção zero que o Pi oferece, nunca um
#     que treina com os dados;
#   - a frase do teste da chave (rede, chave inválida, conta sem cobrança);
#   - o aviso único antes de um modelo pago.
#
# Fronteira de host: ler a área de transferência, o arquivo do OpenCode, o
# cofre do sistema, a rede e o catálogo do Pi é do host (`desk/opencode-host.cjs`);
# o núcleo recebe o fato já lido. A tabela de política por modelo (com a data e
# a fonte) é dado da Mesa (`desk/free-models.json`), entregue como texto.
# ---------------------------------------------------------------------------

def zenProvider() -> String:
  "opencode"

# ---------- chave ----------

# Os tetos são folgados de propósito: o formato real da chave não é publicado e
# o teste na lista de modelos é quem diz se ela vale. O que este núcleo barra é
# texto que NÃO PODE ser chave (espaço, quebra de linha, URL, frase).
def keyPrefix() -> String:
  "sk-"

def keyChar(+c: Char) -> Bool:
  Bool.or(
    Bool.or(Char.is_digit(c), Char.is_alpha(c)),
    Bool.or(Char.is_eq(c, '-'), Char.is_eq(c, '_'))
  )

def keyChars(+s: String) -> Bool:
  match s:
    case SNil{}:
      True{}
    case SCon{h, t}:
      Bool.and(keyChar(h), keyChars(t))

# Entre 20 e 200 caracteres: `drop` é vazio quando a chave tem no máximo `n`.
def keyLength(+key: String) -> Bool:
  Bool.and(
    Bool.not(String.is_empty(String.drop(key, 19n))),
    String.is_empty(String.drop(key, 200n))
  )

# Campo manual: qualquer texto com cara de chave (sem exigir o prefixo).
def typedKey(+key: String) -> Bool:
  Bool.and(keyLength(key), keyChars(key))

# Área de transferência: exige o prefixo `sk-`, para não oferecer toda cópia.
def clipboardKey(+key: String) -> Bool:
  Bool.and(String.starts_with(key, keyPrefix()), typedKey(key))

def lastFour(+key: String) -> String:
  String.reverse(String.take(String.reverse(key), 4n))

def mask.show(valid: Bool, +key: String) -> String:
  match valid:
    case True{}:
      String.append(String.take(key, 3n), String.append("••••", lastFour(key)))
    case False{}:
      "••••"

# O que a tela mostra no lugar da chave: o prefixo e os quatro últimos.
def mask(+key: String) -> String:
  mask.show(typedKey(key), key)

# ---------- teste da chave ----------

# O host chama só a lista de modelos, sem inferência, e entrega o fato: falha de
# rede ou o código HTTP. 200 vale; 401 é chave recusada; 402/403 é conta sem
# cobrança configurada; qualquer outro código é dito como inesperado.
def outcomeBilling(billing: Bool) -> String:
  match billing:
    case True{}:
      "billing"
    case False{}:
      "unexpected"

def outcomeInvalid(invalid: Bool, billing: Bool) -> String:
  match invalid:
    case True{}:
      "invalid"
    case False{}:
      outcomeBilling(billing)

def outcomePick(ok: Bool, invalid: Bool, billing: Bool) -> String:
  match ok:
    case True{}:
      "ok"
    case False{}:
      outcomeInvalid(invalid, billing)

def outcomeStatus(+status: Nat) -> String:
  outcomePick(
    Nat.is_eq(status, 200n),
    Nat.is_eq(status, 401n),
    Bool.or(Nat.is_eq(status, 402n), Nat.is_eq(status, 403n))
  )

def outcome(network: Bool, +status: Nat) -> String:
  match network:
    case True{}:
      "network"
    case False{}:
      outcomeStatus(status)

# Antes da rede: texto que não pode ser chave nem chega a ser testado.
def outcomeFor(shapeOk: Bool, network: Bool, +status: Nat) -> String:
  match shapeOk:
    case True{}:
      outcome(network, status)
    case False{}:
      "shape"

def outcomeMsgShape(isShape: Bool) -> String:
  match isShape:
    case True{}:
      M.msg("freeModels.test.shape")
    case False{}:
      M.msg("freeModels.test.unexpected")

def outcomeMsgNetwork(isNetwork: Bool, +outcome: String) -> String:
  match isNetwork:
    case True{}:
      M.msg("freeModels.test.network")
    case False{}:
      outcomeMsgShape(String.eq(outcome, "shape"))

def outcomeMsgBilling(isBilling: Bool, +outcome: String) -> String:
  match isBilling:
    case True{}:
      M.msg("freeModels.test.billing")
    case False{}:
      outcomeMsgNetwork(String.eq(outcome, "network"), outcome)

def outcomeMsgInvalid(isInvalid: Bool, +outcome: String) -> String:
  match isInvalid:
    case True{}:
      M.msg("freeModels.test.invalid")
    case False{}:
      outcomeMsgBilling(String.eq(outcome, "billing"), outcome)

def outcomeMsgOk(isOk: Bool, +outcome: String) -> String:
  match isOk:
    case True{}:
      M.msg("freeModels.test.ok")
    case False{}:
      outcomeMsgInvalid(String.eq(outcome, "invalid"), outcome)

# A frase (chave do catálogo) de cada resultado do teste.
def outcomeMsg(+outcome: String) -> String:
  outcomeMsgOk(String.eq(outcome, "ok"), outcome)

# Só a chave que o teste aprovou é guardada.
def keepsKey(+outcome: String) -> Bool:
  String.eq(outcome, "ok")

# ---------- modelo grátis ----------

# Grátis é do Zen (provedor `opencode`) E custo zero no catálogo do Pi, ou id
# terminado em `-free`, ou `big-pickle` (grátis sem o sufixo no nome).
def isFree(+provider: String, +id: String, costZero: Bool) -> Bool:
  Bool.and(
    String.eq(provider, zenProvider()),
    Bool.or(
      costZero,
      Bool.or(String.ends_with(id, "-free"), String.eq(id, "big-pickle"))
    )
  )

# ---------- grátis do OpenRouter ----------

def routerProvider() -> String:
  "openrouter"

# O roteador automático não tem preço próprio: cobra o do modelo que escolher.
def routerAuto() -> String:
  "openrouter/auto"

# Grátis no OpenRouter (ajustes do seletor): o id com o sufixo `:free` (o nome
# vem com "(free)") ou custo zero COMPROVADO no catálogo — o host só diz
# `costZero` quando o preço existe e é zero na entrada e na saída; preço ausente
# não é grátis. O roteador automático nunca é grátis. Outros provedores com
# custo zero no catálogo (assinatura, modelo local) não ganham a marca: a pessoa
# leria "grátis" e pagaria.
def isRouterFree(+provider: String, +id: String, costZero: Bool) -> Bool:
  Bool.and(
    String.eq(provider, routerProvider()),
    Bool.and(
      Bool.not(String.eq(id, routerAuto())),
      Bool.or(String.ends_with(id, ":free"), costZero)
    )
  )

# A regra única do selo Grátis: o Zen (`isFree`) ou o OpenRouter (`isRouterFree`).
def isFreeModel(+provider: String, +id: String, +costZero: Bool) -> Bool:
  Bool.or(isFree(provider, id, costZero), isRouterFree(provider, id, costZero))

def paidNeedsConfirmPick(zen: Bool, free: Bool, confirmed: Bool) -> Bool:
  Bool.and(zen, Bool.and(Bool.not(free), Bool.not(confirmed)))

# Escolher um modelo pago do Zen pede confirmação uma vez; grátis e outros
# provedores nunca pedem.
def paidNeedsConfirm(+provider: String, free: Bool, confirmed: Bool) -> Bool:
  paidNeedsConfirmPick(String.eq(provider, zenProvider()), free, confirmed)

# "Pode ter saído do plano gratuito": só com a lista ao vivo conferida e o
# modelo ausente dela. Sem rede (lista desconhecida), nenhum aviso.
def mayHaveLeft(free: Bool, liveKnown: Bool, inLive: Bool) -> Bool:
  Bool.and(free, Bool.and(liveKnown, Bool.not(inLive)))

# ---------- política de dados ----------

# `zero` = não guarda nem treina; `retained` = não treina, guarda 30 dias;
# `improve` = pode usar para melhorar/treinar; `trial` = só teste, sem dados
# pessoais; `train` = treina modelos da Meta. Fora disso: sem informação.
def policyTrain(train: Bool) -> String:
  match train:
    case True{}:
      M.msg("freeModels.policy.train")
    case False{}:
      M.msg("freeModels.policy.unknown")

def policyTrial(trial: Bool, train: Bool) -> String:
  match trial:
    case True{}:
      M.msg("freeModels.policy.trial")
    case False{}:
      policyTrain(train)

def policyImprove(improve: Bool, trial: Bool, train: Bool) -> String:
  match improve:
    case True{}:
      M.msg("freeModels.policy.improve")
    case False{}:
      policyTrial(trial, train)

def policyRetained(retained: Bool, improve: Bool, trial: Bool, train: Bool) -> String:
  match retained:
    case True{}:
      M.msg("freeModels.policy.retained")
    case False{}:
      policyImprove(improve, trial, train)

def policyKnown(zero: Bool, retained: Bool, improve: Bool, trial: Bool, train: Bool) -> String:
  match zero:
    case True{}:
      M.msg("freeModels.policy.zero")
    case False{}:
      policyRetained(retained, improve, trial, train)

def policyMsg(+policy: String) -> String:
  policyKnown(
    String.eq(policy, "zero"),
    String.eq(policy, "retained"),
    String.eq(policy, "improve"),
    String.eq(policy, "trial"),
    String.eq(policy, "train")
  )

# Só `zero` serve de padrão: nunca um modelo que guarda ou treina com os dados.
def isZeroRetention(+policy: String) -> Bool:
  String.eq(policy, "zero")

# ---------- seletor ----------

def appendTail(xs: List<&2, String>, x: String) -> List<&2, String>:
  match xs:
    case Nil{}:
      Con{x, Nil{}}
    case Con{h, t}:
      Con{h, appendTail(t, x)}

def optionTailLeft(left: Bool, base: List<&2, String>) -> List<&2, String>:
  match left:
    case True{}:
      appendTail(base, M.msg("freeModels.maybeLeft"))
    case False{}:
      base

def optionTailFree(free: Bool, +policy: String, left: Bool) -> List<&2, String>:
  match free:
    case True{}:
      optionTailLeft(left, [M.msg("freeModels.badge"), policyMsg(policy)])
    case False{}:
      Nil{}

# O que vai depois do nome no seletor: a marca Grátis, a política e, se for o
# caso, o aviso de que pode ter saído do plano. Pago: nada.
def optionTail(free: Bool, +policy: String, left: Bool) -> List<&2, String>:
  optionTailFree(free, policy, left)

# ---------- padrão recomendado ----------

def hasId(xs: List<&2, String>, +id: String) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, t}:
      Bool.or(String.eq(h, id), hasId(t, id))

def pickDefaultPick(hit: Bool, h: String, rest: String) -> String:
  match hit:
    case True{}:
      h
    case False{}:
      rest

# O primeiro da lista de preferência (retenção zero, em ordem) que o Pi oferece;
# vazio se nenhum estiver no catálogo — a Mesa então não escolhe por conta.
def pickDefault(preferred: List<&2, String>, +available: List<&2, String>) -> String:
  match preferred:
    case Nil{}:
      ""
    case Con{+h, t}:
      pickDefaultPick(hasId(available, h), h, pickDefault(t, available))

def doneMsgPick(none: Bool) -> String:
  match none:
    case True{}:
      M.msg("freeModels.done.none")
    case False{}:
      M.msg("freeModels.done.zero")

# A frase do fim do fluxo: padrão de retenção zero escolhido, ou chave guardada
# sem modelo grátis de retenção zero no catálogo atual do Pi.
def doneMsg(+chosen: String) -> String:
  doneMsgPick(String.is_empty(chosen))
