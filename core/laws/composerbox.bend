import Base
import ../composerbox.bend as C
import ../msg.bend as M
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da caixa de mensagem única (ticket #15). Prefixo `caixa_`.
#
# A linha "Vai junto: …" é o que o usuário lê para saber o que segue com a
# próxima mensagem; o encaixe Enviar/Parar é o que ele aperta. Cenários
# concretos (como as leis das flags): as listas de partes e os atributos
# fecham por computação, e `String.eq` só reduz em texto fechado.
# ---------------------------------------------------------------------------

# ---------- linha "Vai junto" ----------

# Matéria, separador, o resto e o prefixo em partes: o CSS corta `goes-course`
# (e o `goes-sep`, que some junto) antes de `goes-rest`. Cada pedaço traduzível
# é um nó de texto à parte (#41), e o separador entre as partes do resto é um
# nó " · ".
def lead() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-lead")], [V.viewText(M.msg("goes.prefix"))])

def course(name: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-course")], [V.viewText(name)])

def sepNode() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-sep")], [V.viewText(" · ")])

def rest(kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-rest")], kids)

def dot() -> V.ViewNode:
  V.viewText(" · ")

law caixa_arvore_completa:
  {C.goesTree(True{}, "Cálculo I", "Lista 3 q.2", "rascunho.xopp", True{}, ["Limites.pdf p. 4", "Formulario.pdf p. 1"]) == [
    lead(),
    course("Cálculo I"),
    sepNode(),
    rest([ V.viewText("Lista 3 q.2"), dot(), V.viewText("rascunho.xopp"), dot()
         , V.viewText("Limites.pdf p. 4, Formulario.pdf p. 1") ])
  ] : List<&2, V.ViewNode>}

# Só a matéria: sem `goes-sep` nem `goes-rest` (nem separador solto). É o que há
# quando nada está aberto nem preenchido.
law caixa_arvore_so_materia:
  {C.goesTree(True{}, "Cálculo I", "", "", True{}, []) == [lead(), course("Cálculo I")] : List<&2, V.ViewNode>}

# Parte vazia não deixa separador solto.
law caixa_arvore_sem_titulo:
  {C.goesTree(True{}, "Cálculo I", "", "rascunho.xopp", True{}, ["Limites.pdf p. 4"]) == [
    lead(),
    course("Cálculo I"),
    sepNode(),
    rest([V.viewText("rascunho.xopp"), dot(), V.viewText("Limites.pdf p. 4")])
  ] : List<&2, V.ViewNode>}

# Contexto de estudo desligado: a matéria não vai e não há `goes-course`.
law caixa_arvore_sem_estudo:
  {C.goesTree(False{}, "Cálculo I", "Lista 3", "r.xopp", True{}, ["Limites.pdf p. 4"])
    == [lead(), rest([V.viewText("Limites.pdf p. 4")])] : List<&2, V.ViewNode>}

# Sem matéria nomeada, a questão encabeça o resto, sem separador inicial.
law caixa_arvore_sem_materia:
  {C.goesTree(True{}, "", "Lista 3", "", True{}, ["Limites.pdf p. 4"])
    == [lead(), rest([V.viewText("Lista 3"), dot(), V.viewText("Limites.pdf p. 4")])] : List<&2, V.ViewNode>}

# Nada digitado além da mensagem: a linha diz isso, em vez de ficar vazia.
law caixa_arvore_nada:
  {C.goesTree(True{}, "", "", "", True{}, []) == [V.viewText(M.msg("goes.nothing"))] : List<&2, V.ViewNode>}

# Referências desligadas: a linha acompanha o alternador — diz que estão
# desligadas e NÃO lista os materiais abertos.
law caixa_arvore_refs_desligadas:
  {C.goesTree(False{}, "Cálculo I", "", "", False{}, ["Limites.pdf p. 4"])
    == [lead(), rest([V.viewText(M.msg("goes.refsOff"))])] : List<&2, V.ViewNode>}

law caixa_arvore_materia_e_refs_desligadas:
  {C.goesTree(True{}, "Cálculo I", "Lista 3", "", False{}, ["Limites.pdf p. 4"]) == [
    lead(),
    course("Cálculo I"),
    sepNode(),
    rest([V.viewText("Lista 3"), dot(), V.viewText(M.msg("goes.refsOff"))])
  ] : List<&2, V.ViewNode>}

# Contexto de estudo desligado e referências desligadas: só a nota das referências.
law caixa_arvore_sem_estudo_nem_refs:
  {C.goesTree(False{}, "Cálculo I", "Lista 3", "rascunho.xopp", False{}, ["Limites.pdf p. 4"])
    == [lead(), rest([V.viewText(M.msg("goes.refsOff"))])] : List<&2, V.ViewNode>}

# Referências ligadas sem nenhum material aberto: nada a listar.
law caixa_arvore_refs_sem_material:
  {C.goesTree(True{}, "Cálculo I", "Lista 3", "", True{}, []) == [
    lead(),
    course("Cálculo I"),
    sepNode(),
    rest([V.viewText("Lista 3")])
  ] : List<&2, V.ViewNode>}

# ---------- nota do popover de edição ----------

law caixa_nota_desligadas:
  {C.refsNote(False{}, ["Limites.pdf p.4"], True{}) == M.msg("goes.note.off") : String}

law caixa_nota_nenhum_aberto:
  {C.refsNote(True{}, [], True{}) == M.msg("goes.note.none") : String}

law caixa_nota_listadas_com_captura:
  {C.refsNote(True{}, ["Limites.pdf p.4", "Formulario.pdf p.1"], True{})
    == M.msg1("goes.note.listedCapture", "list", "Limites.pdf p.4, Formulario.pdf p.1") : String}

# Sem Conferir (flag desligada) a nota não fala de captura.
law caixa_nota_listadas_sem_captura:
  {C.refsNote(True{}, ["Limites.pdf p.4"], False{})
    == M.msg1("goes.note.listed", "list", "Limites.pdf p.4") : String}

# ---------- Enviar / Parar ----------

law caixa_enviar_tag:
  {V.tagOf(C.sendButton(False{})) == "button" : String}

law caixa_enviar_id:
  {V.attrGet(V.attrsOf(C.sendButton(False{})), "id") == Some{"send"} : Maybe<&2, String>}

# É a ação principal da caixa: a classe vem do nó, nos dois estados.
law caixa_enviar_principal:
  {V.attrGet(V.attrsOf(C.sendButton(False{})), "class") == Some{"primary"} : Maybe<&2, String>}

law caixa_enviar_principal_ocupado:
  {V.attrGet(V.attrsOf(C.sendButton(True{})), "class") == Some{"primary"} : Maybe<&2, String>}

# Parar não é a ação principal: sem classe de acento.
law caixa_parar_sem_acento:
  {V.attrGet(V.attrsOf(C.stopButton(True{})), "class") == None{} : Maybe<&2, String>}

# Ocioso: Enviar à vista. Ocupado: Enviar some e o lugar é do Parar.
law caixa_enviar_visivel_ocioso:
  {V.attrGet(V.attrsOf(C.sendButton(False{})), "hidden") == None{} : Maybe<&2, String>}

law caixa_enviar_oculto_ocupado:
  {V.attrGet(V.attrsOf(C.sendButton(True{})), "hidden") == Some{""} : Maybe<&2, String>}

law caixa_parar_tag:
  {V.tagOf(C.stopButton(True{})) == "button" : String}

law caixa_parar_id:
  {V.attrGet(V.attrsOf(C.stopButton(True{})), "id") == Some{"stop"} : Maybe<&2, String>}

law caixa_parar_oculto_ocioso:
  {V.attrGet(V.attrsOf(C.stopButton(False{})), "hidden") == Some{""} : Maybe<&2, String>}

law caixa_parar_visivel_ocupado:
  {V.attrGet(V.attrsOf(C.stopButton(True{})), "hidden") == None{} : Maybe<&2, String>}

# ---------- a fileira de ações (#42) ----------

# O indicador de modelo e esforço mora na fileira, logo antes de Parar/Enviar.
law caixa_fileira_ordem:
  {C.actionIds() == ["attach", "include-refs", "check", "model-indicator", "stop", "send"] : List<&2, String>}

law caixa_fileira_indicador_antes_do_enviar:
  {List.drop(&2, String, C.actionIds(), 3n) == ["model-indicator", "stop", "send"] : List<&2, String>}

# Cabe tudo: nada cede.
law caixa_fileira_cabe:
  for compactFits: Bool
  for modelFits: Bool
  {C.rowFit(True{}, compactFits, modelFits) == "" : String}

# Falta espaço: primeiro Referências vira ícone…
law caixa_fileira_referencias_cedem:
  for modelFits: Bool
  {C.rowFit(False{}, True{}, modelFits) == "compact" : String}

# …depois o esforço do indicador cede…
law caixa_indicador_cede_esforco:
  {C.rowFit(False{}, False{}, True{}) == "model" : String}

# …e só por último o modelo vira ícone.
law caixa_indicador_vira_icone:
  {C.rowFit(False{}, False{}, False{}) == "icon" : String}
