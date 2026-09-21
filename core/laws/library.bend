import Base
import ../library.bend as L

# ---------------------------------------------------------------------------
# Leis do núcleo da biblioteca (Mesa).
#
# O host entrega os fatos (quais arquivos casam com o prefer deste painel e com
# o dos outros) e a máscara de usados; o núcleo escolhe. Estas leis dizem o
# contrato: cenários de nome (dobra de acentos/caixa), cenários de escolha,
# contratos das três buscas e a composição do passo.
#
# Propriedades parametrizadas pelo RESULTADO (Maybe índice): o resultado de uma
# busca é um valor computado, então as leis falam dele como parâmetro — é o que
# deixa as provas seguirem por indução/caso.
#
# Nota (limitação conhecida): "um painel não repete o índice do anterior" sai de
# três leis — passo_livre (o passo nunca pega índice marcado), passo_marca (o
# passo marca o que escolheu) e indices_distintos (posições com estados opostos
# na máscara não são o mesmo índice). Uma lei única sobre pickAll não foi
# forçada: o Bend não deixa casar valor computado (o resultado de pickStep) nem
# refletir Nat.is_eq, e uma prova geral exigiria uma indução dupla sobre as
# buscas dos dois painéis.
# ---------------------------------------------------------------------------

# As escolhas de um resultado, na ordem dos painéis.
def picksAt(p: L.Picks) -> List<&2, Maybe<&2, Nat>>:
  match p:
    case L.Picks{at, used}:
      at

# ---------- propriedades das buscas ----------

# pickSelf: achou (Some i) ⇒ o arquivo i casa com o prefer.
def preferCase(xs: List<&2, L.Match>, used: List<&2, Bool>, at: Maybe<&2, Nat>) -> Bool:
  match at:
    case None{}:
      True{}
    case Some{i}:
      L.selfAt(xs, i)

# pickSelf: não achou (None) ⇒ nenhum arquivo livre casa com o prefer.
def preferVazio(xs: List<&2, L.Match>, used: List<&2, Bool>, at: Maybe<&2, Nat>) -> Bool:
  match at:
    case None{}:
      Bool.not(L.hasFreeSelf(xs, used))
    case Some{i}:
      True{}

# pickOther: achou (Some i) ⇒ o arquivo i NÃO casa com o prefer dos outros.
def outrosCase(xs: List<&2, L.Match>, used: List<&2, Bool>, at: Maybe<&2, Nat>) -> Bool:
  match at:
    case None{}:
      True{}
    case Some{i}:
      Bool.not(L.otherAt(xs, i))

# pickOther: não achou (None) ⇒ nenhum arquivo livre deixa de casar com os outros.
def outrosVazio(xs: List<&2, L.Match>, used: List<&2, Bool>, at: Maybe<&2, Nat>) -> Bool:
  match at:
    case None{}:
      Bool.not(L.hasFreeOther(xs, used))
    case Some{i}:
      True{}

# pickFree: não achou (None) ⇒ nenhum arquivo livre.
def livreVazio(xs: List<&2, L.Match>, used: List<&2, Bool>, at: Maybe<&2, Nat>) -> Bool:
  match at:
    case None{}:
      Bool.not(L.hasFree(xs, used))
    case Some{i}:
      True{}

# Qualquer busca: o índice achado está livre na máscara (nunca um usado).
def livreAt(used: List<&2, Bool>, at: Maybe<&2, Nat>) -> Bool:
  match at:
    case None{}:
      True{}
    case Some{i}:
      Bool.not(L.usedAt(used, i))

# Qualquer busca: o índice achado existe na máscara.
def inRangeAt(used: List<&2, Bool>, at: Maybe<&2, Nat>) -> Bool:
  match at:
    case None{}:
      True{}
    case Some{i}:
      L.inRange(used, i)

# ---------- propriedades do passo ----------

# A escolha do passo (só os resultados das buscas) casa com o prefer?
def casaEscolha.free(free: Maybe<&2, Nat>, xs: List<&2, L.Match>) -> Bool:
  match free:
    case None{}:
      True{}
    case Some{k}:
      L.selfAt(xs, k)

def casaEscolha.after(other: Maybe<&2, Nat>, free: Maybe<&2, Nat>, xs: List<&2, L.Match>) -> Bool:
  match other:
    case Some{j}:
      L.selfAt(xs, j)
    case None{}:
      casaEscolha.free(free, xs)

def casaEscolha(self: Maybe<&2, Nat>, other: Maybe<&2, Nat>, free: Maybe<&2, Nat>, xs: List<&2, L.Match>) -> Bool:
  match self:
    case Some{i}:
      L.selfAt(xs, i)
    case None{}:
      casaEscolha.after(other, free, xs)

# O resultado do passo já marcou o índice escolhido?
def marcada.after(at: Maybe<&2, Nat>, used1: List<&2, Bool>) -> Bool:
  match at:
    case None{}:
      True{}
    case Some{i}:
      L.usedAt(used1, i)

def marcada(step: L.Step) -> Bool:
  match step:
    case L.Step{at, used1}:
      marcada.after(at, used1)

# O passo (a partir dos resultados das buscas) escolhe livre?
def livreEscolha(self: Maybe<&2, Nat>, other: Maybe<&2, Nat>, free: Maybe<&2, Nat>, used: List<&2, Bool>) -> Bool:
  livreAt(used, L.pickStep.choice(self, other, free))

# ---------- Leis: cenários de escolha (biblioteca concreta) ----------

# Cenário do teste de desk/tests/config.test.mjs: com Apostila, Formulário e
# Lista de Limites, o painel do prefer "Limites" pega o 3º e o "Formul" o 2º.
law cena_limites_formulario:
  {picksAt(L.pickAll(
    [
      [L.Match{False{}, False{}}, L.Match{False{}, True{}}, L.Match{True{}, False{}}],
      [L.Match{False{}, False{}}, L.Match{True{}, False{}}, L.Match{False{}, True{}}]
    ],
    [False{}, False{}, False{}]
  )) == [Some{2n}, Some{1n}] : List<&2, Maybe<&2, Nat>>}

# Sem nenhum casamento, as sobras entram na ordem da biblioteca.
law cena_sobras:
  {picksAt(L.pickAll(
    [
      [L.Match{False{}, False{}}, L.Match{False{}, False{}}],
      [L.Match{False{}, False{}}, L.Match{False{}, False{}}]
    ],
    [False{}, False{}]
  )) == [Some{0n}, Some{1n}] : List<&2, Maybe<&2, Nat>>}

# Tudo usado: ninguém é escolhido.
law cena_sem_livre:
  {picksAt(L.pickAll(
    [[L.Match{True{}, False{}}]],
    [True{}]
  )) == [None{}] : List<&2, Maybe<&2, Nat>>}

# Um painel só: pega o primeiro livre que casa, ignora o resto.
law cena_um_painel:
  {picksAt(L.pickAll(
    [[L.Match{False{}, False{}}, L.Match{True{}, False{}}]],
    [False{}, False{}]
  )) == [Some{1n}] : List<&2, Maybe<&2, Nat>>}

# O 1º painel evita o arquivo que casa com o prefer do outro painel.
law cena_evita_outro:
  {picksAt(L.pickAll(
    [[L.Match{False{}, True{}}, L.Match{False{}, False{}}]],
    [False{}, False{}]
  )) == [Some{1n}] : List<&2, Maybe<&2, Nat>>}

# ---------- Leis: contratos das três buscas ----------

# O prefer, quando acha, acha um arquivo que casa.
law busca_prefer_casa:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {preferCase(xs, used, L.pickSelf(xs, used)) == True{} : Bool}

# O prefer, quando não acha, é porque não existe arquivo livre que case.
law busca_prefer_vazio:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {preferVazio(xs, used, L.pickSelf(xs, used)) == True{} : Bool}

# O prefer nunca devolve um índice usado.
law busca_prefer_livre:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {livreAt(used, L.pickSelf(xs, used)) == True{} : Bool}

# O prefer nunca devolve índice fora da máscara.
law busca_prefer_alcance:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {inRangeAt(used, L.pickSelf(xs, used)) == True{} : Bool}

# O fallback "não casa com os outros", quando acha, acha um que não casa.
law busca_outros_casa:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {outrosCase(xs, used, L.pickOther(xs, used)) == True{} : Bool}

# O fallback, quando não acha, é porque todo livre casa com os outros.
law busca_outros_vazio:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {outrosVazio(xs, used, L.pickOther(xs, used)) == True{} : Bool}

# O fallback nunca devolve um índice usado.
law busca_outros_livre:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {livreAt(used, L.pickOther(xs, used)) == True{} : Bool}

# O fallback nunca devolve índice fora da máscara.
law busca_outros_alcance:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {inRangeAt(used, L.pickOther(xs, used)) == True{} : Bool}

# A escolha livre, quando não acha, é porque não existe arquivo livre.
law busca_livre_vazio:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {livreVazio(xs, used, L.pickFree(xs, used)) == True{} : Bool}

# A escolha livre nunca devolve um índice usado.
law busca_livre_livre:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {livreAt(used, L.pickFree(xs, used)) == True{} : Bool}

# A escolha livre nunca devolve índice fora da máscara.
law busca_livre_alcance:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {inRangeAt(used, L.pickFree(xs, used)) == True{} : Bool}

# ---------- Leis: composição do passo ----------

# Se o prefer achou (e casa), o passo escolhe um que casa; senão, não havia
# candidato livre que casasse.
law escolha_prefer:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  for self: Maybe<&2, Nat>
  for other: Maybe<&2, Nat>
  for free: Maybe<&2, Nat>
  for hs: {preferCase(xs, used, self) == True{} : Bool}
  for hc: {preferVazio(xs, used, self) == True{} : Bool}
  {Bool.or(Bool.not(L.hasFreeSelf(xs, used)), casaEscolha(self, other, free, xs)) == True{} : Bool}

# O passo real: ou o escolhido casa com o prefer, ou não existia candidato.
law passo_prefer:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {Bool.or(Bool.not(L.hasFreeSelf(xs, used)), casaEscolha(L.pickSelf(xs, used), L.pickOther(xs, used), L.pickFree(xs, used), xs)) == True{} : Bool}

# A escolha do passo é sempre um índice não usado.
law escolha_livre:
  for +used: List<&2, Bool>
  for self: Maybe<&2, Nat>
  for other: Maybe<&2, Nat>
  for free: Maybe<&2, Nat>
  for hs: {livreAt(used, self) == True{} : Bool}
  for ho: {livreAt(used, other) == True{} : Bool}
  for hf: {livreAt(used, free) == True{} : Bool}
  {livreEscolha(self, other, free, used) == True{} : Bool}

# O passo real nunca escolhe um arquivo marcado (é o que impede repetir).
law passo_livre:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {livreEscolha(L.pickSelf(xs, used), L.pickOther(xs, used), L.pickFree(xs, used), used) == True{} : Bool}

# A escolha do passo existe na máscara (índice no alcance).
law escolha_alcance:
  for +used: List<&2, Bool>
  for self: Maybe<&2, Nat>
  for other: Maybe<&2, Nat>
  for free: Maybe<&2, Nat>
  for hs: {inRangeAt(used, self) == True{} : Bool}
  for ho: {inRangeAt(used, other) == True{} : Bool}
  for hf: {inRangeAt(used, free) == True{} : Bool}
  {inRangeAt(used, L.pickStep.choice(self, other, free)) == True{} : Bool}

# Marcar o índice escolhido põe a máscara em True naquele índice.
law passo_marca_cond:
  for +used: List<&2, Bool>
  for at: Maybe<&2, Nat>
  for h: {inRangeAt(used, at) == True{} : Bool}
  {marcada(L.pickStep.after(at, used)) == True{} : Bool}
law marca_posicao:
  for +used: List<&2, Bool>
  for i: Nat
  for h: {L.inRange(used, i) == True{} : Bool}
  {L.usedAt(L.markAt(used, i), i) == True{} : Bool}

# O passo real marca o índice escolhido (junto com passo_livre, isso é o
# "nunca dois painéis ficam com o mesmo índice").
law passo_marca:
  for +xs: List<&2, L.Match>
  for +used: List<&2, Bool>
  {marcada(L.pickStep(xs, used)) == True{} : Bool}

# Duas posições com estados opostos na máscara não são a mesma posição: é o
# transporte que, junto com passo_livre e passo_marca, impede repetir índice
# entre painéis.
law indices_distintos:
  for +i: Nat
  for +j: Nat
  for +used: List<&2, Bool>
  for hi: {L.usedAt(used, i) == True{} : Bool}
  for hj: {Bool.not(L.usedAt(used, j)) == True{} : Bool}
  {i != j : Nat}
