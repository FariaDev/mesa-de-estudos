# Roteiro manual: o Claude Code com as funções do Pi (#58)

Os testes automáticos da #58 nunca chamam modelo. O Agent SDK é a fixture
`desk/tests/fixtures/claude-sdk-fake.mjs`, que imita o SDK 0.3.301. Este
roteiro é a prova que falta, com o Claude Code instalado e logado na conta de
quem o roda. **Ele gasta a cota dessa conta.** Use material seu, nunca de
curso alheio, e não anexe nada pessoal.

## Antes

1. Confira que o Claude Code está na faixa aceita (Configurações → Sobre →
   Componentes). A #58 foi escrita contra o SDK 0.3.301.
2. Abra a Mesa numa matéria com um PDF de exercícios seu e comece
   **Sessão nova com Claude Code**.

## O que provar (anote data, versão do Claude Code e modelo)

| # | Passo | Passa quando |
|---|---|---|
| 1 | Mande "Oi" e espere a resposta. | O medidor de contexto aparece no rodapé, e o balão cita a janela do modelo (por exemplo, 200 mil). |
| 2 | Peça uma explicação longa e, enquanto o tutor responde, escreva "responda em uma frase" e aperte ⌘⏎ (Ctrl+⏎ no Windows). | A segunda mensagem entra no turno em curso. A resposta muda de rumo, sem uma segunda resposta e sem o aviso de envio incerto. No `desk.log`, nenhum `CLAUDE_DELIVERY_UNCERTAIN`. Este é o ponto que a fixture não prova: o CLI real ecoar o item de `priority: 'now'`. |
| 3 | Digite `/` no campo. | Aparecem os comandos do Claude Code (embutidos, skills e plugins). Escolha um que não mexa em arquivos, como um comando de ajuda, e confira que roda e o turno termina. |
| 4 | Com o tutor parado, digite `/compact mantenha as fórmulas` e envie. | O aviso "Contexto compactado" aparece, o medidor some até a próxima resposta e volta menor. O resumo respeita a instrução. |
| 5 | Mande `/compact` de novo logo em seguida. | Termina com sucesso ou com a recusa do Claude Code numa frase. Nunca fica preso em "Compactando…". |
| 6 | Na resposta do passo 1, clique **Guardar para revisar**. | Os campos chegam preenchidos ("Sugestão do tutor pronta") e a conversa principal não ganha mensagem nova. Nenhuma sessão nova aparece em `~/.claude/projects` para a pasta `.review-draft-*`. |
| 7 | Peça: "Faça um quiz de três perguntas sobre este exercício." | A atividade aparece no balão da ferramenta (`mcp__mesa__criar_atividade`). |
| 8 | Converse até o medidor passar de uns 80% ou peça uma tarefa bem longa. | Se o Claude Code compactar sozinho, aparece o aviso de compactação e o medidor some até a próxima resposta. O botão de compactação automática continua escondido, porque a Mesa não liga nem desliga a automática do CLI. |
| 9 | Abra o seletor de modelo numa sessão OpenCode e na faixa de esforço olhe o nível padrão. | Diz "Padrão do OpenCode". Numa sessão Claude, diz "Padrão do Claude". |
| 10 | No seletor do OpenCode, com o VoiceOver ligado, ande pelas linhas com ↑↓ e aperte ⌘D. | O VoiceOver lê se a linha é favorita e anuncia "… nos favoritos" ou "… fora dos favoritos". |

## Depois

Copie a tabela para `docs/reviews/issue-58-resultado.md`, na seção "Prova com
modelo real", com o resultado de cada passo. Um passo reprovado vira issue com
o trecho do `desk.log` (sem chave, sem conteúdo de curso).
