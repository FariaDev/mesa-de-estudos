import Base
import ../laws/worklog.bend as Laws
import ../worklog.bend as L

def Laws.worklog_delta_empty(log, now):
  {==}

def Laws.worklog_tool_reference():
  {==}

def Laws.worklog_tool_search():
  {==}

def Laws.worklog_tool_fetch():
  {==}

def Laws.worklog_tool_plain():
  {==}

def Laws.worklog_tool_upper():
  {==}

def Laws.worklog_tool_vazio():
  {==}

def Laws.worklog_tool_longo():
  {==}

def Laws.worklog_has_needle_meio():
  {==}

def Laws.worklog_has_needle_ausente():
  {==}

# Análise de casos em status e, quando running, em kind (a ordem dos campos do
# Step põe status antes de kind, respeitando a ordem dos binders).
def Laws.worklog_close_running(s, now):
  match s:
    case L.Step{id, status, kind, startedAt, endedAt, payload}:
      match status:
        case L.Status.Done{}:
          {==}
        case L.Status.Stopped{}:
          {==}
        case L.Status.Failed{}:
          {==}
        case L.Status.Running{}:
          match kind:
            case L.Thinking{}:
              {==}
            case L.Search{}:
              {==}
            case L.Reference{}:
              {==}
            case L.Fetch{}:
              {==}
            case L.Tool{}:
              {==}
            case L.ErrorKind{}:
              {==}

# Terminar: mesma análise; pensamento vira Done, o resto vira Stopped.
def Laws.worklog_finish_running(s, now):
  match s:
    case L.Step{id, status, kind, startedAt, endedAt, payload}:
      match status:
        case L.Status.Done{}:
          {==}
        case L.Status.Stopped{}:
          {==}
        case L.Status.Failed{}:
          {==}
        case L.Status.Running{}:
          match kind:
            case L.Thinking{}:
              {==}
            case L.Search{}:
              {==}
            case L.Reference{}:
              {==}
            case L.Fetch{}:
              {==}
            case L.Tool{}:
              {==}
            case L.ErrorKind{}:
              {==}

# Indução na lista. Depois de fixar h (e seu status/kind), o goal normaliza
# para `noRunningThinking(closeEach(t, now)) == True{}` — exatamente a hipótese
# de indução, então o passo indutivo é a própria chamada recursiva.
def Laws.worklog_close_each(xs, now):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      match h:
        case L.Step{id, status, kind, startedAt, endedAt, payload}:
          match status:
            case L.Status.Done{}:
              Laws.worklog_close_each(t, now)
            case L.Status.Stopped{}:
              Laws.worklog_close_each(t, now)
            case L.Status.Failed{}:
              Laws.worklog_close_each(t, now)
            case L.Status.Running{}:
              match kind:
                case L.Thinking{}:
                  Laws.worklog_close_each(t, now)
                case L.Search{}:
                  Laws.worklog_close_each(t, now)
                case L.Reference{}:
                  Laws.worklog_close_each(t, now)
                case L.Fetch{}:
                  Laws.worklog_close_each(t, now)
                case L.Tool{}:
                  Laws.worklog_close_each(t, now)
                case L.ErrorKind{}:
                  Laws.worklog_close_each(t, now)
