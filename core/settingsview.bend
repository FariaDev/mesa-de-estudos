import Base
import msg.bend as M
import view.bend as V
import dialogsview.bend as D

# ---------------------------------------------------------------------------
# Configurações com seções na lateral (ticket #20 da spec de redesenho).
# Módulo só da Mesa: a Conversa não importa daqui e este artefato não é gerado
# para ela.
#
# O diálogo vira uma navegação lateral de cinco seções e um rodapé fixo. O
# casco (o `<dialog>`, o `<form>` e os campos de cada seção) continua no
# `desk/index.html`; este núcleo decide o que NÃO pode quebrar:
#
#   - quais são as seções, a ordem delas e qual abre primeiro (Matérias);
#   - a árvore da navegação, com a seção corrente marcada (`aria-current`);
#   - a validação das linhas de matéria: o que impede o Salvar, em que seção
#     e em que campo o erro aparece, e a seção para onde o diálogo leva;
#   - a árvore do aviso de erro que fica ao lado do campo.
#
# Fronteira de host: o aplicador (`desk/src/settings.mjs`) lê o DOM, entrega as
# linhas como fatos, mostra/esconde as seções, foca o campo e fala IPC. Nada
# aqui lê formulário, foca ou grava `config.json`.
#
# O que a validação NÃO inventa: não há campo novo nem regra nova no schema do
# `config.json`. Linha em branco (sem nome e sem pasta) segue ignorada — é o
# que o `readSettingsForm` sempre fez; nome sem pasta, que antes era descartado
# em silêncio, agora é um erro visível.
# ---------------------------------------------------------------------------

# ---------- seções ----------

def firstSection() -> String:
  "materias"

# A ordem é a da lateral e a da spec (#4): Matérias, Leitores, Recursos da
# mesa, Aparência e avisos, Pastas e programas.
def sectionIds() -> List<&2, String>:
  ["materias", "leitores", "mesa", "avisos", "pastas"]

def pickText(hit: Bool, found: String, rest: String) -> String:
  match hit:
    case True{}:
      found
    case False{}:
      rest

def sectionLabel(+id: String) -> String:
  pickText(
    String.eq(id, "materias"), M.msg("settings.sec.courses"),
    pickText(
      String.eq(id, "leitores"), M.msg("settings.sec.readers"),
      pickText(
        String.eq(id, "mesa"), M.msg("settings.sec.features"),
        pickText(
          String.eq(id, "avisos"), M.msg("settings.sec.appearance"),
          pickText(String.eq(id, "pastas"), M.msg("settings.sec.folders"), "")
        )
      )
    )
  )

def isSection(+id: String) -> Bool:
  Bool.or(
    String.eq(id, "materias"),
    Bool.or(
      String.eq(id, "leitores"),
      Bool.or(
        String.eq(id, "mesa"),
        Bool.or(String.eq(id, "avisos"), String.eq(id, "pastas"))
      )
    )
  )

# Seção desconhecida ou vazia vale a primeira: o diálogo nunca abre sem painel.
def activeSection(+id: String) -> String:
  pickText(isSection(id), id, firstSection())

# Vizinhas para as setas do teclado na lateral (cíclico).
def nextSection(+id: String) -> String:
  pickText(
    String.eq(id, "materias"), "leitores",
    pickText(
      String.eq(id, "leitores"), "mesa",
      pickText(
        String.eq(id, "mesa"), "avisos",
        pickText(String.eq(id, "avisos"), "pastas", "materias")
      )
    )
  )

def prevSection(+id: String) -> String:
  pickText(
    String.eq(id, "materias"), "pastas",
    pickText(
      String.eq(id, "leitores"), "materias",
      pickText(
        String.eq(id, "mesa"), "leitores",
        pickText(String.eq(id, "avisos"), "mesa", "avisos")
      )
    )
  )

# ---------- navegação lateral ----------

def tabId(id: String) -> String:
  String.append("settings-tab-", id)

def paneId(id: String) -> String:
  String.append("settings-sec-", id)

# Um botão da lateral. Só a seção corrente leva `aria-current="page"`; o
# destaque cinza é do CSS sobre esse atributo.
def navButton(+active: String, +id: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [ V.attrType("button")
    , V.attrId(tabId(id))
    , V.attrClass("settings-tab")
    , V.attrData("sec", id)
    , V.attrAria("controls", paneId(id))
    , V.attrOn("click", "SelectSection")
    ],
    V.attrWhen(String.eq(active, id), V.attrAria("current", "page"))
  ]), [V.viewText(sectionLabel(id))])

def navButtons.go(+active: String, ids: List<&2, String>) -> List<&2, V.ViewNode>:
  match ids:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{navButton(active, h), navButtons.go(active, t)}

# Filhos do `#settings-tabs`: um botão por seção, na ordem da lateral.
def navChildren(active: String) -> List<&2, V.ViewNode>:
  navButtons.go(activeSection(active), sectionIds())

# O aviso do rodapé depende da seção: Aparência e avisos (tema, acento,
# densidade e avisos de conclusão) aplica na hora e não passa pelo Salvar. Em
# Pastas e programas só o programa de escrita do Conferir vale na hora (é
# estado de interface, como o tema); os caminhos esperam o Salvar.
def footerHint(+id: String) -> String:
  pickText(
    String.eq(activeSection(id), "avisos"),
    M.msg("settings.hint.live"),
    pickText(
      String.eq(activeSection(id), "pastas"),
      M.msg("settings.hint.paths"),
      M.msg("settings.hint.save")
    )
  )

def footerHintNode(+id: String) -> V.ViewNode:
  V.viewText(footerHint(id))

# Salvar com o tutor respondendo (#42). O main recusa mudar a configuração no
# meio de uma resposta; em vez de deixar a pessoa apertar Salvar e ver um aviso
# escondido atrás do diálogo, o rodapé diz que dá para salvar quando ele
# terminar e o Salvar fica desligado. Só com mudança pendente: sem nada
# pendente, Salvar só fecha (não há o que recusar).
def busyHint() -> String:
  M.msg("settings.hint.busy")

def saveBlocked(busy: Bool, dirty: Bool) -> Bool:
  Bool.and(busy, dirty)

def footerHintFor(+id: String, busy: Bool, dirty: Bool) -> String:
  pickText(saveBlocked(busy, dirty), busyHint(), footerHint(id))

def footerHintForNode(+id: String, busy: Bool, dirty: Bool) -> V.ViewNode:
  V.viewText(footerHintFor(id, busy, dirty))

# ---------- validação das matérias ----------

# Uma linha do editor de matérias, como o host a leu. `id` é o `data-id` da
# linha (vazio para linha nova); o id efetivo é derivado aqui, na mesma ordem
# do `readSettingsForm`: id guardado, senão o nome, senão o último segmento da
# pasta.
type SettingsRow is Data:
  SettingsRow{id: String, name: String, path: String}

# Onde o erro aparece: a seção, a linha (0 = primeira) e o campo da linha
# (`name` ou `path`).
type SettingsIssue is Data:
  SettingsIssue{section: String, row: Nat, field: String, message: String}

def missingFolderText() -> String:
  M.msg("settings.error.folder")

def duplicateText() -> String:
  M.msg("settings.error.duplicate")

def rowTouched(+name: String, +path: String) -> Bool:
  Bool.not(Bool.and(
    String.is_empty(String.trim(name)),
    String.is_empty(String.trim(path))
  ))

def rowId(+id: String, +name: String, +path: String) -> String:
  D.textOr(
    String.trim(id),
    D.textOr(String.trim(name), D.fileBase(String.trim(path)))
  )

def hasString(+x: String, xs: List<&2, String>) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, t}:
      Bool.or(String.eq(h, x), hasString(x, t))

def issue(row: Nat, field: String, message: String) -> SettingsIssue:
  SettingsIssue{"materias", row, field, message}

def rowIssues.dup(row: Nat, dup: Bool) -> List<&2, SettingsIssue>:
  match dup:
    case True{}:
      Con{issue(row, "name", duplicateText()), Nil{}}
    case False{}:
      Nil{}

# Linha em branco: nada. Sem pasta: erro na pasta. Com pasta e id repetido: erro
# no nome. Uma linha só dá um erro (o primeiro campo a corrigir).
def rowIssues.folder(noFolder: Bool, row: Nat, id: String, seen: List<&2, String>) -> List<&2, SettingsIssue>:
  match noFolder:
    case True{}:
      Con{issue(row, "path", missingFolderText()), Nil{}}
    case False{}:
      rowIssues.dup(row, hasString(id, seen))

def rowIssues.touched(touched: Bool, row: Nat, id: String, noFolder: Bool, seen: List<&2, String>) -> List<&2, SettingsIssue>:
  match touched:
    case True{}:
      rowIssues.folder(noFolder, row, id, seen)
    case False{}:
      Nil{}

# Só linhas completas entram em `seen`: um nome repetido de uma linha que já
# está com erro de pasta não acusa a linha seguinte duas vezes.
def seenAfter.keep(keep: Bool, id: String, seen: List<&2, String>) -> List<&2, String>:
  match keep:
    case True{}:
      Con{id, seen}
    case False{}:
      seen

def seenAfter(touched: Bool, noFolder: Bool, id: String, seen: List<&2, String>) -> List<&2, String>:
  seenAfter.keep(Bool.and(touched, Bool.not(noFolder)), id, seen)

def settingsIssues.go(rows: List<&2, SettingsRow>, +i: Nat, +seen: List<&2, String>) -> List<&2, SettingsIssue>:
  match rows:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match h:
        case SettingsRow{+id, +name, +path}:
          +eff = rowId(id, name, path)
          +touched = rowTouched(name, path)
          +noFolder = String.is_empty(String.trim(path))
          List.append(&2, SettingsIssue,
            rowIssues.touched(touched, i, eff, noFolder, seen),
            settingsIssues.go(t, Nat.add(i, 1n), seenAfter(touched, noFolder, eff, seen)))

# Os erros que impedem o Salvar, na ordem das linhas. Lista vazia = pode salvar.
def settingsIssues(rows: List<&2, SettingsRow>) -> List<&2, SettingsIssue>:
  settingsIssues.go(rows, 0n, Nil{})

# A seção para onde o diálogo leva ao falhar: a do primeiro erro; sem erro, "".
def issueSection(xs: List<&2, SettingsIssue>) -> String:
  match xs:
    case Nil{}:
      ""
    case Con{h, t}:
      match h:
        case SettingsIssue{section, row, field, message}:
          section

# ---------- aviso ao lado do campo ----------

def errorId(id: String) -> String:
  String.append("settings-error-", id)

# O aviso é um parágrafo `role="alert"` logo abaixo da linha; o `id` é o que o
# campo aponta por `aria-describedby`.
def errorNode(id: String, message: String) -> V.ViewNode:
  V.viewEl("p", [
    V.attrId(errorId(id)),
    V.attrClass("cfg-error"),
    V.attr("role", "alert")
  ], [V.viewText(message)])
