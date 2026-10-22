# #64 — Setup em passos, trio ∫ Σ ∇ e Guia redesenhado

Protótipos de referência: `docs/design/setup-guia-r1/` (Setup-passos, Guia,
Folhinha; locais, fora do git).

## O que mudou

### Primeira abertura em tela cheia

- Sem configuração (ou com a pasta de dados válida e nenhuma matéria), a Mesa
  abre `#setup` por cima de tudo. A Mesa fica `inert` atrás: Tab e leitor de
  tela não caem nela. Diálogos e o toast continuam acima.
- Seis passos, um por vez:
  1. Boas-vindas (idioma);
  2. Como funciona: quatro quadros, e cada um acende uma região do desenho da Mesa (leitores, escrita, tutor, topo);
  3. Nome;
  4. PDFs;
  5. Tutor (opcional);
  6. Pronto.
- **A matéria só nasce em "Criar a matéria"** (ou Enter fora de um campo) no
  último passo. Antes, nome + pasta já criavam sozinhos.
- "Voltar" aparece em todo passo depois do primeiro. Do Nome, ele volta ao
  último quadro do passeio. "Pular a explicação" leva ao Nome.
- "Como a Mesa funciona" leva ao passeio. ⌘/ continua abrindo o Guia.
- O passo dos PDFs aceita a pasta escolhida ou PDFs/pasta soltos em qualquer
  ponto da tela. Ele mostra os quatro primeiros nomes em ordem natural e "+ N".
  Itens de outra pasta são avisados como antes.
- O passo do Tutor tem os mesmos botões de antes, com os mesmos ids (`#connect`, `#free-models`, `#state-pi`):
  - Pi encontrado: **Chamar o tutor** + Usar modelos grátis;
  - sem Pi: **Ajustes do Pi** como principal.

  Com o tutor ligado, o botão vira "Continuar".
- O Pronto resume matéria, PDFs, tutor e idioma, além da pasta de dados:
  - "setup": com **Mudar**;
  - "empty": só informa, sem regravar `vaultPath` (como na #24).
- Fluxo sem DOM em `desk/src/setup-flow.mjs` (com teste) e pintura em
  `setup-view.mjs`. O ciclo, o arrasto e a criação ficam em `first-run.mjs`.
- A marcação dos passos mora em `desk/src/setup-markup.mjs`. O `index.html`
  tem teto de linhas que só cai (`tests/file-size.test.mjs`) e ficaria com
  1008 linhas, contra o teto de 865. O `main.mjs` monta a marcação antes do
  primeiro `setUiLanguage`, então os `data-i18n` são traduzidos como o resto.
  O teste de locales passou a ler esse arquivo junto com o `index.html`.

### Núcleo (ADR 0001)

`core/firstrun.bend` ficou só com a invariante: `entry`, `missing`,
`canCreate`, `courseId` e `dataToConfirm`, com 20 leis e 20 provas.

Saíram para JS, ou sumiram com a folha antiga:

- `sheet`, `tutorView`, `composerHint` e os rótulos;
- `freeModelsButton`;
- `setupTutorTree` (em `tutor-state.mjs`).

`firstrun.core.js` foi regenerado e commitado.

### Mascotes: o trio ∫ Σ ∇ (a Folhinha saiu)

Mudança de escopo aprovada pelo autor: o trio ∫ Integral, Σ Sigma e ∇ Nabla substitui a Folhinha. A revisão foi na página estática `docs/reviews/issue-64-mascotes.html`, gerada com o mesmo código do app. O ícone do app não muda.

- **Um componente só**, `desk/src/mascote.mjs`:
  - `createMascote({personagem, humor, tamanho, label, interativa})`, com `personagem` obrigatório: `'integral' | 'sigma' | 'nabla'`;
  - `personagemOf` recusa o resto (inclusive `'folhinha'`) com o valor recebido e os aceitos;
  - devolve `set`, `look`, `lookAt`, `jump`, `celebrate` e `tally` (o ✓ do Σ);
  - `mascoteMarkup(...)` é a versão parada, em texto, para quem repinta por `innerHTML` (o "pensando" do chat). Recusa humor desconhecido.
- Regras puras em `mascote-humor.mjs`. O desenho fica em `trio-art.mjs` e o movimento em `trio.css`, só com os tokens da #63; com movimento reduzido, cada um fica no quadro de descanso.
- A mascote não é botão nem entra no Tab. A interativa é `role="img"` com o nome no aria-label (`mascote.<id>.nome`) e reage ao clique e ao passar o mouse: ∫ balança, Σ pula, ∇ inclina. A decorativa fica `aria-hidden`.
- **Setup** (`desk/src/setup-cast.mjs`, quem está em cena por `castOf` em `setup-flow.mjs`):
  - os três juntos, de 96px, nas Boas-vindas e no Pronto;
  - um só, de 240px, nos outros passos:
    - ∫ no "Abra o material" e no Tutor;
    - Σ no "Resolva do seu jeito" e no Nome;
    - ∇ no "Pergunte", no "Onde está o quê" (com a dica "!") e nos PDFs.
  - Animações:
    - os olhos seguem o mouse ou o campo com foco; parados, a ∫ e o ∇ olham para o Σ;
    - cada um pisca no seu tempo;
    - cada passo vencido ganha o ✓ do Σ, ou um pulo de quem está em cena;
    - "Criar a matéria" faz os três comemorarem, e a tela sai depois do pulo, 760 ms (0 com movimento reduzido).
- **Guia:** trio de 40px no topo da lateral. A ∫ lê quando a busca acha e o ∇ pensa quando não acha; no vazio da busca entra o ∇ grande pensando.
- **"Pensando" do chat:** a ∫ pequena (20px), pose pensando, pelo `mascoteMarkup` (`worklog-view.mjs`, `data-mascot="integral"`).
- Saíram:
  - `folhinha.mjs`, `folhinha-big.mjs` + `.css` e `tests/folhinha.test.mjs`;
  - `mascote.folhinha.nome` e `setup.mascotePoke`.
- `folhinha-r7.html` ganhou o aviso de histórico. `decisoes.md` registra o trio (linhas 1 e 4, mais uma seção nova). `movimento.md` e `docs/agents/mapa.md` já falam do trio.
- O lápis do "escrevendo" passou a girar com a ponta como pivô, como pede `movimento.md`.

Para pôr outra personagem:

1. Escreva o desenho com o mesmo contrato de grupos (`.mascote-tilt/-jump/-look/-sparks`, como `trio-art.mjs`).
2. Ponha o CSS dela sob `.mascote-<id>`.
3. Acrescente uma linha em `PERSONAGENS` e `mascote.<id>.nome` nos dois catálogos.

### Tom dos textos (setup, Guia e mascotes)

As falas dizem o que aconteceu ou o que fazer, sem falar como personagem; os erros dizem a saída. Um teste (`setup-flow.test.mjs`) recusa "Bora", "Zzz", "!", "a gente" e emoji nas chaves `setup.*`, `firstrun.*`, `guide.*` e `mascote.*`. Fica de fora `firstrun.tutor.lead`, que é a fala do tutor no chat.

| Chave | Antes (pt-BR / en) | Agora (pt-BR / en) |
|---|---|---|
| `setup.say.welcome` | Oi! Eu sou {name}. Vou te mostrar a Mesa. / Hi! I’m {name}. Let me show you the Desk. | Vamos montar a sua Mesa. / Let’s set up your Desk. |
| `setup.say.sleep` | Zzz… me chama quando voltar. / Zzz… wake me when you’re back. | Continue quando quiser. / Continue whenever you like. |
| `setup.say.drop` | Pode soltar aí, eu pego! / Drop it there, I’ll catch it! | Solte os PDFs aqui. / Drop the PDFs here. |
| `setup.say.named` | {name}. Bonito nome! / {name}. Nice name! | Matéria: {name}. / Course: {name}. |
| `setup.say.pdfs.one` | {count} PDF. Já dá para começar! / … Enough to get started! | {count} PDF encontrado. / {count} PDF found. |
| `setup.say.pdfs.other` | {count} PDFs. Bastante coisa para ler! / … Plenty to read! | {count} PDFs encontrados. / {count} PDFs found. |
| `setup.say.emptyFolder` | Pasta vazia por enquanto. Tudo bem! / … That’s fine! | A pasta ainda não tem PDFs. Dá para pôr depois. / The folder has no PDFs yet. You can add them later. |
| `setup.say.folder` | Cadê os PDFs? / Where are the PDFs? | Escolha a pasta dos PDFs. / Choose the PDF folder. |
| `setup.say.tutorOn` | Ligado! Ele já está esperando. / On! It’s already waiting. | Tutor ligado. / Tutor on. |
| `setup.say.ready` | Tudo pronto. Bons estudos! / All set. Happy studying! | Tudo pronto. Crie a matéria para começar. / All set. Create the course to begin. |
| `setup.say.writing` | Anotando… / Taking notes… | (saiu: digitar não troca a fala) |
| `setup.tour.write.say` | A conta é com você, do jeito que preferir. / The math is yours, however you like. | A resolução é sua: no programa ou no papel. / The solving is yours: in an app or on paper. |
| `setup.tour.ask.say` | Travou? O tutor olha a sua resolução. / Stuck? The tutor looks at your work. | O tutor olha a sua resolução quando você pede. / The tutor looks at your work when you ask. |
| `firstrun.hint.name` | Dê um nome à matéria para começar… / Name the course to begin… | Falta o nome da matéria. / The course needs a name. |
| `firstrun.hint.folder` | Diga onde estão os PDFs para começar… / Say where the PDFs are to begin… | Falta a pasta dos PDFs. / The PDF folder is missing. |
| `firstrun.error.openFolder` | Não foi possível abrir a pasta. / Could not open the folder. | … Tente de novo ou escolha outra. / … Try again or choose another one. |
| `firstrun.error.create` | Não foi possível criar a matéria. / Could not create the course. | … Confira a pasta dos PDFs e tente de novo. / … Check the PDF folder and try again. |
| `setup.mascotePoke` | Cutucar {name} / Poke {name} | (saiu: o aria-label é só o nome) |
| `mascote.folhinha.nome` | a Folhinha / Folhinha | `mascote.integral/sigma/nabla.nome`: Integral, Sigma, Nabla |

As legendas da página de revisão passaram pelo mesmo tom, por exemplo "Item 2 somado. Bora para o próximo?" → "Item 2 feito.".

### Guia da Mesa

- Lateral de 252px:
  - trio ∫ Σ ∇ de 40px no topo, que segue o mouse;
  - título "Guia da Mesa" em STIX de 22px, com "Como a Mesa funciona" embaixo;
  - busca com ícone;
  - um ícone por seção, com itens de 34px.
- Barra de 44px com "Guia · <seção>". Os tópicos viram uma lista de leitura:
  título à esquerda, texto à direita. Os cartões do Começar ganham o número
  fantasma. Os atalhos ficam em duas colunas.
- A busca não filtra mais a lateral. Ela mostra numa lista só os tópicos que
  casam, de todas as seções, na ordem do guia. Cada achado traz o botão da
  seção de origem, que leva até ela e limpa a busca. Sem achado, aparece o
  ∇ pensando.
- Correção de texto: o Começar não diz mais que a Mesa exige Xournal++ ou mesa digitalizadora.
  - `guide.lead.comecar`: "no Xournal++, em outro programa de escrita ou no caderno de papel";
  - `guide.comecar.s2`: "Resolva do seu jeito".

### Testes e docs

- Unitários novos:
  - `setup-flow.test.mjs` (11 testes);
  - `mascote.test.mjs` (contrato do componente), `trio-art.test.mjs` (desenho e pivô do lápis), `setup-cast.test.mjs` (palco).
- Unitários reescritos ou ampliados:
  - `firstrun.test.mjs`: só o núcleo, e confere que o que saiu não volta;
  - `first-run-drop.test.mjs`: `pdfNames` e ordem natural;
  - `locales.test.mjs`: lê a marcação do setup.
- Testes de janela atualizados (ainda não rodados, ver abaixo):
  - `first-run-ui.mjs`, reescrito para os passos;
  - `guide-ui.mjs`, com medidas novas e busca em lista;
  - `dialog-standard-ui.mjs`, que isenta `.guide-title`;
  - `ui-smoke.mjs` (primeira-abertura) e `hunt-shell.mjs` (setup inicial);
  - `language-ui.mjs` e `language-sweep.mjs`;
  - `free-models-ui.mjs`, que chega ao passo Tutor;
  - `helpers.mjs`: `enterFree` sai por "Estudar sem matéria".
- Docs: `docs/agents/mapa.md` (primeira abertura, Guia, identidade, modelos grátis, idioma, mapa de CSS), `README.md`, `docs/agents/customizar.md` e `desk/UI-PORT.md`.

## Correções pegas nos testes de janela

Cada falha foi reproduzida antes de mexer em teste. O que era bug do app foi corrigido no app, com regressão.

| Falha | Causa | Tipo | Correção |
|---|---|---|---|
| `first-run-ui`: "Voltar em todo passo" | `paintSetup` escondia todo `[data-step]`, e o `#setup-card` também leva `data-step`: o cartão sumia a cada troca de passo. | **bug do app** | Só os painéis `.setup-step` entram. Regressão: `cardShown` em cada quadro do passeio e no Nome. |
| `free-models-ui`: "Continuar" não ligava depois de escolher a pasta (e o mesmo travamento no `first-run-ui` e no `language-ui`) | O clique em "escolher a pasta" mandava o caminho (texto) para `firstRunResolveDrop`, que só aceita `File` do arrasto. O preload recusava (`err.drop.local`) e a pasta escolhida no clique nunca entrava; só o arrasto funcionava. Não era o cartão sumindo. | **bug do app** (meu, da #64) | Ponte nova `firstRunResolveFolder(caminho)` no preload, para o mesmo IPC `first-run-resolve-drop`. Regressão: o `first-run-ui` confere "Pasta escolhida: …" depois do clique. |
| `language-ui`: "Open the material" em português | Trocar o idioma fora do passeio deixava o texto antigo no painel do passeio, que fica escondido. | **bug do app** | Passeio, pasta e Pronto se pintam sempre; o Tutor, que monta botões, só no passo dele. O próprio `language-ui` é a regressão. |
| `first-run-ui`: "o cartão cabe na janela" no Tutor em 900×650 | Na janela estreita e baixa, a faixa da mascote (104px) e o respiro do cartão empurravam o pé para fora. | **bug do app** (layout) | Em `max-width:1100px` e `max-height:760px`, o trio fica numa faixa de 61px e o cartão aperta o respiro. |
| `first-run-ui`: sem **Mudar** no Pronto | O teste reentra por `enterFirstRun({detectedPi, config})` sem `needsSetup`; o núcleo lê isso como "empty", que de propósito não mostra Mudar. O comentário do app dizia o contrário. | **bug do teste** | O teste passa `needsSetup: true` e o comentário de `enterFirstRun` foi corrigido. |
| `guide-ui`: lead de 18px | O protótipo (Guia.dc.html) usa 15px, igual ao CSS. | bug do teste | O teste espera 15px. |
| `language-ui`: "Idioma / Language" | O aria-label é bilíngue de propósito. | bug do teste | A varredura ignora esse atributo. |

Também: os módulos novos com `// @ts-check` (`mascote*`, `trio-art`, `setup-*`) entraram no `tsconfig.json`, que o `typecheck-list.test` cobra.

## Portões

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | ok: provas verdes, 68 artefatos reproduzíveis |
| `node --test tests/*.test.mjs` | 1990 passam, 0 falham |
| `tsc -p tsconfig.json` e `eslint .` | ok |
| `MESA_GATE_CACHE=0 npm run ui -- first-run,guide-ui,dialog-standard,ui-smoke,language-ui,free-models` | 6 ok |
| `npm run hunts -- shell,chat` | 2 ok |

## Capturas

Pendentes: saem dos testes de janela (`first-run-ui`, `guide-ui`, `language-ui`)
com runtime e PDFs sintéticos, sem material de curso, e com os caminhos
mascarados na hora da foto. O "antes" vem do `main` nos mesmos testes.

## Decisões em aberto (com recomendação)

1. **Saída para a aba Livre.** O protótipo não tem saída sem criar matéria. Pus "Estudar sem matéria" na barra do topo, porque a aba Livre é o lugar aprovado do estudo avulso e antes ela ficava à mão.
   - *Recomendo manter.*
2. **"empty" começa no Nome.** Quem já tem a pasta de dados e só ficou sem matéria (por exemplo, apagou todas) já conhece a Mesa. Pular boas-vindas e passeio evita repetir. Voltar ainda leva até lá.
   - *Recomendo manter.*
3. **Título do Guia em 22px STIX** contra os 15px do padrão de diálogos. É a única exceção, isenta no `dialog-standard-ui`.
   - *Recomendo manter*: o Guia é leitura, não formulário.
4. **A busca do Guia acha também os cartões do Começar e as linhas de atalho**, no mesmo formato de tópico. O protótipo só mostra tópicos.
   - *Recomendo manter*: buscar "⌘K" ou "atalho" sem achar nada seria pior.
5. **Barra do Guia em 44px**, contra os 52px de antes.
   - *Recomendo seguir o protótipo (44px)*. Os 52px do padrão valem para rodapé com filete, não para esta barra.
6. **Títulos das seções do Guia mantidos** (`guide.sectionTitle.*`). O protótipo repete o nome curto. Mantive os títulos longos, que já estavam traduzidos e são o que o `guide-ui` percorre.
   - *Recomendo manter.*
7. **"Começar sessão OpenCode" no meio do setup.** A sessão sobe por baixo, e a tela só passa a dizer que o tutor está ligado (o botão vira "Continuar"). O seletor de modelo fica atrás, até a pessoa criar a matéria ou ir ao Livre.
   - *Recomendo manter*: a matéria é o que falta para estudar.
