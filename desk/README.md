# Mesa de Estudos

Aplicativo local de apoio ao Xournal++: dois PDFs independentes, calculadora e Pi na mesma janela. O Xournal++ continua separado, como editor de escrita. No Windows os PDFs, a calculadora, o Pi e o Conferir Xournal++ funcionam (a captura usa o PowerShell do sistema).

Definição fechada em 2026-09-06: mesa de referências + Xournal++, não um canvas de tinta dentro do app. Ver [`../docs/START-HERE.md`](../docs/START-HERE.md) e [`../docs/DECISIONS.md`](../docs/DECISIONS.md).

## Uso

Abra **Mesa de Estudos.app**. Arraste a mesa para a tela de referências e mantenha o Xournal++ na outra tela.

- **Enunciado** e **Formulário & apoio** têm arquivo, página, zoom e busca independentes.
- Use `＋` no leitor para abrir outro PDF local. A biblioteca inicial usa os PDFs de Cálculo I.
- **Formulário** recolhe a segunda referência quando precisar de mais espaço.
- Arraste a divisória entre os PDFs e a conversa para ajustar a largura.
- **Conectar ao Pi** inicia/retoma a sessão própria da mesa, usando a configuração e as credenciais já existentes.
- A mesa conecta ao Pi sozinha ao abrir e ao trocar de matéria pelas **abas de matérias no topo** (⌘1…⌘9 pula para uma aba, ⌘Tab alterna, ⌘T abre as Configurações para criar matéria). O seletor ao lado de **＋** reabre conversas anteriores da matéria atual. **Como usar** (⌘ /) lista o fluxo e os atalhos.
- Digite uma pergunta e envie com **⌘ Enter**. O seletor “Incluir referências” acrescenta caminhos e páginas abertos como contexto. Os conteúdos não são enviados em toda pergunta: Pi consulta os arquivos quando necessário.
- Gráficos e diagramas que o Pi gera na área de aprendizado aparecem embutidos na conversa; clique para ampliar ou abrir no Preview.
- A ferramenta de quiz do Pi aparece como cartão na conversa: clique na resposta (ou marque várias e envie). A correção, a resposta certa e a explicação saem logo abaixo do cartão.
- O **diário do turno** mostra o que o Pi está fazendo: pensamento (prévia curta ao vivo; texto completo ao expandir), buscas na web com a consulta e os links, consultas a referências e outras ferramentas viram passos. Enquanto trabalha, o diário fica aberto; ao terminar, recolhe numa linha — `Trabalhou por 41s · 1 busca` (ou `Você parou após Xs`) — clicável para revisar cada passo. Conversas antigas reabrem com o diário recolhido.
- Selecione um trecho da conversa (inclusive fórmulas) ou do texto de um PDF e clique em **Citar** para perguntar sobre aquilo. O trecho entra no campo de mensagem como citação Markdown, com as equações em LaTeX; trechos de PDF citam com o nome do arquivo e a página.
- Anexe imagens ao prompt pelo botão **Anexar**, colando (⌘V em qualquer ponto da mesa) ou arrastando para o chat. A miniatura fica acima do campo e pode ser removida antes do envio. Modelos sem visão recusam o anexo. A página atual de um PDF vai como imagem com o botão de câmera no título do leitor. Anexos acima de 1568 px por lado são reduzidos na hora, antes de entrar na fila (o GIF é enviado como veio).
- Identifique a lista/questão ativa no topo da conversa e, se quiser, associe o `.xopp`. Matéria, exercício e referências que serão enviados aparecem antes do campo de mensagem e ficam ligados àquela sessão.
- **Encerrar por hoje** registra na conversa onde você parou e o próximo passo, para a retomada ficar no JSONL do Pi.
- **Conferir Xournal++** (⌘⇧C) captura a janela do Xournal++ e anexa a imagem na bandeja de anexos — nada vai sozinho para o Pi: escreva sua mensagem e envie junto (uma imagem por captura). O texto digitado quando você chama o comando vira o rascunho da mensagem. A mesa verifica permissão e janela ao capturar; o modelo precisa aceitar imagens no envio. **Esc** interrompe a resposta.
- **←** e **→** levam à página anterior ou seguinte do PDF focado. Roda e trackpad percorrem continuamente todas as páginas, sem saltos. Pinça ou ⌘ + roda do mouse faz zoom; a posição de scroll é lembrada.
- A busca do PDF varre todas as páginas, destaca as ocorrências no texto e mostra um contador (`3/7`); clicar em **Buscar** de novo salta para a ocorrência seguinte, em ciclo. **⌘F** foca a busca do painel ativo; **Esc** limpa os destaques.
- **⌘\** recolhe ou mostra o chat para dar tela aos leitores (o botão **‹ chat**, fixo no canto, devolve).
- Blocos de código nas respostas têm o botão **cópia** no canto para levar só o código para a área de transferência.
- No tema escuro, o botão de contraste na barra do leitor (ou **⌘⇧I**) inverte as cores da página; a escolha fica guardada por documento.
- **Exportar conversa** (seta ao lado de `＋`) salva a conversa como Markdown: por padrão na pasta `Mesa de Estudos` do vault, ou no destino escolhido na janela de salvar.
- Passe o mouse sobre uma mensagem e clique em **Copiar** para levar o texto original para a área de transferência.
- **Mesa → Tema** alterna auto (segue o sistema), claro e escuro; a escolha fica guardada com o restante do layout.
- Blocos de código no chat vêm com realce de sintaxe (JS/TS, Python, shell, JSON, SQL, HTML/CSS e outros) e a etiqueta da linguagem. O botão **cópia** leva o texto puro.
- O botão de seta no título de cada leitor **minimiza o PDF** (vira uma faixa de 38 px) e libera o espaço para o outro; a preferência fica guardada no layout.
- **Aba GeoGebra** no fim das abas: o applet completo da web (suite com gráficos, geometria e CAS), com **Print no chat** para anexar uma captura e **⌘⇧G** para pedir ao Pi uma conferência do applet (o modelo precisa aceitar imagens). Com a aba aberta, o Pi pode executar comandos, ler a construção e capturar o applet pela ferramenta `geogebra`. A construção é lembrada por matéria: a mesa captura um snapshot ao sair da aba e o restaura quando você volta. O carregamento do GeoGebra pede internet na primeira abertura.
- Digite **/compact** na mensagem para compactar o contexto da conversa (aceita instruções extras, ex.: `/compact foque na questão 7`). O medidor ao lado de **Pi** mostra quanto do contexto do modelo está em uso; passe o mouse para ver o consumido/total da conversa (atualiza também ao trocar de conversa no seletor). O botão **auto** ao lado do medidor liga e desliga a compactação automática do Pi. A versão da Mesa aparece no rodapé da ajuda (⌘/).
- Arraste a divisória acima da calculadora para redimensioná-la. **Mesa → Configurações** (⌘ ,) altera pastas, nomes das matérias e o caminho do Pi.
- **Parar** interrompe a resposta e limpa a fila. `＋` na conversa começa outra sessão, preservando o JSONL anterior.
- A calculadora aceita `+ - * / ^`, parênteses, `sqrt`, `sin`, `cos`, `tan`, `ln`, `log`, `exp`, `abs`, `pi` e `e`. Multiplicação é explícita: `2*pi`. RAD/GRAUS muda as funções trigonométricas. O histórico permite reutilizar expressões.

## Dados e integração

Fontes são abertas somente para leitura. O estado dos PDFs e a conversa ficam em `desk/.runtime/`. A sessão Pi é um JSONL próprio; não assume uma sessão já aberta no terminal. Para exibir gráficos no chat, a mesa lê imagens somente dentro da área de aprendizado em `.runtime`; caminhos fora dela são ignorados.

Para preservar os registros existentes, a mesa cria um contexto de curso em `.runtime/learning/Courses/Calculus I`, com links para as políticas, fontes e extensões reais do vault. Os novos espelhos temporários ficam nessa área, e a limpeza normal do overlay não atinge as sessões antigas do curso. Mudanças nas políticas reais continuam sendo lidas.

O aplicativo usa Pi em RPC. Preferências de modelo e credenciais permanecem no Pi. Diálogos de extensões (seleção, confirmação, entrada e editor) são apresentados na mesa. Customizações exclusivas do terminal, como cabeçalhos TUI, não são renderizadas pelo RPC.

A imagem capturada é enviada ao provedor configurado no Pi e pode persistir no JSONL. A captura inclui apenas a área visível da janela do Xournal++, sem páginas fora de vista. O macOS pode pedir permissão de Gravação de Tela para o processo que hospeda o aplicativo; a permissão do terminal/Codex não é automaticamente compartilhada. O macOS associa essa permissão à assinatura do app: assine o `.app` com um certificado do Keychain (o `install-app` usa um quando existe) para não reconceder a cada atualização — detalhes em [`SETUP.md`](SETUP.md). No Windows não há permissão a conceder: a captura sai do retângulo da janela pelo PowerShell do próprio sistema. Imagens anexadas ao prompt seguem o mesmo caminho: vão ao provedor e ficam na sessão. A Mesa reduz cada anexo a no máximo 1568 px por lado já no anexo (PNG mantém transparência, JPEG mantém o tipo) e depois aplica os limites de envio (8 MB por anexo, 28 MB somando os anexos; GIF não é re-codificado para não perder animação).

Erros e diagnósticos ficam em `.runtime/desk.log` (JSON por linha, com rotação para `desk.log.1` acima de 256 KB): exceções do processo principal, `stderr` do Pi, encerramentos de processos e erros do renderer chegam lá. Se a interface ficar presa em "Pi está pensando…" sem stream ativo por mais de um minuto, o ping de saúde destrava sozinho e avisa com um toast.

O snapshot do GeoGebra por matéria não fica mais em `desk.json`: a mesa grava `.runtime/ggb/<matéria>.b64` e o `desk.json` continua pequeno.

Não há sincronização com serviço próprio, telemetria do aplicativo, edição de PDFs ou captura contínua. A voz pode ser usada através de ditado do macOS; não há um novo sistema de voz embutido.

## Desenvolvimento

Requer Node 20+. No Mac do autor o vault e o Pi já existentes são detectados. Em outro computador, veja [`SETUP.md`](SETUP.md).

```sh
npm ci
npm run setup
npm run doctor
npm start
npm test
node tests/ui-smoke.mjs
npm run test:pi
npm run install-app
```

`npm test` roda antes o `npm run check` (sintaxe de todos os `.cjs`/`.mjs` da raiz, `src/` e `tests/`), o `build:bend`, o `test:proof` (as leis do núcleo) e o `test:parity`. O `test:parity` roda cada `tests/*-parity.mjs` — a lógica antiga de cada área contra o núcleo Bend, Node puro e sem Electron; a lista vem da varredura, então um verificador novo entra sozinho (a `framing` leva ~7 s pelo caso de 12 MB, o resto fica abaixo de 0,3 s). `npm run test:pi` é opt-in: fala com o binário real do Pi em modo RPC (sessão descartável em `/tmp`) e valida só os formatos das respostas `get_state`, `get_session_stats` e `get_commands`, sem chamada de modelo; sem o Pi, o script sai com "pi não encontrado; contrato ignorado".

`tests/helpers.mjs` concentra o boot dos smokes de UI (runtime temporário pré-escrito, `fake-pi`, lançamento do Electron, espera de toast/busy e o teardown). Qualquer falha de assert copia o runtime do teste (desk.json, sessões, `desk.log`, `ggb-bridge.json`, `ggb/`) e um print por janela aberta para `tests/artifacts/<data>-<bloco>/` antes de falhar; no sucesso os temporários são apagados como antes. O smoke aceita `FAKE_PI_CHAOS` (modos combináveis por vírgula): `stream-abort` (o Pi morre no meio do stream), `desk-error` (evento de erro no meio do stream) e `rpc-timeout` (uma resposta de `get_state` atrasada além do timeout do ping; o atraso aceita `FAKE_PI_TIMEOUT_MS`, default 30 s, mínimo 21 s) — o smoke de UI tem um bloco CHAOS que verifica a recuperação de cada um. `npm run test:ui:x3` roda o smoke três vezes seguidas e para no primeiro fracasso. `npm run test:watchdog` é opt-in e lento (~2 min): valida o destravamento do watchdog com timing real, sem knob. `npm run test:coverage` liga a cobertura nativa do `node --test`. `npm run test:sessions` é opt-in e usa o Pi real: troca de conversa antiga e confere que o medidor/tooltip acompanham. `npm run test:app` é opt-in: faz o sanity dos arquivos-chave do bundle instalado e roda o mesmo smoke apontando `DESK_ELECTRON_BIN` para o executável dele; sem bundle, sai com "instale primeiro: npm run install-app", e com bundle mais velho que o código, avisa e pede `npm run install-app`.

Os smokes de UI (e qualquer `launchDesk`) sobem o Electron em **modo de teste** (`DESK_TEST=1`, definido em `tests/electron-env.mjs`): janela `show: false`, sem ícone na Dock do macOS e sem instância única. A suíte roda com o app aberto e o Mac em uso, sem roubo de foco nem janela piscando; fora dos testes nada muda.

O código do renderer fica em `desk/src/` (`state`, `chat`, `pdf`, `ggb`, `main`); `renderer.mjs` é só o ponto de entrada que importa os módulos.

`tests/live-pi.mjs` consulta o provedor real e requer o documento visual de teste com identificador 7319 aberto no Xournal++. Use-o apenas com esse documento de teste. O script usa registros isolados.

Variáveis de desenvolvimento: `LEARNING_VAULT`, `LEARNING_DESK_RUNTIME`, `LEARNING_DESK_PI`. As matérias vêm do vault (`Courses/*/_state.md`) e/ou da lista em Configurações (pasta de PDFs, com ou sem `_state.md`). A troca de aba troca fontes e contexto; cada matéria preserva suas páginas, rascunho e sessão.

## Modelo, esforço e matérias

Conectar inicia/retoma um processo Pi em RPC para a matéria ativa, usando credenciais existentes. Não assume a sessão de um terminal aberto. Os seletores Modelo e Esforço são habilitados após conectar; os modelos vêm do catálogo disponível do Pi e os esforços vêm das capacidades de cada modelo. Alterações usam os comandos oficiais do Pi e podem atualizar suas preferências do Pi, conforme o comportamento normal dele. Modelos sem visão não habilitam o botão de conferência visual.

As abas no topo mostram Cálculo I, Matemática Discreta, Física I e as outras pastas de curso configuradas. A biblioteca combina Sources e source_roots sem duplicar o mesmo arquivo. Contexto e registros próprios de cada matéria são mantidos na área da mesa; as fontes originais continuam somente leitura. Trocas são bloqueadas durante uma resposta.

A ajuda Como usar explica a calculadora numérica local. Ela não usa o modelo, não consome tokens e não realiza álgebra simbólica.
