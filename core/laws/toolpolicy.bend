import Base
import ../toolpolicy.bend as P

# ---------------------------------------------------------------------------
# Contrato da política de ferramentas / embrulho do prompt (Conversa).
#
# Prefixo `tp_`. Tabela concreta de nomes (o host compara String; aqui as
# agulhas e o prefixo browser reduzem). Idempotência das marcas, anexo
# truncado/nome saneado e display que tira as marcas e preserva o resto.
#
# O que não saiu (e por quê):
#   - `toolAllowed` numa String livre — `String.contains` / `starts_with` /
#     `eq` não reduzem; o compact `[\s-]+`→`_` também não, numa String
#     simbólica. A lei geral casa nos Bools (`empty`, `blocked`) que o
#     núcleo já recebe resolvidos; a tabela é o que o host exercita.
#   - `wrap.edit(s, True{})` geral — depende de `String.contains` da marca.
#     Fecha no fato `hasMark` e nos literais do teste.
#   - `maxBody() == 80000n` (e o `Nat.mul(80n,1000n)` comparado no checker):
#     Peano de 80k estoura a pilha. O teto vive no `def maxBody`; as leis
#     fecham o `cleanFileBody.given` com texto sob o teto (o ramo do corte
#     não expande o teto) e o corte real de 100k→80k é pinado em
#     `chat/tests/toolpolicy-limits.test.mjs`.
#   - `String.repeat(_, 121n)` no nome e igualdade de `wrapPrompt` com o
#     literal enorme da hint: o reducer não fecha. Réplicas por
#     `String.from_list(List.replicate(...))` fecham (sanear, compactar e
#     cortar em maxName). Wrap de busca/editar fecha contra
#     `searchLine`/`editLine`; display de busca/tudo fecha.
# ---------------------------------------------------------------------------

# ---------- fatos Bool (fecham no match) ----------

law tp_vazio_fato:
  for n: String
  {P.toolAllowed.empty(n, True{}) == True{} : Bool}

law tp_browser_bloqueia:
  for n: String
  {P.toolAllowed.browser.if(n, True{}) == False{} : Bool}

law tp_wrap_identidade:
  for s: String
  {P.wrapPrompt(s, False{}, Nil{}, False{}) == s : String}

law tp_wrap_edit_off:
  for s: String
  {P.wrap.edit(s, False{}) == s : String}

law tp_wrap_search_off:
  for s: String
  {P.wrap.search(s, False{}) == s : String}

law tp_edit_ja_tem:
  for s: String
  {P.wrap.edit.has(s, True{}) == s : String}

law tp_search_ja_tem:
  for s: String
  {P.wrap.search.has(s, True{}) == s : String}

law tp_arquivo_corpo_vazio:
  for msg: String
  for name: String
  for body: String
  {P.wrap.file.if(msg, name, body, True{}) == msg : String}

# ---------- tabela de ferramentas ----------

law tp_vazio:
  {P.toolAllowed("") == True{} : Bool}

law tp_espaco:
  {P.toolAllowed("   ") == True{} : Bool}

law tp_web_search:
  {P.toolAllowed("web_search") == True{} : Bool}

law tp_web_fetch:
  {P.toolAllowed("web_fetch") == True{} : Bool}

# O `open_reference` (Wikipedia/arXiv/OpenAlex) é ferramenta da extensão de
# pesquisa do próprio app: sem a agulha "reference" a política bloqueava o nome e
# o host abortava o turno.
law tp_open_reference:
  {P.toolAllowed("open_reference") == True{} : Bool}

law tp_WebSearch:
  {P.toolAllowed("WebSearch") == True{} : Bool}

law tp_tavily_search:
  {P.toolAllowed("tavily_search") == True{} : Bool}

law tp_jina_fetch:
  {P.toolAllowed("jina_fetch") == True{} : Bool}

law tp_read_image:
  {P.toolAllowed("read_image") == True{} : Bool}

law tp_vision:
  {P.toolAllowed("vision") == True{} : Bool}

law tp_bash:
  {P.toolAllowed("bash") == False{} : Bool}

law tp_read:
  {P.toolAllowed("read") == False{} : Bool}

law tp_write:
  {P.toolAllowed("write") == False{} : Bool}

law tp_edit:
  {P.toolAllowed("edit") == False{} : Bool}

law tp_git:
  {P.toolAllowed("git") == False{} : Bool}

law tp_apply_patch:
  {P.toolAllowed("apply_patch") == False{} : Bool}

law tp_query_bash:
  {P.toolAllowed("query:bash") == False{} : Bool}

law tp_Task:
  {P.toolAllowed("Task") == False{} : Bool}

law tp_subagent:
  {P.toolAllowed("subagent") == False{} : Bool}

law tp_python:
  {P.toolAllowed("python") == False{} : Bool}

law tp_grep:
  {P.toolAllowed("grep") == False{} : Bool}

# A fronteira mudou quando a Conversa passou a aceitar exceções nomeadas: `quiz`
# é a ferramenta do vault que o usuário autorizou (não uma categoria — cada nome
# autorizado custa uma agulha aqui, com prova; é o que mantém a política uma
# decisão revisada, e não um interruptor).
law tp_quiz:
  {P.toolAllowed("quiz") == True{} : Bool}

# O adaptador de MCP expõe tudo por uma ferramenta proxy chamada `mcp` — a agulha
# abre o proxy inteiro, não uma ferramenta por servidor. O bloqueio de `browser*`
# continua vindo antes de qualquer agulha (ver tp_browser*): o que passa pelo
# proxy é decisão de quem configura o servidor, não desta lista.
law tp_mcp:
  {P.toolAllowed("mcp") == True{} : Bool}

law tp_mcp_script:
  {P.toolAllowed("mcpScript") == True{} : Bool}

law tp_skill:
  {P.toolAllowed("skill:pdf-reader") == False{} : Bool}

# browser vem antes das agulhas: mesmo contendo "web" / "screenshot".
law tp_browser:
  {P.toolAllowed("browser") == False{} : Bool}

law tp_browser_navigate:
  {P.toolAllowed("browser_navigate") == False{} : Bool}

law tp_browser_web:
  {P.toolAllowed("browser_web_search") == False{} : Bool}

law tp_browser_screenshot:
  {P.toolAllowed("browser_screenshot") == False{} : Bool}

law tp_browser_colon:
  {P.toolAllowed("browser:navigate") == False{} : Bool}

law tp_browser_espaco:
  {P.toolAllowed("browser goto") == False{} : Bool}

law tp_browser_hifen:
  {P.toolAllowed("browser-goto") == False{} : Bool}

# ---------- compact [\s-]+ → _ ----------

law tp_compact_espaco:
  {P.compactName("browser  --  foo") == "browser_foo" : String}

law tp_compact_underscore:
  {P.compactName("browser_foo") == "browser_foo" : String}

# ---------- tetos e saneamento de anexo ----------

law tp_teto_nome:
  {P.maxName() == 120n : Nat}

law tp_nome_vazio:
  {P.cleanFileName("") == "anexo" : String}

law tp_nome_saneado:
  {P.cleanFileName("a\nb\rc") == "a b c" : String}

law tp_wrap_sem_busca:
  {P.wrapPrompt("olá", False{}, Nil{}, False{}) == "olá" : String}

law tp_wrap_busca:
  {P.wrap.search("x", True{}) == String.append("x", String.append("\n\n", P.searchLine())) : String}

law tp_wrap_edit:
  {P.wrap.edit("x", True{}) == String.append(P.editLine(), String.append("\n\n", "x")) : String}

law tp_edit_idem:
  {P.wrapPrompt("[Editar última] x", False{}, Nil{}, True{}) == "[Editar última] x" : String}

law tp_search_idem:
  {P.wrapPrompt("a [Buscar na web] b", True{}, Nil{}, False{}) == "a [Buscar na web] b" : String}

law tp_anexo_vazio:
  {P.wrapPrompt("x", False{}, [P.ToolFile{"a.md", ""}], False{}) == "x" : String}

law tp_anexo_incluso:
  {P.wrapPrompt("resuma", False{}, [P.ToolFile{"notas.md", "item 1"}], False{})
    == "resuma\n\n[Anexo: notas.md]\n```\nitem 1\n```" : String}

law tp_display_preserva:
  {P.displayUserText("só texto") == "só texto" : String}

law tp_display_busca:
  {P.displayUserText(P.wrap.search("hoje", True{})) == "hoje" : String}

law tp_display_edit:
  {P.displayUserText(P.wrapPrompt("versão nova", False{}, Nil{}, True{})) == "versão nova" : String}

law tp_display_anexo:
  {P.displayUserText(P.wrapPrompt("resuma", False{}, [P.ToolFile{"notas.md", "item 1"}], False{}))
    == "resuma\n\n(anexo: notas.md)" : String}

law tp_display_tudo:
  {P.displayUserText(P.wrapPrompt("x", True{}, [P.ToolFile{"a.txt", "b"}], True{}))
    == "x\n\n(anexo: a.txt)" : String}

law tp_display_trim_end:
  {P.displayUserText("oi  ") == "oi" : String}

# ---------- varredura tail e corte (issue #798) ----------

law tp_len:
  {P.strLen("abc") == 3n : Nat}

law tp_len_vazio:
  {P.strLen("") == 0n : Nat}

law tp_take:
  {P.strTake("abcdef", 3n) == "abc" : String}

law tp_take_curto:
  {P.strTake("abc", 120n) == "abc" : String}

law tp_take_zero:
  {P.strTake("abc", 0n) == "" : String}

law tp_take_vazio:
  {P.strTake("", 120n) == "" : String}

law tp_split:
  {P.strSplit("a\nb", '\n') == ["a", "b"] : List<&2, String>}

law tp_split_final:
  {P.strSplit("a\n", '\n') == ["a", ""] : List<&2, String>}

law tp_split_vazio:
  {P.strSplit("", '\n') == [""] : List<&2, String>}

law tp_split_vazios:
  {P.strSplit("a\n\nb", '\n') == ["a", "", "b"] : List<&2, String>}

law tp_join:
  {P.strJoin(["a", "b", "c"], "\n") == "a\nb\nc" : String}

law tp_join_vazio:
  {P.strJoin(Nil{}, "\n") == "" : String}

law tp_lower:
  {P.strLower("Web_Search") == "web_search" : String}

# Réplicas longas: o reducer encadeia os walkers tail, sem a recursão por
# caractere que estourava a pilha.
law tp_saneia_replica:
  {P.sanitizeName(String.from_list(List.replicate(Char, 130n, 'a')))
    == String.from_list(List.replicate(Char, 130n, 'a')) : String}

law tp_saneia_quebra:
  {P.sanitizeName(String.from_list(List.replicate(Char, 130n, '\n')))
    == String.from_list(List.replicate(Char, 130n, ' ')) : String}

law tp_compact_replica:
  {P.compactName(String.from_list(List.replicate(Char, 40n, ' '))) == "_" : String}

law tp_corta_nome:
  {P.cleanFileName(String.from_list(List.replicate(Char, 130n, 'x')))
    == String.from_list(List.replicate(Char, 120n, 'x')) : String}

law tp_corta_nome_given:
  {P.cleanFileName.given(String.from_list(List.replicate(Char, 130n, 'x')), True{})
    == String.from_list(List.replicate(Char, 120n, 'x')) : String}

law tp_nome_given_passa:
  {P.cleanFileName.given("notas.md", False{}) == "notas.md" : String}

law tp_corpo_given_passa:
  {P.cleanFileBody.given("item 1", False{}) == "item 1" : String}

law tp_corpo_given_corta:
  {P.cleanFileBody.given("item 1", True{}) == "item 1" : String}

law tp_corpo_given_replica:
  {P.cleanFileBody.given(String.from_list(List.replicate(Char, 130n, 'y')), True{})
    == String.from_list(List.replicate(Char, 130n, 'y')) : String}

law tp_display_multilinha:
  {P.displayUserText("a\nb\nc") == "a\nb\nc" : String}

law tp_display_anexo_multilinha:
  {P.displayUserText(P.wrapPrompt("resuma", False{}, [P.ToolFile{"n.md", "l1\nl2"}], False{}))
    == "resuma\n\n(anexo: n.md)" : String}

law tp_busca_multilinha:
  {P.wrap.search("a\nb", True{}) == String.append("a\nb", String.append("\n\n", P.searchLine())) : String}
