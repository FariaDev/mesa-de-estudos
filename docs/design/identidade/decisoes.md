# Identidade visual (#61): decisões

Fase A, exploração. Cada peça passa por rodadas curtas de 2 a 4 variantes; o autor escolhe e a escolha fica aqui. Nada disto mexe em `desk/` até a fase B. A coluna "Recomendo" é a sugestão da sessão para o autor discutir; não é decisão.

| # | Peça | Protótipo | Opções | Recomendo | Escolha |
|---|---|---|---|---|---|
| 1 | Mascote (entra ou não, e qual) | [mascote-r1.html](mascote-r1.html) §1 | A Mesinha · B Folhinha · C Caderninho · nenhum | **A Mesinha** | **Trio ∫ Integral, Σ Sigma e ∇ Nabla**, aprovado em 2026-10-22 na #64 ([../../reviews/issue-64-mascotes.html](../../reviews/issue-64-mascotes.html)), no estilo da [mascote-r6.html](mascote-r6.html). Substitui a Folhinha (aprovada em 2026-10-21 em [folhinha-r7.html](folhinha-r7.html), hoje só histórico) |
| 2 | Ícone do app | [logo-r1.html](logo-r1.html), [mascote-r1.html](mascote-r1.html) §2 | A Duas folhas · B M serifado · C Lista 0 · D Tampo · D' M-mesa · E M-lápis · F Folha que sorri | **D' M-mesa** (sem mascote: **B M serifado**) | **G1 · folha com a ∫** ([logo-folha-r5.html](logo-folha-r5.html)), escolhida em 2026-10-22: a mesma folha creme inclinada da F1, com a ∫ em traço de pincel no tom escuro do acento, sem o visto; reativa à cor de acento. Antes: G2 com o visto (#65, no mesmo dia), F1 com a lista (2026-10-21) e, antes dela, D' M-mesa |
| 3 | Estilo dos ícones da interface | [icones-r1.html](icones-r1.html) | A Fino · B Duotom · C Acento | **B Duotom** | **Hoje (Lucide)**, com a faísca do Fino no **traço 2** ([icones-r2.html](icones-r2.html), variante A); 2026-10-21 |
| 4 | "Pensando" animado | [animados-r1.html](animados-r1.html) §1 | A1 Faísca · A2 Lápis · A3 Mesinha · A4 Pontos | **A3 Mesinha** (sem mascote: **A2 Lápis**) | **∫ pequena, pose "pensando"** (mão no queixo, "?" e piscada), pelo componente `desk/src/mascote.mjs`; 2026-10-22 na #64. Antes: Folhinha pequena de [folhinha-r7.html](folhinha-r7.html), 2026-10-21 |
| 5 | Microinterações animadas | [animados-r1.html](animados-r1.html) §2 | copiar · enviar · guardar · conferir | **copiar, guardar e conferir**; enviar fica parado | **copiar, guardar e conferir** (2026-10-21); copiar, guardar e conferir corrigidos em [animados-r2.html](animados-r2.html) |
| 6 | STIX na Lista 0 | [tipografia-r1.html](tipografia-r1.html) §1 | A só cabeçalho · B folha inteira | **B folha inteira** | **B folha inteira** (2026-10-21) |
| 7 | STIX no Caderno | [tipografia-r1.html](tipografia-r1.html) §2 | A 26px regular · B 24px médio | **B 24px médio** | **B 24px médio** (2026-10-21) |
| 8 | STIX nos PDFs | [tipografia-r1.html](tipografia-r1.html) §3 | embutir em todos os modelos, inclusive o genérico | **embutir em todos** | **embutir em todos** (2026-10-21) |
| 9 | Títulos do chat | [tipografia-r1.html](tipografia-r1.html) §4 | A proposta da issue · B tudo 15px | **A proposta da issue** | **A proposta da issue** (2026-10-21) |
| 10 | `tabular-nums` | [tipografia-r1.html](tipografia-r1.html) §5 | sim · não | **sim** (já decidido na issue) | sim |

## Trio ∫ Σ ∇ no lugar da Folhinha (#64, 2026-10-22)

- O autor trocou a Folhinha pelo **trio ∫ Integral, Σ Sigma e ∇ Nabla**, revisado na página estática [issue-64-mascotes.html](../../reviews/issue-64-mascotes.html), feita com o mesmo código do app. A Folhinha saiu do código e dos testes; [folhinha-r7.html](folhinha-r7.html) fica só como histórico.
- Papéis: a **∫** é calma e lê junto; o **Σ** é organizado e soma o progresso (o ✓ do passo vencido e o Pronto); o **∇** é curioso e dá a dica (braço levantado com "!").
- Onde aparecem: os três juntos nas Boas-vindas e no Pronto do setup e no topo do Guia; um só, grande, nos outros passos do setup e no vazio da busca do Guia (∇ pensando); um só, pequeno, no "pensando" do chat (∫).
- Tom: os textos ao redor dizem o que aconteceu ou o que fazer, sem fala de personagem. O nome de cada um aparece só no aria-label (`mascote.<id>.nome`).
- O ícone do app (item 2, hoje o G2 da #65) não muda nesta issue.

## Folhinha sem a lista no corpo (#64, 2026-10-21; histórico)

- A Folhinha sai **sem os itens "1) 2) 3)" e o visto** no corpo, em todo lugar: na grande da primeira abertura e do Guia (o antigo `desk/src/folhinha-big.mjs`, que saiu com o trio), na pequena do "pensando" (que já não tinha) e no protótipo [folhinha-r7.html](folhinha-r7.html). Decisão do autor na revisão do redesenho da primeira abertura (#64).
- O **logo F1 com a lista** (item 2 acima) não muda: a lista é do ícone do app, não da personagem.
- A grande ganhou olhos com recorte (a pupila não sai do olho), pálpebra de verdade, olhar que segue o mouse e os humores da #64; tudo para com movimento reduzido, pelos tokens de [movimento.md](../movimento.md).

## Por que cada recomendação

1. **Mascote: Mesinha.** O nome se explica sozinho ("Mesa de Estudos"). A forma é simples (um retângulo, duas pernas e dois olhos), então aguenta virar ícone de 16 px (ver item 4) e animar no vídeo. A Folhinha é a segunda melhor; o Caderninho de óculos fica "professor" demais para um app que quer o aluno fazendo.
2. **Ícone do app: M-mesa.** É o caminho do desenho escondido: de longe é um M, de perto é uma mesa, e em 16 px continua legível porque é chapado. Se o mascote entrar, ele mora dentro do app e no vídeo, e o ícone fica sério. Sem mascote, o B (M serifado) é o mais forte da rodada 1, porque liga o ícone à STIX.
3. **Ícones: Duotom.** O tom leve dá corpo em 16 px, inclusive em monitor Windows sem retina, onde o traço 1,5 sozinho some. O Acento põe cor em todo botão e briga com o botão principal, que já usa a cor de acento.
4. **Pensando: Mesinha** se o mascote entrar, porque é onde ele aparece todo dia sem ocupar espaço. Sem mascote, o **Lápis**: é o único que diz "escrevendo" em vez de só "carregando".
5. **Microinterações: só confirmação.** Copiar, guardar e conferir respondem a um clique e confirmam que deu certo. Enviar já tem retorno (a mensagem aparece), então animar a seta seria enfeite.
6. **Lista 0 inteira em STIX.** A folha finge ser uma lista impressa; metade sistema, metade serifa fica com cara de remendo. Também é igual ao modelo Lista do PDF.
7. **Caderno 24px médio.** A STIX regular tem filetes finos que ficam ralos na tela, sobretudo em monitor Windows sem retina; o peso 500 segura melhor. A STIX também é mais estreita que a Iowan: medida no navegador, a pergunta de exemplo dá 598px em Iowan 26px, 566px em STIX 26px e 539px em STIX 24px médio. Em 24px ela cabe numa linha a mais de texto sem perder presença. Se o autor achar 24px pequeno, a STIX 26px em peso 500 também cabe.
8. **PDF: embutir em todos.** Hoje o Windows cai na Latin Modern ou na Times, e o modelo genérico ainda está na Georgia. Com a fonte embutida, o PDF sai igual em qualquer máquina.
9. **Chat: proposta da issue.** É o mínimo que resolve os títulos de 30px e a quebra no meio da palavra. Com tudo em 15px, uma resposta longa perde as seções.

## Rodada 2 (2026-10-21)

- [icones-r2.html](icones-r2.html): Lucide de hoje com a faísca do Fino, no traço 2 (A) ou 1,5 (B). Recomendo **A**, para a faísca não destoar dos vizinhos na barra.
- [animados-r2.html](animados-r2.html): nenhuma forma escala mais (só opacidade, traço com `pathLength=1`, raio e recorte), e o estado parado é o final. A1 virou A1a (brilho percorrendo o contorno) e A1b (cintilar). No A2, o lápis anda pela onda (SMIL `animateMotion`) e gira só metade da tangente (±25°): o `rotate="auto"` puro deitava o lápis para a frente. Com o lápis a 65°, ele varia entre −90° e −40°, medido no navegador. Recomendo **A2** para o "pensando" sem mascote e **A1b** se preferirem a faísca.
- [mascote-r2.html](mascote-r2.html): λ Lambda (computação), ∇ Nabla (física e IA), Σ Sigma e ∫ Integral (matemática). Os olhos ficaram grandes, saltados e contornados, e o mascote pisca só pela opacidade da pálpebra. O π ficou de fora de propósito. Recomendo **∇ Nabla**: o triângulo é a silhueta mais firme em 20 px, e o gradiente liga física, cálculo e IA. Em segundo, **λ Lambda**, se quiserem puxar para computação.

## Rodada 3 do mascote (2026-10-21)

- Retorno da rodada 2: nenhum mascote agradou; ∇ Nabla e ∫ Integral foram os "menos piores".
- [mascote-r3.html](mascote-r3.html) separa personagem de estilo: ∇ e ∫ em três estilos (A tinta, B desenho animado, C geométrico chapado). Se nenhum estilo salvar, a opção é ficar sem mascote: a identidade fica na marca M-mesa e nas animações, e o "pensando" usa A2 ou A1b.

## Rodada 4 do mascote (2026-10-21)

- Retorno da rodada 3: o autor prefere de longe o pincel da rodada 2. O estilo fica; o problema era o personagem.
- [mascote-r4.html](mascote-r4.html): ∂ Parcial, ψ Psi, √ Raiz e ∞ Infinito, no pincel da rodada 2. Recomendo **∂ Parcial**: é o mais "bichinho" (barriga redonda e topete) e o que melhor aguenta 20 px. Em segundo, **ψ Psi**, que tem braços e por isso mais expressão para o vídeo.

## Rodada 5 do mascote (2026-10-21)

- Retorno da rodada 4: nenhum agradou. Pedido: sair dos símbolos. A sessão sugeriu gota de tinta, tatu-bola, borracha e post-it, e evitou de propósito a coruja (clichê), o clipe (Clippy), a luminária (Pixar) e a capivara (meme). O autor tirou o tatu-bola.
- [mascote-r5.html](mascote-r5.html): gota de tinta (com as poses "pensando ?", "dica !" e "acertou ✓", e balanço por morph de `d` em SMIL, sem escala), borracha e post-it, no pincel da rodada 2. Recomendo **gota de tinta**: vem da caneta do Xournal++, as poses resolvem as animações de estado e a silhueta aguenta 20 px.

## Logo da folha e cor de acento (2026-10-21, reabre a fase A)

- Pedido do autor: logo reativa, que muda com a cor de acento das configurações, e o mascote mudando de cor junto; mais opções de logo a partir da folha.
- [logo-folha-r1.html](logo-folha-r1.html): A folha de exercício, B rosto da Folhinha, C folha com M, D folha que sorri; cada uma nos seis acentos (`--acc-*` claros de `desk/style.css`). O fundo segue o acento, a folha fica creme.
- [folhinha-r7.html](folhinha-r7.html) §3: braços, pernas e os sinais "?" e "!" seguem o acento (`--membro`); a folha e o lápis âmbar ficam iguais.
- Limite técnico da logo reativa: com o app aberto, troca o ícone do Dock (`app.dock.setIcon`, já usado em `desk/main.cjs`) e o da barra de tarefas do Windows (`BrowserWindow.setIcon`). Com o app fechado (Finder, Launchpad, menu Iniciar, instalador), vale o ícone do pacote, que é um só. Por isso a fase B gera um PNG por acento no build e escolhe um acento para o ícone do pacote.
- Retorno da rodada 1: o autor ficou entre A e B ("B parece muito infantil, A parece meio genérica").
- [logo-folha-r2.html](logo-folha-r2.html): meios-termos, todos sem boca (H1 olhando a lista, H2 olhos de ponto, H3 concentrada, H4 com o lápis). Retorno: "ficaram estranhas". Misturar A e B não resolve.
- O autor escolheu seguir com a **folha chapada**: só a silhueta com o canto dobrado, sem desenho dentro, e a Folhinha só dentro do app.
- [logo-folha-r3.html](logo-folha-r3.html): F1 folha creme, F2 folha no acento, F3 dobra grande (âmbar), F4 duas folhas. Risco: folha lisa com o canto dobrado é o desenho clássico de "arquivo". Recomendo **F3**: a dobra grande em âmbar é o que mais foge do ícone genérico de documento e liga com o lápis da Folhinha.
- [logo-folha-r4.html](logo-folha-r4.html): a pedido do autor, os quatro tratamentos da rodada 3 com a folha da variante A da rodada 1 (inclinada -4°, três itens, o primeiro com o visto âmbar). A lista tira a cara de "arquivo genérico" e vira "exercício". Na F2 os riscos seguem o acento clareado. Recomendo **F3 com a lista**: a silhueta da dobra âmbar continua sendo a marca, e a lista diz "estudo".
- Escolha do autor: **F1 com a lista** (eu recomendava F3).
- Cor do ícone do pacote: **violeta** (`#6d28d9`), escolha do autor em 2026-10-21 (eu recomendava o azul, o acento padrão). Fica igual ao ícone de hoje; com o app aberto, o Dock e a barra de tarefas seguem o acento.

## Fase A fechada (2026-10-21)

O que a fase B aplica, em `desk/`, numa branch própria:

1. **Ícone do app:** F1 com a lista ([logo-folha-r4.html](logo-folha-r4.html)), em `desk/assets/mesa.*`, nos tamanhos de macOS e Windows. No Dock e na barra de tarefas segue a cor de acento com o app aberto (`app.dock.setIcon`, `BrowserWindow.setIcon`); o ícone do pacote é um arquivo fixo, em violeta (`#6d28d9`). Substitui o M-mesa.
2. **Ícones da interface:** continuam no Lucide de `desk/icons.mjs`; só `sparkles` troca pela faísca do Fino, no traço 2. Junto entra o aviso de copyright ISC do Lucide, que o repositório ainda não tem.
3. **Mascote:** Folhinha ([folhinha-r7.html](folhinha-r7.html)), versão grande e versão pequena; o "pensando" usa a pequena, na pose de pensando. *Trocada pelo trio ∫ Σ ∇ na #64 (ver acima).*
4. **Microinterações:** copiar, guardar e conferir, como em [animados-r2.html](animados-r2.html). Animam só opacidade, traço, raio e recorte; com movimento reduzido, mostram o estado final.
5. **STIX Two embutida** (woff2, OFL): Lista 0 inteira; pergunta do Caderno em 24px peso 500; todos os modelos de PDF, inclusive o `pdf-template.css`. A Newsreader sai do `--serif`.
6. **Chat:** h1 17, h2 16, h3 15 e h4 15 cinza, em negrito; código de 13px; `overflow-wrap: break-word` no texto e `anywhere` só em código e links.
7. **`--mono`** com `"Cascadia Mono", Consolas` no lugar das listas repetidas, e **`tabular-nums`** na calculadora e nos tempos.
8. **Ver também:** "pensando" duplicado e em inglês na captura do autor; `#model-indicator` do d16a873 (notas acima).

## Folhinha: polimento (2026-10-21)

- [folhinha-r7.html](folhinha-r7.html), com os seis itens aprovados pelo autor:
  1. versão pequena desenhada à parte (24 a 40 px): só a folha, a orelha e um rosto grande, contorno grosso, sem grão;
  2. bordas levemente curvas; o canto fica sempre dobrado (a orelha que levantava saiu, ver abaixo);
  3. texto de exercício "1) 2) 3)" em STIX com rabiscos; no acerto, um ✓ âmbar no item 2;
  4. ~~margem de caderno violeta~~ (saiu, ver abaixo);
  5. mãos redondas e sapatinhos ovais;
  6. animações próprias: pensando (o lápis tamborila), dica (braço levantado com "!"), acertou (pulinho por deslocamento, com a sombra encolhendo pelo raio). Com movimento reduzido, cada SVG congela num quadro de repouso.
- **Aprovada pelo autor em 2026-10-21. Mascote fechado.** Na fase B entram as duas versões, a grande (Lista 0, telas vazias, vídeo) e a pequena (de 24 a 40 px: "pensando", avatar da dica, aviso de acerto).
- Retorno do autor: não gostou da folha desdobrando (a orelha que levantava) nem da margem roxa vertical. As duas saíram; o canto ficou sempre dobrado.

## Rodada 6 do mascote: lapidação (2026-10-21)

- **Escolha: Folhinha, sem a ∫.** Fecha a busca de personagem; o que vem agora é só polimento.

- Retorno da rodada 5: nenhum agradou. Os favoritos de todas as rodadas são a Folhinha (r1), o ∇ e a ∫ (r2). A sessão propôs parar de abrir personagens e lapidar esses três. O autor topou.
- Prazo combinado: se nenhum convencer depois desta rodada, a v1 fica **sem mascote**, e o mascote vira decisão do vídeo de lançamento (issue própria), de preferência desenhado à mão.
- [mascote-r6.html](mascote-r6.html): Folhinha, ∇, ∫ e a mistura Folhinha-∫, com o mesmo esqueleto (braços e pernas violeta, mesmo lápis, olhos contornados) e quatro poses (parado, pensando, dica, acertou). Cada um aparece em uso: espiando a Lista 0, na barra de "pensando", dando dica no chat e no aviso de acerto.

## Retorno da rodada 1 (2026-10-21, autor e um amigo)

- Ícones: o Lucide de hoje ficou melhor que os redesenhados. Só a faísca troca pela do Fino.
- Animações: dá para salvar todas, mas cada uma precisa de ajuste. A1 tem de ser repensada. No A2, o lápis tem de girar acompanhando a onda. No "guardar", o preenchimento vazava pela borda ao crescer e quase não aparecia em tamanho pequeno. No "conferir", a lente tremia ao encolher. Com "reduzir movimento" ligado, o estado parado estava errado: a câmera aparecia toda pintada.
- Mascote: ficou pequeno e compacto demais, e mal dava para ver os olhos. A Mesinha não lê como mesa. Pedido: mascotes a partir de símbolos de matemática, física, computação ou IA.
- Todo o resto segue a recomendação da sessão.

## Já decidido na issue (2026-10-17)

- A interface continua com a fonte do sistema.
- Uma única serifa embutida: STIX Two (woff2, OFL), na Lista 0, nos títulos do Caderno e nos modelos de PDF.
- A Newsreader sai do `--serif`.
- `--mono` com fallback para Windows (`"Cascadia Mono", Consolas`) substitui as listas repetidas.
- `tabular-nums` na calculadora e nos tempos.
- Corpo do chat em 15px/1,6.

## Notas da exploração

- 2026-10-20, rodada 1 de logo: o autor gostou das quatro e pediu para mantê-las. Também pediu mais exploração de desenho, no traço de pincel e com olhos grandes, e de marcas com um desenho escondido. A referência foi só o estilo; personagens e marcas são originais.
- 2026-10-20, ícones animados: os sites sugeridos (lucide-animated, Lordicon, Flaticon, allsvgicons, useanimations, SVGator) servem de referência de movimento. As animações são próprias, em CSS sobre o SVG de traço, e param com `prefers-reduced-motion`.
- Visto na captura do autor: o "pensando" aparece duas vezes (na barra e na linha embaixo) e em inglês ("The tutor is thinking…") com a interface em português. Fica para a fase B ou para um ticket próprio, porque `desk/` está fechado nesta fase.

## Para rodadas seguintes

- Ícones Lucide continuam: o Lucide é ISC, que pede manter o aviso de copyright junto; o repositório ainda não tem esse aviso (fase B).

- Monograma de provedor do seletor (#59): conferir se combina com o estilo de ícone escolhido.
- Fase B parte do main em d16a873 ou depois. O `#model-indicator` do composer perdeu a pílula e mostra o logo do modelo (`.mi-logo`/`data-logo`, `choiceIcon` em `provider-icons.mjs`) no lugar do ponto verde. Mexeu em `desk/src/header.css`, `tutor-header.mjs` e `state.mjs`. Os testes de janela esperam o ponto com `state:'attached'`, não visível.
- Nomes de ícone devolvidos pelos núcleos (`desk/src/generated/*`): nome novo muda no `core/*.bend` (ADR 0001).
- O "M serifado" e qualquer texto do logo viram contorno no SVG final, sem depender de fonte.
- Se o mascote entrar: poses para tela vazia, Lista 0, erro e vídeo de lançamento.

- 2026-10-22, ícone do app (#65): o ícone passou da F1 para a G2. A ∫ usa `feTurbulence` + `feDisplacementMap`; o Chromium do Electron rasteriza o filtro igual ao protótipo, então não foi preciso desenhar a borda irregular no path.
- 2026-10-22, depois da #65: o autor trocou a G2 pela G1 (sem o visto âmbar). A ∫ fica maior e centrada na folha.
