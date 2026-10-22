# Roteiro manual: qual modelo grátis serve de padrão (#44)

A Mesa escolhe sozinha, ao guardar a chave, o primeiro modelo de
`desk/free-models.json` que tem `"recommended": true` **e** retenção zero
(`"policy": "zero"`) e que o Pi oferece no momento. A ordem que está lá hoje é
**provisória** (`"recommendedVerified": false`): ninguém rodou este roteiro. Ele
existe para trocar o palpite por medida.

**Este roteiro gasta a chave de quem o roda** (cota dos modelos grátis, e a
conta fica ligada ao OpenCode). Por isso a #44 não o executou: a regra daquele
trabalho era nenhuma chamada de modelo, nem grátis. Rode à mão, uma vez por
modelo de retenção zero, com a chave guardada pela Mesa (Configurações → Pastas
e programas → Modelos gratuitos).

## Antes

1. Confira em <https://opencode.ai/docs/zen/> quais modelos grátis ainda existem
   e a política de dados de cada um. Atualize `free-models.json` (`checkedAt`,
   `models`) se algo mudou.
2. Abra a Mesa, escolha uma matéria com um PDF de exercícios qualquer (material
   seu, nunca de curso alheio) e ligue o tutor.
3. No seletor do tutor, escolha o modelo a testar. Ele precisa estar marcado
   **Grátis** e **Não guarda nem treina**. Pule os outros.

## As 4 tarefas fixas (as mesmas para todo modelo)

| # | Tarefa | Passa quando |
|---|---|---|
| 1 | Peça: "Explique o limite de (sen x)/x quando x → 0, com a fórmula em LaTeX." | A resposta usa LaTeX que a Mesa desenha (a fórmula aparece formatada, sem `$` soltos) e o raciocínio está certo. |
| 2 | Peça: "Crie uma lista de estudo em PDF com 4 questões sobre limites." (a ferramenta `criar_pdf`, modelo Lista) | O PDF é criado com 4 questões numeradas e abre no leitor. |
| 3 | Peça: "Mostre numa visualização o gráfico de y = x² de −3 a 3." (a ferramenta `criar_atividade`, visualização com `charts:true`) | A visualização aparece no chat com o gráfico. |
| 4 | Anexe uma foto de caderno (a sua) e peça: "Leia o que está escrito." | O modelo descreve o conteúdo da imagem; se disser que não vê imagens, reprova. |

Cada tarefa vale uma tentativa, sem repetir o pedido. Falha de ferramenta
(o modelo não chamou `criar_pdf`/`criar_atividade`, ou chamou com argumento
inválido) reprova a tarefa.

## Depois

1. Anote na tabela abaixo, com a data, o resultado de cada modelo.
2. Para cada modelo que passou nas **4** tarefas, ponha
   `"recommended": true` em `desk/free-models.json`, na ordem em que você o
   preferiria como padrão (melhor primeiro), e tire de quem falhou. Só entra
   quem tem `"policy": "zero"` (a Mesa recusa outro caso: há teste).
3. Troque `"recommendedVerified"` para `true`, ponha a data em `"checkedAt"` e
   ajuste o `note` do arquivo.
4. Rode `node --test tests/opencode-host.test.mjs` em `desk/`.

## Resultados

| Data | Modelo | 1 LaTeX | 2 `criar_pdf` | 3 `criar_atividade` | 4 foto | Recomendado |
|---|---|---|---|---|---|---|
| — | ainda não rodado | | | | | |

A parte automatizável (o plano inteiro sem rede: botão → cartão → chave
detectada → teste → padrão grátis escolhido, com Pi falso no provedor
`opencode`) já está em `desk/tests/free-models-ui.mjs`; o que depende de um
modelo de verdade é só o que está acima.
