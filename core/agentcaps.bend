import Base

# ---------------------------------------------------------------------------
# Capacidades do motor de conversa da Mesa: o que host/UI podem oferecer para
# Pi, Claude Code e OpenCode sem prometer paridade.
#
# Os fatos vêm do host, escolhidos pelo motor da conversa:
#   - `piCaps()`: tudo ligado — é o comportamento que o app já exercita;
#   - `claudeCaps()` (#58): imagens, permissões, steer (segundo item na
#     consulta viva do Agent SDK), compactação manual (`/compact`, fim no
#     `compact_result`), rascunho de revisão (consulta temporária sem
#     ferramentas), comandos (`supportedCommands()` + texto `/nome`),
#     GeoGebra e quiz (MCP `mesa`, #53) e medidor de contexto LIGADOS.
#     Compactação automática fica DESLIGADA: o CLI compacta sozinho, mas a
#     Mesa não tem como ligar/desligar isso com prova. Modelo e esforço só
#     entram com o catálogo nativo (`claudeControlCaps`) (capacidade false
#     vale para host e UI, sem fallback escondido para Pi);
#   - `opencodeCaps()` (#57): imagens, permissões, steer, compactação manual,
#     comandos, GeoGebra, atividade e medidor de contexto LIGADOS — cada um
#     com caminho medido no `opencode serve` 2.0.32. Compactação automática,
#     e rascunho de revisão ficam DESLIGADOS (o rascunho não foi
#     portado). Modelo e esforço só entram com o catálogo do servidor
#     (`opencodeControlCaps`);
#   - `unknownCaps()`: motor que a Mesa não reconhece fica TODO fechado. Não
#     herda `piCaps` — um descritor estranho nunca ganha ferramenta do Pi.
#
# Bilhete (`handoff`): veio da Conversa, aposentada na #50. Ficou falso nos três
# motores na #58 e saiu do contrato na #49, junto com `ControlHandoff`.
#
# `canSend` é a decisão do composer: anexo só quando `images` está ligada e,
# com o motor ocupado, só se `steer` existir (sem steer, a mensagem espera a
# fila). `canSteer` só fala do caminho ocupado.
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
  ControlCommands{}
  ControlGeogebra{}
  ControlQuiz{}
  ControlContextUsage{}

def piCaps() -> Caps:
  Caps{
    True{}, True{}, True{}, True{}, True{}, True{}, True{},
    True{}, True{}, True{}, True{}, True{}
  }

# Estrutural: o que o Claude integra sem depender do catálogo de modelos.
def claudeCaps() -> Caps:
  Caps{
    True{}, True{}, True{}, True{}, False{}, False{}, False{},
    True{}, True{}, True{}, True{}, True{}
  }

# Catálogo e suporte vêm do SDK nativo já inicializado pelo host. Ausência de
# catálogo mantém os controles ocultos; esforço também exige catálogo válido.
def claudeControlCaps(catalogReady: Bool, effortSupported: Bool) -> Caps:
  match catalogReady:
    case False{}:
      claudeCaps()
    case True{}:
      Caps{
        True{}, True{}, True{}, True{}, False{}, True{}, effortSupported,
        True{}, True{}, True{}, True{}, True{}
      }

# OpenCode: o que a Mesa liga no `serve`. O steer é `delivery:'steer'` no
# prompt, a compactação é `POST /compact` (o fim vem no SSE), os comandos são
# `GET/POST /command`, o medidor soma os tokens da última resposta contra o
# `limit.context` do catálogo, e GeoGebra e atividade são o MCP `mesa` da Mesa.
def opencodeCaps() -> Caps:
  Caps{
    True{}, True{}, True{}, True{}, False{}, False{}, False{},
    False{}, True{}, True{}, True{}, True{}
  }

# Catálogo do servidor lido (`GET /api/model`): o seletor de modelo aparece; a
# variante (esforço) só quando o modelo escolhido tem variantes. Sem catálogo,
# os dois ficam ocultos e o resto continua igual.
def opencodeControlCaps(catalogReady: Bool, effortSupported: Bool) -> Caps:
  match catalogReady:
    case False{}:
      opencodeCaps()
    case True{}:
      Caps{
        True{}, True{}, True{}, True{}, False{}, True{}, effortSupported,
        False{}, True{}, True{}, True{}, True{}
      }

# Motor fora de Pi, Claude e OpenCode: nada liga. O host usa isto em vez de
# cair no Pi.
def unknownCaps() -> Caps:
  Caps{
    False{}, False{}, False{}, False{}, False{}, False{}, False{},
    False{}, False{}, False{}, False{}, False{}
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
    case Caps{_, _, steer, _, _, _, _, _, _, _, _, _}:
      Bool.and(steer, busy)

# Enviar agora: anexo respeita `images`; ocupado só passa com steer.
def canSend(caps: Caps, busy: Bool, hasImages: Bool) -> Bool:
  match caps:
    case Caps{images, _, steer, _, _, _, _, _, _, _, _, _}:
      Bool.and(imagesAllowed(images, hasImages), Bool.or(Bool.not(busy), steer))

# Visibilidade do controle: espelho fiel da capacidade (acesso direto).
def controlVisible(caps: Caps, control: CapsControl) -> Bool:
  match caps control:
    case Caps{images, _, _, _, _, _, _, _, _, _, _, _} ControlImages{}:
      images
    case Caps{_, permissions, _, _, _, _, _, _, _, _, _, _} ControlPermissions{}:
      permissions
    case Caps{_, _, steer, _, _, _, _, _, _, _, _, _} ControlSteer{}:
      steer
    case Caps{_, _, _, compact, _, _, _, _, _, _, _, _} ControlCompact{}:
      compact
    case Caps{_, _, _, _, autoCompaction, _, _, _, _, _, _, _} ControlAutoCompaction{}:
      autoCompaction
    case Caps{_, _, _, _, _, modelSelection, _, _, _, _, _, _} ControlModelSelection{}:
      modelSelection
    case Caps{_, _, _, _, _, _, effort, _, _, _, _, _} ControlEffort{}:
      effort
    case Caps{_, _, _, _, _, _, _, reviewDraft, _, _, _, _} ControlReviewDraft{}:
      reviewDraft
    case Caps{_, _, _, _, _, _, _, _, commands, _, _, _} ControlCommands{}:
      commands
    case Caps{_, _, _, _, _, _, _, _, _, geogebra, _, _} ControlGeogebra{}:
      geogebra
    case Caps{_, _, _, _, _, _, _, _, _, _, quiz, _} ControlQuiz{}:
      quiz
    case Caps{_, _, _, _, _, _, _, _, _, _, _, contextUsage} ControlContextUsage{}:
      contextUsage
