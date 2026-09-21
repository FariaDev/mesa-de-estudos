import Base
import ../attachments.bend as A

# Leis da política de anexos e do conteúdo de mensagem. Vocabulário auxiliar
# primeiro; nada daqui vai para o app.
#
# Os limites grandes são U32 (Nat em Bend é unário; 16 MiB não expande).
# Os fatos que o host mede chegam como Bool na lei também: assim o lado
# direito reduz mesmo com strings simbólicas (o núcleo só casa com Bool).

# ---------------------------------------------------------------------------
# Limites (a política em números)
# ---------------------------------------------------------------------------

# LAW: no máximo 4 imagens por mensagem.
law limit_images:
  {A.maxImages() == 4n : Nat}

# LAW: no máximo 4 arquivos de texto por mensagem.
law limit_files:
  {A.maxFiles() == 4n : Nat}

# LAW: nome exibido cortado em 120 caracteres.
law limit_name:
  {A.maxNameChars() == 120n : Nat}

# LAW: teto do data URL no rascunho (16 MiB medidos no data URL).
law limit_draft_chars:
  {A.maxDraftChars() == (16 * 1024 * 1024 : U32) : U32}

# LAW: teto do texto de um anexo no rascunho.
law limit_text_chars:
  {A.maxTextChars() == (80000 : U32) : U32}

# LAW: teto dos bytes crus de uma imagem no envio.
law limit_raw_bytes:
  {A.maxRawBytes() == (16 * 1024 * 1024 : U32) : U32}

# LAW: teto de uma imagem depois da redução.
law limit_send_bytes:
  {A.maxSendBytes() == (8 * 1024 * 1024 : U32) : U32}

# LAW: teto da soma das imagens no envio.
law limit_total_bytes:
  {A.maxTotalBytes() == (28 * 1024 * 1024 : U32) : U32}

# ---------------------------------------------------------------------------
# Nome saneado
# ---------------------------------------------------------------------------

# LAW: nome vazio vira o padrão.
law name_default:
  {A.cleanName("imagem", "") == "imagem" : String}

# LAW: nome comum passa inteiro.
law name_keeps:
  {A.cleanName("imagem", "foto.png") == "foto.png" : String}

# LAW: CR/LF viram espaço.
law name_scrubs:
  {A.cleanName("d", "a\nb\rc") == "a b c" : String}

# LAW: nome longo é cortado em 120.
law name_cut:
  {A.cleanName("d", String.from_list(List.replicate(Char, 130n, 'x')))
    == String.from_list(List.replicate(Char, 120n, 'x')) : String}

# LAW: o saneamento vem antes do corte (o CR vira espaço e o corte é no
# resultado saneado — scrubName em accumulator/tail, #798).
law name_scrub_cut:
  {A.cleanName("d", String.append("a\n", String.from_list(List.replicate(Char, 130n, 'x'))))
    == String.append("a ", String.from_list(List.replicate(Char, 118n, 'x'))) : String}

# ---------------------------------------------------------------------------
# Tipo de imagem
# ---------------------------------------------------------------------------

# LAW: os tipos aceitos pelo envio e pelo rascunho.
law mime_png:
  {A.allowedMime("image/png") == True{} : Bool}

law mime_jpeg:
  {A.allowedMime("image/jpeg") == True{} : Bool}

law mime_jpg:
  {A.allowedMime("image/jpg") == True{} : Bool}

law mime_webp:
  {A.allowedMime("image/webp") == True{} : Bool}

law mime_gif:
  {A.allowedMime("image/gif") == True{} : Bool}

# LAW: tipo fora da lista é recusado.
law mime_svg:
  {A.allowedMime("image/svg+xml") == False{} : Bool}

law mime_empty:
  {A.allowedMime("") == False{} : Bool}

# LAW: `image/jpg` vira `image/jpeg` no envio.
law canon_jpg:
  {A.canonMime("image/jpg") == "image/jpeg" : String}

law canon_jpeg_kept:
  {A.canonMime("image/jpeg") == "image/jpeg" : String}

law canon_png_kept:
  {A.canonMime("image/png") == "image/png" : String}

# ---------------------------------------------------------------------------
# Conteúdo de mensagem: a imagem de uma parte
# ---------------------------------------------------------------------------

# LAW: a url direta vence os dados (fato do host: url não vazia).
law part_image_url:
  for url: String
  for data: String
  {A.partImage("image", url, "image/png", data, True{}, False{}, False{}) == Some{url} : Maybe<&2, String>}

# LAW: sem url, monta o data URL com o mime da parte.
law part_image_data:
  for data: String
  {A.partImage("image", "", "image/webp", data, True{}, True{}, False{})
    == Some{"data:image/webp;base64," ++ data} : Maybe<&2, String>}

# LAW: uma parte que não é imagem não vira imagem, mesmo com url.
law part_image_kind_gate:
  for url: String
  {A.partImage("toolCall", url, "image/png", "abc", False{}, False{}, False{}) == None{} : Maybe<&2, String>}

# LAW: parte imagem sem url nem dados não vira imagem.
law part_image_payload_gate:
  {A.partImage("image", "", "image/png", "", True{}, True{}, True{}) == None{} : Maybe<&2, String>}

# ---------------------------------------------------------------------------
# Conteúdo de mensagem: contentParts
# ---------------------------------------------------------------------------

# LAW: content string vira o texto puro.
law content_string_text:
  for s: String
  {A.contentText(A.contentParts(True{}, s, Nil{})) == s : String}

# LAW: content string não tem imagens.
law content_string_images:
  for s: String
  {A.contentImages(A.contentParts(True{}, s, Nil{})) == Nil{} : List<&2, String>}

# LAW: lista vazia vira texto vazio, sem imagens.
law content_empty:
  {A.contentText(A.contentParts(False{}, "", Nil{})) == "" : String}

# LAW: uma parte de texto vira o texto dela.
law content_text_single:
  {A.contentText(A.contentParts(False{}, "", [A.ContentPart{"text", "oi", "", "", ""}])) == "oi" : String}

# LAW: partes de texto são unidas com '\n'.
law content_text_join:
  {A.contentText(A.contentParts(False{}, "", [
    A.ContentPart{"text", "a", "", "", ""},
    A.ContentPart{"text", "b", "", "", ""}
  ])) == "a\nb" : String}

# LAW: imagem no meio não entra no texto nem quebra a junção.
law content_text_skips_image:
  {A.contentText(A.contentParts(False{}, "", [
    A.ContentPart{"text", "a", "", "", ""},
    A.ContentPart{"image", "", "", "https://x/1.png", "image/png"},
    A.ContentPart{"text", "b", "", "", ""}
  ])) == "a\nb" : String}

# LAW: parte de texto vazia conta como separador (o JS também a junta).
law content_text_blank_counts:
  {A.contentText(A.contentParts(False{}, "", [
    A.ContentPart{"text", "a", "", "", ""},
    A.ContentPart{"text", "", "", "", ""},
    A.ContentPart{"text", "b", "", "", ""}
  ])) == "a\n\nb" : String}

# LAW: imagem com url sai como url.
law content_image_url:
  {A.contentImages(A.contentParts(False{}, "", [
    A.ContentPart{"image", "", "", "https://x/1.png", "image/png"}
  ])) == ["https://x/1.png"] : List<&2, String>}

# LAW: imagem com dados sai como data URL do mime dela.
law content_image_data:
  {A.contentImages(A.contentParts(False{}, "", [
    A.ContentPart{"image", "", "abc", "", "image/jpeg"}
  ])) == ["data:image/jpeg;base64,abc"] : List<&2, String>}

# LAW: mime vazio vira image/png.
law content_image_mime_default:
  {A.contentImages(A.contentParts(False{}, "", [
    A.ContentPart{"image", "", "abc", "", ""}
  ])) == ["data:image/png;base64,abc"] : List<&2, String>}

# LAW: com url e dados, a url vence.
law content_image_url_wins:
  {A.contentImages(A.contentParts(False{}, "", [
    A.ContentPart{"image", "", "abc", "https://x/1.png", "image/png"}
  ])) == ["https://x/1.png"] : List<&2, String>}

# LAW: as imagens saem na ordem das partes.
law content_image_order:
  {A.contentImages(A.contentParts(False{}, "", [
    A.ContentPart{"image", "", "a1", "", "image/png"},
    A.ContentPart{"image", "", "", "https://x/2.png", "image/png"},
    A.ContentPart{"image", "", "a3", "", "image/webp"}
  ])) == ["data:image/png;base64,a1", "https://x/2.png", "data:image/webp;base64,a3"] : List<&2, String>}

# LAW: parte que não é imagem e imagem sem payload ficam de fora.
law content_image_skips:
  {A.contentImages(A.contentParts(False{}, "", [
    A.ContentPart{"image", "", "", "", "image/png"},
    A.ContentPart{"thinking", "pensando", "", "https://x/3.png", "image/png"},
    A.ContentPart{"toolCall", "", "", "", ""}
  ])) == Nil{} : List<&2, String>}

# ---------------------------------------------------------------------------
# Rascunho: aceitação e limites
# ---------------------------------------------------------------------------

# LAW: sem anexos, tudo vazio.
law draft_empty:
  {A.normalizeAttachments(Nil{}, Nil{}) == A.AttachResult.Ok{Nil{}, Nil{}} : A.AttachResult}

# LAW: imagem válida entra com o nome padrão.
law draft_image_ok:
  for d: String
  {A.attachImages(A.normalizeAttachments([A.ImageIn{d, "image/png", "", True{}, False{}}], Nil{}))
    == [A.Attachment{d, "imagem"}] : List<&2, A.Attachment>}

# LAW: as imagens entram na ordem, com os nomes saneados.
law draft_image_order:
  for d1: String
  for d2: String
  {A.attachImages(A.normalizeAttachments([
    A.ImageIn{d1, "image/png", "a.png", True{}, False{}},
    A.ImageIn{d2, "image/webp", "b.png", True{}, False{}}
  ], Nil{})) == [A.Attachment{d1, "a.png"}, A.Attachment{d2, "b.png"}] : List<&2, A.Attachment>}

# LAW: data URL acima do teto é recusado (o fato vem do host).
law draft_image_big:
  for d: String
  {A.normalizeAttachments([A.ImageIn{d, "image/png", "", True{}, True{}}], Nil{})
    == A.AttachResult.Bad{A.AttachError.ImageTooLarge{}} : A.AttachResult}

# LAW: data URL com forma inválida é recusado.
law draft_image_invalid:
  for d: String
  {A.normalizeAttachments([A.ImageIn{d, "image/png", "", False{}, False{}}], Nil{})
    == A.AttachResult.Bad{A.AttachError.BadType{}} : A.AttachResult}

# LAW: forma ok mas tipo fora da lista é recusado.
law draft_image_type:
  {A.normalizeAttachments([A.ImageIn{"d", "image/svg+xml", "", True{}, False{}}], Nil{})
    == A.AttachResult.Bad{A.AttachError.BadType{}} : A.AttachResult}

# LAW: a quinta imagem é ignorada, mesmo inválida (o corte vem antes).
law draft_image_cap:
  for +d: String
  for rest: List<&2, A.ImageIn>
  {A.attachImages(A.normalizeAttachments(
    List.append(&2, A.ImageIn, [
      A.ImageIn{d, "image/png", "", True{}, False{}},
      A.ImageIn{d, "image/png", "", True{}, False{}},
      A.ImageIn{d, "image/png", "", True{}, False{}},
      A.ImageIn{d, "image/png", "", True{}, False{}},
      A.ImageIn{"ignorada", "image/svg+xml", "", False{}, True{}}
    ], rest),
    Nil{}))
    == [A.Attachment{d, "imagem"}, A.Attachment{d, "imagem"}, A.Attachment{d, "imagem"}, A.Attachment{d, "imagem"}]
    : List<&2, A.Attachment>}

# LAW: arquivo de texto válido entra com o nome.
law draft_file_ok:
  {A.attachFiles(A.normalizeAttachments(Nil{}, [A.FileIn{"notas.md", "abc", False{}}]))
    == [A.TextFile{"notas.md", "abc"}] : List<&2, A.TextFile>}

# LAW: nome vazio do arquivo vira o padrão.
law draft_file_default_name:
  {A.attachFiles(A.normalizeAttachments(Nil{}, [A.FileIn{"", "abc", False{}}]))
    == [A.TextFile{"anexo", "abc"}] : List<&2, A.TextFile>}

# LAW: arquivo vazio é pulado sem derrubar o resto.
law draft_file_empty_skipped:
  {A.attachFiles(A.normalizeAttachments(Nil{}, [
    A.FileIn{"", "", False{}},
    A.FileIn{"b.txt", "x", False{}}
  ])) == [A.TextFile{"b.txt", "x"}] : List<&2, A.TextFile>}

# LAW: arquivo acima do teto é recusado.
law draft_file_big:
  for t: String
  {A.normalizeAttachments(Nil{}, [A.FileIn{"a.txt", t, True{}}])
    == A.AttachResult.Bad{A.AttachError.FileTooLarge{}} : A.AttachResult}

# LAW: o quinto arquivo é ignorado, mesmo acima do teto.
law draft_file_cap:
  for rest: List<&2, A.FileIn>
  {A.attachFiles(A.normalizeAttachments(Nil{},
    List.append(&2, A.FileIn, [
      A.FileIn{"a", "1", False{}},
      A.FileIn{"b", "2", False{}},
      A.FileIn{"c", "3", False{}},
      A.FileIn{"d", "4", False{}},
      A.FileIn{"e", "5", True{}}
    ], rest)))
    == [A.TextFile{"a", "1"}, A.TextFile{"b", "2"}, A.TextFile{"c", "3"}, A.TextFile{"d", "4"}]
    : List<&2, A.TextFile>}

# LAW: a primeira recusa manda; o resto é descartado.
law draft_image_error_first:
  for d: String
  {A.normalizeAttachments([
    A.ImageIn{d, "image/png", "", False{}, False{}},
    A.ImageIn{d, "image/png", "", True{}, False{}}
  ], Nil{}) == A.AttachResult.Bad{A.AttachError.BadType{}} : A.AttachResult}

# LAW: recusa de imagem nem olha os arquivos.
law draft_error_stops_files:
  {A.normalizeAttachments(
    [A.ImageIn{"d", "image/png", "", True{}, True{}}],
    [A.FileIn{"a.txt", "x", False{}}])
    == A.AttachResult.Bad{A.AttachError.ImageTooLarge{}} : A.AttachResult}

# LAW: a razão do resultado aceito é vazia.
law draft_reason_ok:
  {A.attachReason(A.normalizeAttachments(Nil{}, Nil{})) == None{} : Maybe<&2, A.AttachError>}

# LAW: a razão do resultado recusado é o motivo.
law draft_reason_bad:
  {A.attachReason(A.normalizeAttachments([A.ImageIn{"d", "image/png", "", True{}, True{}}], Nil{}))
    == Some{A.AttachError.ImageTooLarge{}} : Maybe<&2, A.AttachError>}

# ---------------------------------------------------------------------------
# Envio
# ---------------------------------------------------------------------------

# LAW: sem imagens, nada a enviar.
law send_empty:
  {A.promptImages(Nil{}) == A.SendResult.Ok{Nil{}} : A.SendResult}

# LAW: imagem válida sai com o mime.
law send_ok:
  {A.sentMimes(A.promptImages([A.SendIn{"image/png", True{}, False{}, False{}, False{}}]))
    == ["image/png"] : List<&2, String>}

# LAW: `image/jpg` sai canônico.
law send_jpg_canon:
  {A.sentMimes(A.promptImages([A.SendIn{"image/jpg", True{}, False{}, False{}, False{}}]))
    == ["image/jpeg"] : List<&2, String>}

# LAW: os mimes saem na ordem das imagens.
law send_order:
  {A.sentMimes(A.promptImages([
    A.SendIn{"image/png", True{}, False{}, False{}, False{}},
    A.SendIn{"image/webp", True{}, False{}, False{}, False{}}
  ])) == ["image/png", "image/webp"] : List<&2, String>}

# LAW: data URL inválido é recusado.
law send_invalid:
  {A.promptImages([A.SendIn{"image/png", False{}, False{}, False{}, False{}}])
    == A.SendResult.Bad{A.AttachError.BadType{}} : A.SendResult}

# LAW: tipo fora da lista é recusado.
law send_type:
  {A.promptImages([A.SendIn{"image/svg+xml", True{}, False{}, False{}, False{}}])
    == A.SendResult.Bad{A.AttachError.BadType{}} : A.SendResult}

# LAW: imagem crua acima do teto é recusada.
law send_raw_big:
  {A.promptImages([A.SendIn{"image/png", True{}, True{}, False{}, False{}}])
    == A.SendResult.Bad{A.AttachError.ImageTooLarge{}} : A.SendResult}

# LAW: imagem que não reduz o bastante é recusada.
law send_reduce_big:
  {A.promptImages([A.SendIn{"image/png", True{}, False{}, True{}, False{}}])
    == A.SendResult.Bad{A.AttachError.ReducedTooLarge{}} : A.SendResult}

# LAW: soma acima do teto é recusada.
law send_total_big:
  {A.promptImages([A.SendIn{"image/png", True{}, False{}, False{}, True{}}])
    == A.SendResult.Bad{A.AttachError.TotalTooLarge{}} : A.SendResult}

# LAW: o primeiro critério que falha manda (cru > redução > soma).
law send_priority:
  {A.promptImages([A.SendIn{"image/png", True{}, True{}, True{}, True{}}])
    == A.SendResult.Bad{A.AttachError.ImageTooLarge{}} : A.SendResult}

# LAW: o critério que falha manda: tipo antes do tamanho.
law send_type_priority:
  {A.promptImages([A.SendIn{"image/svg+xml", True{}, True{}, False{}, False{}}])
    == A.SendResult.Bad{A.AttachError.BadType{}} : A.SendResult}

# LAW: a quinta imagem é ignorada, mesmo inválida.
law send_cap:
  for rest: List<&2, A.SendIn>
  {A.promptImages(
    List.append(&2, A.SendIn, [
      A.SendIn{"image/png", True{}, False{}, False{}, False{}},
      A.SendIn{"image/png", True{}, False{}, False{}, False{}},
      A.SendIn{"image/png", True{}, False{}, False{}, False{}},
      A.SendIn{"image/png", True{}, False{}, False{}, False{}},
      A.SendIn{"image/svg+xml", False{}, True{}, True{}, True{}}
    ], rest))
    == A.SendResult.Ok{["image/png", "image/png", "image/png", "image/png"]} : A.SendResult}

# LAW: a primeira recusa manda e não sai mime parcial.
law send_first_error:
  {A.promptImages([
    A.SendIn{"image/png", True{}, False{}, True{}, False{}},
    A.SendIn{"image/webp", False{}, False{}, False{}, False{}}
  ]) == A.SendResult.Bad{A.AttachError.ReducedTooLarge{}} : A.SendResult}
