import Base
import msg.bend as M
import view.bend as V

# Itens do menu Estudar que abrem uma ferramenta de estudo. A view é pura; o
# host abre os diálogos e revalida cada ação no IPC. Nenhuma ação aqui envia
# uma mensagem. Cada item é um `menuitem` com id estável e `data-icon` (o host
# injeta o SVG e limpa o andaime); o menu em si é do `core/tabsview.bend`.
def action(id: String, label: String, icon: String, handler: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"), V.attrId(id), V.attr("role", "menuitem"),
    V.attrData("icon", icon),
    V.attr("aria-haspopup", "dialog"), V.attrOn("click", handler)
  ], [V.viewText(label)])

# Item com atalho à direita (#27 B8): o rótulo e um `.menu-kbd` vazio — o host
# escreve a tecla da plataforma em `data-shortcut`, o núcleo só diz de qual
# ação ela é. Fora da árvore de acessibilidade: o item já tem o nome dele.
def actionKbd(id: String, label: String, icon: String, handler: String, shortcut: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"), V.attrId(id), V.attr("role", "menuitem"),
    V.attrData("icon", icon),
    V.attr("aria-haspopup", "dialog"), V.attrOn("click", handler)
  ], [
    V.viewText(label),
    V.viewEl("span", [
      V.attrClass("menu-kbd"), V.attrData("shortcut", shortcut), V.attrAria("hidden", "true")
    ], Nil{})
  ])

def tools() -> List<&2, V.ViewNode>:
  [
    actionKbd("study-search-open", M.msg("study.search"), "search", "OpenStudySearch", "study-search"),
    action("study-review-today", M.msg("study.reviewToday"), "rotateCw", "OpenReviewToday"),
    action("study-notes-open", M.msg("study.notes"), "textQuote", "OpenPdfNotes"),
    action("study-stats-open", M.msg("study.stats"), "graph", "OpenStudyStats"),
    action("study-backup-open", M.msg("study.backup"), "download", "OpenStudyBackup"),
    action("study-share-open", M.msg("study.share"), "upload", "OpenStudyShare"),
    action("study-tutor-pdf", M.msg("study.tutorPdf"), "sparkles", "OpenTutorPdf")
  ]
