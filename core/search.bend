import Base

# ---------------------------------------------------------------------------
# Núcleo da busca no conteúdo das conversas (app Conversa).
#
# I/O fica no host: andar a pasta, ler JSONL, medir o relógio, montar o mapa
# UTF-16 do foldText, recortar o trecho original e colapsar espaços. O núcleo
# recebe os fatos já resolvidos (consulta curta, arquivo grande, teto de
# arquivos/trechos, timeout) e aplica as regras: casamento sem acento/caixa,
# reticências do trecho, teto da lista, agrupamento por conversa e a bandeira
# de busca parcial.
#
# Dobra (diferente de fold.bend / nameMatches da Mesa): aqui as marcas
# combinantes U+0300–U+036F SAEM. O JS faz
#   ch.normalize("NFD").replace(MARK, "").toLowerCase()
#   .normalize("NFD").replace(MARK, "")
# por isso "formulario" acha "Formulário" e "calculo" acha "Cálculo". A Mesa,
# no NFD puro, guarda o acento e "calculo" NÃO acha "Cálculo". Só Latin-1 +
# combinantes + ASCII; o resto do Unicode continua no host.
#
# Caps (o host compara os números; o núcleo só vê Bool):
#   consulta 2..80, default 30 trechos, teto 50, 200 no total, 300 arquivos,
#   4 MiB por arquivo. Cortado (teto, timeout, mais de 300 arquivos) ⇒ parcial.
#
# Correção #798 (comentário do aron-intframe): as varreduras de string não podem
# ser recursivas não-tail (`String.split`/`String.length` e Cia. estouram a
# pilha do lane JS em ~5–8k chars). `fold` passou a accumulator/tail; os demais
# helpers alcançados (contains/starts_with/trim/reverse do prelude) já usam
# `run_jump` no artefato e não estouram a pilha com o hay de 4 MiB — a varredura
# do contains segue O(n·m), então o caminho quente do app continua o de sempre.
# ---------------------------------------------------------------------------

type MsgRole is Data:
  MsgUser{}
  MsgAssistant{}

# Trecho já recortado pelo host (texto original, nunca o dobrado).
type SearchHit is Data:
  SearchHit{conv: String, title: String, role: MsgRole, clip: String}

type SearchGroup is Data:
  SearchGroup{conv: String, title: String, hits: +List<SearchHit>}

type SearchOut is Data:
  SearchOut{hits: +List<SearchHit>, truncated: Bool}

# O que fazer com o próximo arquivo: varrer, pular (grande demais) ou parar
# (teto / timeout / além dos 300) — parar marca a busca como parcial.
type FileAct is Data:
  ActScan{}
  ActSkip{}
  ActStop{}

# ---------- constantes (o host compara; o núcleo documenta a política) ----------

def minQueryChars() -> Nat:
  2n

def maxQueryChars() -> Nat:
  80n

def defaultLimit() -> Nat:
  30n

def maxLimit() -> Nat:
  50n

def maxTotalHits() -> Nat:
  200n

def maxFiles() -> Nat:
  300n

# ---------- dobra: Latin-1 sem marcas + ASCII sem caixa ----------

def charStr(c: Char) -> String:
  SCon{c, SNil{}}

def combining(+code: U32) -> Bool:
  Bool.and(U32.is_ge(code, 768), U32.is_le(code, 879))

def asciiUpper(+code: U32) -> Bool:
  Bool.and(U32.is_ge(code, 65), U32.is_le(code, 90))

def foldChar.ascii(code: U32) -> String:
  charStr(Char.from_u32(U32.add(code, 32)))

# Pré-compostos Latin-1 viram a letra-base (sem a marca). æ/ð/ø/þ passam.
def foldChar.latin(c: Char, code: U32) -> String:
  match code:
    case 192:
      "a"
    case 193:
      "a"
    case 194:
      "a"
    case 195:
      "a"
    case 196:
      "a"
    case 197:
      "a"
    case 199:
      "c"
    case 200:
      "e"
    case 201:
      "e"
    case 202:
      "e"
    case 203:
      "e"
    case 204:
      "i"
    case 205:
      "i"
    case 206:
      "i"
    case 207:
      "i"
    case 209:
      "n"
    case 210:
      "o"
    case 211:
      "o"
    case 212:
      "o"
    case 213:
      "o"
    case 214:
      "o"
    case 217:
      "u"
    case 218:
      "u"
    case 219:
      "u"
    case 220:
      "u"
    case 221:
      "y"
    case 224:
      "a"
    case 225:
      "a"
    case 226:
      "a"
    case 227:
      "a"
    case 228:
      "a"
    case 229:
      "a"
    case 231:
      "c"
    case 232:
      "e"
    case 233:
      "e"
    case 234:
      "e"
    case 235:
      "e"
    case 236:
      "i"
    case 237:
      "i"
    case 238:
      "i"
    case 239:
      "i"
    case 241:
      "n"
    case 242:
      "o"
    case 243:
      "o"
    case 244:
      "o"
    case 245:
      "o"
    case 246:
      "o"
    case 249:
      "u"
    case 250:
      "u"
    case 251:
      "u"
    case 252:
      "u"
    case 253:
      "y"
    case 255:
      "y"
    case _:
      charStr(c)

def foldChar.case(c: Char, code: U32, upper: Bool) -> String:
  match upper:
    case True{}:
      foldChar.ascii(code)
    case False{}:
      foldChar.latin(c, code)

def foldChar.strip(c: Char, +code: U32, isMark: Bool) -> String:
  match isMark:
    case True{}:
      SNil{}
    case False{}:
      foldChar.case(c, code, asciiUpper(code))

def foldChar.go(c: Char, +code: U32) -> String:
  foldChar.strip(c, code, combining(code))

def foldChar(+c: Char) -> String:
  foldChar.go(c, Char.to_u32(c))

# Dobra a string inteira. Agulha vazia (depois do trim do host) não casa.
#
# Correção #798 (aron-intframe): a versão antiga (`append(foldChar(h), fold(t))`)
# deixava a self-call fora de tail position — o artefato JS avalia `fold(t)` como
# argumento e estoura a pilha com alguns milhares de chars (o hay do host chega a
# 4 MiB). `fold.go` acumula à esquerda (append é nativo no lane JS) e a self-call
# vira `run_jump`, mantendo a dobra idêntica.
def fold.go(s: String, acc: String) -> String:
  match s:
    case SNil{}:
      acc
    case SCon{h, t}:
      fold.go(t, String.append(acc, foldChar(h)))

def fold(s: String) -> String:
  fold.go(s, SNil{})

def matches.empty(emptyHay: Bool, emptyNeedle: Bool, hay: String, needle: String) -> Bool:
  match emptyHay:
    case True{}:
      False{}
    case False{}:
      match emptyNeedle:
        case True{}:
          False{}
        case False{}:
          String.contains(hay, needle)

# O host já deu trim na consulta (JS: fold(query.trim())). Aqui trim de novo
# não atrapalha; hay vazio ou agulha vazia ⇒ não casa.
def matches(hay: String, needle: String) -> Bool:
  +h = fold(hay)
  +n = fold(String.trim(needle))
  matches.empty(String.is_empty(h), String.is_empty(n), h, n)

# ---------- trecho: o host recorta/colapsa; o núcleo põe as … ----------

def snippet.start(cut: Bool, core: String) -> String:
  match cut:
    case True{}:
      "…" ++ core
    case False{}:
      core

def snippet.end(cut: Bool, s: String) -> String:
  match cut:
    case True{}:
      s ++ "…"
    case False{}:
      s

def snippet(cutStart: Bool, cutEnd: Bool, core: String) -> String:
  snippet.end(cutEnd, snippet.start(cutStart, core))

# ---------- limite da consulta (fatos: inválido / acima de 50) ----------

def clampLimit.cap(overMax: Bool, n: Nat) -> Nat:
  match overMax:
    case True{}:
      50n
    case False{}:
      n

# inválido (NaN, < 1) ⇒ 30; senão min(n, 50).
def clampLimit(invalid: Bool, overMax: Bool, n: Nat) -> Nat:
  match invalid:
    case True{}:
      30n
    case False{}:
      clampLimit.cap(overMax, n)

# ---------- papel da linha (o parser JSONL fica no host) ----------

def keepRole.assistant(isAssistant: Bool) -> Maybe<&2, MsgRole>:
  match isAssistant:
    case True{}:
      Some{MsgAssistant{}}
    case False{}:
      None{}

# Só user/assistant entram; thinking, toolResult, session, linha torta ⇒ None.
def keepRole(isUser: Bool, isAssistant: Bool) -> Maybe<&2, MsgRole>:
  match isUser:
    case True{}:
      Some{MsgUser{}}
    case False{}:
      keepRole.assistant(isAssistant)

# ---------- decisão de um arquivo ----------

def fileAct.large(tooLarge: Bool) -> FileAct:
  match tooLarge:
    case True{}:
      ActSkip{}
    case False{}:
      ActScan{}

def fileAct.files(atFileCap: Bool, tooLarge: Bool) -> FileAct:
  match atFileCap:
    case True{}:
      ActStop{}
    case False{}:
      fileAct.large(tooLarge)

def fileAct.time(timedOut: Bool, atFileCap: Bool, tooLarge: Bool) -> FileAct:
  match timedOut:
    case True{}:
      ActStop{}
    case False{}:
      fileAct.files(atFileCap, tooLarge)

# Ordem do main.cjs: teto de trechos, timeout, além de 300 arquivos, grande, varrer.
def fileAct(atHitCap: Bool, timedOut: Bool, atFileCap: Bool, tooLarge: Bool) -> FileAct:
  match atHitCap:
    case True{}:
      ActStop{}
    case False{}:
      fileAct.time(timedOut, atFileCap, tooLarge)

def isStop(a: FileAct) -> Bool:
  match a:
    case ActStop{}:
      True{}
    case ActSkip{}:
      False{}
    case ActScan{}:
      False{}

def withTruncated(was: Bool, act: FileAct) -> Bool:
  match act:
    case ActStop{}:
      True{}
    case ActSkip{}:
      was
    case ActScan{}:
      was

# Parar (teto/timeout/300 arquivos) marca parcial; pular grande não.
def stepTruncated(
  was: Bool, atHitCap: Bool, timedOut: Bool, atFileCap: Bool, tooLarge: Bool
) -> Bool:
  withTruncated(was, fileAct(atHitCap, timedOut, atFileCap, tooLarge))

# ---------- teto da lista de trechos (fatos alinhados com os candidatos) ----------

# `full[i] = True` = já encheu ANTES deste item. Aí o resto cai fora.
# `f` vem do pattern — dá para casar (não é valor computado).
def takeUntilFull(xs: List<&2, SearchHit>, full: List<&2, Bool>) -> List<&2, SearchHit>:
  match xs full:
    case Nil{} _:
      Nil{}
    case Con{_, _} Nil{}:
      Nil{}
    case Con{h, t} Con{f, fs}:
      match f:
        case True{}:
          Nil{}
        case False{}:
          Con{h, takeUntilFull(t, fs)}

def anyFull(full: List<&2, Bool>) -> Bool:
  match full:
    case Nil{}:
      False{}
    case Con{f, fs}:
      Bool.or(f, anyFull(fs))

# Lista de fatos "ainda cabe", do mesmo comprimento que xs.
def noneFull(xs: List<&2, SearchHit>) -> List<&2, Bool>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{False{}, noneFull(t)}

# ---------- agrupamento: `same` na cauda (mesma conversa que o anterior) ----------

def openGroup(h: SearchHit) -> SearchGroup:
  match h:
    case SearchHit{+conv, +title, role, clip}:
      SearchGroup{conv, title, Con{SearchHit{conv, title, role, clip}, Nil{}}}

def addHit(g: SearchGroup, h: SearchHit) -> SearchGroup:
  match g:
    case SearchGroup{conv, title, hits}:
      SearchGroup{conv, title, List.append(&2, SearchHit, hits, Con{h, Nil{}})}

# `same` tem um Bool por item da cauda: True = continua o grupo aberto.
# `s` vem do pattern — dá para casar.
def group.go(
  xs: List<&2, SearchHit>, same: List<&2, Bool>, g: SearchGroup
) -> List<&2, SearchGroup>:
  match xs same:
    case Nil{} _:
      Con{g, Nil{}}
    case Con{_, _} Nil{}:
      Con{g, Nil{}}
    case Con{h, t} Con{s, ss}:
      match s:
        case True{}:
          group.go(t, ss, addHit(g, h))
        case False{}:
          Con{g, group.go(t, ss, openGroup(h))}

# Host: arquivos já vêm mais recentes primeiro; trechos na ordem da mensagem.
# `same` tem length(xs)-1 (vazio se xs tem 0 ou 1).
def groupHits(xs: List<&2, SearchHit>, same: List<&2, Bool>) -> List<&2, SearchGroup>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      group.go(t, same, openGroup(h))

# ---------- fecho da consulta ----------

def truncatedOf(o: SearchOut) -> Bool:
  match o:
    case SearchOut{hits, truncated}:
      truncated

def hitsOf(o: SearchOut) -> List<&2, SearchHit>:
  match o:
    case SearchOut{hits, truncated}:
      hits

# Consulta curta demais: vazio e NÃO parcial, ignore o que já tinha.
def finishQuery(tooShort: Bool, hits: List<&2, SearchHit>, truncated: Bool) -> SearchOut:
  match tooShort:
    case True{}:
      SearchOut{Nil{}, False{}}
    case False{}:
      SearchOut{hits, truncated}

def searchOut(
  tooShort: Bool, xs: List<&2, SearchHit>, +full: List<&2, Bool>
) -> SearchOut:
  finishQuery(tooShort, takeUntilFull(xs, full), anyFull(full))
