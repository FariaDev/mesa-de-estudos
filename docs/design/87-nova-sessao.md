# Sessão única com troca de motor (#87)

**Status:** desenho para decisão. Nada aqui está implementado.
**Base:** `t3/plan-session-creation` em `063e109`; o motor Pi foi aposentado em
`02d7e4f`.
**Issue:** [#87](https://github.com/FariaDev/mesa-e-conversa/issues/87),
`ready-for-human`. As escolhas de produto são do Lucas; este documento prepara
cada uma com opções, custo e uma recomendação técnica.

**Escala de custo:** P = pequeno, cabe numa fatia; M = alguns dias e mais de um
arquivo; G = atravessa biblioteca, busca, pacote ou o contrato de mais de um
motor. É ordem de grandeza, não prazo.

**O que foi verificado:** o fluxo abaixo foi lido no código desta base, com
arquivo e linha. Não rodei Claude Code nem OpenCode reais, não medi tokens, não
abri a janela para conferir pixels e não li sessões reais. As referências ao T3
Code vêm do comentário da issue, não de código no repositório. Os pontos não
verificados estão marcados com **(*)**, e as premissas da issue que já não valem
nesta base estão na seção 1.4.

## 1. O fluxo de hoje

### 1.1 Criar sessão

| Passo | O que acontece | Onde |
|---|---|---|
| `+` no cabeçalho | Cria uma sessão na hora, com o motor da sessão aberta; se ele sumiu da vista, manda sem motor e o host escolhe o visível | `desk/src/tutor-header.mjs:361-370` |
| Clique direito ou ↓ no `+` | O clique direito abre o menu “Nova sessão com…” **só com 2+ motores visíveis**; a seta ↓ abre o mesmo menu mesmo com um motor (aí com um item só) | `desk/src/tutor-header.mjs:371-377,382-387` |
| Menu | O núcleo gera “Claude (experimental)” e “OpenCode”; o aplicador filtra pelo que a vista do release mostra | `core/tutorheader.bend:56-88`, `desk/src/tutor-header.mjs:199-207` |
| IPC | `new-session` valida `engine` em `claude`/`opencode`, exige o tutor ocioso, troca motor fora da vista pelo padrão, salva a sessão atual, para a ponte e cria o descritor | `desk/main.cjs:569-586` |
| Descritor | O motor fica no **nome do arquivo** (`claude-<uuid>.json`/`opencode-<uuid>.json`) e no campo `engine`; a conversa nova nasce sem mensagens | `desk/src/agents/conversations.cjs:265-286` |
| Reset | A sessão nova limpa rascunho e questão ativa (`study`); os PDFs abertos e a matéria continuam | `desk/main.cjs:580,585` |
| Boot/troca de matéria | `resumeSession` só retoma descritor nativo de motor visível; senão cria uma sessão nova, sem apagar a antiga | `desk/tutor-engine-host.cjs:100-111` |
| Primeiro uso | Escolhe por **presença de executável** (e versão do OpenCode), na ordem OpenCode → Claude; login fica para o adaptador | `desk/tutor-default-engine.cjs:4-9,17-35` |

Em produção `visibleEngines()` devolve sempre `['opencode']`
(`desk/visible-engines.cjs:32-36`). Na prática, hoje:

- o clique no `+` cria direto uma sessão OpenCode e não abre menu;
- o clique direito não abre menu; a seta ↓ ainda abre um menu de **um item**
  (OpenCode), porque o atalho de teclado não consulta a quantidade de motores;
- o menu com dois motores só existe em teste, quando
  `LEARNING_DESK_VISIBLE_ENGINES` reabre os fakes;
- o Claude Code continua no código e no histórico, mas não recebe sessão nova.

Esse menu de um item é parte do que confunde: ele promete uma escolha que não
existe em produção.

### 1.2 Trocar de motor

Não existe troca de motor no meio da conversa. O motor é escolhido só na
criação (`desk/main.cjs:569-586`) e fica preso ao descritor. Para “trocar”, hoje
é preciso criar outra sessão; a antiga continua na lista, mas o histórico novo
começa vazio.

O seletor de modelo **não** troca de motor. Ele recebe só o catálogo do motor
atual (`desk/src/state.mjs:446-459`), a escolha chama `pi-settings`
(`desk/src/main.mjs:253-258`) e o host roteia para o motor da conversa; um
modelo de outro motor é recusado (`desk/tutor-session-ipc.cjs:108-148`). A
premissa da issue de que “o seletor já lista os modelos dos três” não vale nesta
base.

### 1.3 O que confunde

1. **`+` não diz o que faz.** Ele cria uma sessão nova imediatamente, sem
   confirmar e sem oferecer continuidade; o histórico anterior só é encontrado
   abrindo a lista de sessões (`desk/src/course-conversations.mjs:46-72`).
2. **Motor e modelo parecem a mesma escolha.** O motor está no menu do `+`; o
   modelo, no seletor da caixa. Em produção, com um motor só, não há escolha
   real: o clique direito não abre nada e a seta ↓ abre um item.
3. **O motor aparece duas vezes na lista e pode sobrar no título.** O rótulo da
   sessão já ganha o prefixo do motor (`OpenCode · …`, `desk/lib.cjs:142-149`) e
   a linha ainda mostra o motor na meta
   (`desk/src/course-conversations.mjs:79-102`). No cabeçalho, o motor deveria
   ficar só num `data-engine` (`desk/src/state.mjs:372-379`), mas
   `sessionTitleOf` só remove o prefixo `Claude Code · `
   (`desk/src/state.mjs:335-339`); o prefixo `OpenCode · ` não é removido.
4. **Sessão antiga vira beco sem saída.** Abrir uma conversa de motor fora da
   vista tira o composer e mostra “Sessão antiga, só para leitura” com um botão
   “Nova sessão” que não leva nada do histórico (`desk/src/visible-engines-ui.mjs:25-36`,
   `desk/index.html:158-160`). É o mesmo tratamento para Pi e para Claude
   escondido, embora só o Pi não tenha mais motor.
5. **A issue está atrás da base.** Ela fala em três entradas (Pi, Claude,
   OpenCode); o Pi saiu (`02d7e4f`) e o menu gerado só tem Claude e OpenCode.
   Também fala em “instalado e logado”, mas a escolha automática só olha o
   executável.

### 1.4 Premissas da issue que a base já mudou

| Premissa da issue | Estado na base |
|---|---|
| Menu com três entradas: Pi, Claude e OpenCode | Só Claude e OpenCode no núcleo; em produção o clique direito não abre menu e a seta ↓ abre um item só (OpenCode) |
| O seletor lista os modelos dos três motores | Lista só o catálogo do motor atual; `pi-settings` recusa modelo de outro motor |
| Primeiro uso escolhe “instalado e logado” | Escolhe por executável; login só aparece no connect |
| Teste dos três pares de motores | Só existem dois motores (Claude e OpenCode); o Pi não inicia. No máximo dois sentidos: Claude→OpenCode e OpenCode→Claude, mais Pi→OpenCode como leitura |
| Codex e Grok pelo Pi | Sem Pi, ficam fora do escopo |

## 2. Decisões

As opções não estão em ordem de preferência. A recomendação é técnica; a
decisão de produto é do Lucas.

### D1. O que é “passagem de contexto”, quem gera e qual o teto

| Opção | O que vai | Custo | Risco |
|---|---|---|---|
| **A. Digest da Mesa, sem modelo** | Matéria, questão ativa, PDFs abertos com página, últimas falas do aluno/tutor e o último ponto; texto montado pelo host, sem chamar motor | P | Menos “inteligente”; precisa de ordem e corte claros |
| **B. Resumo pelo motor antigo** | O motor antigo recebe um turno extra “resuma o estudo até aqui” e devolve o resumo | M | Custa tokens e tempo; falha se o motor antigo for Pi/offline/incerto; precisa de tratamento de erro |
| **C. Histórico inteiro no motor novo** | O motor novo recebe a transcrição completa (até o teto) e decide sozinho o que usar; não há resumo separado | P de código, G de contexto | Contexto enorme, ruído e custo; estoura fácil |

**Recomendação: A.** É determinística, não depende de login nem de um motor que
pode ter sumido, funciona com JSONL antigo do Pi (só texto) e é testável sem
rede. O teto pode ser o que já existe: **50.000 caracteres** de transcrição
importada (`desk/src/agents/conversations.cjs:373-376`,
`desk/tutor-engine-host.cjs:166-169`), com a ordem “fatos fixos primeiro,
últimas trocas depois, corta do mais antigo”. O T3 Code usa 16k tokens/64k bytes
(*); 50k caracteres fica na mesma ordem de grandeza e reaproveita o caminho que
os dois motores já leem.

O que o digest deve carregar, no mínimo: matéria; questão ativa (título); PDFs
abertos e páginas; as últimas falas de aluno e tutor; e uma frase do ponto de
parada. O `.xopp` não vai como arquivo nem vira autorização da sessão nova: o
caminho e o título podem ser citados no texto, mas o anexo binário continua
sendo da conversa antiga. Matéria e PDFs abertos já sobrevivem ao `+` porque o
estado da matéria não é limpo (`desk/main.cjs:585`); o que se perde é o
histórico, o rascunho e a questão ativa.

Mock do conteúdo (no cartão de confirmação, se houver; senão, no aviso depois
da troca). Desde a #123 o resumo do que vai junto e a edição do contexto de
estudo moram em Mais opções → Contexto, fora do composer:

```text
┌ Continuar no OpenCode? ─────────────────────────────┐
│ Contexto (Mais opções → Contexto):                  │
│   Matéria: Cálculo                                  │
│   Questão: Lista 3, exercício 2                     │
│   PDFs: Stewart, p. 210 · Lista3.pdf, p. 1          │
│   Último ponto: "isole o termo e aplique a regra…"  │
│   Resumo: 1,2 KB · 4 falas recentes                 │
│                                                     │
│ [Cancelar]                          [Continuar]     │
└─────────────────────────────────────────────────────┘
```

Se o autor preferir B, ela pode entrar depois como opção “resumir com o tutor
antigo”; não precisa ser a primeira fatia. “Nada” é o comportamento de hoje
(D3=C): a sessão nova começa vazia. Ele continua sendo o fallback se o digest
falhar, mas o cartão precisa dizer “sem passagem” em vez de fingir continuidade.

### D2. Onde mora a escolha de motor

| Opção | Como o aluno escolhe | Custo | Consequência |
|---|---|---|---|
| **A. No seletor de modelo (proposta da issue)** | Escolher um modelo de outro motor no `#model-pop` cria uma sessão nova naquele motor, com passagem | G | Exige catálogo por motor e um seletor que mistura motor e modelo; “Claude Sonnet” pode existir via Claude Code e via OpenCode |
| **B. Num botão só, com o motor no menu** | O `+` cria com o motor atual; o menu (clique direito/↓) lista os motores prontos e cria a sessão com passagem; o seletor continua só com modelos daquele motor | M | A escolha de motor é explícita e separada da escolha de modelo; o menu só aparece com 2+ motores |
| **C. Só nas Configurações** | O motor padrão fica em Ajustes; a sessão aberta não troca; para trocar, abre Ajustes e cria outra sessão | P | Some a troca no meio do estudo; é só um padrão de sessão nova |

**Recomendação: B.** Motor é decisão de sessão, não de modelo; o código atual já
trata `new-session` assim e o `pi-settings` não aceita modelo de outro motor
(`desk/tutor-session-ipc.cjs:108-148`). Misturar os catálogos em A cria
ambiguidade real: o mesmo modelo Anthropic pode ser servido pelo Claude Code ou
pelo OpenCode, com preço e contexto diferentes, e a linha precisa dizer qual
motor será usado — sem transformar a lista de modelos numa lista de sessões.
A opção B também cumpre “um botão só”: em produção, com um motor, o `+` continua
criando direto, sem menu.

Mock de B:

```text
Cabeçalho (2+ motores prontos)
┌──────────────────────────────────────────────────────┐
│ Sessão de 04/11, 14:32 ▾              [+] [⋯]       │
│                                        │             │
│                          ┌─────────────▼───────────┐ │
│                          │ Nova sessão             │ │
│                          │  • OpenCode (atual)     │ │
│                          │  • Claude Code          │ │
│                          └─────────────────────────┘ │
└──────────────────────────────────────────────────────┘

Produção (1 motor): o [+] cria direto; nenhum menu.
```

Mock de A, para comparar:

```text
┌ Modelo ─────────────────────────────────────────────┐
│ buscar…                                             │
│ OpenCode                                            │
│   • DeepSeek V4.1 Flash              (atual)        │
│   • Qwen3.5 32B                                     │
│ Claude Code — troca de motor                        │
│   • Claude Sonnet 4.5        → nova sessão          │
└─────────────────────────────────────────────────────┘
```

O mesmo modelo pode aparecer nos dois grupos; a linha de outro motor precisa
dizer “nova sessão” e não “modelo atual”.

### D3. O que acontece com uma sessão de motor antigo

| Opção | Na abertura | Custo | Efeito |
|---|---|---|---|
| **A. Leitura + continuar** | Histórico legível; botão “Continuar no OpenCode” cria a sessão nova com o digest; o arquivo antigo fica intacto | M | Dá saída ao histórico sem apagar nem reescrever |
| **B. Migrar ao abrir** | Abrir já cria a cópia no motor visível e troca para ela | M | Surpreende e escreve no disco só por abrir; duas sessões para o mesmo conteúdo |
| **C. Só leitura, como hoje** | Histórico legível e “Nova sessão” vazia | P | O aluno perde o ponto de parada; é o beco atual |

**Recomendação: A.** O histórico antigo é o lugar onde a passagem mais vale; a
conversão silenciosa em B cria arquivos sem o aluno pedir e dificulta a
auditoria. A sessão nova nasce com `origin` apontando para a antiga, e a antiga
continua na lista e no pacote.

Mock do rodapé de A:

```text
┌ Sessão antiga, só para leitura ──────────────────────┐
│ Esta conversa é de um motor que a Mesa não inicia    │
│ mais (Pi ou Claude fora da vista).                   │
│ [Continuar no OpenCode com o contexto]  [Nova sessão]│
└──────────────────────────────────────────────────────┘
```

### D4. O que acontece com fila, steer e permissões no meio de um turno

Hoje não há permissão de ferramenta para passar: o tutor só usa o MCP da Mesa
(ADR 0002), e a jaula saiu. O que existe é turno em voo, fila por conversa e
steer (`desk/src/queue.mjs`, `core/agentdelivery.bend`).

| Opção | Turno em andamento | Fila/steer | Custo |
|---|---|---|---|
| **A. Trocar só ocioso** | Bloqueia com “espere a resposta terminar”; o turno termina no motor antigo | Fila, rascunho e anexos ficam na conversa antiga; a nova começa vazia; o aviso diz isso | P |
| **B. Terminar e trocar** | O turno atual termina no motor antigo; a troca entra sozinha depois do aceite | A fila e o steer continuam sendo do app; precisam mudar de dono sem perder item | G |
| **C. Cancelar e trocar** | Cancela o turno e troca na hora | A fila teria de ser movida ou descartada; a resposta parcial pode ficar órfã | M |

**Recomendação: A para a primeira fatia.** O `assertIdle` já é a guarda do
`new-session` (`desk/main.cjs:571`) e o `stopBridge` derruba a ponte e o
servidor OpenCode (`desk/tutor-bridge-host.cjs:113-130`). Trocar com turno vivo
exigiria uma máquina de estados nova para entrega incerta, fila e steer; o
ganho não paga o risco agora. Se o autor quiser o jeito do T3 Code (*), B pode
ser um ticket seguinte: a troca vale para o próximo turno e a fila é do app, não
do motor. Permissão, se voltar a existir, nunca deve ser transferida entre
motores: o motor novo pede a dele.

### D5. Histórico: duas sessões ou uma conversa

| Opção | Como a lista, a busca e o pacote enxergam | Custo |
|---|---|---|
| **A. Duas sessões ligadas por origem** | Cada descritor continua uma sessão; a nova leva `origin` e a lista mostra “continua de…”; busca e pacote seguem por descritor | M |
| **B. Uma conversa lógica** | Uma conversa no app, várias sessões de provider por baixo; lista, busca e pacote agrupam | G |
| **C. Duas sessões independentes** | Nenhum vínculo; o aluno vê duas conversas parecidas | P |

**Recomendação: A.** O armazenamento já é uma lista de sessões por matéria
(`desk/course-state-host.cjs:50-67`), a busca monta candidatos por arquivo
(`desk/src/study-data/search-sources.cjs:150-158,172-191`) e o pacote grava cada
descritor separado, com `engine` no manifesto
(`desk/src/study-data/package-source.cjs:136-145`,
`desk/src/study-data/packages.cjs:82-95`,
`desk/src/study-data/package-read.cjs:56`). B exigiria agrupar tudo isso e
mexer no formato do pacote; C perde a continuidade. `origin` no descritor é
suficiente para a lista mostrar a linhagem e para a busca achar as duas.

Mock da lista com A:

```text
Sessões da matéria
  Lista 3 — isole o termo                 OpenCode
    hoje, 14:32 · continua de Claude Code
  Sessão de 03/11, 18:10                  Claude Code
  Sessão de 02/11, 09:05                  (Pi, só leitura)
```

### D6. Nomes: onde o motor aparece

| Opção | Lista | Cabeçalho | Custo |
|---|---|---|---|
| **A. Motor só na lista** | Uma linha de meta com o motor (e “continua de…”); título limpo | Só o título da sessão e o indicador de modelo/esforço | P |
| **B. Selo no cabeçalho e na lista** | Motor na meta e um selo/chip no topo | Título + selo do motor + modelo | M |
| **C. Prefixo no título, como hoje** | `OpenCode · …` no rótulo e motor de novo na meta | Só o título (com prefixo) | P |

**Recomendação: A.** Hoje o motor aparece duas vezes na lista (prefixo do host
em `desk/lib.cjs:142-149` e meta em `desk/src/course-conversations.mjs:79-102`);
no cabeçalho ele deveria ser invisível (`data-engine`), mas o strip só cobre o
prefixo do Claude (`desk/src/state.mjs:335-339`), então o `OpenCode · ` pode
sobrar no título. Uma vez na lista, mais o modelo no indicador da caixa, já
responde “onde estou” sem poluir o cabeçalho. O nome da sessão continua sendo o
mesmo depois da troca; o que muda é a linha “continua de…”. Se o autor quiser
que o motor da sessão atual fique óbvio no topo, B é a alternativa, mas custa
mais altura e mais um selo.

### D7. Critério do primeiro uso: instalado, logado ou os dois

| Opção | Como escolhe | Custo | Efeito |
|---|---|---|---|
| **A. Presença de executável (atual)** | Primeiro da ordem OpenCode → Claude que existe | P | Rápido e offline; pode escolher um motor que ainda não tem login |
| **B. Presença + login antes de abrir** | Sonda `auth status`/modelo antes de escolher | M | Mais certeza; atrasa o boot, depende de rede/processo e pode travar |
| **C. Presença + queda para o outro** | Escolhe por presença; se o connect falhar por login, a coluna oferece o outro motor pronto, com passagem | M | Não atrasa o boot e resolve o caso real; precisa de dois motores prontos |

**Recomendação: C.** O código atual só olha o executável e a versão do OpenCode
(`desk/tutor-default-engine.cjs:4-9`), e a issue pede “logado”. Sondar login
antes de abrir (B) troca um erro visível por um boot lento; C deixa o erro
acontecer onde ele já é tratado — no connect — e oferece a saída com contexto.
Em produção, com só OpenCode visível, isso é inerte.

### D8. O que muda agora que só o OpenCode está visível e o Pi saiu

| Opção | Escopo | Custo | Entrega ao aluno |
|---|---|---|---|
| **A. Passagem agora, troca escondida** | Implementa digest, linhagem e “Continuar no OpenCode” para sessões antigas; o menu de motores fica atrás da vista e é testado com fakes; aceite = 2 sentidos Claude/OpenCode + Pi→OpenCode somente leitura | M | Hoje: continuar uma conversa antiga no OpenCode. Quando o Claude voltar, a troca já existe |
| **B. Reexpor o Claude em produção** | Além de A, o Claude volta ao menu/seletor para quem tem | M/G | Troca real hoje, mas reabre a decisão de release e a superfície de suporte |
| **C. Adiar a #87** | Só limpa o menu e o rótulo; passagem fica para quando houver 2 motores visíveis | P | Nada de passagem hoje |

**Recomendação: A.** Com `visibleEngines()` fixo em `['opencode']`
(`desk/visible-engines.cjs:32-36`), uma troca de motor não tem como aparecer em
produção. Mas a passagem tem uso imediato: sessões Pi e Claude antigas abrem
somente para leitura e hoje só oferecem “Nova sessão” vazia. A opção A entrega
esse caminho sem reabrir a decisão de release; B é uma decisão de produto
separada, e C deixa o problema da conversa antiga parado.

O aceite “três pares de motores” da issue não é mais possível: o Pi não inicia.
O substituto verificável é: **Claude→OpenCode**, **OpenCode→Claude** (com fakes
ou com Claude reexposto) e **Pi→OpenCode** a partir do JSONL, somente leitura.

### D9. Onde mora a regra

| Opção | Onde | Custo | Consequência |
|---|---|---|---|
| **A. Invariante no Bend, interface em JS** | Núcleo `sessionhandoff` decide elegibilidade, conteúdo obrigatório e teto; JS decide cartão, lista e texto | M | A lei prova o que custaria material e estudo; o ajuste visual não passa pelo Bend |
| **B. Tudo em JS com teste** | Host e UI | P | Mais rápido, mas a regra “não perder material” fica só em teste de exemplo |
| **C. Tudo no Bend, inclusive a tela** | Núcleo monta menu, cartão e lista | G | Contraria o ADR 0003: texto, ordem e posição não têm o que provar |

**Recomendação: A.** O teste do ADR 0003 é claro: se a troca perder a matéria, a
questão ativa, os PDFs abertos ou a última fala, o aluno perde estudo; isso é
invariante. O que a lei só repetiria (rótulo, ordem do cartão, classe) fica em
JS.

## 3. O que a implementação exige em cada camada

### 3.1 Núcleo Bend e leis (ADR 0003)

Criar `core/sessionhandoff.bend`, com lei em `core/laws/sessionhandoff.bend` e
prova em `core/proofs/sessionhandoff.bend`, e regenerar
`desk/src/generated/sessionhandoff.core.js` (commitado). Funções mínimas:

- `canSwitch(sourceSettled, sourceUncertain, targetReady, sameCourse)` — só
  troca com origem liquidada, sem entrega incerta, destino pronto e mesma
  matéria;
- `handoffSections(hasCourse, hasExercise, hasMaterials, hasTurns)` — a lista de
  seções obrigatórias; a lei prova que matéria, questão e materiais entram
  quando existem;
- `handoffCap()` / `withinCap(length)` — o teto de 50.000 caracteres e a recusa
  do que passa;
- `canContinueLegacy(engine, visible, native)` — leitura legível, sem connect e
  sem prometer retomada nativa.

As leis devem provar, no mínimo: (1) nunca criar destino sem matéria; (2) nunca
descartar material aberto quando existe; (3) nunca trocar com entrega incerta;
(4) nunca reescrever o descritor de origem. Não há lei de permissão hoje: o
tutor é MCP-only e não existe permissão a transferir; se ela voltar, a regra
nasce junto do código que a usa. O menu e o cartão **não** entram no Bend: são
texto, ordem e posição.

Se o ticket mexer em `core/tutorheader.bend`, aplicar o ADR 0003 ao que tocar:
o menu atual é só rótulo/ordem; se a mudança não provar nada, ela vai para JS em
vez de crescer o núcleo.

### 3.2 Hosts

- `desk/src/agents/conversations.cjs`: acrescentar ao descritor um campo
  opcional de linhagem (`origin: {session, engine}` e/ou `handoff: {kind,
  bytes, createdAt}`), validar no schema e preservar a escrita atômica. O
  `importedTranscript` já existe, é imutável e tem teto de 50.000 caracteres
  (`:373-376`); para a passagem, ou ele é gravado na criação do descritor novo,
  ou a criação passa a aceitar `importedTranscript`/`handoff` — as duas opções
  precisam de teste de não sobrescrita.
- Um host novo e pequeno (`desk/session-handoff-host.cjs`, abaixo de 500
  linhas) para montar o digest a partir do descritor (ou do JSONL do Pi),
  truncar, criar o destino e devolver o plano. Não misturar com
  `tutor-engine-host.cjs`, que já tem 216 linhas e outras responsabilidades.

- `desk/tutor-engine-host.cjs`: `newSessionPath`/`resumeSession` ganham o
  caminho “com passagem”; `sessionInfo` devolve `origin` para a lista;
  `legacyHistory` continua sendo a única leitura do JSONL do Pi
  (`:113-128`).
- `desk/course-state-host.cjs` e `desk/free-session-host.cjs`: a sessão nova
  entra na lista da matéria/Livre como qualquer outra; o `origin` vem do
  descritor, não de um índice paralelo. A lista do Livre também precisa do
  rótulo e da linhagem (`desk/free-session-host.cjs:127-140`).
- `desk/src/course-conversations.mjs`: ação “Continuar no OpenCode”, aviso de
  fila que ficou na origem e linha “continua de…” na lista.
- `desk/src/visible-engines-ui.mjs` e `desk/index.html`: o rodapé de sessão
  antiga ganha a ação de continuar; “Nova sessão” continua existindo.
- `desk/src/tutor-header.mjs`: o `+` vira “sessão nova com o motor atual”; o
  menu de motores só abre com 2+ visíveis. Em produção nada muda de aparência.
- Se D2 = A, `desk/src/model-picker-ui.mjs` e `desk/tutor-session-ipc.cjs`
  precisam de catálogo por motor e de uma seleção que devolve “motor + modelo”;
  sem D2 = A, o seletor fica como está.
- `desk/main.cjs`: um IPC novo (`session-switch-engine` ou `new-session` com
  `{engine, carryFrom}`) que exige `assertIdle`, salva, para a ponte, cria o
  destino, troca `live.session` e devolve `initialData()`. Não reutilizar
  `open-session` para escrever.
- `desk/preload.cjs`: expor a chamada com validação de forma, como as demais
  (`desk/preload.cjs:359`).

### 3.3 IPC e contrato

- Pedido sugerido: `{engine, carryFrom: <caminho da sessão atual>, mode:
  'digest'|'none'}`; resposta: o mesmo `initialData()` de `new-session`, mais
  `origin` na sessão.
- Recusas explícitas: motor fora da vista; origem incerta; origem de outra
  matéria; destino sem motor pronto; teto estourado (com o tamanho recebido e o
  esperado, sem caminho pessoal).
- A sessão nova nasce com `nativeSessionId` nulo no OpenCode e o servidor cunha
  o `ses_` como hoje (`desk/src/agents/conversations.cjs:281`); a passagem é
  texto de prompt, não um `--session` do motor antigo.
- O `importedTranscript`/digest entra no prompt dos dois motores pelo caminho
  que já existe (`desk/src/agents/desk-prompts.cjs:143-145`), não por um canal
  novo.

### 3.4 Testes

- Núcleo: `desk/tests/sessionhandoff.test.mjs` para as leis e os casos de teto,
  matéria, materiais e incerteza; `npm run verify:bend` (toolchain pinada).
- Host: descritor com `origin`, JSONL do Pi, truncamento, recusa de origem
  incerta, não sobrescrita do arquivo antigo, Free e matéria.
- Janela: estender `desk/tests/legacy-session-ui.mjs` para “Continuar no
  OpenCode”; novo `desk/tests/switch-engine-ui.mjs` com
  `LEARNING_DESK_VISIBLE_ENGINES='claude,opencode'` e os fakes nomeados;
  `desk/tests/pi-opcional-ui.mjs` para o menu com um e com dois motores;
  `desk/tests/tutor-default-engine.test.mjs` para o critério de D7.
- Pacote/busca: `desk/tests/study-packages.test.mjs` e os testes de busca para
  garantir que a linhagem não cria sessão duplicada nem some do pacote.
- Portões: `MESA_GATE_CACHE=0 npm test`, `npm run hunts` e `npm run ui --
  legacy-session,switch-engine` (o helper `visual-check` é só macOS).

### 3.5 Fatias sugeridas

1. **Núcleo + host + leitura antiga**: `sessionhandoff`, descritor com
   `origin`, “Continuar no OpenCode” no rodapé legado, testes de host e janela.
   Não mexe no seletor nem no menu.
2. **Sessão nova única**: menu de motores só com 2+ visíveis, `+` direto em
   produção, linhagem na lista, testes com fakes. Depende de D2.
3. **Troca pelo seletor** (só se D2 = A): catálogo por motor, ambiguidade do
   mesmo modelo, cartão de confirmação. É a fatia mais cara e a que mais pode
   esperar.

## 4. Riscos

| Risco | Por que acontece | Mitigação |
|---|---|---|
| **Conversa antiga** | Pi é JSONL só de texto (`desk/tutor-engine-host.cjs:113-128`); Claude escondido não conecta; descritor pode estar corrompido; `.xopp` e PDFs podem ter mudado de lugar | Ler sem reescrever; `origin` só aponta; nunca prometer retomada nativa; marcar o que não veio; teste com JSONL e descritor inválido |
| **Contexto enorme** | Descritor guarda até ~12 MiB de mensagens (`desk/src/agents/conversations.cjs:56`), cada texto até 400k (`desk/src/agents/history.cjs:35`); o teto de 50k da transcrição importada pode cortar o começo | Ordem fixa (matéria/questão/PDFs primeiro, falas recentes depois), corte do mais antigo, mostrar o tamanho no cartão, teste de borda |
| **Custo de tokens** | O digest entra no prompt de toda conexão; resumo pelo motor antigo (D1=B) custa um turno extra; modelo pago escolhido no seletor | Digest sem modelo por padrão; teto de 50k; mostrar “resumo de X KB”; não resumir com modelo pago sem aviso; manter o modelo padrão do OpenCode |
| **Troca no meio do turno** | `stopBridge` derruba ponte/servidor; fila e steer são por conversa; entrega incerta não pode ser reenviada | Bloquear com `assertIdle` (D4=A); nunca trocar com `uncertain`; fila fica na origem e o aviso diz; se D4=B, máquina de estados e testes antes |
| **Mesmo modelo em dois motores** | Anthropic aparece no Claude Code e no catálogo do OpenCode; preço/contexto podem diferir | Se D2=A, agrupar por motor e rotular “nova sessão”; se D2=B, o seletor nunca mistura |
| **Duas sessões parecerem a mesma** | Título e prévia iguais; lista plana | Linha “continua de…” e origem no descritor; busca acha as duas; nada é apagado |
| **Pacote com linhagem** | O `origin` aponta para um arquivo que pode não ir no pacote, e a importação reescreve ids (`desk/src/study-data/package-import.cjs:191-220`) | Remapear `origin` para o id importado ou descartar a linhagem na importação, com teste |
| **Crescimento de disco** | Cada troca cria um descritor novo | Linhagem visível; a biblioteca existente é quem renomeia/apaga; não criar cópia em B (migrar ao abrir) |

## 5. O que fica para o Lucas decidir

1. D1: digest da Mesa (A), resumo pelo motor antigo (B) ou histórico inteiro (C), e o teto.
2. D2: motor no seletor de modelo (A), no menu do `+` (B) ou só nas Configurações (C).
3. D3: sessão antiga com “Continuar” (A), migração ao abrir (B) ou só leitura (C).
4. D4: trocar só ocioso (A), terminar e trocar (B) ou cancelar e trocar (C).
5. D5: duas sessões ligadas (A), uma conversa lógica (B) ou independentes (C).
6. D6: motor só na lista (A), selo no cabeçalho (B) ou prefixo no título (C).
7. D7: presença (A), presença + login antes (B) ou queda para o outro motor (C).
8. D8: passagem agora com troca escondida (A), reexpor Claude (B) ou adiar (C).
9. D9: invariante no Bend + JS (A), tudo em JS (B) ou tudo no Bend (C).

Combinações que fecham um escopo pequeno: **D1=A, D2=B, D3=A, D4=A, D5=A,
D6=A, D7=C, D8=A, D9=A** — continuar conversa antiga no OpenCode, sem reabrir o
Claude, com a troca pronta para quando houver um segundo motor visível.

Combinação maior, no espírito literal do T3 Code: **D2=A, D4=B, D5=B, D8=B** —
exige catálogo por motor, máquina de estados de troca e mudança no pacote; é a
que mais custa e a que mais precisa de teste com os dois motores reais (*).
