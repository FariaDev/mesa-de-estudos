A 1.0 é a primeira versão da Mesa de Estudos com a interface redesenhada de ponta a ponta. A Mesa ganhou identidade própria, uma primeira abertura em passos, interface e tutor em inglês ou português, e mais formas de usar o tutor, inclusive sem assinatura de IA. Os seus PDFs, matérias e sessões continuam onde estavam.

## Começar

- Primeira abertura em tela cheia, um passo por vez: idioma, como a Mesa funciona, nome da matéria, PDFs e tutor. A matéria só é criada no último passo, e dá para voltar em qualquer um.
- Modelos grátis pelo Pi (OpenCode Zen): o tutor funciona sem assinatura de IA.
- GeoGebra offline opcional, baixado no setup com o hash conferido.

## Estudar

- Interface redesenhada: barra superior com Estudar, Ajustes e busca de comandos; leitor com uma barra só; painéis colados e PDF na largura do leitor.
- Leitor vazio mostra a folha "Lista 0" e aceita PDF solto em cima.
- Coluna do tutor com o título da sessão, o modelo e o esforço no cabeçalho, uma caixa de mensagem com a linha "Vai junto" e a calculadora em uma linha no pé.
- Caderno, Estatísticas, Guia da Mesa, Calculadora e Sobre redesenhados. O Guia tem lateral, busca e Próximo/Anterior, e abre com ⌘/.
- Foto do celular: um QR code abre uma página na mesma rede, e as fotos do caderno entram na bandeja da Mesa na ordem de envio.
- Conferir aceita outros programas de escrita além do Xournal++. O programa é escolhido nas Configurações.
- Atividades interativas no chat com cartão novo e o ciclo prever, observar e concluir. As visualizações funcionam offline.
- Estatísticas contam o tempo sozinhas enquanto a janela está à vista numa matéria. Pausar segura o cronômetro até você retomar.
- Citar uma fórmula do PDF anexa o recorte da página como imagem, com arquivo e página, em vez de texto embaralhado.

## Tutor e modelos

- Seletor de modelo com busca, grupos por provedor, favoritos, recentes e os grátis à parte.
- OpenCode como motor, ao lado do Pi e do Claude Code.
- Claude Code com as funções do Pi: steer, compactar, medidor de contexto, comandos, rascunho e quiz. Continua marcado como experimental.
- O tutor desenha figuras em SVG e gráficos, no chat e no PDF, e pode ver o que desenhou para conferir.
- Modelos de PDF do tutor: Lista, Apostila, Resumo, Simulado e Formulário. O diálogo Montar PDF mostra a prévia em A4.
- Menções @ das ferramentas no chat; o GeoGebra abre sob demanda, com quadro limpo a cada uso.
- Avisos de atualização do Pi e do Claude Code, com Atualizar de dentro da Mesa.

## Aparência

- Logo nova (a folha com a ∫), ícone do app e marca do cabeçalho no acento escolhido.
- O trio ∫ Σ ∇ nas telas de setup, Guia e celular: a ∫ lê junto, o Σ soma o que você fez e o ∇ dá a dica.
- Títulos em STIX Two Text, embutida no app.
- Seis cores de acento nas Configurações.
- Tema escuro em cinza neutro (Grafite) no lugar do quase preto.
- Transições e animações com um ritmo só, e "reduzir movimento" do sistema respeitado em todo o app.

## Idioma

- Interface e tutor em português ou inglês. Em inglês o app se chama Study Desk.

## Problemas e suporte

- Relatar um problema monta um relatório limpo, sem caminho pessoal, e um prompt pronto para passar a um agente.
- Mensagens de erro dizem o valor recebido e o formato esperado. O log do app (`desk.log`) pode ser lido no Sobre.

## Por dentro

- O app Conversa foi aposentado: o chat avulso mora na aba Livre da Mesa.
- Electron 44, pdf.js 6, KaTeX 0.19, marked 18 e DOMPurify 3.4. Compatível com o Pi 1.3.0.
- Testes de janela e hunts mais rápidos, portão de tipos e lint dentro do `npm test`.

## Para quem já usa

- **Como atualizar:** Sobre → Atualizar e reiniciar (de 0.4.0 em diante). Pelo terminal, `npm run update` em `desk/`.
- **`config.json`:** continua valendo como está. Há um campo novo e opcional, `claudePath`, para apontar um Claude Code fora do PATH. Instalação nova grava o runtime em `desk/.runtime` do próprio clone.
- **Estado de interface:** favoritos e recentes do seletor de modelo, idioma e o programa do Conferir ficam no `desk.json`, fora do `config.json`.
- **Claude Code:** a Mesa usa o Claude Code que você instalou, sem binário de reserva. Ela aceita de 2.1.296 até a série 2.1; série nova é recusada até ser testada, e o Sobre avisa.
- **Conversa:** a pasta `chat/` de uma instalação antiga não é apagada pelo updater. Quem quiser o código de volta usa a tag local `conversa-final`.
- **Contas e dados:** a Mesa não faz login nem guarda token de nenhum provedor. O motor Claude roda o Claude Code que você instalou, com a sua própria conta, e o uso segue os termos da Anthropic; para uso fora do dia a dia pessoal, a Anthropic recomenda chave de API do Console. Os modelos grátis do OpenCode Zen mudam com o tempo, e alguns podem usar as mensagens para melhorar o modelo: a Mesa prefere os que não guardam nada, e cada modelo mostra a política dele no seletor.
- **Tema e acento:** quem usava o tema escuro passa a ver o Grafite. O acento padrão continua azul.

## Acessibilidade e desempenho

- Menus da barra pelo teclado: as setas andam entre os itens, Home/End vão às pontas e o Esc devolve o foco ao botão que abriu o menu.
- Texto de erro, aviso e sucesso com contraste AA nos dois temas, e os seis acentos conferidos.
- Botões pequenos (remover menção, anexo e marcador) com área de clique de 24 px.
- Sessões longas mais leves: com 1000 mensagens, cada resposta nova custa cerca de metade do tempo de antes.
