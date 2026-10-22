# Ajustes do tutor — 08/10/2026

Modelo e Esforço permanecem visíveis. O gerenciamento de contexto fica em uma seção recolhível, fechada inicialmente. A antiga explicação sem controle associado e o botão `auto` isolado foram substituídos por um rótulo junto do estado Ativado/Desativado e uma ação manual Resumir agora. O histórico salvo é preservado. O botão vivo continua usando o handler e o estado do núcleo; não muda defaults do autor nem configurações pessoais.

A biblioteca de conversas permanece no diálogo com busca, assunto, favoritos, prévia e retomada com rascunho por conversa. A busca ocupa uma linha inteira; filtros de matéria/assunto têm mais espaço e Só favoritas fica alinhado ao checkbox.

Validação local:

- `npm test`: 1.071 testes passaram; sintaxe de 287 arquivos; build, provas e seis verificadores de paridade aprovados. A primeira tentativa encontrou um arquivo Bend em edição concorrente; a rodada completa subsequente passou, sem editar esse arquivo.
- `node docs/reviews/2026-10-07/ajustes-ui/reproduce.mjs`: campos principais visíveis, contexto recolhido, estado sincronizado após ligar/desligar, resumo manual sem mensagem extra e controles acessíveis em 900×650. Capturas do painel inteiro e do elemento real.
- `node tests/claude-ui-smoke.mjs`: controles indisponíveis respeitados, descriptor/cache/resume/entrega preservados, zero fallback para Pi.
- `node tests/chat-library-ui.mjs`: conversa de um ano, título, assunto, favorito, busca, retomada, rascunhos por conversa, reabertura e 900×650 passaram.
- `node tests/responsive-chat-calc-ui.mjs`: calculadora, envio, anexos, retomada, histórico longo e rolagem adaptativa passaram em 1480×840. O teste foi atualizado para respeitar o scroller ativo e alcançar controles por rolagem; as verificações de geometria, cliques reais, resposta e ResizeObserver permanecem.

Dados e provedores sintéticos. Nenhuma instalação, publicação, credencial ou material pessoal alterado. O total da suíte inclui trabalho concorrente no checkout e não representa apenas mudanças deste painel.
