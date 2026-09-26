import Base
import ../pdfref.bend as R

# Leis da citação de PDF: o marcador de página depois do nome e a dobra do
# nome contra a biblioteca. Cenários concretos, como as leis do find — o host
# entrega o candidato já recortado e a lista de nomes; aqui só as decisões.

# Biblioteca de um cenário.
def biblioteca() -> List<&2, String>:
  ["Limites.pdf", "Formulário & apoio.pdf", "Tabela de derivadas.pdf"]

def isPage(m: Maybe<&2, R.CiteCue>, +page: Nat, +length: Nat) -> Bool:
  match m:
    case None{}:
      False{}
    case Some{+c}:
      Bool.and(Nat.is_eq(R.pageOf(c), page), Nat.is_eq(R.cueLenOf(c), length))

def noCue(m: Maybe<&2, R.CiteCue>) -> Bool:
  match m:
    case None{}:
      True{}
    case Some{c}:
      False{}

def isName(m: Maybe<&2, String>, +want: String) -> Bool:
  match m:
    case None{}:
      False{}
    case Some{n}:
      String.eq(n, want)

def noName(m: Maybe<&2, String>) -> Bool:
  match m:
    case None{}:
      True{}
    case Some{n}:
      False{}

# ---------- página: o formato do "Citar" e os marcadores ----------

law pdfref_cue_ponto:
  {isPage(R.cueFrom(", p. 7)"), 7n, 6n) == True{} : Bool}

law pdfref_cue_sem_virgula:
  {isPage(R.cueFrom(" p. 12"), 12n, 6n) == True{} : Bool}

law pdfref_cue_ponto_colado:
  {isPage(R.cueFrom("p.7"), 7n, 3n) == True{} : Bool}

law pdfref_cue_pagina:
  {isPage(R.cueFrom(", página 12)"), 12n, 11n) == True{} : Bool}

law pdfref_cue_pag_abreviado:
  {isPage(R.cueFrom(", pág. 3"), 3n, 8n) == True{} : Bool}

law pdfref_cue_pag_sem_ponto:
  {isPage(R.cueFrom("; pág 4"), 4n, 7n) == True{} : Bool}

law pdfref_cue_p_sem_ponto:
  {isPage(R.cueFrom(" p 9"), 9n, 4n) == True{} : Bool}

law pdfref_cue_ancora:
  {isPage(R.cueFrom(" #page=42"), 42n, 9n) == True{} : Bool}

# O cue para no último dígito: o resto do texto não entra no link.
law pdfref_cue_para_no_digito:
  {isPage(R.cueFrom(", p. 7 e depois a 8"), 7n, 6n) == True{} : Bool}

# ---------- página: o que não é cue ----------

law pdfref_cue_sem_marcador:
  {noCue(R.cueFrom("))")) == True{} : Bool}

law pdfref_cue_texto_qualquer:
  {noCue(R.cueFrom(" veja o capítulo 4")) == True{} : Bool}

law pdfref_cue_marcador_sem_digito:
  {noCue(R.cueFrom(", p. )")) == True{} : Bool}

law pdfref_cue_pagina_zero:
  {noCue(R.cueFrom(", p. 0")) == True{} : Bool}

law pdfref_cue_pagina_alem_do_teto:
  {noCue(R.cueFrom(", p. 10001")) == True{} : Bool}

law pdfref_cue_vazio:
  {noCue(R.cueFrom("")) == True{} : Bool}

# ---------- nome: dobra contra a biblioteca ----------

law pdfref_nome_exato:
  {isName(R.knownName("Limites.pdf", biblioteca()), "Limites.pdf") == True{} : Bool}

law pdfref_nome_caixa:
  {isName(R.knownName("LIMITES.PDF", biblioteca()), "Limites.pdf") == True{} : Bool}

law pdfref_nome_sem_acento:
  {isName(R.knownName("formulario & apoio.pdf", biblioteca()), "Formulário & apoio.pdf") == True{} : Bool}

law pdfref_nome_com_espaco:
  {isName(R.knownName("Tabela de derivadas.pdf", biblioteca()), "Tabela de derivadas.pdf") == True{} : Bool}

law pdfref_nome_desconhecido:
  {noName(R.knownName("Outro arquivo.pdf", biblioteca())) == True{} : Bool}

# Com prosa junto não casa: quem recorta é o host (o rabo depois de cada
# espaço), o núcleo só reconhece o nome inteiro.
law pdfref_nome_com_prosa:
  {noName(R.knownName("veja Limites.pdf", biblioteca())) == True{} : Bool}

law pdfref_nome_vazio:
  {noName(R.knownName("   ", biblioteca())) == True{} : Bool}

law pdfref_nome_sem_biblioteca:
  {noName(R.knownName("Limites.pdf", [])) == True{} : Bool}

# ---------- rótulos ----------

law pdfref_rotulo:
  {String.eq(R.refLabel("Limites.pdf", 7n), "Limites.pdf, p. 7") == True{} : Bool}

law pdfref_titulo:
  {String.eq(R.refTitle("Limites.pdf", 7n), "Abrir Limites.pdf na p. 7") == True{} : Bool}

law pdfref_aria:
  {String.eq(R.refAria("Limites.pdf", 7n), "Abrir a página 7 de Limites.pdf") == True{} : Bool}
