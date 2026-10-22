import Base
import msg.bend as M
import view.bend as V

def currentLabel() -> String:
  M.msg("chatlib.current")

def favoriteLabel(value: Bool) -> String:
  match value:
    case True{}:
      M.msg("chatlib.favorite.on")
    case False{}:
      M.msg("chatlib.favorite.off")

def action(id: String, label: String, handler: String) -> V.ViewNode:
  V.viewEl("button", [V.attrType("button"), V.attr("data-chat", id), V.attrOn("click", handler)], [V.viewText(label)])

def row(+id: String, title: String, detail: String, preview: String, topic: String, favorite: Bool, current: Bool) -> V.ViewNode:
  V.viewEl("article", [V.attrClass("chat-library-row"), V.attr("data-id", id)], [
    V.viewEl("button", [
      V.attrType("button"), V.attrClass("chat-library-resume"), V.attr("data-chat", id),
      V.attrOn("click", "ResumeChat")
    ], [
      V.viewEl("strong", Nil{}, [V.viewText(title)]),
      V.viewEl("small", [V.attrClass("study-muted")], [V.viewText(detail)]),
      V.viewEl("span", [V.attrClass("chat-library-preview")], [V.viewText(preview)]),
      V.viewEl("span", [V.attrClass("chat-library-topic")], [V.viewText(topic)]),
      V.viewEl("span", V.attrWhen(Bool.not(current), V.attr("hidden", "")), [V.viewText(currentLabel())])
    ]),
    V.viewEl("div", [V.attrClass("chat-library-row-actions")], [
      action(id, favoriteLabel(favorite), "FavoriteChat"),
      action(id, M.msg("chatlib.label"), "LabelChat")
    ])
  ])
