# #62 — Relatar um problema: resultado

Branch `claude/gallant-kilby-535db1`. Sem push nem PR; nenhuma issue criada,
nenhuma inferência chamada (nem `opencode run`, nem `pi`, nem Claude).

## O que entrou

- **`npm run triage`** (`desk/scripts/triage.mjs`): imprime o relatório limpo
  e as saídas. O endereço da issue é só impresso; nada sai da máquina.
- **"Relatar um problema"** no menu Mais opções do tutor, antes de "Recolher o
  tutor": diálogo com o relatório para ler e uma linha por saída (o que é, o
  aviso dela, o botão de copiar); no rodapé, Fechar e **Abrir issue no
  GitHub**. Textos em pt-BR e en (`triage.*`). O relatório em si fica em
  pt-BR nos dois idiomas, porque vai para as issues do repositório.
- **Relatório**: versão e commit da Mesa, Electron, sistema, Node; versões do
  Pi, do Claude Agent SDK e do OpenCode; o doctor; motor e modelo em uso; as
  últimas 20 linhas de erro/aviso do `desk.log`.
- **Saídas**:
  1. prompt completo para Claude Code / Codex (conferir a máquina e consertar,
     procurar issue parecida, **rascunhar** a issue sem criar);
  2. **Pi** (pedido durante o ticket): `pi --model <provedor/id> '<prompt>'`,
     interativo, com o modelo que a pessoa já usa — o em uso, os recentes e os
     favoritos do seletor (#59); trocável na janela; sem os grátis do Zen (pelo
     Pi dão 403, #57); aviso "pode cobrar como uma conversa normal"; sem Pi, a
     saída some com explicação. O modelo só pode vir da lista (texto livre não
     entra no comando);
  3. `opencode run --model opencode/<grátis> '<prompt curto, passo a passo>'`:
     a lista é a viva (`opencode models opencode`), o que é grátis é o
     `isFree` do `core/freemodels.bend`, a política é a do `free-models.json`
     (a mesma frase do seletor); preferência DeepSeek Flash, depois MiniMax,
     depois retenção zero, sem nome fixo. Sem OpenCode ou sem grátis, some com
     explicação;
  4. issue nova em `FariaDev/mesa-e-conversa`, com título e relatório (cortado
     com aviso se passar de 7500 caracteres). O host só abre esse endereço.

## Limpeza (`desk/triage-scrub.mjs`)

Antes de qualquer saída: casa → `~` (e a casa de outra pessoa,
`/Users/x`, `/home/x`, `C:\Users\x`); runtime → `<runtime>`; vault →
`<vault>`; pasta, nome e id de matéria → `<matéria N>`; toda subpasta do vault
(inclusive matéria que a Mesa ainda não reconhece) → `<pasta>`; nome de PDF
conhecido e qualquer `*.pdf` → `<pdf>`; `.xopp`/imagens → `<arquivo>`;
`.jsonl` → `<sessão>`; segredos (o `redactSecrets` do log mais tokens do
GitHub/Slack/Google e campos `"key"`/`"token"` de JSON, o formato dos
`auth.json`) → `[oculto]`; linha de log com cara de sessão (`"role":`,
`"content":`…) sai inteira, com marcador. A triagem não lê sessão, `auth.json`,
chave nem captura: o doctor só olha existência de arquivo, e do `desk.json`
saem apenas recentes e favoritos do seletor.

Nome de arquivo com espaço pode levar junto a palavra anterior
("falhou Prova Final.pdf" → `<pdf>`): é de propósito, perde contexto em vez de
vazar.

## Doctor reaproveitado

As checagens saíram de `scripts/doctor.mjs` para `desk/doctor-checks.mjs`
(fica no pacote, porque o app instalado também roda a triagem). O
`npm run doctor` só imprime; a saída antes/depois foi comparada num runtime
sintético e é idêntica.

## Onde mora

- Coleta: `desk/triage-report.mjs`; limpeza: `triage-scrub.mjs`; grátis:
  `triage-free-model.mjs`; Pi: `triage-pi-model.mjs`; saídas:
  `triage-outputs.mjs` (também importado pela janela para refazer o comando
  do Pi ao trocar o modelo).
- Janela: `triage-worker.mjs` (a coleta roda `git`, `--version` e
  `opencode models` de forma síncrona e não pode travar o processo principal),
  `triage-host.cjs` (canais `triage-report` e `triage-open-issue`),
  `preload.cjs`, `src/triage.mjs` (o diálogo nasce no JS: o `index.html`
  passaria do teto de linhas), item `#more-triage` em `src/tutor-header.mjs`.
- `main.cjs`: o `openExternal` de teste (grava em `opened-links.jsonl`) virou
  `openExternalLink`, dividido entre OpenCode e triagem.
- Linha nova em `docs/agents/mapa.md`; parágrafo no `README.md`.

## Decisões para você olhar

1. **Item do menu em JS, fora do Bend.** O ADR 0001 manda interface nova para
   JS; o `core/tutorheader.bend` segue com os seis itens e as leis dele
   intactas, e o host acrescenta o sétimo. Não migrei o núcleo inteiro (seria
   trabalho grande sem ganho para este ticket). `verify:bend` não se aplica.
2. **Limpeza em JS.** Pelo teste do ADR ("o app faz o que não devia?") dá para
   defender que é invariante. Deixei em JS porque é casamento de texto (regex)
   e o `redactSecrets` que ela estende já mora em JS; a garantia vem do teste
   de vazamento. Se preferir no Bend, vira ticket próprio.
3. **Pi interativo (sem `-p`)**: a pessoa acompanha e responde enquanto o Pi
   conserta ou rascunha. Flags conferidas no `pi --help` (sem inferência).

## Testes

- `tests/triage-leak.test.mjs` — **vazamento**: roda o `npm run triage` de
  verdade no perfil falso `tests/fake-triage-profile.mjs` (casa
  `ana.secreta`, vault, três matérias — uma configurada, uma descoberta, uma
  que a Mesa não reconhece —, PDFs, os dois `auth.json`, sessão JSONL, captura,
  título de sessão no `desk.json`, e um `desk.log` cru com caminhos, `sk-…`,
  `Bearer`, `ghp_…`, JSON de `auth.json` e trecho de sessão) e falha se
  qualquer um dos 26 textos aparecer na saída ou no endereço da issue
  decodificado. Prova também que o OpenCode e o Pi falsos só ouviram
  `--version` e `models`. Conferido que morde: desligando a limpeza das pastas
  do vault, ele acusa "Física Confidencial".
- `tests/triage-units.test.mjs` (limpador, log, grátis, Pi, aspas no `sh`,
  comandos, prompts, endereço da issue, doctor), `tests/triage-host.test.mjs`
  (canais com `ipcMain` e worker falsos).
- `tests/triage-ui.mjs` — janela real no perfil falso: ordem do menu, nada do
  perfil na tela, no que é copiado (área de transferência trocada por um
  gravador na página) nem no link aberto; troca do modelo do Pi; inglês.

## Portões

- `MESA_GATE_CACHE=0 npm test`: **1942/1942**.
- `npx tsc -p tsconfig.json` e `npx eslint .`: limpos (arquivos novos na lista
  do `tsc`).
- `MESA_REVIEW_SHOTS=1 node tests/triage-ui.mjs`: PASS. Capturas em
  `docs/reviews/2026-10-21/relatar-problema-sTR9cL/` (menu claro/escuro,
  diálogo claro/escuro/en). Os nomes de matéria nelas são do perfil falso.
- `npm run test:packaged`: PASS (não abre a triagem no app empacotado; os
  arquivos que ela importa estão todos na lista do pacote).
- `npm run verify:bend`: não rodado, nenhum `.bend` mudou.

## Observações

- O `npm ci` do worktree trouxe o Electron truncado ("Electron Framework"
  com 84 MB) e derrubava 21 testes de PDF/Electron sem relação com a #62.
  Reinstalar com `node node_modules/electron/install.js` resolveu. Vale saber
  se aparecer em outra sessão.
- Sem cobertura de ponta a ponta: "sem Pi" pelo terminal (o perfil falso não
  esconde o `pi` real do PATH); coberto no teste de unidade.
