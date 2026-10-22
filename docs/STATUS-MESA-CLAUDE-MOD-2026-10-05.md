# Mesa como mod do Claude — protótipo experimental implementado

Protótipo separado em `claude-mod/mesa-study`. Implementação, duas revisões independentes, correções e testes locais concluídos. Não representa entrega validada no Desktop.

## Escopo

- Painel `/mesa`, matéria/questão/notas, dois documentos com prioridade do primeiro, navegação de página, calculadora e retomada de metadados.
- Helper Node/Poppler para páginas e captura explícita da janela do Xournal++. A captura não pede análise automaticamente.
- Análise por ação explícita: prompt textual pedindo leitura do PNG local pela ferramenta nativa, sob as permissões normais do Claude.
- Sem login, inferência, instalação, atualização, carregamento no aplicativo, commit ou publicação nesta rodada.

## Evidências disponíveis

- Suíte final integrada: agente raiz executou `npm test` após todas as correções e verificou **117/117 passando**, nenhum falhou ou foi pulado. Log local: `/tmp/mesa-mod-tests-root-20261005.log`. São 60 testes do host, 56 do painel/bibliotecas/harness e um da ponte. Painel e captura são simulados; oito testes do host usam Poppler/qpdf reais e um da ponte usa Node/CLI/Poppler reais com PDFs sintéticos.
- Helper após correções: agente raiz executou `node --test tests/host*.test.mjs`; 52 passaram, nenhum falhou ou foi pulado. Cinco são testes reais com Poppler/CLI e PDFs sintéticos. A captura continua simulada.
- Helper após achados da revisão: agente raiz executou host + ponte e verificou 61/61 passando (60 do host, um da ponte), sem falhas ou testes pulados. Inclui oito testes do host com Poppler/qpdf reais e um da ponte. Log: `/tmp/mesa-mod-host-tests-root-20261005.log`.
- Teste adicional em `tests/integration-bridge.test.mjs`: agente raiz executou e passou (1/1, sem skip). Exercita consumidor real → subprocesso Node → CLI → Poppler, PDFs sintéticos, páginas simples/grandes, erro de página e preservação do documento. Não usa modelo nem Desktop.
- Pesquisa complementar: recortes de uma página sintética de texto couberam em elementos SVG separados e foram recompostos em um navegador. Isso não valida o renderizador do mod nem PDFs gerais.
- CLI inspecionado: 2.1.246, anterior ao suporte documentado aos mods; a versão interna do Code no Desktop precisa ser verificada separadamente.

## Revisões e correções concluídas

- Concluídas no helper e verificadas pelos testes: preservar o PNG quando o SVG exceder o limite, sem truncar a página; validar IDs de janela; proteger o cache privado; restringir a limpeza a saídas identificadas do helper.
- Concluídas no painel e verificadas pela suíte: serializar/coalescer a persistência, mostrar falhas de gravação, preservar estado incompatível até ação explícita, evitar análise de página antiga durante carregamento e confirmar o estado do painel pelas APIs disponíveis.
- Contrato integrado com aviso de prévia omitida e PNG analisável; caminhos com aspas/metacaracteres testados na ponte real por argv, sem shell.
- Revisão independente do helper concluída: não encontrou bloqueadores nos contratos centrais; os três bugs reproduzidos foram corrigidos e verificados por testes: pasta autorizada obsoleta bloquear outras pastas, CLI executado por symlink produzir saída vazia e diagnóstico de senha do Poppler virar mensagem genérica. A identidade da janela em produção continua comparando ID e aplicativo: o helper atual não fornece `ownerPID`.
- Revisão independente do painel concluída: confirmou APIs e a suíte integrada. Navegação durante seleção de outro PDF agora é recusada com aviso, sem enfileirar a página do documento antigo; o campo de caminho acompanha a aba ativa e não é sobrescrito por resposta atrasada de outra aba. A comparação lexical do cache exige caminhos absolutos e recusa segmentos `.`/`..`. Cinco testes de regressão foram acrescentados; o agente reportou que falham em uma cópia descartável com os trechos antigos restaurados. O agente raiz inspecionou os trechos corrigidos e executou a suíte final.
- Os relatórios r3 são registros do snapshot anterior às correções r4. Os achados corrigidos acima não devem ser tratados como pendências atuais. Os informativos sobre `options.roots` não declarado no manifesto, identidade de janela sem `ownerPID` e limpeza em falhas raras de `chmod` permanecem limites conhecidos, sem bloqueador identificado pelas revisões.

## Validação real pendente

Confirmar tipos gerados na build alvo, disponibilidade de `$.process.run`, renderização do SVG, captura com as permissões do processo hospedeiro e leitura efetiva do PNG pelo modelo. Um prompt aceito ou enfileirado não comprova leitura ou análise concluída.

### Primeira inspeção do Desktop

Em 2026-10-05, após o usuário pedir validação no aplicativo, o agente raiz inspecionou o Claude Desktop pela interface nativa. A conta mostra **Free**; abrir **Code** apresenta a tela inicial com **Get Claude Code**, sem sessão local ou painel de projeto. A documentação oficial exige Pro, Max, Team ou Enterprise para Code no Desktop. Assim, o teste do mod nessa superfície está bloqueado pelo acesso da conta. Nenhuma assinatura, compra, instalação de plugin ou chamada ao modelo foi feita.

O aplicativo instalado informa versão `2.19675.1` no Info.plist; isso **não** revela a versão interna do Claude Code. Quando a aba Code estiver disponível, confirmar `/status` (Code interno 2.1.286+), instalar/carregar o plugin nessa sessão, verificar sua ativação e só então usar `/mesa`. O comando não funciona como painel no Chat comum. O plugin desta implementação foi criado no disco e não foi instalado automaticamente no Desktop.

Fontes: [Desktop quickstart](https://code.claude.com/docs/en/desktop-quickstart), [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview).

## Preservação e autoria

O baseline `/tmp/mesa-mod-baseline-20261005.json` cobre 423 arquivos de código do produto existente. Na comparação final, 16 diferiam: `desk/sidechat-engine.cjs`, `desk/sidechat.cjs`, `desk/src/sidechat.mjs`, `desk/src/support.mjs`, `desk/tests/sidechat-pi.test.mjs`, `desk/tests/sidechat.test.mjs`, `desk/README.md`, `desk/SETUP.md`, `desk/index.html`, `desk/main.cjs`, `desk/preload.cjs`, `desk/src/chat.mjs`, `desk/src/main.mjs`, `desk/src/nav.mjs`, `desk/src/tooltip.mjs` e `desk/style.css`. A comparação não atribui autoria dessas alterações. Nenhum desses arquivos foi editado nesta rodada do mod; não foram revertidos ou incorporados ao seu escopo. Não se deve afirmar preservação byte a byte de todos os 423 arquivos com base nessa medição. Não houve instalação, atualização, abertura de sessão Claude, captura real ou publicação como parte deste trabalho.

## Referências

- [Pesquisa inicial](reviews/mesa-mod-api-20261005.md)
- [Pesquisa complementar](reviews/mesa-mod-api-followup-20261005.md)
- [Revisão independente do helper](reviews/mesa-mod-host-review-20261005-r3.md)
- [Revisão independente do painel](reviews/mesa-mod-ui-review-20261005-r3.md)
- [README do protótipo](../claude-mod/mesa-study/README.md)
