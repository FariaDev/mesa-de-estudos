# Novidades da Mesa de Estudos

## 1.2.0

A conversa pode ocupar a tela inteira, o login do OpenCode agora acontece dentro da Mesa e a leitura ficou do seu jeito. Nada precisa ser configurado de novo.

### Novidades

- **Chat na tela inteira:** o botão no cabeçalho do tutor, ou `⌘⇧E` (`Ctrl+Shift+E` no Windows), esconde as referências e centra a conversa. Ao voltar, PDF, página e zoom continuam como estavam.
- **Entrar na conta pelo app:** na primeira abertura e em Configurações → Pastas e programas, escolha o provedor e entre pelo navegador ou com a chave. O tutor religa sem reiniciar a Mesa.
- **Continuar conversa antiga com contexto:** a sessão antiga ganha **Continuar no OpenCode com o contexto**, sem reescrever o histórico.
- **Leitura do seu jeito:** em Configurações → Aparência e avisos, escolha o tamanho e a largura do texto do chat e o tom **Suave** da página escura do PDF. O texto vale na hora no tutor e no chat lateral.

### Melhorias

- **OpenCode já instalado:** a Mesa agora encontra a instalação feita por outros meios, como bun ou npm, e deixa você escolher o programa se ainda não achar.
- **PDF mais difícil:** o tutor gira, recorta e amplia a página antes de ler.
- **Anexo na fila:** colar ou soltar uma imagem durante a resposta entra na fila, como o texto.
- **Conversas longas:** o histórico e as fórmulas aparecem mais rápido; quando o espaço aperta, a conversa antiga perde a imagem antes do texto.
- **Caixa de mensagem:** o resumo do contexto foi para **Mais opções** e o campo do tutor fica fixo em três linhas.
- **Sobre:** mostra de onde o app se atualiza — Release oficial ou pasta de desenvolvimento.
- **Inglês:** os textos foram revisados e a busca, o copiar e os avisos acompanham a troca de idioma na hora.

### Correções

- **Limite do modelo grátis:** o aviso agora explica o que aconteceu e oferece a saída certa, uma vez só.
- **Relatar um problema:** o relato vai para o repositório público e volta a funcionar com o OpenCode 2 ou mais novo.
- **Links:** links `https` na resposta abrem pelo diálogo da Mesa, que mostra o destino.
- **Sessões:** **Parar** funciona do Enviar até o fim da resposta, conectar não bloqueia Ajustes, matéria e sessão, e uma sessão recusada não fica presa em “conectando”.
- **Erros do tutor:** fechou sozinho, login ou credencial aparecem em linguagem clara, e enviar sem rede avisa que falta conexão.
- **Primeira mensagem:** não aparece de novo no fim da resposta.
- **Citar:** o cursor volta para o fim da caixa de mensagem.
- **Zoom:** os atalhos valem para o leitor em que você está, sem mexer no outro.
- **Backup e GeoGebra:** uma falha no backup não é marcada como backup feito, e o GeoGebra não restaura duas vezes ao reabrir a aba.
- **Recuperação e atualização:** se a Mesa fechar no meio de uma resposta, você perde no máximo os últimos 8 segundos dela; a atualização não instala uma versão mais antiga nem deixa cópia para trás quando é recusada.

### O que ainda falta

- É preciso o OpenCode 2 ou mais novo.
- No macOS com ícones em preto e branco, o ícone da Mesa fica colorido enquanto ela está aberta.
- No Windows, esta versão passou só por testes automáticos.

Para quem já usa: **Sobre → Atualizar e reiniciar**.

## 1.1.0

A Mesa ganhou cara nova e o tutor agora funciona pelo OpenCode. Seus estudos continuam onde estavam.

### Antes de atualizar

- **O tutor passa a usar o OpenCode**, no lugar do Pi e do Claude Code. A Mesa instala o programa para você. Depois, é só entrar na conta do modelo que você usa, uma vez só. As contas do Pi não vêm junto.
- **Matérias, PDFs, caderno e progresso ficam como estão.** As sessões antigas continuam abertas para leitura; para seguir o assunto, comece uma sessão nova.
- **No macOS**, o sistema pode pedir de novo a permissão de Gravação de Tela para o Conferir.

### Novidades

- **Luminária:** o novo ícone do app, que acompanha a sua cor de acento enquanto a Mesa está aberta. Quando o tutor pensa, a luminária aparece acesa na conversa.
- **Primeira abertura:** a luz da luminária acende aos poucos a cada passo, e a configuração inicial ficou mais direta, com o detalhe no Guia.
- **Quiz e perguntas em cartões:** o tutor pergunta sem prender a conversa.
- **Cartões de revisão propostos pelo tutor:** só entram no caderno depois que você aprova.
- **PDF solto na conversa:** anexe um PDF e o tutor consegue ler.
- **Modelo padrão:** escolha qual modelo já vem em cada sessão nova.
- **Fila de mensagens:** uma mensagem na fila pode interromper o tutor e ser enviada na hora.

### Melhorias

- **Menos texto na tela:** configurações, diálogos e estados vazios ficaram mais enxutos, e as explicações foram para o Guia.
- **Caixa de mensagem nova:** encostada na coluna, com menos controles, e alinhada entre o tutor e o chat lateral.
- **Visual:** cinzas neutros, novas superfícies e o texto da conversa maior e mais espaçado.
- **Conversa:** segue a resposta até o fim sem puxar quem rolou para cima, e os desenhos em SVG do tutor aparecem como figura.
- **Leitor de PDF:** navegação por páginas e numeração impressa nas Configurações.

### Segurança

- **Atualizações assinadas:** a Mesa só aplica uma versão com assinatura válida e confere o arquivo antes de instalar.
- **Tutor só com as ferramentas da Mesa:** ele não roda comandos no seu computador nem usa as ferramentas nativas do motor.
- **Links de atividade:** mostram o destino antes de abrir o navegador.
- **Pacote de estudo:** agora leva as conversas do OpenCode, e uma sessão do Pi importada não volta retomável com histórico de terceiros.

### O que ainda falta

- Quem instalou o OpenCode por `bun` ou `npm` pode ver o aviso de que ele não está instalado.
- No macOS com ícones em preto e branco, o ícone da Mesa fica colorido enquanto ela está aberta.
- É preciso o OpenCode 2 ou mais novo.
- No Windows, esta versão passou só por testes automáticos.

Para quem já usa: **Sobre → Atualizar e reiniciar**.
