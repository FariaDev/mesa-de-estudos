import Base
import ../deskflags.bend as D
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato das flags do `desk` nos controles vivos do index.html: `hidden` por
# flag e o `aria-pressed` do botão de referências. Cenários concretos, como as
# leis do status — o host entrega os fatos já normalizados (`Bool`).
#
# O Encerrar por hoje saiu do composer e virou item do menu Estudar: a flag
# `endDay` dele é do `core/tabsview.bend` (`tabs_endday_*`), não daqui.
#
# Sem fato de plataforma: o Conferir Xournal++ é de todas as suportadas (macOS
# e Windows capturam a janela do Xournal++) e só a flag `conferir` o desliga.
# ---------------------------------------------------------------------------

# Tudo ligado (o cenário padrão do app, em qualquer plataforma).
def ligado() -> D.DeskFlags:
  D.DeskFlags{True{}, True{}, True{}, True{}, True{}}

# Só o botão de referências em jogo: `includeRefs` corrente, resto ligado.
def soRefs(includeRefs: Bool) -> D.DeskFlags:
  D.DeskFlags{True{}, includeRefs, True{}, True{}, True{}}

# refsToggle desligado: o botão some e as referências ficam ligadas na view.
def semBotaoRefs(includeRefs: Bool) -> D.DeskFlags:
  D.DeskFlags{False{}, includeRefs, True{}, True{}, True{}}

# Uma flag desligada por vez (para os `hidden`).
def semEstudo() -> D.DeskFlags:
  D.DeskFlags{True{}, True{}, False{}, True{}, True{}}

def semConferir() -> D.DeskFlags:
  D.DeskFlags{True{}, True{}, True{}, False{}, True{}}

def semCalculadora() -> D.DeskFlags:
  D.DeskFlags{True{}, True{}, True{}, True{}, False{}}

# ---------- referências do composer ----------

law deskflags_refs_tag:
  {V.tagOf(D.includeRefsButton(ligado())) == "button" : String}

law deskflags_refs_id:
  {V.attrGet(V.attrsOf(D.includeRefsButton(ligado())), "id") == Some{"include-refs"} : Maybe<&2, String>}

law deskflags_refs_visivel:
  {V.attrGet(V.attrsOf(D.includeRefsButton(ligado())), "hidden") == None{} : Maybe<&2, String>}

law deskflags_refs_oculto:
  {V.attrGet(V.attrsOf(D.includeRefsButton(semBotaoRefs(True{}))), "hidden") == Some{""} : Maybe<&2, String>}

law deskflags_refs_pressed:
  {V.attrGet(V.attrsOf(D.includeRefsButton(soRefs(True{}))), "aria-pressed") == Some{"true"} : Maybe<&2, String>}

law deskflags_refs_pressed_false:
  {V.attrGet(V.attrsOf(D.includeRefsButton(soRefs(False{}))), "aria-pressed") == Some{"false"} : Maybe<&2, String>}

# Sem o botão, as referências seguem ligadas mesmo com o fato corrente false.
law deskflags_refs_pressed_forcado:
  {V.attrGet(V.attrsOf(D.includeRefsButton(semBotaoRefs(False{}))), "aria-pressed") == Some{"true"} : Maybe<&2, String>}

# ---------- contexto de estudo ----------

law deskflags_estudo_tag:
  {V.tagOf(D.studyContextRow(ligado())) == "div" : String}

law deskflags_estudo_id:
  {V.attrGet(V.attrsOf(D.studyContextRow(ligado())), "id") == Some{"study-context"} : Maybe<&2, String>}

law deskflags_estudo_visivel:
  {V.attrGet(V.attrsOf(D.studyContextRow(ligado())), "hidden") == None{} : Maybe<&2, String>}

law deskflags_estudo_oculto:
  {V.attrGet(V.attrsOf(D.studyContextRow(semEstudo())), "hidden") == Some{""} : Maybe<&2, String>}

# ---------- conferir Xournal++ ----------

law deskflags_conferir_tag:
  {V.tagOf(D.conferirButton(ligado())) == "button" : String}

law deskflags_conferir_id:
  {V.attrGet(V.attrsOf(D.conferirButton(ligado())), "id") == Some{"check"} : Maybe<&2, String>}

# A flag sozinha decide: ligada, o botão existe em qualquer plataforma.
law deskflags_conferir_visivel:
  {V.attrGet(V.attrsOf(D.conferirButton(ligado())), "hidden") == None{} : Maybe<&2, String>}

law deskflags_conferir_oculto:
  {V.attrGet(V.attrsOf(D.conferirButton(semConferir())), "hidden") == Some{""} : Maybe<&2, String>}

# ---------- divisor da calculadora ----------

law deskflags_calc_tag:
  {V.tagOf(D.calcDivider(ligado())) == "div" : String}

law deskflags_calc_id:
  {V.attrGet(V.attrsOf(D.calcDivider(ligado())), "id") == Some{"calc-divider"} : Maybe<&2, String>}

law deskflags_calc_visivel:
  {V.attrGet(V.attrsOf(D.calcDivider(ligado())), "hidden") == None{} : Maybe<&2, String>}

law deskflags_calc_oculto:
  {V.attrGet(V.attrsOf(D.calcDivider(semCalculadora())), "hidden") == Some{""} : Maybe<&2, String>}
