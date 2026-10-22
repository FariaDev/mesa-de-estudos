# Instalação da Mesa de Estudos

Instruções para um agente (ou para você) deixar a mesa rodando num computador novo, inclusive Windows.

A Mesa é um app Electron local: dois leitores de PDF, calculadora e Pi na mesma janela. O Xournal++ continua separado. Não precisa do vault Obsidian original.

## Requisitos

1. Node 22.19 ou mais novo (exigência do Pi).
2. Uma pasta com os PDFs da matéria (enunciados, formulário, o que for).
3. Pi **0.99.1 ou mais novo**. Os perfis usam `builtin:mcp`, `builtin:codemode` e `builtin:tool-search` explicitamente.

### Migrar um Pi com pi-mcp-adapter

Os servidores continuam em `~/.pi/agent/mcp.json`. Em `desk/`, rode
`node scripts/migrate-native-mcp.mjs` para conferir e acrescente `--apply`
para aplicar: o script guarda as settings originais em `~/.pi/agent/backups/`,
remove apenas o pacote do adapter, habilita Codemode e descoberta com adições
em `defaultTools` (mantendo a seleção existente) e instala uma política que preserva
`approveTools` (incluindo chamadas dentro de Codemode). Não muda os servidores,
o modelo, o esforço nem as credenciais. Reabra o app ou crie uma nova conexão.

Para desfazer, restaure o `settings.json` do backup e remova apenas os arquivos
listados em `migration.json` como criados pela migração. Não remova a pasta de
servidores nem sessões. Sessões já abertas não são interrompidas pelo script.

Não peça Homebrew nem o vault Obsidian de outra pessoa.

## Passos

No diretório `desk/`:

```sh
npm ci
npm run setup
npm run doctor
npm start
```

`npm run setup` instala as dependências se faltarem, tenta colocar o Pi localmente em `desk/.pi-local/` (`@earendil-works/pi-coding-agent`, com fallback para `@mariozechner/pi-coding-agent` — a pasta do Pi tem `package.json` próprio, FORA da árvore npm da Mesa: o `package.json`/`package-lock.json` versionados do `desk/` continuam limpos e o update por git nunca encontra "trabalho local" inventado), compila a integração visual no macOS e copia um `TUTOR.md` / `LEARNER.md` mínimos para `desk/.runtime/starter`.

### GeoGebra offline (opcional)

A aba GeoGebra usa o applet da web por padrão e precisa de internet. O `setup` pergunta se você quer baixar o pacote oficial do GeoGebra (Math Apps Bundle 5.4.932.1: ~32 MB de download, ~116 MB em `desk/.runtime/geogebra/`, fora do git) para usar a aba e a ferramenta do tutor sem rede. É uma escolha sua: o pacote é do GeoGebra, sob a [licença não comercial](https://www.geogebra.org/license) deles (pessoal e intransferível), e a Mesa não o distribui; o download vai direto de geogebra.org, com versão e hash conferidos. Sem terminal ou sem resposta, o `setup` pula.

```sh
npm run setup -- --geogebra      # baixa sem perguntar (você aceita a licença)
npm run setup -- --no-geogebra   # nunca pergunta
npm run geogebra:offline         # só esse passo, depois
npm run geogebra:offline -- --remove
```

Reabra a Mesa depois de baixar. Com o pacote, a sessão do applet não faz nenhum pedido de rede.

`npm run doctor` fornece uma verificação reproduzível do executável do Pi, políticas `TUTOR.md`/`LEARNER.md`, fontes das matérias, extensão visual e escrita do runtime. Corrija qualquer linha marcada com `✗` antes de estudar.

Na primeira abertura (sem configuração) a Mesa não mostra diálogo: ela já abre no app.

1. Dê um nome à matéria no campo **Nome da matéria**, na barra de cima.
2. Diga onde estão os PDFs: **Escolher a pasta…** na folha "Lista 0", ou solte PDFs (ou a pasta) em qualquer ponto do leitor. A Mesa só aponta para a pasta; não copia nem altera os arquivos.
3. A pasta onde ficam as exportações e as instruções do tutor aparece na folha (por padrão `Documentos/Mesa de Estudos`); **Mudar** escolhe outra. Ela só é criada quando a matéria nasce e fica gravada no `config.json` deste computador.
4. Na coluna do tutor, o Pi aparece como encontrado ou não (**Ajustes do Pi** leva ao caminho). **Chamar o tutor** liga a conexão; as credenciais do provedor são pedidas pelo próprio Pi e ficam nele, não na Mesa.

Com nome e pasta a matéria é criada e a Mesa vai para ela, já com a caixa de mensagem liberada. Quem preferir só estudar um assunto avulso pode abrir a aba **Livre**.

Depois disso, **Ajustes → Configurações** (⌘ ,) altera pastas, nomes das matérias e o caminho do Pi.

Em **Configurações → Recursos da mesa**, escolha o nome e quais recursos aparecem. Encerrar por hoje também controla o "onde parei" da coluna do tutor; Lista/questão e rascunho `.xopp` são controlados juntos. As escolhas são aplicadas ao salvar.

**Leitores** permite um ou dois leitores, nomes, termos de preferência do PDF inicial e o nome do botão do segundo leitor. **Aparência e avisos** oferece tema Sistema, Claro ou Escuro e a cor de acento; tema e acento valem na hora. Cancelar descarta as demais edições. Com dois leitores, o Formulário recolhido vira uma faixa que o reabre; o chat lateral abre pelo botão do cabeçalho do tutor.

Para personalizar rótulos dos PDFs, PDF que abre primeiro ou um só leitor, edite o bloco `desk` do `config.json`. Contrato completo em [`../docs/agents/customizar.md`](../docs/agents/customizar.md) e exemplo em [`config.example.json`](config.example.json). Não mude os defaults em `config.cjs` — isso é o jeito do autor.

## Windows

PDFs, calculadora e o chat com o Pi funcionam. **Conferir Xournal++** captura a janela do Xournal++ (botão, Ctrl+Shift+C ou menu Estudar) com o PowerShell do próprio sistema — nada instalado. Prints colados com Ctrl+V também viram anexo. Precisa do Xournal++ aberto e com a janela restaurada.

### Passos

1. Node **22.19** ou mais novo (exigência do Pi).
2. No diretório `desk/`: `npm ci`, `npm run setup`, `npm start`.
3. Xournal++ é opcional. Se instalado, indique o `xournalpp.exe` em **Configurações** — a Mesa procura em `C:\Program Files\Xournal++\bin` e `%LOCALAPPDATA%\Programs\Xournal++\bin`, e o campo fica visível mesmo sem caminho (para configurar).
4. O bundle `Mesa de Estudos.app` é de macOS; no Windows use `npm start` (ou um atalho para ele). `npm run install-app` avisa isso e sai.

### Checklist de teste manual (máquina Windows real)

- [ ] Abrir com `npm start` sem configuração: ver a folha "Lista 0" e o campo **Nome da matéria**, criar a primeira matéria com nome + pasta (ou soltando PDFs) e conferir que a Mesa vai para ela.
- [ ] Ícone da Mesa na janela e na barra de tarefas; fixar na barra, fechar e reabrir pelo botão fixado (inclusive em uma pasta com espaços no caminho).
- [ ] Matérias/PDFs: abrir, busca com contagem, zoom/scroll, minimizar o leitor, girar 90° (a orientação volta ao reabrir).
- [ ] Calculadora (expressões e histórico).
- [ ] Conectar o Pi (as credenciais são pedidas pelo próprio Pi).
- [ ] Anexos: colar (Ctrl+V), arrastar para o chat e câmera do leitor; enviar com imagem.
- [ ] GeoGebra: aba e "Print para o tutor".
- [ ] Atalhos Ctrl (Ctrl+Enter envia, Ctrl+F busca, Ctrl+, Configurações) e ajuda com Ctrl em vez de ⌘.
- [ ] Tema auto/claro/escuro; **Encerrar por hoje**; exportar conversa.
- [ ] Conferir Xournal++: botão, Ctrl+Shift+C, menu Estudar e ajuda presentes; com o Xournal++ aberto, a captura anexa a janela dele (minimizada pede para restaurar; fechada pede para abrir).
- [ ] **Atualizar e rollback**: com rede, `npm run update` aplica a versão nova e reabre a Mesa; simule falha (corte a rede no meio do `npm ci`) e confira o rollback no `desk.log` — a versão anterior sobe de novo; sem rede, nada pendura (checagens têm prazo).

## macOS (opcional)

Se `Mesa de Estudos.app` já existir ao lado de `desk/`:

```sh
npm run install-app
```

Isso só atualiza o `.app` existente; não cria um instalador novo.

### Gravação de Tela

O macOS lembra a permissão de **Gravação de Tela** pela identidade de assinatura do app. Sem um certificado, o `install-app` assina ad-hoc e cada atualização vira "outro" app para o sistema — a permissão é pedida de novo.

Para não repetir, crie o certificado uma vez:

1. **Acesso às Chaves** → menu **Acesso às Chaves** → **Assistente de Certificado…** → **Criar um Certificado…**
2. Nome `Mesa de Estudos`; tipo de identidade **Raiz autoassinada**; tipo de certificado **Assinatura de Código**. Criar.
3. Rode `npm run install-app` de novo: o script detecta o certificado e assina com ele.

Com Xcode, um certificado **Apple Development** também serve. `security find-identity -v -p codesigning` lista o que existe; `MESA_SIGN_IDENTITY="Nome" npm run install-app` escolhe um específico.

Sem certificado a Mesa funciona igual — basta reconceder a permissão em Ajustes → Privacidade e Segurança → Gravação de Tela depois de cada atualização.

## Se o Pi não conectar

- Rode `npm run setup` de novo.
- Confira o caminho em Configurações.
- A primeira conexão pede login/API key do provedor configurado no Pi.

## Atualizar a Mesa (por clique ou terminal)

- **Pelo app:** Ajustes → Sobre → **Verificar atualizações** / **Atualizar e reiniciar** (o app fecha, aplica e reabre sozinho; se algo falhar, a versão anterior volta e o motivo fica em `.runtime/desk.log` — acesse pelo "Ver o log" no Sobre).
- **Pelo terminal:** `npm run update` (mesma transação). `npm run update -- --versao X.Y.Z` só vale em instalação por **zip** (sem clone git); em clone, o update segue a branch de desenvolvimento. `npm run update -- --pi` atualiza só o Pi local (`desk/.pi-local`).

**Veio de uma versão com o app Conversa?** A Conversa (`chat/`) foi aposentada na #50 e o chat avulso agora é a aba **Livre** da Mesa. A atualização não apaga nem altera uma pasta `chat/` que já esteja no seu disco; se não a usa mais, apague-a à mão. Num clone git, o `git pull` remove os arquivos rastreados dela e deixa o que o git ignora (`chat/node_modules`, `chat/.runtime`). Sessões antigas que vieram de um bilhete da Conversa continuam abrindo, só sem o bloco `[Da Conversa]`.
