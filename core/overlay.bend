import Base

# ---------------------------------------------------------------------------
# Sobreposição de página inteira × view nativa (ticket #52).
#
# O applet do GeoGebra é uma view nativa por cima do leitor: fica acima de todo
# o DOM. Qualquer sobreposição de página inteira (diálogo, paleta, lightbox,
# tela cheia do quadro de atividades) precisa de a view sair de cima, e voltar
# no mesmo lugar e com a mesma construção quando a última fechar.
#
# O host entrega DOIS fatos — a aba GeoGebra está ativa? e quantas
# sobreposições estão abertas (UMA lista de seletores, `OVERLAY_SELECTOR` em
# `desk/src/ggb.mjs`) — e o núcleo decide o estado da view:
#   ViewOff:     a aba não está ativa; a view fecha (e a construção é guardada);
#   ViewCovered: a aba está ativa mas há sobreposição; a view se esconde sem
#                fechar (mesmo retângulo, mesma construção, ponte do tutor viva);
#   ViewShown:   a aba está ativa e nada cobre; a view aparece no retângulo.
# ---------------------------------------------------------------------------

type ViewState is Data:
  ViewOff{}
  ViewCovered{}
  ViewShown{}

def viewStateClear(clear: Bool) -> ViewState:
  match clear:
    case True{}:
      ViewShown{}
    case False{}:
      ViewCovered{}

def viewState(active: Bool, overlays: U32) -> ViewState:
  match active:
    case False{}:
      ViewOff{}
    case True{}:
      viewStateClear(U32.is_eq(overlays, 0))
