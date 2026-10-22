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
import ./proofs/mesaqolescape.bend as MesaQolEscape
import ./proofs/mesaqolpalette.bend as MesaQolPalette
import ./proofs/mesaqollayout.bend as MesaQolLayout
import ./proofs/undoview.bend as UndoView
import ./proofs/wheel.bend as Wheel
import ./proofs/worklog.bend as Worklog
import ./proofs/library.bend as Library
import ./proofs/fold.bend as Fold
import ./proofs/find.bend as Find
import ./proofs/search.bend as Search
import ./proofs/courses.bend as Courses
import ./proofs/study.bend as Study
import ./proofs/studycontext.bend as StudyContext
import ./proofs/framing.bend as Framing
import ./proofs/rpcstate.bend as RpcState
import ./proofs/config.bend as Config
import ./proofs/view.bend as View
import ./proofs/state.bend as State
import ./proofs/accent.bend as Accent
import ./proofs/attachments.bend as Attachments
import ./proofs/sessions.bend as Sessions
import ./proofs/statusview.bend as StatusView
import ./proofs/composerview.bend as ComposerView
import ./proofs/worklogview.bend as WorkLogView
import ./proofs/pdfref.bend as PdfRef
import ./proofs/pdfnav.bend as PdfNav
import ./proofs/review.bend as Review
import ./proofs/pdfview.bend as PdfView
import ./proofs/tabsview.bend as TabsView
import ./proofs/toastview.bend as ToastView
import ./proofs/talkview.bend as TalkView
import ./proofs/dialogsview.bend as DialogsView
import ./proofs/updatenotice.bend as UpdateNotice
import ./proofs/overlay.bend as Overlay
import ./proofs/ggbboard.bend as GgbBoard
import ./proofs/toolmentions.bend as ToolMentions
import ./proofs/calcview.bend as CalcView
import ./proofs/auxview.bend as AuxView
import ./proofs/pdfpageview.bend as PdfPageView
import ./proofs/shortcutview.bend as ShortcutView
import ./proofs/slashview.bend as SlashView
import ./proofs/deskflags.bend as DeskFlags
import ./proofs/attachview.bend as AttachView
import ./proofs/pending.bend as Pending
import ./proofs/resume.bend as Resume
import ./proofs/agentcaps.bend as AgentCaps
import ./proofs/agentdelivery.bend as AgentDelivery
import ./proofs/sidechat.bend as Sidechat
import ./proofs/freeworkspaces.bend as FreeWorkspaces
import ./proofs/studytoolsview.bend as StudyToolsView
import ./proofs/tutorheader.bend as TutorHeader
import ./proofs/tutorstate.bend as TutorState
import ./proofs/settingsview.bend as SettingsView
import ./proofs/readersheet.bend as ReaderSheet
import ./proofs/materialmodel.bend as MaterialModel
import ./proofs/conferir.bend as Conferir
import ./proofs/firstrun.bend as FirstRun
import ./proofs/composerbox.bend as ComposerBox
import ./proofs/chatlibraryview.bend as ChatLibraryView
import ./proofs/studysearch.bend as StudySearch
import ./proofs/studyannotations.bend as StudyAnnotations
import ./proofs/studystats.bend as StudyStats
import ./proofs/reviewschedule.bend as ReviewSchedule
import ./proofs/guideview.bend as GuideView
import ./proofs/activityview.bend as ActivityView
import ./proofs/msg.bend as Msg
import ./proofs/language.bend as Language
import ./proofs/claudeversion.bend as ClaudeVersion
import ./proofs/freemodels.bend as FreeModels
import ./proofs/phonedrop.bend as PhoneDrop
