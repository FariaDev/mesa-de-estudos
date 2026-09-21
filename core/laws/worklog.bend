import Base
import ../worklog.bend as L

# Contrato do diário do turno. Prefixo `worklog_` para não colidir com as leis
# da roda.

# LAW: delta vazio não muda o diário (o adaptador pode chamar à vontade).
law worklog_delta_empty:
  for log: L.Log
  for now: Nat
  {L.thinkingDelta(log, "", now) == log : L.Log}

# LAW: "open_reference" vira Reference — casa com "reference" e também
# pareceria busca; a ordem da classificação é o contrato.
law worklog_tool_reference:
  {L.toolKind("open_reference") == L.Reference{} : L.StepKind}

# LAW: "web_search" vira Search.
law worklog_tool_search:
  {L.toolKind("web_search") == L.Search{} : L.StepKind}

# LAW: "fetch_page" vira Fetch (bate em "page").
law worklog_tool_fetch:
  {L.toolKind("fetch_page") == L.Fetch{} : L.StepKind}

# LAW: ferramenta sem palavra conhecida vira Tool.
law worklog_tool_plain:
  {L.toolKind("run_bash") == L.Tool{} : L.StepKind}

# LAW: o nome é baixado antes de procurar as agulhas (`String.to_lower` do
# Base era não-tail; `toLower` em accumulator — #798).
law worklog_tool_upper:
  {L.toolKind("WEB_SEARCH") == L.Search{} : L.StepKind}

# LAW: nome vazio não casa agulha nenhuma.
law worklog_tool_vazio:
  {L.toolKind("") == L.Tool{} : L.StepKind}

# LAW: a agulha vale em qualquer posição, inclusive depois de um prefixo de 20k
# chars — acima dos ~10k em que a classe #798 estourava a pilha (core/README.md).
# É um caso concreto do checker, não medição de runtime: a escala real é
# exercitada por `chat/tests/search-limits.test.mjs` (8k/20k/100k) e
# `chat/tests/framing-parity.mjs` (12 MB). Medido: o portão de provas sai de
# ~4 s (com 200n) para ~10 s (20k) e ~37 s (100k), então 20k é o teto prático.
law worklog_tool_longo:
  {L.toolKind(String.append(String.from_list(List.replicate(Char, 20000n, 'a')), "open_reference")) == L.Reference{} : L.StepKind}

# LAW: `hasNeedle` espelha `String.contains` (inclusive agulha vazia).
law worklog_has_needle_meio:
  {L.hasNeedle("x_fetch_y", "fetch") == True{} : Bool}

law worklog_has_needle_ausente:
  {L.hasNeedle("x_y", "fetch") == False{} : Bool}

# LAW: fechar o pensamento não deixa nenhum pensamento running.
law worklog_close_running:
  for s: L.Step
  for now: Nat
  {L.isRunningThinking(L.closeStep(s, now)) == False{} : Bool}

# LAW: terminar o turno não deixa nada running (pensamento vira Done, o
# resto vira Stopped).
law worklog_finish_running:
  for s: L.Step
  for now: Nat
  {L.isRunning(L.finishStep(s, now)) == False{} : Bool}

# LAW: fechar a lista inteira não deixa pensamento running.
law worklog_close_each:
  for xs: +List<L.Step>
  for now: Nat
  {L.noRunningThinking(L.closeEach(xs, now)) == True{} : Bool}
