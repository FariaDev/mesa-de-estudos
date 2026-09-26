# Portão de provas do core. Roda com `bend PROOF.bend` (ou `npm run test:proof`
# no app): falha enquanto qualquer lei estiver aberta ou falsa e imprime
# `All terms check.` quando tudo fecha.
#
# As leis e as provas são por módulo:
#   laws/<módulo>.bend    — o contrato (escrito à mão)
#   proofs/<módulo>.bend  — as provas (`def Laws.<nome>`)
#
# O `LAWS.bend` daqui é o índice humano (comentário apenas). O bend 2.0.9 recusa
# um `PROOF.bend` que conviva com um `LAWS.bend` sem importá-lo, então o import
# fica — a convenção do guia (leis todas num arquivo só) não é a deste projeto.
import ./LAWS.bend as LawsIndex
import ./proofs/wheel.bend as Wheel
import ./proofs/worklog.bend as Worklog
import ./proofs/library.bend as Library
import ./proofs/fold.bend as Fold
import ./proofs/find.bend as Find
import ./proofs/search.bend as Search
import ./proofs/courses.bend as Courses
import ./proofs/study.bend as Study
import ./proofs/studycontext.bend as StudyContext
import ./proofs/handoff.bend as Handoff
import ./proofs/framing.bend as Framing
import ./proofs/rpcstate.bend as RpcState
import ./proofs/config.bend as Config
import ./proofs/view.bend as View
import ./proofs/state.bend as State
import ./proofs/attachments.bend as Attachments
import ./proofs/sessions.bend as Sessions
import ./proofs/statusview.bend as StatusView
import ./proofs/composerview.bend as ComposerView
import ./proofs/searchview.bend as SearchView
import ./proofs/worklogview.bend as WorkLogView
import ./proofs/pdfref.bend as PdfRef
import ./proofs/pdfnav.bend as PdfNav
import ./proofs/review.bend as Review
import ./proofs/pdfview.bend as PdfView
import ./proofs/tabsview.bend as TabsView
import ./proofs/toastview.bend as ToastView
import ./proofs/talkview.bend as TalkView
import ./proofs/dialogsview.bend as DialogsView
import ./proofs/chatlist.bend as ChatList
import ./proofs/paletteview.bend as PaletteView
import ./proofs/msgview.bend as MsgView
import ./proofs/findbar.bend as FindBar
import ./proofs/popoverview.bend as PopoverView
import ./proofs/comfortview.bend as ComfortView
import ./proofs/notifyview.bend as NotifyView
import ./proofs/lightboxview.bend as LightBoxView
import ./proofs/calcview.bend as CalcView
import ./proofs/gaugeview.bend as GaugeView
import ./proofs/auxview.bend as AuxView
import ./proofs/pdfpageview.bend as PdfPageView
import ./proofs/keysview.bend as KeysView
import ./proofs/shortcutview.bend as ShortcutView
import ./proofs/welcomeview.bend as WelcomeView
import ./proofs/slashview.bend as SlashView
import ./proofs/toolpolicy.bend as ToolPolicy
import ./proofs/deskflags.bend as DeskFlags
import ./proofs/attachview.bend as AttachView
import ./proofs/pending.bend as Pending
import ./proofs/resume.bend as Resume
