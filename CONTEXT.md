# Mesa de Estudos

Mesa de referências local para estudar ao lado do Xournal++: junta os PDFs da matéria e um tutor num lugar só. Este glossário fixa as palavras que a interface e o código usam para as mesmas coisas.

## Language

### Tela

**Mesa**:
O app e a sua janela principal. Não nomeia menu nem painel.
_Avoid_: menu Mesa

**Leitor**:
Painel que mostra um PDF. A tela tem um ou dois.
_Avoid_: painel de PDF, visualizador

**Rótulo do leitor**:
Nome que o usuário dá a cada leitor na configuração (ex.: "Enunciado", "Formulário & apoio").
_Avoid_: título do painel

**Material**:
Qualquer PDF aberto num leitor.
_Avoid_: arquivo, documento

**Referências**:
A inclusão dos materiais abertos (e da página atual) no que é enviado ao tutor. Nunca significa mostrar ou esconder um leitor.
_Avoid_: contexto do PDF

**Vai junto**:
A linha acima da caixa de mensagem que diz o que segue com a próxima mensagem: matéria, questão ativa, rascunho e os materiais abertos com a página. Acompanha o alternador de Referências; "Editar" abre o contexto de estudo.
_Avoid_: contexto enviado, resumo de contexto

**Contexto de estudo**:
A questão ativa (lista/exercício) e o rascunho .xopp associado, que vão com a mensagem. Some da mensagem quando `studyContext` está desligado.

**Matéria**:
Unidade de estudo com nome e pasta de PDFs; é o que as abas do topo trocam.
_Avoid_: curso, disciplina

### Tutor

**Tutor**:
O assistente com quem o usuário conversa. É a palavra da interface.
_Avoid_: Pi (fora de Configurações e Sobre), IA, assistente

**Pi**:
O programa que faz o tutor funcionar. Detalhe técnico, visível só em Configurações e Sobre.

**Sessão**:
Uma sessão de estudo: a sequência de mensagens com o tutor dentro de uma matéria, que pode ser retomada depois.
_Avoid_: conversa (a Mesa fala em sessão), chat, thread

**Chat lateral**:
Conversa secundária, aberta ao lado de um leitor, com escopo e histórico próprios.

**Conferir**:
Capturar a janela do Xournal++ e anexá-la à próxima mensagem para o tutor ver o que foi escrito à mão.
_Avoid_: captura, screenshot
