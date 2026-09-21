import Base
import ../framing.bend as F

# ---------------------------------------------------------------------------
# Contrato do framing JSON-RPC (linhas do stdout do Pi).
#
# Conservação plena `rejoin(split(s)) == s` para s abstrato exigiria analisar
# se cada Char é LF — o match em U32 não refina o ramo default, então essa
# igualdade geral não entra. O que cabe: overflow como fato Bool, peel como
# inversa do join da lista de partes, cenários concretos (incluindo a
# conservação nas strings fechadas) e a correção #798: o split/strLength agora
# são loops (`split.go`/`strLength.go`) e a lei de não-overflow é provada por
# indução sobre o estado, sem depender de `String.split`/`String.length`.
# ---------------------------------------------------------------------------

# LAW: overflow (o fato True do host) descarta tudo — fiel ao JS.
law overflow_descarta:
  for s: String
  {F.feed.over(s, True{}) == F.Frame{Nil{}, "", True{}} : F.Frame}

# LAW: sem overflow, feed.over é o split puro.
law over_false_e_split:
  for s: String
  {F.feed.over(s, False{}) == F.split(s) : F.Frame}

# LAW: o split puro nunca marca overflow.
law peel_go_ok:
  for t: +List<String>
  for h: String
  {F.overflowOf(F.peel.go(t, h)) == False{} : Bool}

law peel_ok:
  for xs: +List<String>
  {F.overflowOf(F.peel(xs)) == False{} : Bool}

law split_nunca_overflow:
  for s: String
  {F.overflowOf(F.split(s)) == False{} : Bool}

# LAW: rejuntar o Frame do peel reconstrói o join das partes.
law peel_go_rejoin:
  for t: +List<String>
  for h: String
  {F.rejoinFrame(F.peel.go(t, h)) == String.join(Con{h, t}, "\n") : String}

law peel_rejoin:
  for xs: +List<String>
  {F.rejoinFrame(F.peel(xs)) == String.join(xs, "\n") : String}

# ---------- split/strLength em loop (correção #798) ----------
#
# A ponte abstrata antiga (`split == peel ∘ String.split`) morreu junto com a
# primitiva recursiva: a igualdade vale no concreto (lei abaixo) e a
# conservação segue nos cenários fechados; para s abstrato entra só o
# não-overflow, provado por indução no estado do loop.

# LAW: o loop do split não marca overflow em estado nenhum.
law split_go_nunca_overflow:
  for s: String
  for st: String & List<&2, String>
  {F.overflowOf(F.split.go(s, st)) == False{} : Bool}

# LAW: comprimento em loop; conta Chars (escalares), não unidades UTF-16.
law str_len_vazio:
  {F.strLength("") == 0n : Nat}

law str_len_ascii:
  {F.strLength("abc") == 3n : Nat}

law str_len_acento:
  {F.strLength("ação") == 4n : Nat}

# Emoji astral é UM Char (escalar Unicode).
law str_len_emoji:
  {F.strLength("🙂") == 1n : Nat}

# Acumulador do loop: soma o que já tinha.
law str_len_go:
  {F.strLength.go("ab", 3n) == 5n : Nat}

# A API do loop bate com o antigo `peel(String.split(s, '\n'))` no concreto.
law split_igual_peel:
  {F.split("a\n\nb\nc") == F.peel(String.split("a\n\nb\nc", '\n')) : F.Frame}

# ---------- cenários concretos ----------

# Sem '\n' no buffer++chunk: nenhuma linha, resto = concatenação.
law sem_nl:
  {F.feed("buf", "chunk", 100n) == F.Frame{Nil{}, "bufchunk", False{}} : F.Frame}

# Uma linha completa, resto vazio.
law uma_linha:
  {F.split("abc\n") == F.Frame{["abc"], "", False{}} : F.Frame}

# Uma linha e um resto incompleto.
law linha_e_resto:
  {F.split("abc\ndef") == F.Frame{["abc"], "def", False{}} : F.Frame}

# Linhas vazias saem (o host é quem filtra com trim).
law linha_vazia:
  {F.split("\n") == F.Frame{[""], "", False{}} : F.Frame}

law duas_vazias_e_resto:
  {F.split("a\n\nb") == F.Frame{["a", ""], "b", False{}} : F.Frame}

# Chunk cola no buffer e só então parte.
law concat_chunk:
  {F.feed("hel", "lo\nwor", 100n) == F.Frame{["hello"], "wor", False{}} : F.Frame}

# Conservação concreta: rejuntar devolve o texto original.
law conserva_concreto:
  {F.rejoinFrame(F.split("a\n\nb\n")) == "a\n\nb\n" : String}

# No limite (length == limit) o JS NÃO derruba (`>` estrito).
law no_limite:
  {F.feed("abc", "", 3n) == F.Frame{Nil{}, "abc", False{}} : F.Frame}

# Acima do limite: descarta inclusive linhas já fechadas no buffer.
law acima_do_limite:
  {F.feed("abcd", "", 3n) == F.Frame{Nil{}, "", True{}} : F.Frame}

law overflow_descarta_linhas:
  {F.feed("ok\n", "xxxx", 4n) == F.Frame{Nil{}, "", True{}} : F.Frame}

# Só LF fecha linha: U+2028 e CR ficam dentro (como o teste RPC de hoje).
law split_u2028:
  {F.split("a\u{2028}b\nc") == F.Frame{["a\u{2028}b"], "c", False{}} : F.Frame}

law split_cr:
  {F.split("a\rb\nc") == F.Frame{["a\rb"], "c", False{}} : F.Frame}

# Buffer vazio, chunk vazio.
law vazio:
  {F.split("") == F.Frame{Nil{}, "", False{}} : F.Frame}
