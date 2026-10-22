# Referências adicionais fornecidas durante a implementação

## OpenUI

Artigo: https://www.openui.com/blog/how-chatgpt-intelligent-ui-works
(Thesys, 2026-10-08). É engenharia reversa feita pelos autores, não documentação
oficial da OpenAI. Consulta realizada pelo pai; cópia de leitura temporária em
`/private/tmp/mesa-openui-reference-20261008.txt`.

A análise distingue componentes de catálogo, com lógica isolada num worker e
operações aplicadas pelo host, de apps livres HTML/CSS/JS em iframe. Para Mesa,
o segundo caminho se aproxima do requisito prioritário de geração livre.
Tema compartilhado e altura ajustada ajudam a integrar a atividade à fala.
O artigo relata perda de estado ao recarregar e erros de lógica silenciosos.
Assim, preservar estado versionado e verificar os cálculos dos exemplos
continua necessário. Renderização válida não comprova correção pedagógica.
A abordagem de catálogo é referência futura, sem substituir o runtime livre
ou acrescentar um compilador/DSL à primeira entrega.

## T3 Code nightly inspecionado

- Tag: `v0.0.46-nightly.20261008.2833`.
- SHA: `a6ec88f7a716fc421bd22c2484881c44110f9375`.
- Release: https://github.com/pingdotgg/t3code/releases/tag/v0.0.46-nightly.20261008.2833
- Clone de leitura em `/private/tmp/mesa-t3-nightly-20261008`, sem instalar
  dependências, executar o projeto ou alterar o app instalado.

Arquivos lidos no clone:

- `packages/shared/src/htmlRender.ts`: contrato de referência, validação,
  tema antes da primeira pintura, notificações de tema e tamanho; guia pede
  largura fluida e evita `100vh` porque altura baseada no iframe pode crescer
  em ciclo. Há medição de altura por largura e clamp.
- `apps/server/src/htmlRender/HtmlRender.ts`: prepara HTML, incorpora imagens
  locais verificadas e salva attachment; medição e prévia são operações
  separadas. O limite de 25 MiB serve ao produto deles, não ao contrato Mesa.
- `apps/web/src/components/chat/HtmlRenderFrame.tsx`: reserva altura durante
  carregamento/erro e mantém a URL durante a vida da montagem; ampliar abre
  o attachment no painel. ResizeObserver adapta à coluna.
- `apps/web/src/components/files/BrowserDocumentFrame.tsx`: iframe opaco sem
  `allow-same-origin`, lazy load, tema via fragmento inicial/postMessage e
  validação de `event.source` para altura/links. Permite forms; não há watchdog
  de laço nessa implementação lida.
- `apps/server/src/http.ts`: CSP de HTML fornece sandbox, mas não declara
  `connect-src 'none'`. Esse isolamento não prova bloqueio de rede nem
  contenção de CPU para o requisito offline da Mesa.
- `apps/web/src/session-logic.ts`: resultado concluído de html_render vira
  entrada própria `html-render` com ID da ferramenta; não fica agrupado no
  topo do turno. `MessagesTimeline.tsx` dá key pelo attachment para impedir
  que uma linha reciclada retenha a página de outra atividade.

Aplicação à Mesa: manter âncora pela chamada, tema antes da primeira pintura,
montagem estável, limites de altura/frequência e controles fora do documento.
Rede, arquivos, laços e flood continuam sujeitos ao experimento Electron
próprio; copiar um atributo sandbox não atende sozinho ao gate definido.
