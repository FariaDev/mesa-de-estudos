import Base
import ../findbar.bend as F
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da view da barra da busca na conversa (⌘F, `.find-bar`).
#
# Fatos do host: `value` do campo, `hasQuery` (consulta dobrada não vazia),
# `index` (0-based) e `total` de trechos, `open`/`closing`. Cenários concretos
# travam os textos do contador, classes, ARIA, `disabled` e a ordem dos filhos.
# O que ficou de fora (TreeWalker, `Range`/`CSS.highlights`, dobra com mapa de
# índices, foco, scroll e o relógio do agendamento) é host.
# ---------------------------------------------------------------------------

def first(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

def nth(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      match i:
        case 0n:
          h
        case 1n+rest:
          nth(t, rest)

# ---------- textos do contador ----------

law fb_vazio:
  {F.countLabel(False{}, 0n, 0n) == "0/0" : String}

law fb_sem_consulta_ignora_indice:
  for index: Nat
  {F.countLabel(False{}, index, 0n) == "0/0" : String}

law fb_sem_resultados:
  for index: Nat
  {F.countLabel(True{}, index, 0n) == "0 resultados" : String}

law fb_posicao_primeira:
  {F.countLabel(True{}, 0n, 5n) == "1/5" : String}

law fb_posicao_meio:
  {F.countLabel(True{}, 2n, 12n) == "3/12" : String}

law fb_posicao_ultima:
  {F.countLabel(True{}, 11n, 12n) == "12/12" : String}

law fb_posicao_estrutural:
  for index: Nat
  {F.countLabel(True{}, index, 1n) == Nat.show(Nat.add(index, 1n)) ++ "/1" : String}

# ---------- fatos derivados ----------

law fb_none_zero:
  for hasQuery: Bool
  {F.noResults(hasQuery, 0n) == hasQuery : Bool}

law fb_none_sucessor:
  for hasQuery: Bool
  for t: Nat
  {F.noResults(hasQuery, 1n+t) == False{} : Bool}

law fb_dead_zero:
  {F.dead(0n) == True{} : Bool}

law fb_dead_sucessor:
  for t: Nat
  {F.dead(1n+t) == False{} : Bool}

# ---------- input ----------

law fb_input_valor:
  {V.attrGet(V.attrsOf(F.inputNode("alfa")), "value") == Some{"alfa"} : Maybe<&2, String>}

law fb_input_sem_texto:
  {List.length(&2, V.ViewNode, V.kidsOf(F.inputNode("alfa"))) == 0n : Nat}

law fb_input_tipo:
  {V.attrGet(V.attrsOf(F.inputNode("")), "type") == Some{"search"} : Maybe<&2, String>}

law fb_input_placeholder:
  {V.attrGet(V.attrsOf(F.inputNode("")), "placeholder") == Some{"Buscar na conversa"} : Maybe<&2, String>}

law fb_input_rotulo:
  {V.attrGet(V.attrsOf(F.inputNode("")), "aria-label") == Some{"Buscar na conversa"} : Maybe<&2, String>}

law fb_input_eventos:
  {V.attrGet(V.attrsOf(F.inputNode("")), "on:input") == Some{"schedule"} : Maybe<&2, String>}

law fb_input_tecla:
  {V.attrGet(V.attrsOf(F.inputNode("")), "on:keydown") == Some{"key"} : Maybe<&2, String>}

# ---------- contador (nó) ----------

law fb_contador_texto:
  {V.textOf(first(V.kidsOf(F.countNode(True{}, 2n, 12n)))) == "3/12" : String}

law fb_contador_vazio_classe:
  {V.attrGet(V.attrsOf(F.countNode(False{}, 0n, 0n)), "class") == Some{"find-count"} : Maybe<&2, String>}

law fb_contador_none_classe:
  {V.attrGet(V.attrsOf(F.countNode(True{}, 0n, 0n)), "class") == Some{"find-count none"} : Maybe<&2, String>}

law fb_contador_resultado_classe:
  {V.attrGet(V.attrsOf(F.countNode(True{}, 0n, 3n)), "class") == Some{"find-count"} : Maybe<&2, String>}

law fb_contador_aria:
  {V.attrGet(V.attrsOf(F.countNode(True{}, 0n, 3n)), "aria-live") == Some{"polite"} : Maybe<&2, String>}

law fb_contador_atomico:
  {V.attrGet(V.attrsOf(F.countNode(True{}, 0n, 3n)), "aria-atomic") == Some{"true"} : Maybe<&2, String>}

# ---------- botões ----------

law fb_anterior_desabilitado:
  {V.attrGet(V.attrsOf(F.prevNode(True{})), "disabled") == Some{""} : Maybe<&2, String>}

law fb_anterior_habilitado:
  {V.attrGet(V.attrsOf(F.prevNode(False{})), "disabled") == None{} : Maybe<&2, String>}

law fb_anterior_dir:
  {V.attrGet(V.attrsOf(F.prevNode(False{})), "data-dir") == Some{"prev"} : Maybe<&2, String>}

law fb_anterior_rotulo:
  {V.attrGet(V.attrsOf(F.prevNode(False{})), "aria-label") == Some{"Anterior"} : Maybe<&2, String>}

law fb_anterior_titulo:
  {V.attrGet(V.attrsOf(F.prevNode(False{})), "title") == Some{"Anterior (Shift+Enter)"} : Maybe<&2, String>}

law fb_proxima_dir:
  {V.attrGet(V.attrsOf(F.nextNode(False{})), "data-dir") == Some{"next"} : Maybe<&2, String>}

law fb_proxima_titulo:
  {V.attrGet(V.attrsOf(F.nextNode(False{})), "title") == Some{"Próxima (Enter)"} : Maybe<&2, String>}

law fb_proxima_desabilitada:
  {V.attrGet(V.attrsOf(F.nextNode(True{})), "disabled") == Some{""} : Maybe<&2, String>}

law fb_fechar_sem_dir:
  {V.attrGet(V.attrsOf(F.closeNode()), "data-dir") == None{} : Maybe<&2, String>}

law fb_fechar_rotulo:
  {V.attrGet(V.attrsOf(F.closeNode()), "aria-label") == Some{"Fechar busca"} : Maybe<&2, String>}

law fb_fechar_titulo:
  {V.attrGet(V.attrsOf(F.closeNode()), "title") == Some{"Fechar (Esc)"} : Maybe<&2, String>}

# Clique dos botões (o host liga o listener pela tabela; sem o attr o botão fica morto).
law fb_anterior_clique:
  {V.attrGet(V.attrsOf(F.prevNode(False{})), "on:click") == Some{"prev"} : Maybe<&2, String>}

law fb_proxima_clique:
  {V.attrGet(V.attrsOf(F.nextNode(False{})), "on:click") == Some{"next"} : Maybe<&2, String>}

law fb_fechar_clique:
  {V.attrGet(V.attrsOf(F.closeNode()), "on:click") == Some{"close"} : Maybe<&2, String>}

# ---------- casca ----------

law fb_casca_classe:
  {V.attrGet(V.attrsOf(F.barView(True{}, False{}, "", False{}, 0n, 0n)), "class") == Some{"find-bar"} : Maybe<&2, String>}

law fb_casca_saindo_classe:
  {V.attrGet(V.attrsOf(F.barView(False{}, True{}, "", True{}, 0n, 0n)), "class") == Some{"find-bar closing"} : Maybe<&2, String>}

law fb_casca_fechada_escondida:
  {V.attrGet(V.attrsOf(F.barView(False{}, False{}, "", False{}, 0n, 0n)), "hidden") == Some{""} : Maybe<&2, String>}

law fb_casca_aberta_visivel:
  {V.attrGet(V.attrsOf(F.barView(True{}, False{}, "", False{}, 0n, 0n)), "hidden") == None{} : Maybe<&2, String>}

law fb_casca_saindo_visivel:
  {V.attrGet(V.attrsOf(F.barView(False{}, True{}, "", True{}, 0n, 0n)), "hidden") == None{} : Maybe<&2, String>}

law fb_casca_papel:
  {V.attrGet(V.attrsOf(F.barView(False{}, False{}, "", False{}, 0n, 0n)), "role") == Some{"search"} : Maybe<&2, String>}

law fb_casca_rotulo:
  {V.attrGet(V.attrsOf(F.barView(False{}, False{}, "", False{}, 0n, 0n)), "aria-label") == Some{"Buscar na conversa"} : Maybe<&2, String>}

law fb_casca_cinco_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(F.barView(False{}, False{}, "", False{}, 0n, 0n))) == 5n : Nat}

law fb_casca_tags:
  {V.tagOf(nth(V.kidsOf(F.barView(True{}, False{}, "alfa", True{}, 0n, 2n)), 0n)) == "input" : String}

law fb_casca_valor:
  {V.attrGet(V.attrsOf(nth(V.kidsOf(F.barView(True{}, False{}, "alfa", True{}, 0n, 2n)), 0n)), "value") == Some{"alfa"} : Maybe<&2, String>}

law fb_casca_contador:
  {V.textOf(first(V.kidsOf(nth(V.kidsOf(F.barView(True{}, False{}, "alfa", True{}, 1n, 2n)), 1n)))) == "2/2" : String}

law fb_casca_botoes_habilitados:
  {V.attrGet(V.attrsOf(nth(V.kidsOf(F.barView(True{}, False{}, "alfa", True{}, 0n, 2n)), 2n)), "disabled") == None{} : Maybe<&2, String>}

law fb_casca_botoes_desabilitados:
  {V.attrGet(V.attrsOf(nth(V.kidsOf(F.barView(True{}, False{}, "", False{}, 0n, 0n)), 2n)), "disabled") == Some{""} : Maybe<&2, String>}

law fb_casca_ultimo_e_fechar:
  {V.attrGet(V.attrsOf(nth(V.kidsOf(F.barView(True{}, False{}, "", False{}, 0n, 0n)), 4n)), "data-dir") == None{} : Maybe<&2, String>}
