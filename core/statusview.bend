import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Status da Mesa: o rodapé (modelo · esforço · contexto) e os indicadores da
# cabeça do chat (medidor de contexto, estado de conexão, compactação
# automática, rótulo do modelo e opções de sessão).
#
# Tudo é construtor puro: entra valor, sai `ViewNode`; quem aplica no DOM é o
# `view-host.mjs`. Nada aqui lê DOM, mede elemento, guarda referência ou
# observa mutação — o host empurra valores (rótulos, contagem, estados).
#
# Contrato que o host e o smoke fixam:
# - `#ctx-meter` sem `hidden` quando há uso; `em` com o texto `N%`; classes
#   `warn` (60..84) e `hot` (85+) nos mesmos cortes do app. A porcentagem
#   chega já arredondada em `Nat` — parse/clamp de F32 é fronteira de host,
#   como em `state.bend` (fatos prontos, decisões puras aqui). Consequência
#   aceita: cortes e largura acompanham o mostrador e divergem no máximo meio
#   ponto do valor cru na borda (mesma política do `gaugeview` da Conversa).
# - `#auto-compact` reflete `aria-pressed` e some sem conexão (`hidden`).
# - Tooltip sai como `data-tip`, nunca `title`: o `tooltip.mjs` move o `title`
#   para `dataset.tip` e um re-render com `title` apagaria o balão armado.
#   O medidor é a exceção (`data-no-tip`): o balão dele é o `#ctx-tip`,
#   posicionado pelo host.
# - `#foot-status` é o botão do rodapé: clique chama `toggleMeterTip` (nome do
#   handler registrado pelo host no `view-host`), `aria-label` cai em
#   "Status do modelo" sem tooltip e o botão fica `hidden` sem itens.
# ---------------------------------------------------------------------------

type ConnState is Data:
  ConnOff{}
  ConnConnecting{}
  ConnOnline{}
  ConnError{}

# Sessão como o `<option>` precisa: rótulo visível e caminho (valor).
type SessionChoice is Data:
  SessionChoice{label: String, path: String}

# ---------- tooltip: data-tip, nunca title ----------

def tipAttrs.if(tip: String, empty: Bool) -> List<&2, V.ViewAttr>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      Con{V.attrData("tip", tip), Nil{}}

def tipAttrs(tip: String) -> List<&2, V.ViewAttr>:
  +t = tip
  tipAttrs.if(t, String.is_empty(t))

def fallbackLabel.if(tip: String, fallback: String, empty: Bool) -> String:
  match empty:
    case True{}:
      fallback
    case False{}:
      tip

def fallbackLabel(tip: String, fallback: String) -> String:
  +t = tip
  fallbackLabel.if(t, fallback, String.is_empty(t))

# ---------- rodapé ----------

def footItem(text: String, cls: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass(String.append("fs-item ", cls))], [V.viewText(text)])

def footSep() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("fs-sep"), V.attrBool("aria-hidden", True{})], [V.viewText("·")])

# Empilha invertido: item novo entra na frente com o separador (a inversão
# final deixa o separador depois do item anterior). Texto vazio não entra;
# com o item presente, o separador só entra quando já há algo.
def footPush.add(acc: List<&2, V.ViewNode>, text: String, cls: String) -> List<&2, V.ViewNode>:
  match acc:
    case Nil{}:
      Con{footItem(text, cls), Nil{}}
    case Con{_, _}:
      Con{footItem(text, cls), Con{footSep(), acc}}

def footPush.if(acc: List<&2, V.ViewNode>, text: String, cls: String, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      acc
    case False{}:
      footPush.add(acc, text, cls)

def footPush(acc: List<&2, V.ViewNode>, text: String, cls: String) -> List<&2, V.ViewNode>:
  +t = text
  footPush.if(acc, t, cls, String.is_empty(t))

def footItems(model: String, level: String, context: String) -> List<&2, V.ViewNode>:
  +a = footPush(Nil{}, model, "fs-model")
  +b = footPush(a, level, "fs-eff")
  +c = footPush(b, context, "fs-ctx")
  List.reverse(&2, V.ViewNode, c)

def footAllEmpty(modelEmpty: Bool, levelEmpty: Bool, contextEmpty: Bool) -> Bool:
  Bool.and(modelEmpty, Bool.and(levelEmpty, contextEmpty))

def footHasItems(model: String, level: String, context: String) -> Bool:
  Bool.not(footAllEmpty(String.is_empty(model), String.is_empty(level), String.is_empty(context)))

def footTextPart(text: String, empty: Bool) -> List<&2, String>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      Con{text, Nil{}}

# O detalhe (texto longo do medidor) vale mais que o `N%`; sem detalhe, o `%`.
def footContextPart.if(context: String, detail: String, empty: Bool) -> String:
  match empty:
    case True{}:
      context
    case False{}:
      detail

def footContextPart(context: String, detail: String) -> String:
  +d = detail
  footContextPart.if(context, d, String.is_empty(d))

def footTip.if(model: String, level: String, context: String, detail: String, override: String, empty: Bool) -> String:
  match empty:
    case True{}:
      +mo = model
      +le = level
      +co = context
      +m = footTextPart(mo, String.is_empty(mo))
      +l = footTextPart(le, String.is_empty(le))
      +c = footTextPart(footContextPart(co, detail), String.is_empty(co))
      +ml = List.append(&2, String, m, l)
      String.join(List.append(&2, String, ml, c), " · ")
    case False{}:
      # O host manda o balão pronto (chips com provider/prefixo) e o núcleo não recompõe.
      override

def footTip(model: String, level: String, context: String, detail: String, +override: String) -> String:
  footTip.if(model, level, context, detail, override, String.is_empty(override))

def footAttrs(tip: String, hidden: Bool) -> List<&2, V.ViewAttr>:
  +t = tip
  V.attrJoin([
    [V.attrType("button"), V.attrId("foot-status"), V.attrClass("foot-status")],
    V.attrWhen(hidden, V.ViewAttr{"hidden", ""}),
    [V.attrOn("click", "toggleMeterTip")],
    tipAttrs(t),
    [V.attrAria("label", fallbackLabel(t, "Status do modelo"))]
  ])

def footStatus(model: String, level: String, context: String, detail: String, +override: String) -> V.ViewNode:
  +mo = model
  +le = level
  +co = context
  +tip = footTip(mo, le, co, detail, override)
  +hidden = Bool.not(footHasItems(mo, le, co))
  V.viewEl("button", footAttrs(tip, hidden), footItems(mo, le, co))

# ---------- medidor de contexto ----------

def meterWarn(pct: Nat) -> Bool:
  +p = pct
  Bool.and(Nat.is_ge(p, 60n), Nat.is_lt(p, 85n))

def meterHot(pct: Nat) -> Bool:
  Nat.is_ge(pct, 85n)

def meterText(pct: Nat) -> String:
  String.append(Nat.show(pct), "%")

def meterWidth(pct: Nat) -> String:
  String.append("width:", meterText(pct))

def ctxMeter(visible: Bool, pct: Nat) -> V.ViewNode:
  +p = pct
  V.viewEl("span", V.attrJoin([
    [V.attrId("ctx-meter"), V.ViewAttr{"data-no-tip", ""}],
    V.attrWhen(Bool.not(visible), V.ViewAttr{"hidden", ""}),
    [V.classes([V.classOn("warn", meterWarn(p)), V.classOn("hot", meterHot(p))])]
  ]), [
    V.viewEl("span", [V.attrClass("bar")], [V.viewEl("i", [V.ViewAttr{"style", meterWidth(p)}], Nil{})]),
    V.viewEl("em", Nil{}, [V.viewText(meterText(p))])
  ])

# O balão do medidor: o host posiciona e decide `hidden` (alternado pelo
# clique no rodapé); o texto vem daqui.
def ctxTip(text: String, hidden: Bool) -> V.ViewNode:
  V.viewEl("span", V.attrJoin([
    [V.attrId("ctx-tip")],
    V.attrWhen(hidden, V.ViewAttr{"hidden", ""})
  ]), [V.viewText(text)])

# ---------- conexão ----------

def connClass(state: ConnState) -> String:
  match state:
    case ConnOff{}:
      ""
    case ConnConnecting{}:
      "connecting"
    case ConnOnline{}:
      "online"
    case ConnError{}:
      "error"

def statusDot(state: ConnState, label: String) -> V.ViewNode:
  +l = label
  V.viewEl("span", V.attrJoin([
    [V.attrId("status-dot"), V.ViewAttr{"role", "img"}, V.attrClass(connClass(state))],
    tipAttrs(l),
    [V.attrAria("label", fallbackLabel(l, "Pi desconectado"))]
  ]), Nil{})

# ---------- compactação automática ----------

def autoCompact(connected: Bool, enabled: Bool, tip: String) -> V.ViewNode:
  +en = enabled
  V.viewEl("button", V.attrJoin([
    [V.attrType("button"), V.attrId("auto-compact")],
    V.attrWhen(Bool.not(connected), V.ViewAttr{"hidden", ""}),
    [V.attrBool("aria-pressed", en), V.classes([V.classOn("on", en)])],
    tipAttrs(tip)
  ]), [V.viewText("auto")])

# ---------- modelo / sessão ----------

def piLabel(text: String) -> V.ViewNode:
  V.viewEl("span", [V.attrId("pi-label")], [V.viewText(text)])

def sessionOption(current: String, choice: SessionChoice) -> V.ViewNode:
  match choice:
    case SessionChoice{label, +path}:
      V.viewEl("option", V.attrJoin([
        [V.ViewAttr{"value", path}],
        V.attrWhen(String.eq(path, current), V.ViewAttr{"selected", ""})
      ]), [V.viewText(label)])

def sessionOptions.go(+current: String, xs: List<&2, SessionChoice>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{sessionOption(current, h), sessionOptions.go(current, t)}

def sessionOptions(current: String, xs: List<&2, SessionChoice>) -> List<&2, V.ViewNode>:
  sessionOptions.go(current, xs)

def sessionSelect(current: String, disabled: Bool, xs: List<&2, SessionChoice>) -> V.ViewNode:
  V.viewEl("select", V.attrJoin([
    [V.attrId("session-select"), V.attrAria("label", "Conversa")],
    V.attrWhen(disabled, V.ViewAttr{"disabled", ""})
  ]), sessionOptions(current, xs))
