# #55: GeoGebra offline (licença primeiro)

Resultado da issue #55. Os commits ficam locais, na branch da worktree. Não houve
push, PR nem comentário na issue. Defaults de `desk/config.cjs`, PDFs e materiais
de curso ficaram intactos. Não rodei `npm run setup`, `update` nem `install-app` de
verdade, e nenhum teste usou inferência real. Decisão do usuário nesta sessão:
**cada pessoa baixa o pacote de geogebra.org, e isso é opcional.**

## 1. A licença

**Fonte:** [geogebra.org/license](https://www.geogebra.org/license) (a Non-Commercial
License Agreement), lida em **2026-10-17**. A página diz "These License terms were
last updated in November 2025". O `README.txt` do próprio bundle repete: pode copiar,
distribuir e transmitir para fins não comerciais, e remete à mesma página.

O que a licença diz (cláusulas numeradas pela ordem da página):

- **2. O pacote é "Materials".** Instaladores, serviços web e materiais estão
  licenciados de forma "limited, non-exclusive, personal, non-transferable and
  royalty-free". Dentro disso, a pessoa é livre para "use, copy, distribute, modify and
  transmit the Materials" — mas só para fins não comerciais, sem cobrar nada de
  terceiros, citando o nome do GeoGebra, com um aviso de copyright e um link para
  geogebra.org.
- **3. Código-fonte:** EUPL v1.2. Usar o código junto dos Materials e dos arquivos de
  idioma, como produto GeoGebra, continua só para fins não comerciais.
- **4. Arquivos de idioma, documentação, ícones e estilos:** CC BY-NC-SA 4.0 ou mais nova.
- **9. O aviso exigido** tem esta forma: `Made with GeoGebra®` (nome, copyright e link).
- **11. A licença é pessoal.** Quem a recebe não pode cedê-la nem deixar terceiros se
  beneficiarem dela sem consentimento escrito do GeoGebra. E, na cláusula 1, quem baixa
  ou usa o GeoGebra aceita os termos.
- O **Math Apps Bundle não é citado** em nenhum ponto da licença nem do FAQ.

**Pergunta: a Mesa pode distribuir o pacote dentro do app, num repositório público, sem
fins comerciais?** **Não está claro.** A cláusula 2 permite "distribute" para uso não
comercial, mas a mesma cláusula chama a licença de pessoal e intransferível, e a 11
proíbe terceiros de se beneficiarem dela sem consentimento. Quem recebe o pacote da
Mesa não teria aceitado nada. O texto também não diz se embutir num app ou num
repositório público conta como o "distribute" permitido. Por isso a Mesa **não
distribui**.

**Pergunta: cada pessoa precisa baixar ela mesma?** **Sim, é o caminho seguro.** O
download vai direto de geogebra.org para a máquina da pessoa, que aceita a licença ao
baixar (cláusula 1). Isso é o que a Mesa faz, com consentimento explícito antes.

**Aviso em Sobre → Créditos:** entrou uma linha do GeoGebra em
[`desk/index.html`](../../desk/index.html): "applet da aba GeoGebra, da web ou do pacote
offline que você baixa no setup (licença não comercial, geogebra.org/license). Made with
GeoGebra®, geogebra.org". Ela aparece sempre, com ou sem o pacote, porque o applet da web
também é o GeoGebra. Não leva `data-package` porque não é pacote npm (o
`about-credits-versions.test` confere só os que têm).

**Limite do uso:** isto vale enquanto a Mesa for uso pessoal e sem fins comerciais, como é
hoje. Se algum dia for vendida, usada para vender material ou para ganhar com anúncio,
a licença muda para a comercial (a página lista esses casos).

## 2. O que foi implementado

- **Download opcional no `setup`** (`desk/scripts/geogebra-offline.mjs`, chamado por
  `setup.mjs`). Mostra o que baixa, de onde, o tamanho e a licença, e pergunta `[s/N]`.
  `--geogebra` já vale como consentimento, `--no-geogebra` pula, e sem terminal pula. Falha
  de download não derruba o `setup`: avisa e a aba segue com o applet da web.
  `npm run geogebra:offline` roda só esse passo depois, e `-- --remove` apaga o pacote.
- **Versão fixada e hash conferido** (`desk/geogebra-pack.cjs`): Math Apps Bundle
  **5.4.932.1**, URL
  `https://download.geogebra.org/installers/5.4/geogebra-math-apps-bundle-5-4-932-1.zip`,
  33.454.039 bytes, SHA-256
  `c139f3edb51c004ec67d83226a1f1215486f8559ad98ee37e9e775aac278e96e`. O GeoGebra não
  publica hash; este foi calculado no primeiro download (2026-10-17; `Last-Modified` do
  arquivo: 2026-10-12). Outro arquivo na mesma URL é recusado com o valor recebido e o
  esperado. Baixa para a memória, confere, extrai numa pasta vizinha com o `tar` do
  sistema e só então troca a pasta final: uma queda no meio nunca deixa pacote pela metade.
- **Local do pacote:** `desk/.runtime/geogebra/` (já fora do git, do updater e do hash
  do portão). O app acha o pacote pela raiz do clone (`installRoot()`), então o
  `Mesa de Estudos.app` também enxerga.
- **Protocolo local** (`desk/ggb-pack-protocol.cjs`), no estilo do `mesa-activity://lib/`:
  `mesa-ggb://app/ggb.html` serve o `ggb.html` da Mesa e `mesa-ggb://app/pack/…` serve
  `GeoGebra/…` do pacote. Mesma origem, então o GWT do applet faz fetch/XHR sem CORS. Só
  é instalado na sessão da view do applet (`persist:geogebra`). Recusa `..`, barra
  invertida, NUL e link simbólico para fora do pacote.
- **Rede fechada:** com o pacote, essa sessão cancela todo pedido http, https, ws, wss e
  ftp. O GeoGebra offline não fala com ninguém (nem com geogebra.org).
- **`ggb.html`** escolhe sozinho: sob `mesa-ggb:` carrega o `deployggb.js` do pacote e
  aponta o codebase para `web3d/` dele; fora disso, é o applet da web como antes. O
  `geogebra-host.cjs` decide ao criar a view (reabrir a Mesa depois de baixar).
- **Sem mudar:** snapshot da matéria, quadro limpo (#53), captura e a ferramenta do tutor
  passam pelo mesmo host. Só a mensagem de "applet não ficou pronto" deixou de mandar
  procurar internet quando o offline está ligado.

## 3. Tamanho

| Onde | Custo |
| --- | --- |
| Download (zip) | 33.454.039 bytes (31,9 MiB) |
| Em disco, extraído | 116 MB (`web` 48, `web3d` 48, `webSimple` 19) |
| `npm ci` | 0 (nada entra nas dependências) |
| Repositório | 0 (`desk/.runtime/` é ignorado) |
| `Mesa de Estudos.app` | 0 (o `install-app` copia código, não `.runtime/`); `npm run test:packaged` passou |

O applet da Mesa usa só `web3d/`. Extraí o zip inteiro mesmo assim, para o pacote ficar
igual ao oficial; podar `web/` e `webSimple/` pouparia uns 67 MB, mas é uma decisão para
depois.

## 4. Portões rodados

Todos em `desk/`. Esta worktree se chama `quizzical-…`, e o `tests/fake-pi.mjs` responde
com um quiz a qualquer mensagem que contenha "quiz" (linha 238), inclusive pelo caminho
que entra no contexto. Por isso `responsive-chat-calc-ui` e 3 passos do `hunt-calc-ggb`
falharam **só nesta pasta**. Rodei os portões com o código do meu commit idêntico numa
worktree temporária de nome neutro, e passaram. O código do `fake-pi` não foi alterado.

| Portão | Resultado |
| --- | --- |
| `npm run verify:bend` | verde: 67 artefatos reproduzíveis, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | 1464 testes, 1463 verdes. O que falhou foi `test-harness` (prazo de 2 s para subir o Electron com a máquina carregada); passou 2 de 2 sozinho |
| `npm run ui -- calc,ggb,activity-ggb,tutor-geogebra` | verde: 5 janelas (`ggb-offline-ui`, `responsive-chat-calc-ui`, `tutor-geogebra-ondemand-ui`, `activity-ggb-overlay-ui`, `calculator-ui`), na pasta de nome neutro |
| `MESA_GGB_REAL_PACK=… node tests/ggb-offline-ui.mjs` | verde com o **pacote oficial real** (applet verdadeiro, rede fechada) |
| `node tests/hunt-calc-ggb.mjs` | verde na pasta de nome neutro ("nenhum problema no escopo"; 1 nota antiga de layout) |
| `node tests/bundle-payload-ui.mjs` | verde |
| `npm run test:packaged` | verde |

**Mudei o `setup` e há arquivo novo lido na subida (`geogebra-pack.cjs`,
`ggb-pack-protocol.cjs`): a bateria completa roda no `main`.** O `setup` em si não foi
executado de verdade; o download real foi feito pela rotina `installPack` numa pasta
temporária, com o `tar` e o hash reais.

## 5. A prova de "sem rede"

`tests/ggb-offline-ui.mjs`, na janela. Um servidor HTTP de prova conta qualquer pedido
que chegar. O pacote falso (`tests/fixtures/fake-ggb-pack`) faz o que o GWT real faz
(fetch de arquivos do próprio pacote por `mesa-ggb://`) e tenta sair por fetch, XHR,
`<img>` e `<script>`; de dentro do applet o teste ainda tenta fetch, beacon, WebSocket e o
próprio servidor do GeoGebra. Conferido: a view está em `mesa-ggb://app/ggb.html`; o
codebase é o do pacote e o `deployggb.js` recebe `offline=true`; todas as tentativas são
`bloqueado`; o servidor de prova não recebe **nada** (espera de 2 s); a ferramenta do
tutor (`@geogebra`, ponte real) roda o comando e lê o estado. Com
`MESA_GGB_REAL_PACK=<pasta>` o mesmo teste roda no applet oficial, e passou.

Testes de unidade novos: `geogebra-pack.test.mjs` (hash, tamanho, entrada ausente,
instalação anterior preservada, zip com `../` recusado, versão/hash do `pack.json`),
`ggb-pack-protocol.test.mjs` (tipos, traversal, symlink, rede), `geogebra-offline-script.test.mjs`
(consentimento, pular, falha, já instalado) e três casos novos em
`geogebra-host.test.mjs`. Fakes com nome: `fake-ggb-pack/`, `zip-writer.cjs`,
`fake-ggb-applet-browser.js` (o applet em memória que antes estava dentro do
`fake-ggb.html` e agora os dois usam) e o `fake-ggb-electron.cjs`, que ganhou `session`
e `loadURL`.

## 6. Decisões

- **Download no `setup`, não no repositório.** Pela licença (acima) e pelo tamanho. O
  usuário pediu que fosse opcional: o default é perguntar, e a resposta padrão é não.
- **Hash fixado por mim.** Como o GeoGebra não publica hash, o primeiro download define o
  valor; se eles trocarem o arquivo na mesma URL, o download falha de forma segura e o
  hash é atualizado em um commit (`geogebra-pack.cjs`).
- **`tar` do sistema para extrair** (macOS e Windows 10+ trazem o bsdtar). Sem dependência
  nova. O bsdtar recusa caminho com `..` (testado). Não testei no Windows.
- **Rede fechada só com o pacote.** O applet da web precisa de rede; fechar só o offline
  deixa claro o que cada modo faz.
- **Em teste, só vale o pacote apontado por `LEARNING_DESK_GGB_PACK`.** Um `setup` de
  verdade na máquina de quem testa não pode mudar o resultado dos testes de janela.
- **Texto:** não mexi em `desk/locales/*.json` nem em texto de outras telas (a fase 3 do
  #41 roda em paralelo). Mexi em duas linhas de GeoGebra no `index.html` (a nota da barra,
  que dizia "o applet é o da web", e a linha dos Créditos), que não têm chave de tradução.
  Sobra a chave `tabs.ggbTitle` ("… applet da web"), que fica certa no modo online; a
  fase 3 pode decidir se a atualiza. As mensagens de `ggb.html` e do setup são texto
  fixo em português, como as que já existiam ali.

## 7. Não coberto

- **Windows:** o `tar` do sistema e o download não foram exercitados lá.
- **Print (⌘⇧G) e a captura da ferramenta com o applet real offline:** a captura é do
  Chromium e não usa rede, mas a prova com o pacote real cobre abrir, rodar e ler, não a
  captura.
- **Quantos pedidos a sessão recusou no applet real:** o teste prova que o applet
  funcionou com a rede fechada, não conta os pedidos recusados (o host registra os
  cinco primeiros no `desk.log`).
- **Troca de versão do pacote:** uma versão nova do GeoGebra exige atualizar
  `PACK` (versão, URL, hash, tamanho) e rodar `npm run geogebra:offline` de novo; a versão
  antiga deixa de valer (`readInstalledPack` devolve `null`) e a aba volta ao applet da web
  até lá.
- **A bateria completa** (roda no `main`).
