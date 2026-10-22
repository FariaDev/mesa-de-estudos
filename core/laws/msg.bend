import Base
import ../msg.bend as M

# ---------------------------------------------------------------------------
# Contrato da mensagem traduzível (#41). Prefixo `msg_`.
#
# Uma mensagem é a chave do catálogo e os argumentos, num `String`: o marcador
# U+E000 no começo, a chave, e pares nome/valor separados por U+E001. As leis
# fecham a forma no fio, que é o que o host (`desk/src/i18n.mjs`) decodifica;
# a tradução em si (catálogo, plural, `Intl`) é do host e tem teste próprio
# (`desk/tests/i18n.test.mjs`).
# ---------------------------------------------------------------------------

law msg_sem_argumentos:
  {M.msg("a.b") == "\u{E000}a.b" : String}

law msg_um_argumento:
  {M.msg1("a.b", "app", "OneNote") == "\u{E000}a.b\u{E001}app\u{E001}OneNote" : String}

law msg_dois_argumentos:
  {M.msg2("a.b", "n", "3", "app", "Xournal++") == "\u{E000}a.b\u{E001}n\u{E001}3\u{E001}app\u{E001}Xournal++" : String}

law msg_tres_argumentos:
  {M.msg3("a.b", "x", "1", "y", "2", "z", "3") == "\u{E000}a.b\u{E001}x\u{E001}1\u{E001}y\u{E001}2\u{E001}z\u{E001}3" : String}

law msg_quatro_argumentos:
  {M.msg4("a.b", "w", "1", "x", "2", "y", "3", "z", "4") == "\u{E000}a.b\u{E001}w\u{E001}1\u{E001}x\u{E001}2\u{E001}y\u{E001}3\u{E001}z\u{E001}4" : String}

# O argumento é um texto qualquer (nome de matéria, pasta): vai como veio.
law msg_argumento_com_acento_e_espaco:
  {M.msg1("a.b", "name", "Cálculo I") == "\u{E000}a.b\u{E001}name\u{E001}Cálculo I" : String}

law msg_reconhece_mensagem:
  {M.isMsg(M.msg1("a.b", "n", "1")) == True{} : Bool}

# Texto de verdade (conteúdo da pessoa, nome de arquivo) nunca é traduzido.
law msg_texto_comum_nao_e_mensagem:
  {M.isMsg("Cálculo I") == False{} : Bool}

law msg_vazio_nao_e_mensagem:
  {M.isMsg("") == False{} : Bool}

# O marcador só vale no começo: uma chave citada no meio do texto não conta.
law msg_marcador_no_meio_nao_vale:
  {M.isMsg(String.append("texto ", M.msg("a.b"))) == False{} : Bool}
