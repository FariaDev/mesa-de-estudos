# Aba Livre e rotação de PDF

Implementação solicitada em 2026-10-06; validação final retomada em 2026-10-07.
As configurações, o chat lateral e as melhorias de descoberta anteriores estão
documentados em [STATUS-MESA-CONFIG-LATERAL-2026-10-05.md](STATUS-MESA-CONFIG-LATERAL-2026-10-05.md).

## Comportamento entregue

- Aba Livre disponível sem cadastrar matéria. Cada conversa tem título,
  histórico, rascunho, materiais e estado dos leitores próprios.
- Abrir PDF importa uma cópia para a sessão e abre o primeiro leitor.
- PDF pelo tutor oferece a ferramenta nativa no tutor principal (Pi e Claude)
  para preencher título e conteúdo na prévia. O usuário revisa e confirma
  Salvar PDF e abrir; só então o Electron produz o arquivo. O conteúdo preparado
  persiste na sessão e pode ser retomado por Revisar e salvar PDF.
- Montar PDF oferece edição manual e prévia de Markdown/LaTeX.
- Criar matéria transfere a conversa e seus materiais, preserva destinos
  existentes e reconecta o motor no contexto da nova matéria. Retomar a sessão
  antiga em Livre redireciona para a matéria criada.
- Diário de promoção recupera gravações interrompidas; testes cobrem rollback,
  recuperação após commit e preservação dos dados externos.
- Livre usa a pasta da própria sessão, desliga a descoberta de arquivos de
  contexto ancestrais e exclui `context-mode`, `learning-session`,
  `code-study-guard` e `anki-cards` do perfil Pi. Nas matérias, o perfil de estudo
  permanece disponível. A guarda de acesso e o MCP continuam no perfil Livre.
- Girar PDF alterna 0/90/180/270 graus, soma à orientação nativa e guarda a
  escolha por documento/leitor, com restauração ao retomar a matéria ou sessão.
- Trocar de sessão fecha os diálogos Livre; resultados atrasados não atualizam
  a conversa seguinte. Criar matéria também atualiza o escopo do chat lateral.

## Evidências locais

`env -u ELECTRON_RUN_AS_NODE MESA_GATE_CACHE=0 npm test` concluiu com
**756 testes passando, zero falhas e zero skips**, incluindo o portão de sintaxe,
build, provas e paridade sem cache. `git diff --check` também passou.
Log desta execução: `/tmp/mesa-final-20261007-tests.log`.

O teste integrado foi executado novamente em 2026-10-07 com interface,
preload, IPC, armazenamento e impressão PDF reais. O Pi foi simulado, o seletor
nativo foi respondido pelo teste e todos os arquivos/runtime eram artificiais.

`node tests/free-study-integration-ui.mjs` passou: isolamento A/B, histórico e
rascunho, leitura autorizada por sessão, reabertura, rotação, importação, prévia
LaTeX, PDF gerado, cancelamentos, colisão de pasta, promoção, reconexão e retorno
ao registro promovido. O teste também confere os argumentos reais de lançamento
para Livre e para a matéria criada; não executa o carregador real do Pi.
Log desta execução: `/tmp/mesa-final-20261007-integration.log`.

Na rodada de 2026-10-06, `free-study-ui.mjs`, `pdf-rotation.mjs`,
`responsive-ui.mjs` e os 17 blocos de `ui-smoke.mjs` passaram. Os logs finais
dessas execuções permanecem em `/tmp/mesa-pi-handoff-20261006/`.

## Limites da entrega

Não há evidência de uso com provedor autenticado nesta validação. O ícone da
barra de tarefas ainda requer conferência em Windows real. Esta entrega é do
checkout de desenvolvimento; não representa publicação ou atualização do app
instalado.
