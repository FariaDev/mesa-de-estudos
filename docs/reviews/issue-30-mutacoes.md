# #30 — Mutação manual por área (preservação)

Método: uma troca de texto na fonte de **produção** (`docs/reviews/issue-30/mutacoes.mjs`),
guardião rodado (Bend: `node core/proof.mjs`; JS: `node --test` nos arquivos citados),
arquivo restaurado com `git checkout -- <arquivo>`; `git diff` em produção vazio ao final.
Rodado **depois** das remoções/consolidações da lane — é a prova de que o que sobrou ainda guarda a área.

| Área (Map) | Arquivo mutado | Mutação | Quem pegou |
|---|---|---|---|
| Estado do tutor | `core/tutorstate.bend` | "Chamando o tutor" → "Chamando" | leis do `tutorstate` |
| Cabeçalho do tutor | `core/tutorheader.bend` | "Encerrar por hoje" → "Encerrar hoje" | leis do `tutorheader` |
| Anexo / Conferir | `core/attachview.bend` | "Remover citação" → "Remover cita" | leis do `attachview` |
| Chat lateral | `core/sidechat.bend` | "Atualizar contexto" → "Atualizar" | leis do `sidechat` |
| Caixa de mensagem | `core/composerbox.bend` | "Vai junto: só a mensagem" alterado | leis do `composerbox` |
| Calculadora (flags) | `core/deskflags.bend` | id `calc-divider` → `calc-divisor` | leis do `deskflags` |
| Slash | `core/slashview.bend` | `slash-opt-` → `slash-op-` | leis do `slashview` |
| Navegação PDF | `core/pdfnav.bend` | "Voltar à página anterior" → "Voltar" | leis do `pdfnav` |
| Capacidades do agente | `core/agentcaps.bend` | `canSend`: `or(not(busy), steer)` → `or(busy, steer)` | leis do `agentcaps` |
| Fila guardada | `core/pending.bend` | `keptWhileOff.ready`: comando passa a guardar | leis do `pending` |
| Desfazer | `core/undoview.bend` | `isExpired`: `now>=prazo` invertido | leis do `undoview` |
| Envio (recusa × dúvida) | `desk/send.cjs` | `notSent` troca `refused`/`ambiguous` | `send.test` ("escrita que falha é incerta…", "recusa comprovada…") |
| Bilhete (recuperação) | `desk/handoff.cjs` | `recoverClaims` ignora `enviando-*` | `handoff.test` ("envio iniciado sem confirmação vai para dúvida…") |
| Updater | `desk/updater.cjs` | `pull --ff-only` → `pull` | **não pego na 1ª rodada** → `updateflow.test` ganhou a asserção `--ff-only`; agora pega |
| Ponte RPC | `desk/rpc.cjs` | `split('\n')` → `split('\n\n')` | `rpc.test` (3 testes) |
| Calculadora | `desk/calculator.mjs` | `sec` sem o inverso | `core.test` ("reciprocal and inverse functions") |
| Favoritos | `desk/bookmarks.cjs` | teto do núcleo +1000 | `bookmarks.test` ("o teto do núcleo vale na gravação") |
| Retomada | `desk/resume.cjs` | `saveResume` aceita matéria vazia | **não pego** → `resume.test` ganhou "sem matéria ativa não há onde guardar"; agora pega |
| Imagem fora da raiz | `desk/lib.cjs` | `startsWith(base+sep)` removido | `lib.test` ("imageCandidates only resolves image files inside the learning root") |
| Desfazer (token vence) | `desk/review.cjs`/`annotations.cjs` | ignoram `at` | **não pego** quando retirei os testes "token vence no prazo" → devolvi os testes (só "token inventado" saiu); com eles, pega |
| Fila em disco | `desk/pending.cjs` | filtro `__proto__` removido | não pego — **mutante equivalente**: a entrada vai para o protótipo do objeto local `out`, que nunca é lido por chave; sem efeito observável |
| Desfazer (poda) | `desk/deletion-undo.cjs` | `prune` não remove vencidos | não pego — **mutante equivalente** quanto a comportamento: `check` decide o vencimento de cada token e o teto remove o mais antigo (o vencido); só muda memória |

Achados com teste novo (baratos): `--ff-only` no updater e matéria vazia no `resume`.
Dois mutantes não pegos são equivalentes (documentados acima), sem teste novo.
