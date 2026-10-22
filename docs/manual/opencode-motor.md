# Roteiro manual: o motor OpenCode com modelo de verdade (#57)

Os testes automáticos da #57 nunca chamam modelo: o `opencode serve` é o
`desk/tests/fake-opencode.mjs`. Este roteiro é a prova que falta, com o
OpenCode instalado e um modelo grátis do Zen. **Ele gasta a cota de quem o
roda.** Use material seu, nunca de curso alheio, e não anexe nada pessoal:
os modelos grátis podem guardar o que recebem (veja a política no seletor).

## Antes

1. Instale o OpenCode (`~/.opencode/bin/opencode`) e confira `opencode
   --version`. A Mesa foi medida no 2.0.32.
2. Se quiser os modelos que pedem conta, guarde a chave pela Mesa
   (Configurações → Pastas e programas → Modelos gratuitos). Para provar o
   item 1 abaixo, comece **sem** chave.
3. Abra a Mesa numa matéria com um PDF de exercícios seu.

## O que provar (anote data, versão do OpenCode e modelo)

| # | Passo | Passa quando |
|---|---|---|
| 1 | Sem chave guardada: **Sessão nova com OpenCode** e mande "Oi". | O seletor lista os grátis primeiro, com **Grátis** e a política, e o tutor responde. Se aparecer "O OpenCode Zen recusou o modelo grátis nesta sessão (403)", veja a seção do 403 abaixo. |
| 2 | Escolha um modelo grátis com variantes e troque o esforço. | O esforço muda sem erro; a próxima resposta sai do modelo escolhido (o rodapé da resposta ou o log do OpenCode diz o modelo). |
| 3 | Peça: "Construa no GeoGebra a parábola y = x² e me mostre." | A aba GeoGebra abre sozinha e a figura aparece. No `desk.log`, nenhum aviso `OPENCODE_MCP_FAILED`. |
| 4 | Peça: "Mostre numa visualização o gráfico de y = x² de −3 a 3." | O quadro aparece **no balão da ferramenta**. Se aparecer solto com um aviso `atividade sem tool.called no prazo` no `desk.log`, anote: a ordem SSE × MCP é diferente da esperada. |
| 5 | Mande uma mensagem e, enquanto o tutor responde, mande outra com ⌘⏎. | A segunda entra no turno em curso (steer), sem duplicar. |
| 6 | Digite `/` no campo. | Aparecem os comandos do servidor. Escolha um e confira que roda. |
| 7 | Mais opções → Resumir contexto. | A compactação termina e o medidor de contexto cai. |
| 8 | Anexe uma foto de caderno sua e peça: "Leia o que está escrito." | O modelo descreve a imagem, ou diz que o modelo não vê imagens (anote qual). |
| 9 | Peça: "Apague o arquivo notas.txt desta pasta." | O tutor recusa ou a Mesa nega (permissão `edit`/`shell` negada). Nada é apagado. |
| 10 | Feche a Mesa com o tutor respondendo e abra de novo. | Nenhum `opencode serve` órfão (`ps aux \| grep "opencode serve"`); a mensagem em voo aparece como incerta, sem reenvio. |
| 11 | Abra a Mesa empacotada (`Mesa de Estudos.app`) e repita o passo 3. | O MCP `mesa` sobe pelo Node do Electron (`ELECTRON_RUN_AS_NODE`). |

## O 403 do grátis e o id da sessão (2026-10-20, OpenCode 2.0.32)

Até esta correção, uma sessão OpenCode com um grátis do Zen
(`opencode/deepseek-v4.1-flash-free`, `opencode/minimax-m3.1-flash-free`)
aceitava a mensagem e não respondia: o SSE trazia `session.step.failed` e
`session.execution.failed` com `provider.auth`, status 403, corpo
`FreeTierError`, e a Mesa só fechava o turno com erro, sem mostrar nada.

**Causa.** O Zen recusa o grátis quando o id da sessão não saiu do gerador do
próprio OpenCode (`ses_` com prefixo de tempo em hex). A Mesa cunhava o seu
(`ses_` + base64url) e o mandava no `POST /api/session`. Prova, no mesmo
`opencode serve`, com os mesmos cabeçalhos e o mesmo corpo: sem `id` (o
servidor cunha) responde; com o id da Mesa, 403; e o próprio
`opencode run --session <id da Mesa>` também leva 403. Detalhe em
`docs/reviews/opencode-free-tier-resultado.md`.

**O que mudou.**

- A Mesa não cunha mais o `ses_`. O descritor `opencode-<uuid>.json` nasce com
  `nativeSessionId: null`; na primeira ligação o adaptador cria a sessão sem
  `id`, adota o `ses_` que o servidor devolve e o descritor o grava uma vez
  (`desk/src/agents/native-identity.cjs`). Depois ele é imutável, e reabrir
  ou trocar de servidor manda esse id, como antes.
- Turno que falha no provedor vira um aviso na conversa (diário do turno e
  aviso rápido) com a frase do provedor, sem derrubar a conexão. O 403 do
  grátis tem frase própria: "O OpenCode Zen recusou o modelo grátis nesta
  sessão (403). Comece uma sessão nova do OpenCode ou escolha um modelo da sua
  conta."
- **Conversas OpenCode criadas antes desta versão** guardam o id antigo e
  seguem com 403 nos grátis: comece uma sessão nova com OpenCode.

## Depois

Copie a tabela para `docs/reviews/issue-57-resultado.md`, na seção "Prova com
modelo real", com o resultado de cada passo. Um passo reprovado vira issue com
o trecho do `desk.log` (sem chave, sem conteúdo de curso).
