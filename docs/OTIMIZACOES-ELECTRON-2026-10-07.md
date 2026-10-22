# Otimizações do Electron — 7 de outubro de 2026

O app continua em Electron. Foram implementadas duas mudanças com ganho medido: retirada de um executável redundante no pacote e descarte de buffers de páginas de PDF fora da área de leitura.

## Resultado medido

| Cenário | Antes | Depois | Evidência e limite |
| --- | ---: | ---: | --- |
| App instalado no macOS arm64, espaço alocado (`du -sk`) | 630,48 MiB | 410,34 MiB | Menos 220,14 MiB / 34,92%. Mesmo Electron e identidade de assinatura. |
| PDF sintético de 36 páginas, passeio 1→36, canvases retidos no leitor | 36 | 3 | Electron real, janela 1400×900, runtime temporário e Pi fake. |
| Capacidade dos buffers desses canvases (`width × height × 4`) | 159,1 MiB | 13,3 MiB | Menos 91,7%. **Não é uma medição da RAM total do app.** |
| Passeio de volta 36→1, versão final | — | 3 canvases / 13,3 MiB | Páginas descartadas são renderizadas novamente. |

O benchmark curto com dois PDFs de uma página não demonstrou melhora de abertura ou de RAM total: mediana de 978 ms no código antes e 991 ms no payload reduzido, em três execuções de cada. Working sets somados: 562.224 e 564.944 KiB, respectivamente. O app assinado em uma pasta temporária teve maior variação na primeira abertura; esses números não sustentam promessa de inicialização mais rápida. São execuções com caches do SO aquecidos, janela oculta e sem inferência; os working sets podem contar memória compartilhada e não incluem o processo Pi.

## Mudanças no código

- `desk/bundle-runtime.cjs`: `stageBundlePayload` deixa de incluir os CLIs nativos opcionais de `@anthropic-ai/claude-agent-sdk`. A Mesa já detecta o Claude original do usuário e passa `pathToClaudeCodeExecutable`. O SDK, suas dependências, os peers e os codecs de PDF continuam no pacote. O comportamento geral de `runtimePackages` permanece inclusivo por padrão; somente o empacotamento da Mesa ativa a opção. Cada pacote selecionado é copiado separadamente, preservando versões aninhadas e impedindo que um `node_modules` interno reintroduza o CLI omitido.
- `desk/src/pdf.mjs`: a janela de renderização anterior foi preservada. Canvases e textLayers distantes são descartados; os shells e dimensões continuam para manter o scroll. O buffer é zerado antes da remoção. Uma janela maior reduz repinturas ao voltar pouco na leitura. O orçamento conta primeiro a banda de pintura, preservada mesmo quando ela excede os tetos; fora dela, retém as páginas mais próximas enquanto couberem em 12 canvases / 40 MiPixels por leitor.
- Renderizações pendentes também são invalidadas quando a página sai da retenção. Testes com `getPage` e extração de texto deliberadamente atrasados comprovaram que a página não reaparece depois do descarte e que o canvas intermediário é zerado.

Uma revisão independente, somente leitura, via Pi Mesa Dev / Command Code / DeepSeek V4.1 Flash com esforço max confirmou o delta exato de um pacote e não encontrou bloqueadores. Os alertas baixos motivaram guardas adicionais no smoke do SDK e documentação de que o monitor de `pageerror` do benchmark começa em `firstWindow`, podendo perder erros anteriores de boot.

Regressões/medições novas: `desk/tests/hunt-pdf-retention.mjs`, `desk/tests/hunt-pdf-render-race.mjs`, `desk/tests/bundle-runtime-sdk.mjs`, `desk/tests/performance-smoke.mjs`; ampliação de `desk/tests/bundle-runtime.test.mjs`.

## Aplicação ao app instalado

A aplicação foi cirúrgica em `Mesa de Estudos.app`: somente `Contents/Resources/app/bundle-runtime.cjs`, `src/pdf.mjs` e `.update-manifest.json` mudaram. Apenas os quatro arquivos do pacote redundante `node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64` foram removidos. Nenhum outro arquivo do payload foi adicionado ou alterado, conforme comparação SHA-256 com o backup.

Isso preservou o código já instalado, sem incorporar as outras funcionalidades que estão sendo desenvolvidas simultaneamente no checkout. A versão continuou `0.5.0`. O app foi assinado novamente com `Learning Canvas Code Signing` e passou em `codesign --verify --deep --strict`; a identidade designada `local.learningcanvas.mesa` e o certificado foram preservados.

Backup completo local: `/private/tmp/Mesa de Estudos before electron optimization 20261007.app`. Essa pasta temporária não é um backup permanente. As validações abriram somente instâncias ocultas com dados sintéticos em runtimes temporários; as sessões pessoais não foram reabertas ou migradas.

## Validação

Comandos executados em `desk/`:

```sh
npm test
node --test --test-concurrency=2 tests/*.test.mjs
npm run verify:bend
node --test tests/bundle-runtime.test.mjs tests/updater.test.mjs tests/updateflow.test.mjs
node --test tests/claude-adapter.test.mjs tests/claude-controls.test.mjs tests/bundle-runtime.test.mjs
node --test tests/free-material-pdf.test.mjs
node tests/bundle-runtime-sdk.mjs
node tests/hunt-pdf-retention.mjs
node tests/hunt-pdf-render-race.mjs
```

- A primeira execução de `npm test` teve 962/963 testes aprovados: a busca de estudos não retornou o texto de uma página de PDF durante a rodada paralela. O teste passou isoladamente (20/20). A busca possui orçamento de tempo e pode devolver resultado parcial; carga concorrente é uma explicação compatível, não uma causa comprovada. A repetição completa com concorrência 2 aprovou **974/974** testes. Outros testes foram acrescentados pelo trabalho simultâneo no checkout entre as duas rodadas. Nenhum arquivo da busca foi alterado por esta otimização.
- `verify:bend`: 74 artefatos reproduzíveis, tipagem/provas/paridade aprovadas.
- Bundle/updater/updateflow: 48/48. Adaptador/controles Claude + bundle: 74/74. Material PDF: 8/8, incluindo renderização real no Electron.
- SDK oficial 0.3.246 carregou o payload sem o CLI opcional e inicializou com um executável externo sintético. Isso valida o contrato de lançamento; **não valida login, assinatura ou inferência real do Claude**. O pacote omitido tem 230.824.600 bytes lógicos. O teste confere os oito nomes opcionais do SDK pinado e verifica que os pacotes aninhados das árvores reais estão no grafo declarado. Sem opcionais instalados, continua testando o contrato do executável externo.
- Retenção final: 30 verificações aprovadas. Busca/destaque, zoom, fit, rotação, seleção, ida/volta, navegação rápida e dois leitores independentes preservados.
- Versão empacotada otimizada: retenção, corrida com render atrasado, navegação em documento de 220 páginas e JBIG2/CSP aprovados. O app instalado passou no smoke completo de UI e recuperação de entrega com Pi fake. A última revisão do descarte também passou na corrida artificial e na retenção no app instalado.

O benefício demonstrado é espaço em disco e menor retenção de buffers em PDFs longos. Ainda não foi medido o uso diário com documentos pessoais, provedores reais ou Windows. Há custo de repintura ao retornar a páginas distantes descartadas. Electron/Chromium seguem sendo o piso de tamanho e memória.
