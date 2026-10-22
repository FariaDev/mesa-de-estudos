import Base

# ---------------------------------------------------------------------------
# Política do Esc da Mesa (qualidade de vida): qual camada o Esc fecha.
#
# O host entrega os fatos já resolvidos (Bool) — não há DOM, medida nem foco
# aqui — e recebe de volta a PRIMEIRA camada aberta, de cima para baixo:
#
#   modal    <dialog> nativo aberto (o browser fecha; o host não interfere)
#   palette  paleta de ações (⌘K)
#   menu     menu Estudar/Mesa
#   popover  refs, conversas, contexto do chat lateral, navegação do leitor
#   citation botão Citar visível (seleção de texto)
#   search   busca (PDF em qualquer leitor, anotações/busca de estudos)
#   tutor    turno aberto: cancela a resposta (desk-stop + abort)
#   none     nada aberto e nada em curso
#
# Regra que nunca pode quebrar: Esc que fecha uma camada NUNCA cancela o tutor.
# Só `stopsTutor("tutor")` é verdadeiro — as demais ações fecham e o turno
# segue de pé (o botão Parar e os atalhos continuam sendo a via do usuário).
#
# A paleta da Mesa é exclusive deste app; os mesmos fatos servem para o teste
# puro (`decideEscape`, em `desk/src/escape-policy.mjs`).
# ---------------------------------------------------------------------------

type EscapeFacts is Data:
  EscapeFacts{
    dialog: Bool,
    palette: Bool,
    menu: Bool,
    popover: Bool,
    citation: Bool,
    search: Bool,
    tutor: Bool
  }

# ---------- decisão ----------
# Helpers antes de quem chama: o Bend não tem referência para frente e cada
# nível só olha a própria camada; a decisão desce em cadeia.

def tutorAction(tutor: Bool) -> String:
  match tutor:
    case True{}:
      "tutor"
    case False{}:
      "none"

def afterSearch(search: Bool, tutor: Bool) -> String:
  match search:
    case True{}:
      "search"
    case False{}:
      tutorAction(tutor)

def afterCitation(citation: Bool, search: Bool, tutor: Bool) -> String:
  match citation:
    case True{}:
      "citation"
    case False{}:
      afterSearch(search, tutor)

def afterPopover(popover: Bool, citation: Bool, search: Bool, tutor: Bool) -> String:
  match popover:
    case True{}:
      "popover"
    case False{}:
      afterCitation(citation, search, tutor)

def afterMenu(menu: Bool, popover: Bool, citation: Bool, search: Bool, tutor: Bool) -> String:
  match menu:
    case True{}:
      "menu"
    case False{}:
      afterPopover(popover, citation, search, tutor)

def afterPalette(palette: Bool, menu: Bool, popover: Bool, citation: Bool, search: Bool, tutor: Bool) -> String:
  match palette:
    case True{}:
      "palette"
    case False{}:
      afterMenu(menu, popover, citation, search, tutor)

def escapeAction(f: EscapeFacts) -> String:
  match f:
    case EscapeFacts{dialog, palette, menu, popover, citation, search, tutor}:
      match dialog:
        case True{}:
          "modal"
        case False{}:
          afterPalette(palette, menu, popover, citation, search, tutor)

# ---------- tutor ----------
# Só o próprio cancelamento para o turno; qualquer camada fechada devolve o
# usuário ao estado anterior sem tocar no turno.
def stopsTutor(action: String) -> Bool:
  String.eq(action, "tutor")
