# Instalação da Mesa de Estudos

Instruções para um agente (ou para você) deixar a mesa rodando num computador novo, inclusive Windows.

A Mesa é um app Electron local: dois leitores de PDF, calculadora e Pi na mesma janela. O Xournal++ continua separado. Não precisa do vault Obsidian original.

## Requisitos

1. Node 22.19 ou mais novo (exigência do Pi).
2. Uma pasta com os PDFs da matéria (enunciados, formulário, o que for).

Não peça Homebrew nem o vault Obsidian de outra pessoa.

## Passos

No diretório `desk/`:

```sh
npm ci
npm run setup
npm run doctor
npm start
```

`npm run setup` instala as dependências se faltarem, tenta colocar o Pi localmente (`@earendil-works/pi-coding-agent`, com fallback para `@mariozechner/pi-coding-agent`), compila a integração visual no macOS e copia um `TUTOR.md` / `LEARNER.md` mínimos para `desk/.runtime/starter`.

`npm run doctor` fornece uma verificação reproduzível do executável do Pi, políticas `TUTOR.md`/`LEARNER.md`, fontes das matérias, extensão visual e escrita do runtime. Corrija qualquer linha marcada com `✗` antes de estudar.

Na primeira abertura:

1. Escolha a pasta de dados (ou deixe em branco e use a padrão).
2. Adicione pelo menos uma matéria: **nome** + **pasta de PDFs**.
3. Se o Pi não foi detectado, use **Detectar** ou indique o executável.
4. Salve. A mesa conecta ao Pi; as credenciais do provedor são pedidas pelo próprio Pi e ficam nele, não na Mesa.

Depois disso, **Mesa → Configurações** (⌘ ,) altera pastas, nomes das matérias e o caminho do Pi.

Para personalizar rótulos dos PDFs, PDF que abre primeiro, um só leitor, esconder calculadora/Xournal: edite o bloco `desk` do `config.json`. Contrato completo em [`../AGENTS.md`](../AGENTS.md) (seção Customizar) e exemplo em [`config.example.json`](config.example.json). Não mude os defaults em `config.cjs` — isso é o jeito do autor.

## Windows

PDFs, calculadora e o chat com o Pi funcionam. **Conferir Xournal++** não está disponível (a captura da janela é só macOS): o botão, o atalho e o item de menu somem. Cole um print da resolução (Ctrl+V) como anexo.

### Passos

1. Node **22.19** ou mais novo (exigência do Pi).
2. No diretório `desk/`: `npm ci`, `npm run setup`, `npm start`.
3. Xournal++ é opcional. Se instalado, indique o `xournalpp.exe` em **Configurações** — a Mesa procura em `C:\Program Files\Xournal++\bin` e `%LOCALAPPDATA%\Programs\Xournal++\bin`, e o campo fica visível mesmo sem caminho (para configurar).
4. O bundle `Mesa de Estudos.app` é de macOS; no Windows use `npm start` (ou um atalho para ele). `npm run install-app` avisa isso e sai.

### Checklist de teste manual (máquina Windows real)

- [ ] Abrir com `npm start` e ver a boas-vindas da primeira abertura → **Configurar agora**.
- [ ] Matérias/PDFs: abrir, busca com contagem, zoom/scroll, minimizar o leitor.
- [ ] Calculadora (expressões e histórico).
- [ ] Conectar o Pi (as credenciais são pedidas pelo próprio Pi).
- [ ] Anexos: colar (Ctrl+V), arrastar para o chat e câmera do leitor; enviar com imagem.
- [ ] GeoGebra: aba e "Print no chat".
- [ ] Atalhos Ctrl (Ctrl+Enter envia, Ctrl+F busca, Ctrl+, Configurações) e ajuda com Ctrl em vez de ⌘.
- [ ] Tema auto/claro/escuro; **Encerrar por hoje**; exportar conversa.
- [ ] Conferir Xournal++ invisível em todo lugar (botão, atalho, menu Estudar e ajuda).

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
