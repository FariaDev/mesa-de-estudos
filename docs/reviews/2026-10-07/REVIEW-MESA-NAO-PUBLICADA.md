# Review da Mesa ainda não publicada

**Atualização:** as sete issues abaixo foram corrigidas. Veja
[correções e validação](CORRECOES.md) e [capturas da UI](ui/galeria.html).
O restante deste documento preserva o diagnóstico original da revisão.

**Resultado: 7 issues confirmadas; corrigir a distribuição antes de publicar.**
CodeRabbit levantou 5 issues (1 major e 4 minor). A checagem complementar
identificou 2 issues adicionais de distribuição, descritas como R1 e R2 abaixo.
Não foram aplicadas correções de implementação nesta rodada.

## Escopo e método

- Base pública consultada ao vivo: release estável
  [v0.4.7](https://github.com/FariaDev/mesa-de-estudos/releases/tag/v0.4.7),
  publicada em 2026-10-02, commit `5354d89765e48df798339094086962eed1e68e1e`.
- Checkout de desenvolvimento: HEAD `9b84ddd40fe1f05d59dd4ac8f92f627dc5ff48e6`
  mais os arquivos locais, incluindo os novos ainda não rastreados.
- Snapshot isolado em `/tmp/mesa-unpublished-review-20261007-TwasL5/review`.
  O app e o núcleo foram comparados diretamente à release, sem alterar a
  branch, o index ou os arquivos de implementação do checkout original.
- Diff: 139 arquivos, 30.700 inserções e 457 remoções. CodeRabbit confirmou
  138 arquivos revisados; o único excluído foi o binário `desk/assets/mesa.ico`.
  Sua estrutura foi conferida separadamente: 7 imagens PNG de 16 a 256 px,
  entradas e offsets válidos. Isso não prova sua exibição no Windows.
- Incluídos: configurações, layout, identidade Windows, chat lateral, transporte
  Claude, rotação PDF, aba Livre, promoção, núcleo Bend, artefatos e testes.
  Os protótipos independentes `claude-mod/` e `codex-plugin/`, o app irmão
  `chat/`, docs de pesquisa, dados pessoais/runtime e dependências instaladas
  ficaram fora do diff enviado. Artefatos da Mesa que dependem da ausência de
  `chat/` foram considerados na análise de distribuição.
- CLI CodeRabbit 0.8.2, revisão `--agent --deep --fresh`, arquivos novos
  incluídos. A primeira execução falhou por falta de branch de base no clone
  destacado; a segunda usou `release-v0.4.7` e concluiu sem erro.

## Issues major

### R1 — P1: a atualização/instalação não entrega módulos exigidos no boot

Origem: checagem complementar. Código novo em `desk/main.cjs:7` e
`desk/material-pdf.cjs:37`; contratos de distribuição em
`desk/scripts/install-app.mjs:32` e `desk/updater.cjs:58`.

O main agora importa `./agents/conversations.cjs` e outros módulos dessa pasta
incondicionalmente, inclusive quando o usuário usa Pi. O instalador copia
somente `src`, `assets` e `templates`, além dos módulos da raiz. A política ZIP,
tanto da v0.4.7 quanto do código atual, também rejeita `desk/agents/*` e
`desk/materials/*`.

Ao instalar/atualizar, `main.cjs` é entregue sem suas dependências novas: o app
falha no boot com módulo ausente. Mesmo após resolver `agents`, a impressão de
PDF falha porque `materials/print.html` e o preload não viajam nesses fluxos.

**Evidência:** execução das funções reais `isReplaceable` da release e do
checkout, e inspeção das listas efetivas do instalador, registradas em
[packaging-evidence.json](packaging-evidence.json).

**Correção sugerida:** colocar os módulos e a página de impressão sob diretórios
já aceitos pela v0.4.7, como `desk/src/`, ajustando os imports; ou preparar uma
migração compatível com o updater antigo. Alterar somente a whitelist do novo
updater não resolve o primeiro upgrade, executado pelo updater instalado.
Conferir também o payload final do `.app` e testar atualização ZIP da v0.4.7.

### R2 — P2: o bundle omite o SDK usado pelo Claude

Origem: checagem complementar. `desk/agents/claude-adapter.cjs:1764`,
`desk/package.json:33` e `desk/scripts/install-app.mjs:34`.

O adaptador importa `@anthropic-ai/claude-agent-sdk` em tempo de execução, mas o
instalador do `.app` limpa `node_modules` e copia somente `marked`, `katex`,
`dompurify` e `pdfjs-dist`. Mesmo corrigindo R1, conectar/consultar histórico
com Claude em um bundle limpo falha por pacote ausente. O `node_modules` do
checkout em `desk/` não pertence à cadeia de resolução de módulos do bundle.

**Evidência:** listas reais do instalador e caminho real do import. O problema
foi demonstrado por inspeção do payload, sem instalar ou reabrir o app do usuário.
Os testes com SDK injetado não exercitam essa resolução.

**Correção sugerida:** distribuir o SDK e suas dependências de runtime completas,
ou empacotar o transporte; conferir a resolução do import no payload limpo,
sem um loader fake e sem depender dos `node_modules` de desenvolvimento.

### R3 — P2: uma resposta inválida elimina a pergunta pendente do lateral

Origem: CodeRabbit major. `desk/src/sidechat.mjs:619` e `:678`.

As perguntas estruturadas sempre recebem radios, mesmo com `multiSelect:true`,
e não oferecem texto livre quando há opções. Ao clicar Responder sem preencher
todas as perguntas, a UI remove o cartão e o registro local antes de aguardar
`sidechatRespond`. O backend recusa a resposta vazia e mantém o pedido pendente,
mas o usuário perde a possibilidade de corrigir/responder na interface. A
consulta fica esperando até ser interrompida.

**Evidência:** reproduzido com renderer Electron real e canal lateral simulado.
Os inputs eram `radio`, o payload continha resposta vazia, a função real
`validateQuestionAnswers` o rejeitou com `CLAUDE_QUESTION_ANSWER_INVALID`, e
o cartão/registro continuaram ausentes após a rejeição. Ver
[sidechat-evidence.json](sidechat-evidence.json) e
[reproduce-sidechat.mjs](reproduce-sidechat.mjs).

**Correção sugerida:** reaproveitar a validação das perguntas do principal,
renderizar checkboxes para seleção múltipla e oferecer resposta livre. Manter
o cartão e mostrar o erro enquanto a validação/IPC falhar; removê-lo somente
após aceite. Aplicar a espera também a permissões/seleções em `answerRequest`.

## Issues minor

### R4 — P2: a descoberta automática não encontra o launcher Windows

Origem: CodeRabbit minor. `desk/agents/claude-environment.cjs:77` e
`desk/main.cjs:296`.

As duas rotas procuram `.local/bin/claude`, sem `.exe`. O instalador nativo do
Windows usa `%USERPROFILE%\.local\bin\claude.exe`, conforme a
[documentação oficial](https://code.claude.com/docs/en/setup#native-installation).
Sem configurar o executável manualmente, a Mesa informa que Claude não foi
encontrado, apesar da instalação existente.

**Evidência:** layout Windows simulado em pasta temporária no macOS: descoberta
padrão retornou `found:false`; o mesmo arquivo indicado explicitamente retornou
`found:true`, usando sondas fake sem executar Claude. Ver
[windows-detection-evidence.json](windows-detection-evidence.json).

**Correção sugerida:** incluir `claude.exe` e compartilhar a resolução entre o
main e `claude-environment`, preservando o caminho escolhido pelo usuário.

### R5 — P2: o doctor lê configurações no diretório do macOS em todo sistema

Origem: CodeRabbit minor. `desk/scripts/claude-doctor.mjs:8`.

Sem `LEARNING_DESK_RUNTIME`, o script fixa `~/Library/Application Support/`.
Windows e Linux usam outros diretórios de userData; portanto, o diagnóstico
ignora o `claudePath` salvo na Mesa e pode reportar instalação ausente/errada.

**Validação:** inspeção direta da expressão e comparação com
`main.cjs`, que utiliza `app.getPath('userData')`.
**Correção sugerida:** resolver por plataforma: APPDATA no Windows, Application
Support no macOS e XDG_CONFIG_HOME/`~/.config` no Linux, mantendo o override.

### R6 — P3: o teste não captura erros do renderer após reabrir

Origem: CodeRabbit minor. `desk/tests/settings-resources-ui.mjs:66`.

O listener `pageerror` está ligado somente à primeira janela. Depois do
relaunch, a variável `page` aponta para outra janela, mas o listener não é
reinstalado; a asserção final `errors === []` não cobre essa segunda metade.

**Validação:** inspeção do listener, relaunch e asserção final.
**Correção sugerida:** registrar o listener também na nova janela ou centralizar
a criação de página com a coleta de erros.

### R7 — P3: a asserção de atualização pode correr antes do IPC

Origem: CodeRabbit minor. `desk/tests/settings-resources-ui.mjs:82`.

O teste envia `update-available` pelo processo principal e imediatamente
consulta `isVisible()`. Essa consulta não espera o renderer processar o evento,
criando uma corrida e possível falso negativo no teste.

**Validação:** inspeção do envio assíncrono e da consulta sem espera; não foi
provocada uma falha intermitente nesta rodada.
**Correção sugerida:** aguardar o locator `#update-notice` ficar visível antes
da asserção, sem usar uma pausa de duração fixa.

## Validação e limites

A suíte de 756 testes e o fluxo integrado haviam passado na rodada anterior
deste mesmo checkout. Esta review não repetiu a suíte inteira: verificou os
achados e adicionou reproduções temporárias específicas, sem modificar o código
de implementação. O estado Git do checkout permaneceu idêntico até a gravação
deste relatório e suas evidências.

Não houve inferência/autenticação real de provedor, teste em Windows real,
instalação, publicação ou atualização do `.app`. A reprodução de R3 usa
Electron real, API lateral simulada e validador real. R1/R2 foram conferidos
pelos contratos de distribuição, sem executar o instalador sobre o bundle.

Saída integral do CodeRabbit: [coderabbit-r2.ndjson](coderabbit-r2.ndjson).
Issues extraídas: [coderabbit-issues.json](coderabbit-issues.json).
Inventário e hashes do snapshot: [scope.json](scope.json).
