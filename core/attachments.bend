import Base

# ---------------------------------------------------------------------------
# Núcleo da política de anexos (Mesa + Conversa) e do conteúdo de mensagem.
#
# O host faz o mundo: lê bytes (FileReader/fs), decodifica base64, mede
# tamanhos, comprime/redimensiona e persiste. O núcleo decide o que entra e
# como sai normalizado: tipos de imagem aceitos, tetos de contagem e de
# tamanho (a partir dos fatos medidos), mime canônico, nome saneado/truncado,
# ordem das imagens e a forma do data URL.
#
# Portas:
#   - normalizeAttachments: o que entra no rascunho (4 imagens + 4 arquivos,
#     data URL abaixo do teto, texto abaixo de 80000 caracteres).
#   - promptImages: o que é enviado (data URL válido, 16 MiB crus, 8 MiB por
#     imagem após a redução, 28 MiB de soma).
#   - contentParts: `content` string ou lista de partes → texto (partes de
#     texto unidas com '\n') e imagens (url direta ou data URL de mime+base64,
#     mime vazio vira image/png).
#
# O host entrega os fatos já medidos como Bool (`valid` do data URL, `overRaw`,
# `overSend`, `overTotal`, `over`): o núcleo só casa com Bool, é o que mantém
# as leis reduzindo. Bytes, base64, compressão e disco nunca entram aqui.
#
# Contrato do host (o adaptador mede; o núcleo decide):
#   - ImageIn.valid: o data URL tem a forma `data:<mime>;base64,<payload>`; o
#     host extrai o `mime` junto. Regex estrito (só os tipos aceitos) ou só
#     estrutural servem: o núcleo reaplica a lista de tipos.
#   - ImageIn.overRaw: no rascunho, `dataUrl.length > 16 MiB` (ATTACH_MAX_IMAGE,
#     medido em chars, como o host já faz); no envio, os bytes decodificados
#     vazios ou acima de 16 MiB.
#   - FileIn.over: o texto passou de 80000 chars.
#   - SendIn.overSend: os bytes depois da redução passaram de 8 MiB.
#   - SendIn.overTotal: a soma dos bytes das imagens que passaram nos critérios
#     anteriores, incluindo esta, passou de 28 MiB.
#   - os números são a fonte única dos hosts: main e renderer leem daqui (só o
#     preload, em sandbox, repete o literal — pinado por
#     `chat/tests/limits-parity.test.mjs`).
#
# Medidas diferentes, tetos iguais: o rascunho mede o data URL em chars e o
# envio mede bytes decodificados — base64 infla 4/3, então 16 MiB de chars
# valem ~12 MiB de arquivo. A Mesa recusa já ao anexar com o teto do envio
# (`maxRawBytes`, em bytes): a mesma recusa que o main faria depois, um passo
# antes. A Conversa mede o rascunho em chars (`maxDraftChars`) e o envio em
# bytes, como o contrato acima descreve.
#
# Sem dedupe: nenhum dos apps deduplica anexos hoje.
#
# Pilha (issue bendlang/bend#798, acumulador do aron-intframe): o saneamento
# do nome (`scrubName`) percorre a string em accumulator/tail; `String.take`
# de 120 é limitado. Nome de 100k não estoura a pilha.
# ---------------------------------------------------------------------------

# ---------- constantes da política (o host compara; o núcleo documenta) ----------

# Anexos por mensagem, no rascunho e no envio.
def maxImages() -> Nat:
  4n

def maxFiles() -> Nat:
  4n

# Nome exibido (caracteres).
def maxNameChars() -> Nat:
  120n

# Teto do data URL no rascunho: o host mede `dataUrl.length` (ATTACH_MAX_IMAGE).
# Os tetos grandes são U32: Nat em Bend é unário e um literal de 16 MiB não
# expande na checagem; U32 é palavra de máquina.
def maxDraftChars() -> U32:
  (16 * 1024 * 1024 : U32)

# Texto de um arquivo anexado (caracteres).
def maxTextChars() -> U32:
  (80000 : U32)

# Envio: bytes crus decodificados, bytes após a redução, soma das imagens.
def maxRawBytes() -> U32:
  (16 * 1024 * 1024 : U32)

def maxSendBytes() -> U32:
  (8 * 1024 * 1024 : U32)

def maxTotalBytes() -> U32:
  (28 * 1024 * 1024 : U32)

def defaultImageName() -> String:
  "imagem"

def defaultFileName() -> String:
  "anexo"

def defaultImageMime() -> String:
  "image/png"

# ---------- tipos ----------

# Imagem no rascunho: data URL e nome exibido.
type Attachment is Data:
  Attachment{dataUrl: String, name: String}

# Arquivo de texto no rascunho.
type TextFile is Data:
  TextFile{name: String, text: String}

# Entrada de imagem + fatos medidos pelo host.
# `valid`: o data URL tem a forma `data:<mime>;base64,<payload>` (o host casa;
# se ele usar o regex estrito, `valid` já cobre o tipo — o núcleo reaplica a
# lista de tipos de qualquer forma).
# `overRaw`: acima do teto do data URL no rascunho (chars) ou dos bytes crus
# no envio (o host funde "vazio" e "grande demais", que dão a mesma recusa).
type ImageIn is Data:
  ImageIn{dataUrl: String, mime: String, name: String, valid: Bool, overRaw: Bool}

# Entrada de texto + fato medido pelo host (`over`: passou de 80000 chars).
type FileIn is Data:
  FileIn{name: String, text: String, over: Bool}

# Entrada do envio + fatos medidos pelo host depois da redução.
# `overTotal`: a soma das imagens aceitas até esta passou de 28 MiB.
type SendIn is Data:
  SendIn{mime: String, valid: Bool, overRaw: Bool, overSend: Bool, overTotal: Bool}

# Motivo da recusa: o host traduz para a mensagem de cada app.
type AttachError is Data:
  AttachError.BadType{}
  AttachError.ImageTooLarge{}
  AttachError.FileTooLarge{}
  AttachError.ReducedTooLarge{}
  AttachError.TotalTooLarge{}

type AttachResult is Data:
  AttachResult.Ok{images: +List<Attachment>, files: +List<TextFile>}
  AttachResult.Bad{reason: AttachError}

type SendResult is Data:
  SendResult.Ok{mimes: +List<String>}
  SendResult.Bad{reason: AttachError}

# Parte do `content` de uma mensagem, como o host a leu do JSONL.
type ContentPart is Data:
  ContentPart{kind: String, text: String, data: String, url: String, mimeType: String}

type Content is Data:
  Content{text: String, images: +List<String>}

# ---------- tipos internos (não saem para o host: ele vê o resultado final) ----------

# O que uma entrada vira: aceita (com o já normalizado) ou recusa com motivo.
type ImageVerdict is Data:
  ImageVerdict.Keep{attachment: Attachment}
  ImageVerdict.Reject{reason: AttachError}

type FileVerdict is Data:
  FileVerdict.Keep{file: TextFile}
  FileVerdict.Drop{}
  FileVerdict.Reject{reason: AttachError}

type SendVerdict is Data:
  SendVerdict.Keep{mime: String}
  SendVerdict.Reject{reason: AttachError}

type PartVerdict is Data:
  PartVerdict.Text{text: String}
  PartVerdict.Picture{src: String}
  PartVerdict.Ignore{}

type DraftImages is Data:
  DraftImages{images: +List<Attachment>, reason: Maybe<&2, AttachError>}

type DraftFiles is Data:
  DraftFiles{files: +List<TextFile>, reason: Maybe<&2, AttachError>}

# ---------- nomes ----------

def scrubChar.go(c: Char, +code: U32) -> Char:
  match code:
    case 10:
      ' '
    case 13:
      ' '
    case _:
      c

def scrubChar(+c: Char) -> Char:
  scrubChar.go(c, Char.to_u32(c))

# CR/LF viram espaço (o mesmo que o replace do wrapPrompt). Accumulator
# (`acc` invertido + `String.reverse`, tail-safe): nome de 100k não estoura a
# pilha — a recursão `SCon{..., scrubName(t)}` do Base era não-tail (#798).
def scrubName.go(s: String, acc: String) -> String:
  match s:
    case SNil{}:
      String.reverse(acc)
    case SCon{h, t}:
      scrubName.go(t, SCon{scrubChar(h), acc})

def scrubName(s: String) -> String:
  scrubName.go(s, SNil{})

def nameOr(default: String, name: String, empty: Bool) -> String:
  match empty:
    case True{}:
      default
    case False{}:
      name

def nameOr.if(default: String, +name: String) -> String:
  nameOr(default, name, String.is_empty(name))

# Nome exibido: vazio vira o padrão, CR/LF viram espaço, corta em 120.
def cleanName(default: String, name: String) -> String:
  String.take(scrubName(nameOr.if(default, name)), maxNameChars())

# Arquivo aceito no rascunho: nome saneado; o corte do texto em 80000 fica com
# o host (ele mede), e o rascunho recusa acima disso em vez de cortar.
def cleanTextFile(name: String, text: String) -> TextFile:
  TextFile{cleanName(defaultFileName(), name), text}

# ---------- tipos de imagem ----------

# Tipos que os dois apps aceitam (o `image/jpg` do mundo Apple entra).
def allowedMime(+mime: String) -> Bool:
  Bool.or(
    String.eq(mime, "image/png"),
    Bool.or(
      String.eq(mime, "image/jpeg"),
      Bool.or(
        String.eq(mime, "image/jpg"),
        Bool.or(String.eq(mime, "image/webp"), String.eq(mime, "image/gif"))
      )
    )
  )

def canonMime.if(mime: String, jpg: Bool) -> String:
  match jpg:
    case True{}:
      "image/jpeg"
    case False{}:
      mime

# Mime canônico: `image/jpg` vira `image/jpeg` (como o envio já fazia).
def canonMime(+mime: String) -> String:
  canonMime.if(mime, String.eq(mime, "image/jpg"))

# ---------- conteúdo de mensagem ----------

# A imagem de uma parte: só quando a parte é imagem E tem url ou dados; a url
# direta vence; senão o data URL (mime vazio vira image/png).
def partImage.dataUrl(mime: String, mimeEmpty: Bool, data: String) -> String:
  match mimeEmpty:
    case True{}:
      "data:" ++ defaultImageMime() ++ ";base64," ++ data
    case False{}:
      "data:" ++ mime ++ ";base64," ++ data

def partImage.mime(+mime: String, data: String) -> String:
  partImage.dataUrl(mime, String.is_empty(mime), data)

def partImage.data(mime: String, data: String, dataEmpty: Bool) -> Maybe<&2, String>:
  match dataEmpty:
    case True{}:
      None{}
    case False{}:
      Some{partImage.mime(mime, data)}

def partImage.src(url: String, mime: String, data: String, urlEmpty: Bool, dataEmpty: Bool) -> Maybe<&2, String>:
  match urlEmpty:
    case False{}:
      Some{url}
    case True{}:
      partImage.data(mime, data, dataEmpty)

def partImage(kind: String, url: String, mime: String, data: String, isImage: Bool, urlEmpty: Bool, dataEmpty: Bool) -> Maybe<&2, String>:
  match isImage:
    case True{}:
      partImage.src(url, mime, data, urlEmpty, dataEmpty)
    case False{}:
      None{}

def partVerdict.src(pic: Maybe<&2, String>) -> PartVerdict:
  match pic:
    case Some{src}:
      PartVerdict.Picture{src}
    case None{}:
      PartVerdict.Ignore{}

def partVerdict.go(src: Maybe<&2, String>, isText: Bool, text: String) -> PartVerdict:
  match isText:
    case True{}:
      PartVerdict.Text{text}
    case False{}:
      partVerdict.src(src)

def partVerdict(p: ContentPart) -> PartVerdict:
  match p:
    case ContentPart{+kind, text, +data, +url, mimeType}:
      partVerdict.go(
        partImage(kind, url, mimeType, data, String.eq(kind, "image"), String.is_empty(url), String.is_empty(data)),
        String.eq(kind, "text"),
        text
      )

def partVerdicts(parts: List<&2, ContentPart>) -> List<&2, PartVerdict>:
  match parts:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{partVerdict(h), partVerdicts(t)}

def scanParts(parts: List<&2, PartVerdict>, texts: +List<String>, images: +List<String>) -> Content:
  match parts:
    case Nil{}:
      Content{String.join(texts, "\n"), images}
    case Con{h, t}:
      match h:
        case PartVerdict.Text{text}:
          scanParts(t, List.append(&2, String, texts, Con{text, Nil{}}), images)
        case PartVerdict.Picture{src}:
          scanParts(t, texts, List.append(&2, String, images, Con{src, Nil{}}))
        case PartVerdict.Ignore{}:
          scanParts(t, texts, images)

# `content` string vira texto puro; lista de partes vira texto (partes de texto
# unidas com '\n') + imagens na ordem das partes.
def contentParts(isString: Bool, text: String, parts: List<&2, ContentPart>) -> Content:
  match isString:
    case True{}:
      Content{text, Nil{}}
    case False{}:
      scanParts(partVerdicts(parts), Nil{}, Nil{})

def contentText(c: Content) -> String:
  match c:
    case Content{text, images}:
      text

def contentImages(c: Content) -> List<&2, String>:
  match c:
    case Content{text, images}:
      images

# ---------- rascunho: vereditos ----------

def imageVerdict.mime(mimeOk: Bool, dataUrl: String, name: String) -> ImageVerdict:
  match mimeOk:
    case False{}:
      ImageVerdict.Reject{AttachError.BadType{}}
    case True{}:
      ImageVerdict.Keep{Attachment{dataUrl, cleanName(defaultImageName(), name)}}

def imageVerdict.valid(valid: Bool, mimeOk: Bool, dataUrl: String, name: String) -> ImageVerdict:
  match valid:
    case False{}:
      ImageVerdict.Reject{AttachError.BadType{}}
    case True{}:
      imageVerdict.mime(mimeOk, dataUrl, name)

def imageVerdict.over(overRaw: Bool, valid: Bool, mimeOk: Bool, dataUrl: String, name: String) -> ImageVerdict:
  match overRaw:
    case True{}:
      ImageVerdict.Reject{AttachError.ImageTooLarge{}}
    case False{}:
      imageVerdict.valid(valid, mimeOk, dataUrl, name)

# Ordem do host: tamanho do data URL, forma/tipo, aceita.
def imageVerdict(item: ImageIn) -> ImageVerdict:
  match item:
    case ImageIn{dataUrl, mime, name, valid, overRaw}:
      imageVerdict.over(overRaw, valid, allowedMime(mime), dataUrl, name)

def fileVerdict.empty(empty: Bool, file: TextFile) -> FileVerdict:
  match empty:
    case True{}:
      FileVerdict.Drop{}
    case False{}:
      FileVerdict.Keep{file}

# Ordem do host: texto grande demais, vazio é pulado, aceita truncado.
def fileVerdict.over(over: Bool, empty: Bool, name: String, text: String) -> FileVerdict:
  match over:
    case True{}:
      FileVerdict.Reject{AttachError.FileTooLarge{}}
    case False{}:
      fileVerdict.empty(empty, cleanTextFile(name, text))

def fileVerdict(item: FileIn) -> FileVerdict:
  match item:
    case FileIn{name, +text, over}:
      fileVerdict.over(over, String.is_empty(text), name, text)

def imageVerdicts(items: List<&2, ImageIn>) -> List<&2, ImageVerdict>:
  match items:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{imageVerdict(h), imageVerdicts(t)}

def fileVerdicts(files: List<&2, FileIn>) -> List<&2, FileVerdict>:
  match files:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{fileVerdict(h), fileVerdicts(t)}

# ---------- rascunho: dobra dos vereditos ----------

# A primeira recusa para a dobra (e o que já entrou fica de fora).
def collectImages(items: List<&2, ImageVerdict>, acc: +List<Attachment>) -> DraftImages:
  match items:
    case Nil{}:
      DraftImages{acc, None{}}
    case Con{h, t}:
      match h:
        case ImageVerdict.Keep{attachment}:
          collectImages(t, List.append(&2, Attachment, acc, Con{attachment, Nil{}}))
        case ImageVerdict.Reject{reason}:
          DraftImages{acc, Some{reason}}

def collectFiles(files: List<&2, FileVerdict>, acc: +List<TextFile>) -> DraftFiles:
  match files:
    case Nil{}:
      DraftFiles{acc, None{}}
    case Con{h, t}:
      match h:
        case FileVerdict.Keep{file}:
          collectFiles(t, List.append(&2, TextFile, acc, Con{file, Nil{}}))
        case FileVerdict.Drop{}:
          collectFiles(t, acc)
        case FileVerdict.Reject{reason}:
          DraftFiles{acc, Some{reason}}

def finishDraftFiles(images: +List<Attachment>, files: DraftFiles) -> AttachResult:
  match files:
    case DraftFiles{files, reason}:
      match reason:
        case Some{r}:
          AttachResult.Bad{r}
        case None{}:
          AttachResult.Ok{images, files}

def finishDraft(imgs: DraftImages, files: List<&2, FileIn>) -> AttachResult:
  match imgs:
    case DraftImages{images, reason}:
      match reason:
        case Some{r}:
          AttachResult.Bad{r}
        case None{}:
          finishDraftFiles(
            images,
            collectFiles(fileVerdicts(List.take(&2, FileIn, files, maxFiles())), Nil{})
          )

# Rascunho: até 4 imagens e 4 arquivos, na ordem; recusa a primeira que falha.
def normalizeAttachments(images: List<&2, ImageIn>, files: List<&2, FileIn>) -> AttachResult:
  finishDraft(
    collectImages(imageVerdicts(List.take(&2, ImageIn, images, maxImages())), Nil{}),
    files
  )

def attachImages(r: AttachResult) -> List<&2, Attachment>:
  match r:
    case AttachResult.Ok{images, files}:
      images
    case AttachResult.Bad{reason}:
      Nil{}

def attachFiles(r: AttachResult) -> List<&2, TextFile>:
  match r:
    case AttachResult.Ok{images, files}:
      files
    case AttachResult.Bad{reason}:
      Nil{}

def attachReason(r: AttachResult) -> Maybe<&2, AttachError>:
  match r:
    case AttachResult.Ok{images, files}:
      None{}
    case AttachResult.Bad{reason}:
      Some{reason}

# ---------- envio ----------

def sendVerdict.total(overTotal: Bool, mime: String) -> SendVerdict:
  match overTotal:
    case True{}:
      SendVerdict.Reject{AttachError.TotalTooLarge{}}
    case False{}:
      SendVerdict.Keep{canonMime(mime)}

def sendVerdict.send(overSend: Bool, overTotal: Bool, mime: String) -> SendVerdict:
  match overSend:
    case True{}:
      SendVerdict.Reject{AttachError.ReducedTooLarge{}}
    case False{}:
      sendVerdict.total(overTotal, mime)

def sendVerdict.raw(overRaw: Bool, overSend: Bool, overTotal: Bool, mime: String) -> SendVerdict:
  match overRaw:
    case True{}:
      SendVerdict.Reject{AttachError.ImageTooLarge{}}
    case False{}:
      sendVerdict.send(overSend, overTotal, mime)

def sendVerdict.mime(mimeOk: Bool, overRaw: Bool, overSend: Bool, overTotal: Bool, mime: String) -> SendVerdict:
  match mimeOk:
    case False{}:
      SendVerdict.Reject{AttachError.BadType{}}
    case True{}:
      sendVerdict.raw(overRaw, overSend, overTotal, mime)

def sendVerdict.valid(valid: Bool, mimeOk: Bool, overRaw: Bool, overSend: Bool, overTotal: Bool, mime: String) -> SendVerdict:
  match valid:
    case False{}:
      SendVerdict.Reject{AttachError.BadType{}}
    case True{}:
      sendVerdict.mime(mimeOk, overRaw, overSend, overTotal, mime)

# Ordem do host: forma do data URL, tipo, bytes crus, redução, soma.
def sendVerdict(item: SendIn) -> SendVerdict:
  match item:
    case SendIn{+mime, valid, overRaw, overSend, overTotal}:
      sendVerdict.valid(valid, allowedMime(mime), overRaw, overSend, overTotal, mime)

def sendVerdicts(items: List<&2, SendIn>) -> List<&2, SendVerdict>:
  match items:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{sendVerdict(h), sendVerdicts(t)}

def collectMimes(items: List<&2, SendVerdict>, acc: +List<String>) -> SendResult:
  match items:
    case Nil{}:
      SendResult.Ok{acc}
    case Con{h, t}:
      match h:
        case SendVerdict.Keep{mime}:
          collectMimes(t, List.append(&2, String, acc, Con{mime, Nil{}}))
        case SendVerdict.Reject{reason}:
          SendResult.Bad{reason}

# Envio: até 4 imagens, na ordem, com o mime canônico; recusa a primeira que falha.
def promptImages(items: List<&2, SendIn>) -> SendResult:
  collectMimes(sendVerdicts(List.take(&2, SendIn, items, maxImages())), Nil{})

def sentMimes(r: SendResult) -> List<&2, String>:
  match r:
    case SendResult.Ok{mimes}:
      mimes
    case SendResult.Bad{reason}:
      Nil{}

def sentReason(r: SendResult) -> Maybe<&2, AttachError>:
  match r:
    case SendResult.Ok{mimes}:
      None{}
    case SendResult.Bad{reason}:
      Some{reason}
