import Base
import ../attachview.bend as A
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato dos anexos do composer e do chip de citação.
#
# Fatos concretos travam textos, classes, ids, ARIA, `key`, os fatos que
# divergem entre Mesa e Conversa (`lazy`, `removeTitle`) e a ordem
# imagens→arquivos. O que ficou de fora (data URL viva, compressão,
# clipboard, foco, IPC `readImage`) é host.
# ---------------------------------------------------------------------------

def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

def kind(n: V.ViewNode, i: Nat) -> V.ViewNode:
  at(V.kidsOf(n), i)

def attrOf(n: V.ViewNode, name: String) -> Maybe<&2, String>:
  V.attrGet(V.attrsOf(n), name)

def textOfAt(n: V.ViewNode, i: Nat) -> String:
  V.textOf(at(V.kidsOf(kind(n, i)), 0n))

def oneImage() -> A.AttachImage:
  A.AttachImage{"img-0", "data:image/png;base64,AA", "imagem", "Remover imagem imagem", "Remover imagem imagem", "RemoveImage", False{}}

def lazyImage() -> A.AttachImage:
  A.AttachImage{"img-0", "data:image/png;base64,AA", "Anexo: foto.png", "Remover foto.png", "", "RemoveAttachment", True{}}

def secondImage() -> A.AttachImage:
  A.AttachImage{"img-1", "data:image/png;base64,BB", "outra", "Remover imagem outra", "Remover imagem outra", "RemoveImage", False{}}

def oneFile() -> A.AttachFile:
  A.AttachFile{"file-0", "notas.txt", "Remover arquivo notas.txt", "Remover arquivo notas.txt", "RemoveFile"}

# ---------- item imagem ----------

law av_imagem_tag:
  {V.tagOf(A.imageItem(oneImage())) == "div" : String}

law av_imagem_classe:
  {attrOf(A.imageItem(oneImage()), "class") == Some{"attachment"} : Maybe<&2, String>}

law av_imagem_key:
  {attrOf(A.imageItem(oneImage()), "key") == Some{"img-0"} : Maybe<&2, String>}

law av_imagem_dois_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(A.imageItem(oneImage()))) == 2n : Nat}

law av_imagem_tag_img:
  {V.tagOf(kind(A.imageItem(oneImage()), 0n)) == "img" : String}

law av_imagem_src:
  {attrOf(kind(A.imageItem(oneImage()), 0n), "src") == Some{"data:image/png;base64,AA"} : Maybe<&2, String>}

law av_imagem_alt:
  {attrOf(kind(A.imageItem(oneImage()), 0n), "alt") == Some{"imagem"} : Maybe<&2, String>}

# Sem `lazy`, o `img` do rascunho da Conversa não ganha loading/decoding.
law av_imagem_sem_lazy:
  {attrOf(kind(A.imageItem(oneImage()), 0n), "loading") == None{} : Maybe<&2, String>}

law av_imagem_lazy_loading:
  {attrOf(kind(A.imageItem(lazyImage()), 0n), "loading") == Some{"lazy"} : Maybe<&2, String>}

law av_imagem_lazy_decoding:
  {attrOf(kind(A.imageItem(lazyImage()), 0n), "decoding") == Some{"async"} : Maybe<&2, String>}

law av_imagem_alt_lazy:
  {attrOf(kind(A.imageItem(lazyImage()), 0n), "alt") == Some{"Anexo: foto.png"} : Maybe<&2, String>}

law av_imagem_botao_tag:
  {V.tagOf(kind(A.imageItem(oneImage()), 1n)) == "button" : String}

law av_imagem_botao_classe:
  {attrOf(kind(A.imageItem(oneImage()), 1n), "class") == Some{"attachment-remove"} : Maybe<&2, String>}

law av_imagem_botao_tipo:
  {attrOf(kind(A.imageItem(oneImage()), 1n), "type") == Some{"button"} : Maybe<&2, String>}

law av_imagem_botao_rotulo:
  {attrOf(kind(A.imageItem(oneImage()), 1n), "aria-label") == Some{"Remover imagem imagem"} : Maybe<&2, String>}

law av_imagem_botao_title:
  {attrOf(kind(A.imageItem(oneImage()), 1n), "title") == Some{"Remover imagem imagem"} : Maybe<&2, String>}

# O título vazio (Mesa) não vira atributo.
law av_imagem_botao_sem_title:
  {attrOf(kind(A.imageItem(lazyImage()), 1n), "title") == None{} : Maybe<&2, String>}

law av_imagem_botao_evento:
  {attrOf(kind(A.imageItem(oneImage()), 1n), "on:click") == Some{"RemoveImage"} : Maybe<&2, String>}

law av_imagem_botao_texto:
  {textOfAt(A.imageItem(oneImage()), 1n) == "×" : String}

# ---------- item arquivo ----------

law av_arquivo_classe:
  {attrOf(A.fileItem(oneFile()), "class") == Some{"attachment"} : Maybe<&2, String>}

law av_arquivo_key:
  {attrOf(A.fileItem(oneFile()), "key") == Some{"file-0"} : Maybe<&2, String>}

law av_arquivo_dois_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(A.fileItem(oneFile()))) == 2n : Nat}

law av_arquivo_rotulo:
  {attrOf(kind(A.fileItem(oneFile()), 0n), "class") == Some{"file"} : Maybe<&2, String>}

law av_arquivo_texto:
  {textOfAt(A.fileItem(oneFile()), 0n) == "notas.txt" : String}

law av_arquivo_botao_rotulo:
  {attrOf(kind(A.fileItem(oneFile()), 1n), "aria-label") == Some{"Remover arquivo notas.txt"} : Maybe<&2, String>}

law av_arquivo_botao_title:
  {attrOf(kind(A.fileItem(oneFile()), 1n), "title") == Some{"Remover arquivo notas.txt"} : Maybe<&2, String>}

law av_arquivo_botao_evento:
  {attrOf(kind(A.fileItem(oneFile()), 1n), "on:click") == Some{"RemoveFile"} : Maybe<&2, String>}

# ---------- lista ----------

law av_lista_uma_imagem:
  {List.length(&2, V.ViewNode, A.attachmentViews([oneImage()], Nil{})) == 1n : Nat}

law av_lista_imagem_arquivo:
  {List.length(&2, V.ViewNode, A.attachmentViews([oneImage()], [oneFile()])) == 2n : Nat}

# Imagens primeiro; o arquivo fica depois e mantém a própria key.
law av_lista_ordem:
  {attrOf(at(A.attachmentViews([oneImage()], [oneFile()]), 1n), "key") == Some{"file-0"} : Maybe<&2, String>}

law av_lista_primeira_key:
  {attrOf(at(A.attachmentViews([oneImage()], [oneFile()]), 0n), "key") == Some{"img-0"} : Maybe<&2, String>}

law av_lista_duas_imagens:
  {attrOf(at(A.attachmentViews([oneImage(), secondImage()], Nil{}), 1n), "key") == Some{"img-1"} : Maybe<&2, String>}

law av_lista_vazia:
  {List.length(&2, V.ViewNode, A.attachmentViews(Nil{}, Nil{})) == 0n : Nat}

# ---------- chip de citação ----------

law av_chip_id:
  {attrOf(A.quoteChipView("curto"), "id") == Some{"quote-chip"} : Maybe<&2, String>}

law av_chip_classe:
  {attrOf(A.quoteChipView("curto"), "class") == Some{"quote-chip"} : Maybe<&2, String>}

law av_chip_tres_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(A.quoteChipView("curto"))) == 3n : Nat}

law av_chip_rotulo:
  {textOfAt(A.quoteChipView("curto"), 0n) == "Citar:" : String}

law av_chip_texto:
  {textOfAt(A.quoteChipView("curto"), 1n) == "“curto”" : String}

law av_chip_title:
  {attrOf(kind(A.quoteChipView("curto"), 1n), "title") == Some{"curto"} : Maybe<&2, String>}

# O corte (fato `long`) tira uma casa do teto e fecha com reticências; o texto
# curto com o fato desligado passa inteiro. O `title` guarda o texto sem as
# aspas.
law av_chip_corta:
  {A.quoteDisplay.given(String.from_list(List.replicate(Char, 161n, 'x')), True{})
    == String.append(String.from_list(List.replicate(Char, 159n, 'x')), "…") : String}

# O caminho `given` (fato `long` já resolvido pelo host) só decide reto ×
# reticência; a borda do caminho automático (len>160 → 159+"…") é pinada no
# teste de app (`chat/tests/attachview.test.mjs`).
law av_chip_given_longo_acrescenta:
  {A.quoteDisplay.given("abcdef", True{}) == "abcdef…" : String}

law av_chip_curto:
  {A.quoteDisplay.given("curto", False{}) == "curto" : String}

# Predicado limitado: no teto ainda é curto; um char além já é longo (o
# `String.length` da string inteira era recursão não-tail — #798).
law av_chip_pred_curto:
  {A.quoteIsLong("curto") == False{} : Bool}

law av_chip_pred_no_teto:
  {A.quoteIsLong(String.from_list(List.replicate(Char, 160n, 'x'))) == False{} : Bool}

law av_chip_pred_acima:
  {A.quoteIsLong(String.from_list(List.replicate(Char, 161n, 'x'))) == True{} : Bool}

# O caminho automático (sem fato do host) usa o predicado limitado.
law av_chip_auto_corta:
  {A.quoteChipText(String.from_list(List.replicate(Char, 161n, 'x')))
    == String.append("“", String.append(String.from_list(List.replicate(Char, 159n, 'x')), "…”")) : String}

# O fato `long` do host entra pronto e o `title` continua com o texto inteiro.
law av_chip_view_given_title:
  {attrOf(kind(A.quoteChipView.given("abcdef", True{}), 1n), "title") == Some{"abcdef"} : Maybe<&2, String>}

law av_chip_view_given_texto:
  {textOfAt(A.quoteChipView.given("abcdef", True{}), 1n) == "“abcdef…”" : String}

law av_chip_view_given_curto:
  {textOfAt(A.quoteChipView.given("abcdef", False{}), 1n) == "“abcdef”" : String}

law av_chip_visivel_corta:
  {A.quoteChipText.given(String.from_list(List.replicate(Char, 161n, 'x')), True{})
    == String.append("“", String.append(String.from_list(List.replicate(Char, 159n, 'x')), "…”")) : String}

law av_chip_visivel_curto:
  {A.quoteChipText.given("curto", False{}) == "“curto”" : String}

law av_chip_botao_classe:
  {attrOf(kind(A.quoteChipView("curto"), 2n), "class") == Some{"quote-chip-remove"} : Maybe<&2, String>}

law av_chip_botao_rotulo:
  {attrOf(kind(A.quoteChipView("curto"), 2n), "aria-label") == Some{"Remover citação"} : Maybe<&2, String>}

law av_chip_botao_title:
  {attrOf(kind(A.quoteChipView("curto"), 2n), "title") == Some{"Remover citação"} : Maybe<&2, String>}

law av_chip_botao_evento:
  {attrOf(kind(A.quoteChipView("curto"), 2n), "on:click") == Some{"RemoveQuote"} : Maybe<&2, String>}

law av_chip_botao_texto:
  {textOfAt(A.quoteChipView("curto"), 2n) == "×" : String}
