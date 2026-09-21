import Base

# ---------- dobra de acentos pt-BR + caixa ----------

# Um caractere como string de um caractere.
def charStr(c: Char) -> String:
  SCon{c, SNil{}}

def asciiUpper(+code: U32) -> Bool:
  Bool.and(U32.is_ge(code, 65), U32.is_le(code, 90))

# A-Z viram a-z; combinantes não têm caixa.
def foldChar.ascii(code: U32) -> String:
  charStr(Char.from_u32(U32.add(code, 32)))

# Latin-1: NFD (base + marca) seguido de toLowerCase, como o JS faz com
# `normalize("NFD").toLowerCase()` — â = "a" + U+0302, ç = "c" + U+0327 etc.
# Caracteres sem decomposição (×, æ, ß, ð, ÷, ø, þ) passam iguais.
def foldChar.latin(c: Char, code: U32) -> String:
  match code:
    case 192:
      "a\u{0300}"
    case 193:
      "a\u{0301}"
    case 194:
      "a\u{0302}"
    case 195:
      "a\u{0303}"
    case 196:
      "a\u{0308}"
    case 197:
      "a\u{030A}"
    case 198:
      "æ"
    case 199:
      "c\u{0327}"
    case 200:
      "e\u{0300}"
    case 201:
      "e\u{0301}"
    case 202:
      "e\u{0302}"
    case 203:
      "e\u{0308}"
    case 204:
      "i\u{0300}"
    case 205:
      "i\u{0301}"
    case 206:
      "i\u{0302}"
    case 207:
      "i\u{0308}"
    case 208:
      "ð"
    case 209:
      "n\u{0303}"
    case 210:
      "o\u{0300}"
    case 211:
      "o\u{0301}"
    case 212:
      "o\u{0302}"
    case 213:
      "o\u{0303}"
    case 214:
      "o\u{0308}"
    case 216:
      "ø"
    case 217:
      "u\u{0300}"
    case 218:
      "u\u{0301}"
    case 219:
      "u\u{0302}"
    case 220:
      "u\u{0308}"
    case 221:
      "y\u{0301}"
    case 222:
      "þ"
    case 224:
      "a\u{0300}"
    case 225:
      "a\u{0301}"
    case 226:
      "a\u{0302}"
    case 227:
      "a\u{0303}"
    case 228:
      "a\u{0308}"
    case 229:
      "a\u{030A}"
    case 231:
      "c\u{0327}"
    case 232:
      "e\u{0300}"
    case 233:
      "e\u{0301}"
    case 234:
      "e\u{0302}"
    case 235:
      "e\u{0308}"
    case 236:
      "i\u{0300}"
    case 237:
      "i\u{0301}"
    case 238:
      "i\u{0302}"
    case 239:
      "i\u{0308}"
    case 241:
      "n\u{0303}"
    case 242:
      "o\u{0300}"
    case 243:
      "o\u{0301}"
    case 244:
      "o\u{0302}"
    case 245:
      "o\u{0303}"
    case 246:
      "o\u{0308}"
    case 249:
      "u\u{0300}"
    case 250:
      "u\u{0301}"
    case 251:
      "u\u{0302}"
    case 252:
      "u\u{0308}"
    case 253:
      "y\u{0301}"
    case 255:
      "y\u{0308}"
    case _:
      charStr(c)

def foldChar.if(c: Char, code: U32, upper: Bool) -> String:
  match upper:
    case True{}:
      foldChar.ascii(code)
    case False{}:
      foldChar.latin(c, code)

def foldChar.go(c: Char, +code: U32) -> String:
  foldChar.if(c, code, asciiUpper(code))

# Um caractere dobrado para a forma NFD + minúscula.
def foldChar(+c: Char) -> String:
  foldChar.go(c, Char.to_u32(c))

# NFD + minúscula, como `name.normalize("NFD").toLowerCase()` do host.
def normalize(s: String) -> String:
  match s:
    case SNil{}:
      SNil{}
    case SCon{h, t}:
      String.append(foldChar(h), normalize(t))

# A agulha (não vazia) aparece no nome? O host de hoje ignora agulha vazia.
def matchesAny.hit(n: String, +needle: String) -> Bool:
  Bool.and(Bool.not(String.is_empty(needle)), String.contains(n, needle))

def matchesAny.any(+n: String, needles: List<String>) -> Bool:
  match needles:
    case Nil{}:
      False{}
    case Con{h, t}:
      Bool.or(matchesAny.hit(n, normalize(h)), matchesAny.any(n, t))

def matchesAny(name: String, needles: List<String>) -> Bool:
  matchesAny.any(normalize(name), needles)
