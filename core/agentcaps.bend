import Base

# ---------------------------------------------------------------------------
# Capacidades do motor de conversa da Mesa: o que host/UI podem oferecer para
# Pi e para Claude Code sem prometer paridade.
#
# Os fatos vêm do host, escolhidos pelo motor da conversa:
#   - `piCaps()`: tudo ligado — é o comportamento que o app já exercita;
#   - `claudeCaps()`: experimento estrutural; só imagens e permissões ficam
#     ligadas. Steer, compactação, modelo/esforço, rascunho de revisão,
#     bilhete, comandos, GeoGebra, quiz e medidor de contexto ficam DESLIGADOS
#     até integração comprovada (capacidade false vale para host e UI, sem
#     fallback escondido para Pi).
#
# `canSend` é a decisão do composer: anexo só quando `images` está ligada e,
# com o motor ocupado, só se `steer` existir (o Claude não suporta steer nesta
# versão — a mensagem espera a fila). `canSteer` só fala do caminho ocupado.
# `controlVisible` responde por controle do contrato — é o acesso direto que o
# adaptador do host usa para mostrar/esconder cada comando.
#
# Escopo: pura decisão sobre fatos. I/O, IPC, permissão real, processo, timer
# e fila ficam no host, que resolve `busy`/`hasImages` e aplica o resultado.
# ---------------------------------------------------------------------------

# Ordem dos campos = ordem dos fatos (host monta por nome; provas usam
# posição). Falta de campo é erro de tipo/contrato, não default.
type Caps is Data:
  Caps{
    images: Bool,
    permissions: Bool,
    steer: Bool,
    compact: Bool,
    autoCompaction: Bool,
    modelSelection: Bool,
    effort: Bool,
    reviewDraft: Bool,
    handoff: Bool,
    commands: Bool,
    geogebra: Bool,
    quiz: Bool,
    contextUsage: Bool
  }

# Controle do contrato que a UI consulta para aparecer ou não.
type CapsControl is Data:
  ControlImages{}
  ControlPermissions{}
  ControlSteer{}
  ControlCompact{}
  ControlAutoCompaction{}
  ControlModelSelection{}
  ControlEffort{}
  ControlReviewDraft{}
  ControlHandoff{}
  ControlCommands{}
  ControlGeogebra{}
  ControlQuiz{}
  ControlContextUsage{}

def piCaps() -> Caps:
  Caps{
    True{}, True{}, True{}, True{}, True{}, True{}, True{},
    True{}, True{}, True{}, True{}, True{}, True{}
  }

# Estrutural: o que a primeira versão Claude de fato integra.
def claudeCaps() -> Caps:
  Caps{
    True{}, True{}, False{}, False{}, False{}, False{}, False{},
    False{}, False{}, False{}, False{}, False{}, False{}
  }

# Catálogo e suporte vêm do SDK nativo já inicializado pelo host. Ausência de
# catálogo mantém os controles ocultos; esforço também exige catálogo válido.
def claudeControlCaps(catalogReady: Bool, effortSupported: Bool) -> Caps:
  match catalogReady:
    case False{}:
      claudeCaps()
    case True{}:
      Caps{
        True{}, True{}, False{}, False{}, False{}, True{}, effortSupported,
        False{}, False{}, False{}, False{}, False{}, False{}
      }

# Anexo entra se o motor aceita imagem; sem anexo o fato nem importa.
def imagesAllowed(images: Bool, hasImages: Bool) -> Bool:
  match hasImages:
    case True{}:
      images
    case False{}:
      True{}

# Steer só existe no caminho ocupado; motor sem steer nunca "steera".
def canSteer(caps: Caps, busy: Bool) -> Bool:
  match caps:
    case Caps{_, _, steer, _, _, _, _, _, _, _, _, _, _}:
      Bool.and(steer, busy)

# Enviar agora: anexo respeita `images`; ocupado só passa com steer.
def canSend(caps: Caps, busy: Bool, hasImages: Bool) -> Bool:
  match caps:
    case Caps{images, _, steer, _, _, _, _, _, _, _, _, _, _}:
      Bool.and(imagesAllowed(images, hasImages), Bool.or(Bool.not(busy), steer))

# Visibilidade do controle: espelho fiel da capacidade (acesso direto).
def controlVisible(caps: Caps, control: CapsControl) -> Bool:
  match caps control:
    case Caps{images, _, _, _, _, _, _, _, _, _, _, _, _} ControlImages{}:
      images
    case Caps{_, permissions, _, _, _, _, _, _, _, _, _, _, _} ControlPermissions{}:
      permissions
    case Caps{_, _, steer, _, _, _, _, _, _, _, _, _, _} ControlSteer{}:
      steer
    case Caps{_, _, _, compact, _, _, _, _, _, _, _, _, _} ControlCompact{}:
      compact
    case Caps{_, _, _, _, autoCompaction, _, _, _, _, _, _, _, _} ControlAutoCompaction{}:
      autoCompaction
    case Caps{_, _, _, _, _, modelSelection, _, _, _, _, _, _, _} ControlModelSelection{}:
      modelSelection
    case Caps{_, _, _, _, _, _, effort, _, _, _, _, _, _} ControlEffort{}:
      effort
    case Caps{_, _, _, _, _, _, _, reviewDraft, _, _, _, _, _} ControlReviewDraft{}:
      reviewDraft
    case Caps{_, _, _, _, _, _, _, _, handoff, _, _, _, _} ControlHandoff{}:
      handoff
    case Caps{_, _, _, _, _, _, _, _, _, commands, _, _, _} ControlCommands{}:
      commands
    case Caps{_, _, _, _, _, _, _, _, _, _, geogebra, _, _} ControlGeogebra{}:
      geogebra
    case Caps{_, _, _, _, _, _, _, _, _, _, _, quiz, _} ControlQuiz{}:
      quiz
    case Caps{_, _, _, _, _, _, _, _, _, _, _, _, contextUsage} ControlContextUsage{}:
      contextUsage
