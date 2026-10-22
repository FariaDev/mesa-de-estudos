import Base

# ---------------------------------------------------------------------------
# Foto do celular (ticket #36). Módulo só da Mesa.
#
# A Mesa abre, a pedido, um site na rede local; o celular abre o site pelo QR
# code e manda a foto do caderno, que cai na bandeja de anexos (nunca é enviada
# sozinha). É um servidor HTTP na rede local, então o que não pode quebrar é a
# porta: quem entra, o quê, quanto, e quando ela está fechada.
#
#   - o fluxo: desligado → esperando → recebeu N → parado / expirou / erro de
#     rede. Foto só conta com o servidor de pé; Parar e o tempo sem uso fecham
#     a porta e guardam quantas chegaram;
#   - a porta (`door`): servidor parado, token errado ou caminho desconhecido
#     dão o MESMO "não existe" (404); só há duas portas abertas, a página e o
#     envio da foto. Não existe rota que leia arquivo do disco;
#   - a foto (`photo`): só imagem (JPEG, PNG, WebP), nunca vazia, com teto por
#     arquivo e por sessão (fotos e bytes); servidor parado no meio do envio
#     também dá 404.
#
# Fronteira de host (`desk/phone-host.cjs`): o host compara o token em tempo
# constante, reconhece a imagem pelos primeiros bytes, conta os bytes que
# chegaram e lê o relógio; o núcleo recebe esses fatos já resolvidos. Os textos
# do popover e da página do celular são interface (ADR 0001) e moram nos
# catálogos `desk/locales/*.json`, chaves `phone.*`.
# ---------------------------------------------------------------------------

# ---------- fluxo ----------

type Flow is Data:
  PhoneOff{}
  PhoneWaiting{}
  PhoneReceived{count: U32}
  PhoneStopped{count: U32}
  PhoneExpired{count: U32}
  PhoneNetError{}

type FlowEvent is Data:
  EvStart{}
  EvPhoto{}
  EvStop{}
  EvIdle{}
  EvFail{}

# O servidor está de pé (a porta pode abrir) só esperando ou depois de receber.
def running(f: Flow) -> Bool:
  match f:
    case PhoneOff{}:
      False{}
    case PhoneWaiting{}:
      True{}
    case PhoneReceived{count}:
      True{}
    case PhoneStopped{count}:
      False{}
    case PhoneExpired{count}:
      False{}
    case PhoneNetError{}:
      False{}

# Quantas fotos chegaram nesta sessão (zero fora dela).
def received(f: Flow) -> U32:
  match f:
    case PhoneOff{}:
      0
    case PhoneWaiting{}:
      0
    case PhoneReceived{count}:
      count
    case PhoneStopped{count}:
      count
    case PhoneExpired{count}:
      count
    case PhoneNetError{}:
      0

# Foto aceita: só conta com o servidor de pé.
def onPhoto(f: Flow) -> Flow:
  match f:
    case PhoneOff{}:
      PhoneOff{}
    case PhoneWaiting{}:
      PhoneReceived{1}
    case PhoneReceived{count}:
      PhoneReceived{U32.add(count, 1)}
    case PhoneStopped{count}:
      PhoneStopped{count}
    case PhoneExpired{count}:
      PhoneExpired{count}
    case PhoneNetError{}:
      PhoneNetError{}

def closeAs(f: Flow, expired: Bool) -> Flow:
  match expired:
    case True{}:
      PhoneExpired{received(f)}
    case False{}:
      PhoneStopped{received(f)}

# Parar e expirar só fecham o que está de pé; o resto fica como estava.
def onClose.when(up: Bool, f: Flow, expired: Bool) -> Flow:
  match up:
    case True{}:
      closeAs(f, expired)
    case False{}:
      f

def onClose(+f: Flow, expired: Bool) -> Flow:
  onClose.when(running(f), f, expired)

# Um pedido novo sempre recomeça do zero (token novo, contagem nova).
def step(f: Flow, e: FlowEvent) -> Flow:
  match e:
    case EvStart{}:
      PhoneWaiting{}
    case EvPhoto{}:
      onPhoto(f)
    case EvStop{}:
      onClose(f, False{})
    case EvIdle{}:
      onClose(f, True{})
    case EvFail{}:
      PhoneNetError{}

# ---------- limites ----------

# 15 MB por foto: a foto de celular mais pesada (JPEG de 48 MP) fica abaixo.
def maxFileBytes() -> U32:
  15728640

# Por sessão (do Iniciar ao Parar): 12 fotos e 100 MB.
def maxSessionPhotos() -> U32:
  12

def maxSessionBytes() -> U32:
  104857600

# Desliga sozinho depois de 10 minutos sem nenhum pedido.
def idleMs() -> U32:
  600000

# ---------- porta ----------

# Forma do pedido, como o host a leu: `GET /<token>` é a página e
# `POST /<token>/photo` é o envio; o resto é `Other`.
type Route is Data:
  PageRoute{}
  UploadRoute{}
  OtherRoute{}

type Door is Data:
  DoorClosed{}
  DoorPage{}
  DoorUpload{}

def routeDoor(r: Route) -> Door:
  match r:
    case PageRoute{}:
      DoorPage{}
    case UploadRoute{}:
      DoorUpload{}
    case OtherRoute{}:
      DoorClosed{}

def tokenDoor(token: Bool, r: Route) -> Door:
  match token:
    case True{}:
      routeDoor(r)
    case False{}:
      DoorClosed{}

# Servidor parado ou token errado: fechado, qualquer que seja o caminho.
def door(up: Bool, token: Bool, r: Route) -> Door:
  match up:
    case True{}:
      tokenDoor(token, r)
    case False{}:
      DoorClosed{}

# ---------- foto ----------

# Tipo reconhecido pelo host nos primeiros bytes (não pelo Content-Type).
type ImageKind is Data:
  KindJpeg{}
  KindPng{}
  KindWebp{}
  KindNotImage{}

def isImage(k: ImageKind) -> Bool:
  match k:
    case KindJpeg{}:
      True{}
    case KindPng{}:
      True{}
    case KindWebp{}:
      True{}
    case KindNotImage{}:
      False{}

type Verdict is Data:
  PhotoAccept{}
  PhotoGone{}
  PhotoWrongType{}
  PhotoTooLarge{}
  PhotoFull{}

def acceptUnless(full: Bool) -> Verdict:
  match full:
    case True{}:
      PhotoFull{}
    case False{}:
      PhotoAccept{}

# Cheia quando já tem o máximo de fotos ou quando esta passa do teto de bytes.
def sessionFull(photos: U32, total: U32, bytes: U32) -> Bool:
  Bool.or(U32.is_ge(photos, maxSessionPhotos()), U32.is_gt(bytes, U32.sub(maxSessionBytes(), total)))

def fitsFile.when(big: Bool, bytes: U32, photos: U32, total: U32) -> Verdict:
  match big:
    case True{}:
      PhotoTooLarge{}
    case False{}:
      acceptUnless(sessionFull(photos, total, bytes))

def fitsFile(+bytes: U32, photos: U32, total: U32) -> Verdict:
  fitsFile.when(U32.is_gt(bytes, maxFileBytes()), bytes, photos, total)

def imageVerdict.when(ok: Bool, bytes: U32, photos: U32, total: U32) -> Verdict:
  match ok:
    case True{}:
      fitsFile(bytes, photos, total)
    case False{}:
      PhotoWrongType{}

def imageVerdict(k: ImageKind, +bytes: U32, photos: U32, total: U32) -> Verdict:
  imageVerdict.when(Bool.and(isImage(k), Bool.not(U32.is_eq(bytes, 0))), bytes, photos, total)

# A foto que chegou inteira: `up` é se o servidor ainda está de pé, `photos` e
# `total` o que a sessão já aceitou (o host só soma com `Accept`). `total` nunca
# passa de `maxSessionBytes`, então a subtração em `fitsSession` não dá a volta.
def photo(up: Bool, k: ImageKind, bytes: U32, photos: U32, total: U32) -> Verdict:
  match up:
    case True{}:
      imageVerdict(k, bytes, photos, total)
    case False{}:
      PhotoGone{}

# Status HTTP de cada resposta. `Gone` é 404 de propósito: para quem está de
# fora, servidor parado e token errado são a mesma coisa.
def verdictStatus(v: Verdict) -> U32:
  match v:
    case PhotoAccept{}:
      201
    case PhotoGone{}:
      404
    case PhotoWrongType{}:
      415
    case PhotoTooLarge{}:
      413
    case PhotoFull{}:
      413
