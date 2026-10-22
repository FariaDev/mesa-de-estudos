# Mesa no Codex app — API de plugin local (pesquisa oficial)

Data: 2026-10-05 · Escopo: read-only de código + documentação oficial.
Fontes permitidas: `developers.openai.com`, `learn.chatgpt.com` (espelho oficial dos docs), `platform.openai.com`.
CLI verificado: `/opt/homebrew/bin/codex` — `codex-cli 0.160.1` (última do changelog em 2026-10-05).

Nada foi instalado, carregado, reiniciado; nenhuma configuração pessoal, credencial, sessão, PDF ou material de curso foi lido/alterado; nenhum modelo foi chamado; sem commit/push; sem subdelegação. Não abri `agent-plugins.org`, GitHub nem fontes fora da lista autorizada.

## 1. Manifesto: `plugin.json` raiz e overlay `.codex-plugin/plugin.json`

Documentado em `https://developers.openai.com/plugins/build/plugins`:

- O caminho novo é o pacote portável **Agent Plugins**: `plugin.json` na raiz com `$schema` (referência `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, citado mas não aberto por restrição de fonte).
- `.codex-plugin/plugin.json` **continua suportado como fallback de compatibilidade**.
- `skills/` e `mcp.json` na raiz são descobertos automaticamente no formato portável.
- Metadados específicos de OpenAI ficam em `extensions.com.openai` no `plugin.json` raiz. **Se esse objeto existir, ele substitui (não mescla com) as configurações do overlay `.codex-plugin/plugin.json`.** Identidade (`name`, `version`, `description`) e componentes continuam vindo da raiz.
- Caminhos devem começar com `./` e ficar dentro da raiz do plugin.
- Manifests aceitos na validação: `plugin.json` (Agent Plugins), `.codex-plugin/plugin.json`, `.agent-plugin/plugin.json` e `.claude-plugin/plugin.json` (este último é normalizado para o formato Codex; código de aviso `claude_format_normalized`).

Campos do formato Codex (compatível), segundo `plugins/deploy/submission` e `plugins/deploy/submission-errors`:

```json
{
  "name": "mesa-study",
  "version": "0.1.0",
  "description": "...",
  "author": { "name": "..." },
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "...",
    "shortDescription": "...",
    "longDescription": "...",
    "developerName": "...",
    "category": "Education & Research",
    "capabilities": ["..."]
  }
}
```

- `name` kebab-case estável (máx. 64, `[a-z0-9_-]`); `version` semver; `author.name`; `interface` exigido no formato Codex.
- `composerIcon` e `logo` são exigidos na validação de pacote Codex (para upload/submissão; não achei exigência explícita para instalação local).
- Templates oficiais de referência do próprio ecossistema: Figma/Notion/build-web-apps (links em `plugins/build/plugins`, repositório `openai/plugins` — não aberto).

Implicação para a Mesa: o `.claude-plugin/plugin.json` do `claude-mod/mesa-study` **não** é um bom ponto de partida para o Codex: o protótipo Claude é um *Mod* (hooks no formato `{"modules": [...]}`, `userConfig`, sem skills/MCP). O Codex não executa Mods; `userConfig` e `${user_config.*}` não são expandidos (`plugins/guides/submit-claude-plugin`). O porte para Codex precisa ser reautorado como **skills + (opcional) MCP stdio**, num diretório novo (ex.: `codex-mod/mesa-study/`).

## 2. Marketplace local e ativação sem mudar configuração pessoal

Documentado em `plugins/build/plugins` (seções *Build your own curated plugin list*, *Marketplace metadata*, *How local marketplaces work*) e `codex/enterprise/plugin-management`:

- Fontes locais lidas pelo app:
  - repo: `$REPO_ROOT/.agents/plugins/marketplace.json`
  - legado: `$REPO_ROOT/.claude-plugin/marketplace.json` (compatível com Claude)
  - pessoal: `~/.agents/plugins/marketplace.json`
- Entrada de marketplace (campos obrigatórios por entrada: `name`, `source`, `policy.installation`, `policy.authentication`, `category`):

```json
{
  "name": "mesa-local",
  "interface": { "displayName": "Mesa local" },
  "plugins": [
    {
      "name": "mesa-study",
      "source": { "source": "local", "path": "./codex-mod/mesa-study" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Education & Research"
    }
  ]
}
```

- `source.path` é relativo à **raiz do marketplace** (não à pasta `.agents/plugins/`), com `./` e dentro da raiz. Para escopos pessoais, o padrão citado é `./.codex/plugins/<plugin>`.
- Instalação: o app copia para `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/`; para plugin local, `$VERSION` é `local` — o app carrega a cópia do cache, não a pasta fonte. Editar a fonte exige reinstalar/atualizar.
- Ativação por repo, sem tocar no config do usuário: `.codex/config.toml` do projeto com

```toml
[plugins."mesa-study@mesa-local"]
enabled = true
```

  Projeto precisa ser **confiável** (`trusted project`) — só então o `.codex/config.toml` é carregado; settings de projeto sobrepõem usuário/nuvem/sistema. O navegador de plugins grava escolhas do usuário em `~/.codex/config.toml`, mas a fonte de repo pode habilitar. Plugins com MCP são marcados **Desktop only** no gerenciamento por workspace.
- Política de MCP do plugin pela config: `[plugins."mesa-study@mesa-local".mcp_servers.mesa] enabled = true` + `default_tools_approval_mode` etc.
- CLI (verificado por `--help`, sem ler config): `codex plugin add <plugin[@marketplace]> [--json]`, `codex plugin list`, `codex plugin remove`; `codex plugin marketplace add <owner/repo|url|./local-root>`, `list`, `upgrade`, `remove`. `codex plugin marketplace add` e `codex plugin add` **gravam no config do usuário** — não executar sem consentimento explícito.

## 3. MCP stdio empacotado no plugin

- `codex/mcp` (developers): Codex suporta **STDIO** (processo local) e **Streamable HTTP**; servidores fornecidos por plugin "são lançados pelo plugin, então o config do usuário não define o comando de transporte"; o usuário só controla liga/desliga e política de ferramentas em `plugins.<plugin>.mcp_servers.<server>`.
- Formato portável: `mcp.json` na raiz, com `mcpServers` e **campo `type` de transporte por servidor** (exemplo documentado: `"type": "streamable-http"`). Não renomear `.mcp.json` para `mcp.json` nem vice-versa: o formato portável exige `type`; o `.mcp.json` do Codex (exemplo oficial de HTTP) omite `type`.
- **Não existe exemplo oficial completo de stdio em `.mcp.json`** nas páginas consultadas. As evidências parciais e convergentes:
  - `config-reference`: campos de stdio em `config.toml` — `command`, `args`, `env`, `env_vars`, `cwd` (o discriminador é `command` vs `url`).
  - `api/docs/guides/agents-api/tools/plugins` (mesmo dono, formato `.mcp.json`): para **Stdio**, `env_vars` lista variáveis passadas ao processo e **`cwd` relativo resolve a partir da raiz do plugin**.
  - `codex/config-file/config-sample`: exemplo canônico de stdio (`command`, `args`, `env`, `env_vars`, `cwd`).
  - Conclusão marcada como **inferência a validar** (teste manual, seção 9): `.mcp.json` provável = `{"mcpServers":{"mesa":{"command":"node","args":["./host/mcp.mjs"],"cwd":"./","env_vars":[...]}}}`; no portável, `{"type":"stdio",...}` é o palpite, **não confirmado** por fonte oficial.
- **Submissão pública**: só MCP remoto HTTPS (Streamable HTTP); MCP local exige contato com a OpenAI. Isso **não** limita o uso local do plugin (teste/desenvolvimento), mas impede publicação pública do caminho stdio.

## 4. Variáveis de ambiente e `${...}` no bundle

- A variável correta documentada é **`PLUGIN_ROOT`** (raiz instalada do plugin) e **`PLUGIN_DATA`** (diretório de dados gravável), recebidas por **comandos de hook** de plugin. Fonte: `plugins/build/plugins#bundled-mcp-servers-and-lifecycle-hooks` e `learn.chatgpt.com/docs/hooks` (plugin-bundled hooks).
- `CLAUDE_PLUGIN_ROOT` e `CLAUDE_PLUGIN_DATA` são definidos **apenas por compatibilidade** com hooks de plugins existentes (Claude/legado). Não há `CODEX_PLUGIN_ROOT` em nenhuma página consultada.
- **Não há documentação oficial de expansão de `${PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_ROOT}` dentro de `.mcp.json`/`mcp.json`.** Não presumir que a variável Claude funcione; para MCP stdio, o caminho documentado/indireto é `cwd` relativo à raiz do plugin (ver seção 3) — a validar. Alternativa segura: hook `SessionStart` (que recebe `PLUGIN_ROOT`) fornecendo contexto/caminhos à skill, ou o fallback skill-only (seção 10).

## 5. Skills e ativação (`$mesa` vs `/mesa`)

`learn.chatgpt.com/docs/build-skills` e `docs/skills-and-plugins`:

- Skill = pasta com `skills/<nome>/SKILL.md` (`name` + `description` obrigatórios), scripts/referências opcionais.
- **Codex usa `$` para mencionar skill** ("ChatGPT supports `@` mentions, while Codex supports `$` mentions for skills"). Em Codex CLI/IDE também existe `/skills` para listar. **`/mesa` não é sintaxe documentada** para skills/plugins — não usar. Ativação implícita se dá pela `description`.
- Skill dentro de plugin: aparece no catálogo/autocomplete depois de instalar; começar nova conversa/sessão. Codex inclui **o caminho do arquivo da skill** na lista inicial — isso permite que a skill localize seus próprios scripts/referências em runtime.
- `skills/<nome>/agents/openai.yaml` (opcional): `interface` (display_name, short_description, ícones, brand_color, default_prompt), `policy.allow_implicit_invocation` (default true) e `dependencies.tools` (exemplo documentado usa `transport: "streamable_http"`).
- Orçamento da lista de skills: ~2% da janela de contexto ou 8.000 caracteres.

## 6. UI / custom pane no Codex

- `plugins/build/chatgpt-ui` documenta MCP Apps (iframe, bridge `postMessage`, `_meta.ui.resourceUri`, inline/fullscreen/PiP) **para ChatGPT**; `window.openai` é explicitamente "ChatGPT provides". O padrão MCP Apps é multi-host, mas a doc de desenvolvimento não promete renderização no Codex.
- Evidência oficial de que o **app Codex tem painéis MCP embutidos** (changelog `developers.openai.com/codex/changelog`):
  - 2026-04-24 (app 26.423): "Kept embedded MCP app panels from restarting or losing state during fullscreen changes and thread reloads."
  - 2026-06-11 (app 26.609): "…fixed … MCP app sizing after right-pane transitions…"
  - Changelog atual (item buscado no índice): "Preserve MCP App UI metadata in tool-call events and history".
- `codex/enterprise/plugin-management`: plugin que declara MCP é **Desktop only** (ChatGPT desktop app).
- Leitura correta: existe superfície de painel MCP no desktop, mas **sem contrato de desenvolvedor documentado para Codex** (bridge, display modes, garantias). Não publicar claim de host UI no Codex; manter as ferramentas úteis sem UI e tratar o painel como experimental a validar.

## 7. Imagem em resultado de ferramenta MCP

- Nenhuma página consultada documenta `content: [{type:"image",...}]` em resultado MCP sendo exibido/entendido pelo Codex. O `config-sample` mostra `[tools] view_image = true` (ferramenta local de imagem), o que não equivale a conteúdo de imagem vindo de MCP.
- Lacuna explícita: **não afirmar visão nativa de imagem em resultado MCP no Codex**. Testar com PNG sintético via servidor stdio local (seção 9) antes de projetar a captura do Xournal++ como imagem lida pelo modelo no Codex. (No protótipo Claude, o pedido referencia a imagem local pela ferramenta nativa `Read`; esse mecanismo é específico do Claude e não se traduz automaticamente.)

## 8. Versão mínima (o que é oficial)

- **App Codex 26.324 (2026-03-25)**: changelog "Build and install plugins in Codex" — plugins no app, CLI e IDE (na época), marketplace de repo/home, scaffold `@plugin-creator`. Mesma data, app 26.324 "Redesigned the skills and plugins browse and manage pages".
- 26.318 (2026-03-19): skills no menu do composer.
- Hoje: `codex/plugins` diz que o **IDE extension não suporta plugins** (mudou desde março); app + CLI sim.
- CLI 0.160.1 instalado tem a família `codex plugin` (add/list/remove/marketplace).
- **Não há versão mínima documentada para o schema portável Agent Plugins** (root `plugin.json`) nem para `extensions.com.openai`. Recomendação: usar o app atualizado (changelog de outubro/2026) e validar no app; a doc só garante 26.324+ para o conceito de plugin.

## 9. Roteiro de teste manual no app (não executado; requer consentimento)

Pré-condições: app atualizado; projeto confiável; Node 22.19+ e Poppler; **apenas fixtures sintéticas** (PDF gerado, PNG gerado); nada de materiais de curso, credenciais ou sessões.

1. Criar `codex-mod/mesa-study/` com `.codex-plugin/plugin.json` (ou `plugin.json` portável), `skills/mesa/SKILL.md`, `assets/icon.png`, `logo.png` e `.mcp.json` mínimo de stdio apontando para um servidor sintético (`host/mcp.mjs` com uma tool `mesa_echo` e uma tool `mesa_image` que devolve PNG sintético).
2. Criar `$REPO_ROOT/.agents/plugins/marketplace.json` com a entrada acima e `$REPO_ROOT/.codex/config.toml` com `[plugins."mesa-study@mesa-local"] enabled = true`.
3. Validar JSON/caminhos (`./`, sem `..`) sem abrir o app.
4. Abrir o app no projeto; conferir a fonte local no diretório de Plugins; instalar; confirmar a cópia em `~/.codex/plugins/cache/mesa-local/mesa-study/local/`.
5. Nova conversa Codex: `/skills` deve listar `mesa`; usar `$mesa` explicitamente e por descrição (implícito).
6. Verificar chamadas `mcp__mesa__*` no transcript; confirmar que o processo stdio subiu com o helper real e que a tool respondeu.
7. Testar imagem: `mesa_image` devolvendo PNG sintético; registrar se o modelo descreve/usa a imagem (lacuna da seção 7).
8. Se houver componente MCP Apps, testar painel à direita; se não renderizar, registrar o fallback textual (seção 6).
9. Se portar hooks: `/hooks` para revisar e confiar; hooks de plugin não rodam sem trust.
10. Reverter: remover plugin/marketplace de teste e a cópia no cache; conferir que configs pessoais e sessões ficaram intactas.

Pontos de atenção: editar arquivos do plugin exige reinstalar (cache); `codex plugin marketplace add`/`codex plugin add` e o fluxo de instalação pelo app **mudam config pessoal/cache** — só com o usuário no comando; o agente não deve executar.

## 10. Alternativa skill-only (se o bundle local não suportar stdio)

- Plugin sem `.mcp.json`/`mcp.json`, apenas `skills/`. A skill pode ter `scripts/` e `references/`; o Codex fornece o **caminho da skill** na lista inicial, então a instrução pode executar `node <caminho-da-skill>/scripts/...` pela ferramenta de shell, com aprovação normal.
- Implicações: sem tools tipadas nem namespacing MCP; a saída entra no transcript; sujeita a sandbox/aprovação de shell; depende de Node/Poppler no ambiente e do checkout do helper (hoje o `host/` do `claude-mod/mesa-study` é dependência deste checkout, não distribuível sozinho).
- Vantagem: evita `${PLUGIN_ROOT}`/cwd de `.mcp.json` (não documentados), evita launch de processo pelo host e funciona mesmo se o app não aceitar stdio empacotado.
- Meio-termo para um teste pontual (com o usuário): registrar o servidor stdio manualmente em **Settings → MCP servers** (`~/.codex/config.toml`), sem empacotar no plugin — altera config pessoal, portanto fora do nosso escopo agora.

## 11. Lacunas (não inventei nada para preenchê-las)

1. Sem exemplo oficial de `.mcp.json` **stdio** completo (só HTTP). Campos/caminho exatos a validar no app.
2. Sem documentação de expansão de variáveis (`${PLUGIN_ROOT}` etc.) em `.mcp.json`; `CLAUDE_PLUGIN_ROOT` é apenas compatibilidade de hooks.
3. Sem contrato de dev para UI MCP no Codex (apesar de painéis existirem no changelog).
4. Sem doc de conteúdo de imagem MCP no Codex.
5. Sem versão mínima documentada para o schema portável Agent Plugins.
6. `learn.chatgpt.com` espelha os docs de `developers.openai.com`; em caso de divergência, tratei developers como canônico.

## 12. Esquema concreto recomendado (marcado: doc vs a validar)

```
codex-mod/mesa-study/
├── plugin.json              # Agent Plugins (doc) OU .codex-plugin/plugin.json (doc, compat)
├── .mcp.json                # stdio local (a validar) OU ausente no modo skill-only
├── skills/mesa/SKILL.md     # doc
├── skills/mesa/scripts/...  # doc (skill scripts)
├── assets/icon.png, logo.png# exigidos para validação Codex (doc)
└── hooks/hooks.json         # opcional; formato de hooks do Codex (doc), não Mods
```

`.mcp.json` (inferido de docs oficiais; testar):

```json
{
  "mcpServers": {
    "mesa": {
      "command": "node",
      "args": ["./host/mcp.mjs"],
      "cwd": "./",
      "env_vars": ["MESA_CACHE_DIR"]
    }
  }
}
```

Status desta pesquisa: documental + help de CLI. Não é validação de app; Node/Poppler reais não foram executados aqui; a captura do Xournal++ continua com engine simulado nos testes existentes; carregamento no Codex app e inferência autenticada seguem pendentes.

## Fontes principais

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/extensions
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/submission-errors
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/plugins/guides/submit-claude-plugin
- https://developers.openai.com/plugins/plugin-guidelines
- https://developers.openai.com/plugins/reference
- https://developers.openai.com/codex/plugins
- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/build-skills
- https://developers.openai.com/codex/enterprise/plugin-management
- https://developers.openai.com/codex/config-file/config-reference
- https://developers.openai.com/codex/config-file/config-sample
- https://developers.openai.com/codex/glossary
- https://developers.openai.com/codex/changelog
- https://developers.openai.com/api/docs/guides/agents-api/tools/plugins
- https://learn.chatgpt.com/docs/hooks
- https://learn.chatgpt.com/docs/skills-and-plugins
- https://platform.openai.com/docs/mcp
