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

# Cada item é uma pílula: a matéria primeiro, depois o resto. O prefixo
# "Contexto: " fica no DOM escondido pelo CSS quando há pílula (#90).

def lead() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-lead")], [V.viewText(M.msg("goes.prefix"))])

def nameSpan(+text: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-pill-name")], [V.viewText(text)])

def pageSpan(+page: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-pill-page")], [V.viewText(" " ++ page)])

def pill(+cls: String, +label: String, kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("span", [
    V.attrClass("goes-pill " ++ cls), V.attrTitle(label), V.attrAria("label", label)
  ], kids)

def course(+name: String) -> V.ViewNode:
  pill("goes-course", name, [nameSpan(name)])

def textPill(+text: String) -> V.ViewNode:
  pill("goes-rest", text, [nameSpan(text)])

def refPill(+name: String, +page: String) -> V.ViewNode:
  pill("goes-rest", name ++ " " ++ page, [nameSpan(name), pageSpan(page)])

law caixa_arvore_completa:
  {C.goesTree(True{}, "Cálculo I", "Lista 3 q.2", "rascunho.xopp", True{}, [C.GoesRef{"Limites.pdf", "p.4"}, C.GoesRef{"Formulario.pdf", "p.1"}]) == [
    lead(),
    course("Cálculo I"),
    textPill("Lista 3 q.2"),
    textPill("rascunho.xopp"),
    refPill("Limites.pdf", "p.4"),
    refPill("Formulario.pdf", "p.1")
  ] : List<&2, V.ViewNode>}

# Só a matéria: sem pílula de resto. É o que há quando nada está aberto nem
# preenchido.
law caixa_arvore_so_materia:
  {C.goesTree(True{}, "Cálculo I", "", "", True{}, []) == [lead(), course("Cálculo I")] : List<&2, V.ViewNode>}

# Parte vazia não deixa pílula solta.
law caixa_arvore_sem_titulo:
  {C.goesTree(True{}, "Cálculo I", "", "rascunho.xopp", True{}, [C.GoesRef{"Limites.pdf", "p.4"}]) == [
    lead(),
    course("Cálculo I"),
    textPill("rascunho.xopp"),
    refPill("Limites.pdf", "p.4")
  ] : List<&2, V.ViewNode>}

# Contexto de estudo desligado: a matéria não vai e não há `goes-course`.
law caixa_arvore_sem_estudo:
  {C.goesTree(False{}, "Cálculo I", "Lista 3", "r.xopp", True{}, [C.GoesRef{"Limites.pdf", "p.4"}])
    == [lead(), refPill("Limites.pdf", "p.4")] : List<&2, V.ViewNode>}

# Sem matéria nomeada, a questão encabeça o resto, sem pílula de curso.
law caixa_arvore_sem_materia:
  {C.goesTree(True{}, "", "Lista 3", "", True{}, [C.GoesRef{"Limites.pdf", "p.4"}])
    == [lead(), textPill("Lista 3"), refPill("Limites.pdf", "p.4")] : List<&2, V.ViewNode>}

# Nada digitado além da mensagem: a linha diz isso, em vez de ficar vazia.
law caixa_arvore_nada:
  {C.goesTree(True{}, "", "", "", True{}, []) == [V.viewText(M.msg("goes.nothing"))] : List<&2, V.ViewNode>}

# Referências desligadas: a linha acompanha o alternador — diz que estão
# desligadas e NÃO lista os materiais abertos.
law caixa_arvore_refs_desligadas:
  {C.goesTree(False{}, "Cálculo I", "", "", False{}, [C.GoesRef{"Limites.pdf", "p.4"}])
    == [lead(), textPill(M.msg("goes.refsOff"))] : List<&2, V.ViewNode>}

law caixa_arvore_materia_e_refs_desligadas:
  {C.goesTree(True{}, "Cálculo I", "Lista 3", "", False{}, [C.GoesRef{"Limites.pdf", "p.4"}]) == [
    lead(),
    course("Cálculo I"),
    textPill("Lista 3"),
    textPill(M.msg("goes.refsOff"))
  ] : List<&2, V.ViewNode>}

# Contexto de estudo desligado e referências desligadas: só a nota das referências.
law caixa_arvore_sem_estudo_nem_refs:
  {C.goesTree(False{}, "Cálculo I", "Lista 3", "rascunho.xopp", False{}, [C.GoesRef{"Limites.pdf", "p.4"}])
    == [lead(), textPill(M.msg("goes.refsOff"))] : List<&2, V.ViewNode>}

# Referências ligadas sem nenhum material aberto: nada a listar.
law caixa_arvore_refs_sem_material:
  {C.goesTree(True{}, "Cálculo I", "Lista 3", "", True{}, []) == [
    lead(),
    course("Cálculo I"),
    textPill("Lista 3")
  ] : List<&2, V.ViewNode>}

# ---------- pílula ----------

law caixa_pilula_nome_aria:
  {V.attrGet(V.attrsOf(course("Cálculo I")), "aria-label") == Some{"Cálculo I"} : Maybe<&2, String>}

law caixa_pilula_nome_title:
  {V.attrGet(V.attrsOf(course("Cálculo I")), "title") == Some{"Cálculo I"} : Maybe<&2, String>}

law caixa_pilula_nome_classe:
  {V.attrGet(V.attrsOf(course("Cálculo I")), "class") == Some{"goes-pill goes-course"} : Maybe<&2, String>}

# O nome da referência e a página são nós separados: só o nome corta.
law caixa_pilula_ref_nos:
  {V.kidsOf(refPill("Limites.pdf", "p.4")) == [
    nameSpan("Limites.pdf"),
    pageSpan("p.4")
  ] : List<&2, V.ViewNode>}

law caixa_pilula_ref_aria:
  {V.attrGet(V.attrsOf(refPill("Limites.pdf", "p.4")), "aria-label") == Some{"Limites.pdf p.4"} : Maybe<&2, String>}

# ---------- nota do popover de edição ----------

law caixa_nota_desligadas:
  {C.refsNote(False{}, [C.GoesRef{"Limites.pdf", "p.4"}], True{}) == M.msg("goes.note.off") : String}

law caixa_nota_nenhum_aberto:
  {C.refsNote(True{}, [], True{}) == M.msg("goes.note.none") : String}

law caixa_nota_listadas_com_captura:
  {C.refsNote(True{}, [C.GoesRef{"Limites.pdf", "p.4"}, C.GoesRef{"Formulario.pdf", "p.1"}], True{})
    == M.msg("goes.note.listedCapture") : String}

# Sem Conferir (flag desligada) a nota não fala de captura.
law caixa_nota_listadas_sem_captura:
  {C.refsNote(True{}, [C.GoesRef{"Limites.pdf", "p.4"}], False{})
    == M.msg("goes.note.listed") : String}

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
  {C.actionIds() == ["attach", "include-refs", "model-indicator", "stop", "send"] : List<&2, String>}

law caixa_fileira_indicador_antes_do_enviar:
  {List.drop(&2, String, C.actionIds(), 2n) == ["model-indicator", "stop", "send"] : List<&2, String>}

# Cabe tudo: nada cede.
law caixa_fileira_cabe:
  for modelFits: Bool
  {C.rowFit(True{}, modelFits) == "" : String}

# Falta espaço: primeiro o esforço do indicador cede…
law caixa_indicador_cede_esforco:
  {C.rowFit(False{}, True{}) == "model" : String}

# …e só por último o modelo vira ícone.
law caixa_indicador_vira_icone:
  {C.rowFit(False{}, False{}) == "icon" : String}
