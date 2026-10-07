# Configurações, descoberta de recursos e chat lateral

Implementação solicitada em 2026-10-05, com subagentes OpenCode usando
`opencode-go/deepseek-v4.1-flash`, variante `max` e `full-access`.

**Estado: implementação e validação local concluídas.**
As revisões reproduziram e corrigiram problemas de ordem/aceite de mensagens,
rascunho perdido no reload imediato, incerteza omitida na retomada Claude,
envio lateral enquanto ocupado e confirmações tardias após interrupção.
O layout agora mede o espaço real da coluna, reduz o corpo rolável de Ajustes
e permite rolar o chat quando nem esse espaço basta. O teste sintético de
calculadora/anexos, a suíte geral (708 testes) e o smoke legado (17 blocos)
passaram novamente pelo coordenador. As abas de apoio receberam navegação por setas,
Home e End. Este registro não representa uma release, instalação ou teste
com provedores autenticados.

## Comportamento implementado

- Ícone Windows: ICO de 16 a 256 px, ícone da janela, AppUserModelId e detalhes
  de ícone/reabertura da barra de tarefas. Revisão estática concluída;
  **Windows real ainda não foi validado**.
- Configurações: nome da mesa, Encerrar por hoje/retomada, Lista/questão e
  rascunho `.xopp` juntos, calculadora, Xournal++, Conferir e referências.
  Desativar preserva os dados; o estudo desativado sai dos próximos envios,
  inclusive do nome de exercício associado a uma captura anterior.
- Layout: um ou dois leitores, nomes, termos de preferência do PDF inicial,
  nome do botão do segundo leitor e prévia. Cancelar descarta as edições.
  Campos vazios herdam os defaults normalizados.
- Abas visíveis para reabrir Formulário ou Chat lateral, mantendo a área de
  apoio acessível depois de recolher. O lateral pode abrir com um leitor.
- Chat lateral: sessão, mensagens, rascunho, envio, cancelamento e pedidos
  interativos próprios. Usa o mesmo motor do principal, sem fallback de
  Claude para Pi. Criação copia PDF/página, estudo e até 12 trechos recentes
  do principal, de até 800 caracteres cada; não é um resumo de todo o histórico.
  Retomar mantém essa cópia; Atualizar contexto renova explicitamente.
  Levar ao principal acrescenta texto ao rascunho e não envia.
- Histórico lateral em `runtime/sidechats/`, por matéria e conversa principal.
  Recuperação de entrega incerta não dispara reenvio automático. Novo mantém
  o registro anterior no disco.
- Lista de conversas com título/data/trecho/motor, detalhes das referências,
  Sumário e favoritos, acesso ao Caderno com contagem, Exportar e controles de
  resumo com explicação das capacidades do motor.
- Tema Sistema/Claro/Escuro nas configurações; aviso de atualização
  persistente durante a abertura e clicável para o Sobre.

## Verificação concluída pelo coordenador

Todos os testes Electron abaixo usaram runtimes e materiais artificiais;
Pi e Claude foram simulados. Nenhum app instalado foi aberto ou atualizado.

| Verificação | Resultado |
|---|---|
| `node --test tests/sidechat*.test.mjs` | 41 testes passaram, incluindo retomada incerta e aceites/rejeições tardios |
| `node tests/settings-resources-ui.mjs` | cancelar/salvar/reabrir/reativar, dados preservados e aviso de atualização passaram |
| `node tests/sidechat-ipc-smoke.mjs` | 24 checks passaram, incluindo referência PDF/página e recuperação no segundo launch |
| `node tests/pi-prompt-capture-ipc-smoke.mjs` | 12 checks passaram, incluindo imagem/horário e estudo desativado |
| `node tests/menu-conferir-ipc-smoke.mjs` | 7 checks passaram, incluindo mudança de configuração no menu nativo |
| `node tests/sidechat-claude-ipc-smoke.mjs` | 43 checks passaram, incluindo retomada incerta após fechar com um turno aceito em andamento |
| `node tests/sidechat-draft-reload.mjs` | 2 blocos passaram: reload imediato, envio, migração, confirmação antiga e campo vazio |
| `node tests/sidechat-ui-races.mjs` | passou: aceite tardio, duplo clique, recusa/incerteza, streaming, ferramentas, escopo e Novo |
| `node tests/ui-smoke.mjs` | 17 blocos passaram: PDFs, calculadora, anexos, configurações, falhas/retomada e updater |
| `node tests/responsive-chat-calc-ui.mjs` | passou: coluna 1480×840, calculadora grande, anexos, retomada e rolagem sem sobreposição |
| `node tests/responsive-ui.mjs` | passou: 900×650 com um/dois leitores, lateral, Ajustes e Encerrar ligado/desligado |
| `node tests/sidechat-ui.mjs` | 4 blocos passaram: leitores, histórico/rascunho/LaTeX, parar e responder perguntas |
| `node tests/claude-ui-smoke.mjs` | passou: principal Claude, permissões, fila, cancelamento, retomada e exportação nativa |
| `npm test` | 708 testes passaram na execução integrada final do coordenador |
| `node tests/syntax-check.mjs` | sintaxe passou em 196 arquivos |
| `npm run verify:bend` | provas passaram; 67 artefatos reproduzíveis, nenhum byte alterado |
| navegação das abas no Electron | setas, Home, End e foco único por Tab passaram |

As capturas de 900×650 foram inspecionadas em claro e escuro, com os controles
acessíveis. A regressão inicial do smoke (calculadora coberta pelo composer)
foi corrigida. O teste novo confere geometria, o elemento sob o clique e cliques
reais na calculadora, além de anexos/retomada, retorno ao modo normal,
estabilidade e leitura/rolagem da resposta.

## Limites

Em colunas extremas (calculadora grande com anexos), o chat usa rolagem da
coluna: lê-se voltando para cima e envia-se no fim. O corpo de Ajustes pode
encolher e exigir rolagem interna.

Ainda precisam de validação real: ícone da janela/barra de tarefas no Windows,
provedores autenticados e captura do Xournal++. SDK simulado, trap de binário
e testes de IPC comprovam o contrato local, não esses cenários reais.

O aviso automático usa o cache existente de atualização por 24 h. Depois
desse prazo, uma abertura offline pode não repetir uma atualização conhecida;
o botão manual continua informando a falha de consulta. Não houve mudança
na transação de aplicação/rollback do updater.

Configurações, sessões e materiais reais não foram editados. Os defaults do
autor e a integração Claude experimental preexistente foram preservados.
Mudanças compartilhadas do núcleo regeneram o artefato de Ajustes da Conversa;
nenhum recurso lateral foi acrescentado ao app irmão.

Auditoria final: 633 arquivos da linha de base, nenhum ausente; 30 alterados
pelo escopo desta implementação. `git diff --check` passou. Arquivos novos
e alterações permanecem locais, sem commit, push, release ou instalação.
