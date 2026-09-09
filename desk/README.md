# Mesa de Estudos

Aplicativo local de apoio ao Xournal++: dois PDFs independentes, calculadora e Pi na mesma janela. O Xournal++ continua separado, como editor de escrita. No Windows os PDFs, a calculadora e o Pi funcionam; Conferir Xournal++ é só macOS.

Definição fechada em 2026-09-06: mesa de referências + Xournal++, não um canvas de tinta dentro do app. Ver [`../docs/START-HERE.md`](../docs/START-HERE.md) e [`../docs/DECISIONS.md`](../docs/DECISIONS.md).

## Uso

Abra **Mesa de Estudos.app**. Arraste a mesa para a tela de referências e mantenha o Xournal++ na outra tela.

- **Enunciado** e **Formulário & apoio** têm arquivo, página, zoom e busca independentes.
- Use `＋` no leitor para abrir outro PDF local. A biblioteca inicial usa os PDFs de Cálculo I.
- **Formulário** recolhe a segunda referência quando precisar de mais espaço.
- Arraste a divisória entre os PDFs e a conversa para ajustar a largura.
- **Conectar ao Pi** inicia/retoma a sessão própria da mesa, usando a configuração e as credenciais já existentes.
- A mesa conecta ao Pi sozinha ao abrir e ao trocar de matéria. O seletor ao lado de **＋** reabre conversas anteriores da matéria atual. **Como usar** (⌘ /) lista o fluxo e os atalhos.
- Digite uma pergunta e envie com **⌘ Enter**. O seletor “Incluir referências” acrescenta caminhos e páginas abertos como contexto. Os conteúdos não são enviados em toda pergunta: Pi consulta os arquivos quando necessário.
- **Conferir Xournal++** (⌘⇧C) usa a integração visual sob demanda. O texto digitado pode especificar o que conferir. A mesa verifica permissão, janela do Xournal++ e modelo com visão antes de enviar; a bolha mostra a captura, não o comando `/conferir`. **Esc** interrompe a resposta.
- **←** e **→** mudam a página do PDF focado. Roda no fim da página avança; no topo, volta. Pinça ou ⌘ + roda do mouse faz zoom; a posição de scroll é lembrada.
- Arraste a divisória acima da calculadora para redimensioná-la. **Mesa → Configurações** (⌘ ,) altera pastas, nomes das matérias e o caminho do Pi.
- **Parar** interrompe a resposta e limpa a fila. `＋` na conversa começa outra sessão, preservando o JSONL anterior.
- A calculadora aceita `+ - * / ^`, parênteses, `sqrt`, `sin`, `cos`, `tan`, `ln`, `log`, `exp`, `abs`, `pi` e `e`. Multiplicação é explícita: `2*pi`. RAD/GRAUS muda as funções trigonométricas. O histórico permite reutilizar expressões.

## Dados e integração

Fontes são abertas somente para leitura. O estado dos PDFs e a conversa ficam em `desk/.runtime/`. A sessão Pi é um JSONL próprio; não assume uma sessão já aberta no terminal.

Para preservar os registros existentes, a mesa cria um contexto de curso em `.runtime/learning/Courses/Calculus I`, com links para as políticas, fontes e extensões reais do vault. Os novos espelhos temporários ficam nessa área, e a limpeza normal do overlay não atinge as sessões antigas do curso. Mudanças nas políticas reais continuam sendo lidas.

O aplicativo usa Pi em RPC. Preferências de modelo e credenciais permanecem no Pi. Diálogos de extensões (seleção, confirmação, entrada e editor) são apresentados na mesa. Customizações exclusivas do terminal, como cabeçalhos TUI, não são renderizadas pelo RPC.

A imagem capturada é enviada ao provedor configurado no Pi e pode persistir no JSONL. A captura inclui apenas a área visível da janela do Xournal++, sem páginas fora de vista. O macOS pode pedir permissão de Gravação de Tela para o processo que hospeda o aplicativo; a permissão do terminal/Codex não é automaticamente compartilhada.

Não há sincronização com serviço próprio, telemetria do aplicativo, edição de PDFs ou captura contínua. A voz pode ser usada através de ditado do macOS; não há um novo sistema de voz embutido.

## Desenvolvimento

Requer Node 20+. No Mac do autor o vault e o Pi já existentes são detectados. Em outro computador, veja [`SETUP.md`](SETUP.md).

```sh
npm ci
npm run setup
npm start
npm test
node tests/ui-smoke.mjs
npm run install-app
```

`tests/live-pi.mjs` consulta o provedor real e requer o documento visual de teste com identificador 7319 aberto no Xournal++. Use-o apenas com esse documento de teste. O script usa registros isolados.

Variáveis de desenvolvimento: `LEARNING_VAULT`, `LEARNING_DESK_RUNTIME`, `LEARNING_DESK_PI`. As matérias vêm do vault (`Courses/*/_state.md`) e/ou da lista em Configurações (pasta de PDFs, com ou sem `_state.md`). A seleção troca fontes e contexto; cada matéria preserva suas páginas, rascunho e sessão.

## Modelo, esforço e matérias

Conectar inicia/retoma um processo Pi em RPC para a matéria ativa, usando credenciais existentes. Não assume a sessão de um terminal aberto. Os seletores Modelo e Esforço são habilitados após conectar; os modelos vêm do catálogo disponível do Pi e os esforços vêm das capacidades de cada modelo. Alterações usam os comandos oficiais do Pi e podem atualizar suas preferências do Pi, conforme o comportamento normal dele. Modelos sem visão não habilitam o botão de conferência visual.

O seletor superior descobre Cálculo I, Matemática Discreta, Física I e as outras pastas de curso configuradas. A biblioteca combina Sources e source_roots sem duplicar o mesmo arquivo. Contexto e registros próprios de cada matéria são mantidos na área da mesa; as fontes originais continuam somente leitura. Trocas são bloqueadas durante uma resposta.

A ajuda Como usar explica a calculadora numérica local. Ela não usa o modelo, não consome tokens e não realiza álgebra simbólica.
