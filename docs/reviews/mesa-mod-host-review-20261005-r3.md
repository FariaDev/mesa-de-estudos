# Revisão independente r3 — host do mod Mesa no Claude Desktop

Revisor: agente independente (somente leitura). Único arquivo escrito: este relatório.
Sem login, inferência, captura real, execução do helper de janelas, app/curso, install/update, commit ou push.
Testes e reproduções rodaram apenas em `os.tmpdir()` (`/private/var/folders/.../T/opencode/mesa-r3-probe/`); nenhum arquivo do repo foi alterado.
`lib/` foi lido apenas para conferir o contrato CLI↔consumidor (está sendo alterado por outro agente; não revisei falhas transitórias dele).

## 1. Snapshot congelado usado

`claude-mod/` é untracked (`?? claude-mod/` no `git status`), então não há commit de referência; tudo abaixo foi conferido contra este snapshot:

| Arquivo | mtime | sha256 (12) |
|---|---|---|
| `host/capture.mjs` | 10-05 21:27 | `da16fc1089f4` |
| `host/cli.mjs` | 10-05 21:11 | `c041438454d0` |
| `host/config.mjs` | 10-05 21:26 | `88aaace100ec` |
| `host/errors.mjs` | 10-05 21:09 | `45f2384573cd` |
| `host/index.mjs` | 10-05 21:27 | `16e25c5e9f9c` |
| `host/operations.mjs` | 10-05 21:11 | `b956fa4d6636` |
| `host/output.mjs` | 10-05 21:27 | `f9ccd120e245` |
| `host/page.mjs` | 10-05 21:26 | `09a4ed9a6ff7` |
| `host/paths.mjs` | 10-05 21:10 | `b935c126c605` |
| `host/proc.mjs` | 10-05 21:10 | `daffe163729c` |
| `host/testing.mjs` | 10-05 21:27 | `7edc4259d373` |
| `host/tools.mjs` | 10-05 21:45 | `20775d94c577` |
| `host/validate.mjs` | 10-05 21:10 | `463f53b20265` |
| `tests/host-capture.test.mjs` | 10-05 21:39 | `5943f8c6f28e` |
| `tests/host-cli.test.mjs` | 10-05 21:44 | `e3ad4b8e63bb` |
| `tests/host-output.test.mjs` | 10-05 21:35 | `b944171511fb` |
| `tests/host-page.test.mjs` | 10-05 21:47 | `d0055be92817` |
| `tests/host-poppler.test.mjs` | 10-05 21:36 | `652bf856f419` |
| `tests/integration-bridge.test.mjs` | 10-05 21:30 | `24f3a588fc93` |
| `lib/helper.mjs` (contrato) | 10-05 21:50 | `051190600d87` |
| `visual-check/windows` (helper compilado) | 09-04 20:59 | `fc484e8deeb7` |
| `visual-check/windows.swift` | 09-21 19:53 | `c5eab3480d54` |

## 2. Evidência própria executada

- **Suíte host**: `node --test tests/host-{cli,page,capture,output,poppler}.test.mjs` → **52/52 passam, 0 skip**, incluindo os **5 testes Poppler reais** (pdfinfo/pdftocairo 26.10.0 em `/opt/homebrew/bin`, o primeiro da lista fixa). Confirma a claim do pai.
- **Ponte real**: `node --test tests/integration-bridge.test.mjs` → **1/1 passa** (Node → CLI → Poppler, PDF sintético, PDF intacto por hash).
- **Repro A (root obsoleta)**: `pageOperation` com `roots: [root, pasta-removida]` → `ROOT_NOT_FOUND`, mesmo com o PDF dentro de `root`; e o mesmo via `lib/helper.mjs` real (`probe4`): `roots=[root, stale]` → `{"ok":false,"error":{"code":"ROOT_NOT_FOUND",...}}`; `roots=[root]` → ok.
- **Repro B (CLI por symlink)**: `ln -s .../host/cli.mjs /tmp/cli-link.mjs && node /tmp/cli-link.mjs '{"op":"teleporte"}'` → **exit 0, stdout 0 bytes, stderr 0 bytes**. Idem por diretório-pai symlinkado (`node linkdir/mesa-study/host/cli.mjs ...`). Diagnóstico: `argv1` mantém o symlink; `import.meta.url` é o caminho real.
- **Repro C (PDF com senha, Poppler real)**: PDF sintético cifrado com `qpdf --encrypt user owner 256` → `pdfinfo` real sai **1** com `Command Line Error: Incorrect password`; `pageOperation` devolve `PDFINFO_FAILED - pdfinfo falhou. Command Line Error: Incorrect password`. Com senha de usuário vazia (`--encrypt "" owner 256`), `pdfinfo` sai 0, imprime `Encrypted: yes` e a página é renderizada normalmente.
- **Não-achados que testei para descartar**: página minúscula (MediaBox 1 pt → PNG 114 B) passa do piso de 100 B (`assertPng`); a invariante "bytes > 512 KiB ⇒ chars > 131072" vale (512 KiB / 4 B por char = 131072); nenhum caminho pessoal/curso nos host tests (grep vazio).

## 3. Achados

### A. [Médio — não bloqueador] Root autorizada inexistente aborta a página mesmo com o arquivo dentro de outra root válida

- **Onde**: `host/paths.mjs:28-35` — o laço resolve TODAS as roots e lança `ROOT_NOT_FOUND` na primeira que não existe, antes de testar se o arquivo está dentro de alguma root que existe.
- **Fluxo normal afetado**: o consumidor manda `requestRoots(doc) = [dirname(doc.path), ...session.roots]` (`lib/mesa.mjs:286-295`). `session.roots` é persistida e a UI só **adiciona** pasta (`lib/view.mjs:84-88`); não há remoção. Se o usuário apagar/desmontar uma pasta adicionada antes (ex.: pendrive), **toda leitura de página passa a falhar** — inclusive de PDFs em outra pasta — até a root obsoleta sair pela retenção das 4 últimas.
- **Evidência**: repro A acima (host puro e via `lib/helper.mjs` real), com Poppler real; o erro na UI é `Falha no helper: Diretório autorizado não existe: <pasta>`.
- **Correção mínima sugerida** (sem afrouxar confinamento): pular roots que não resolvem e só falhar `ROOT_NOT_FOUND` se nenhuma root resolver; a pertinência continua por realpath+prefixo. Alternativa no consumidor: podar roots obsoletas ao montar o pedido.

### B. [Baixo] CLI sai 0 em silêncio quando invocado por caminho com symlink

- **Onde**: `host/cli.mjs:48-51` — `import.meta.url === pathToFileURL(process.argv[1]).href`; em ESM o Node resolve symlinks para `import.meta.url`, mas `argv[1]` preserva o caminho digitado.
- **Impacto**: se `$.plugin.root` for um caminho symlinkado (setup comum de desenvolvimento, ex.: plugin linkado na pasta de plugins), **toda** operação do helper vira exit 0 sem JSON; o consumidor reporta `helper-json` ("O helper não devolveu JSON válido") e página/captura param, sem pista do motivo.
- **Evidência**: repro B (arquivo symlinkado e diretório-pai symlinkado).
- **Correção mínima**: comparar `fs.realpathSync(process.argv[1])` com `fileURLToPath(import.meta.url)` (ou tratar argv[1] ausente/inexistente como erro).

### C. [Baixo] `PDF_ENCRYPTED` é inalcançável com Poppler real; PDF com senha vira `PDFINFO_FAILED` com mensagem crua

- **Onde**: `host/page.mjs:197-206` executa `pdfinfo` antes de interpretar `Encrypted:`; `pdfInfoError` (`:83-89`) só devolve `PDF_ENCRYPTED` quando `pdfinfo` sai 0 com `Encrypted: yes` e sem `Pages:`.
- **Fato real**: `pdfinfo` com senha de usuário não vazia sai **1** e imprime `Command Line Error: Incorrect password` (verificado com qpdf 256-bit). O código estável desenhado e o teste `host-page.test.mjs:330-333` (fake com exit 0 + `Encrypted: yes`) não correspondem ao Poppler real.
- **Impacto**: apenas código/mensagem de erro menos claros; a recusa é segura e nenhuma pasta fica para trás.
- **Correção mínima**: mapear stderr de `pdfinfo` contendo `password` para `PDF_ENCRYPTED` (ou detectar `Encrypted:` também no caminho de falha).

### D. [Informativo — lacuna de prova] `defaultHelperPath()` nunca é exercitado por teste

- **Onde**: `host/capture.mjs:37-39`; todos os testes de captura injetam `helperPath` (`tests/host-capture.test.mjs:16,61,...`), então o caminho de produção `../../../visual-check/windows` não é coberto.
- **Verificação manual (sem executar o binário)**: resolve para `<repo>/visual-check/windows`, existe e tem X_OK; o `scripts/doctor.mjs:39-41` usa a mesma raiz relativa. O binário compilado contém as seis chaves do contrato (`id`, `app`, `title`, `bounds`, `permission`, `windows`), embora seu mtime (09-04) seja anterior ao `windows.swift` (09-21).
- **Sugestão**: um teste que só afirme o caminho resolvido (sem rodar o helper), e rebuild do binário antes do ensaio real.

### E. [Informativo — limite residual] A revalidação de identidade em produção compara só id+app

- **Onde**: `host/capture.mjs:93-103`; o helper real `visual-check/windows.swift:5` emite apenas `id/app/title/bounds` — não emite `ownerPID`. O teste `host-capture.test.mjs:205-261` prova um ramo que a produção nunca exercita.
- **Consequência**: entre a listagem e o `screencapture`, a reutilização do mesmo ID por outra janela "Xournal++" não seria detectada; o desenho já é conservador (ambiguidade, sumiço e ID inválido recusam) e o teste foi escrito com "quando exposto". Não é bloqueador; vale registrar como limitação do par helper/host.

### F. [Informativo — robustez] Dois pontos menores de limpeza/erro

- `host/output.mjs:98-105`: se `fs.chmod(dir, 0o700)` falhar após o `mkdtemp`, o diretório vazio (já 0700) fica para trás — o `rm` de limpeza só existe no caminho de falha do marcador.
- `host/capture.mjs:235` e `host/page.mjs:242`: `fs.chmod(snapshotPath, 0o600)` sem `catch`; numa falha exótica de FS a operação vira `INTERNAL` mesmo com o PNG pronto. Sem impacto de privacidade (a pasta é 0700 e o arquivo já está dentro dela).

## 4. Claims da r2 conferidas

| Claim | Status | Evidência |
|---|---|---|
| SVG grande → `svg:null` + `previewWarning` sem truncar; SVG inválido segue fatal | **Confirmado** | `host/page.mjs:105-137,223-226`; fake + smoke real de 55 linhas (svg real > 131072, PNG gerado, arquivo removido) |
| IDs de pedido/listagem restritos a 1..0xffffffff | **Confirmado** | `host/capture.mjs:41-43,59-63`; testes com 0, negativos, float, string, `2^32`, `Infinity` |
| Identidade id/app e `ownerPID` só quando o helper fornece | **Confirmado no código** | `host/capture.mjs:93-103`; ressalva E |
| Leaf symlink / outro UID / gravável por grupo-outros recusados sem chmod alheio | **Confirmado** | `host/output.mjs:34-79`; testes preservam o modo original |
| Marcador host + kind page/capture + token 32 hex + timestamp | **Confirmado** | `host/output.mjs:25-26,131-140`; poda preserva marcador fraco, host errado, kind errado, sem marcador, symlink e "curso" |
| Poppler resolvido só de `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, na ordem, sem PATH | **Confirmado** | `host/tools.mjs:24-30`; mesma lista do `scripts/doctor.mjs:27`; teste de ordem + smoke real |
| 52/52 host tests, 5 Poppler reais sem skip | **Confirmado por execução** | §2 |
| Ponte `integration-bridge` 1 pass | **Confirmado por execução** | §2 |

## 5. Requisitos do brief verificados por inspeção

- Helper por **argv, sem shell**: `host/proc.mjs:17-24` usa `execFile` com `shell:false`; só `proc.mjs` importa `node:child_process` (teste varre o diretório); executável/ferramenta/helper nunca vêm do JSON (`host/operations.mjs:1-3`, testes de campos extras hostis).
- **PDF somente leitura e escolhido**: realpath + roots (realpath) + extensão + tamanho + magic `%PDF-`; symlink que escapa recusado; hash do PDF inalterado no smoke real.
- **Cache privado**: `mkdtemp` 0700 por operação, marcador 0600, PNG/SVG 0600, poda só de diretórios `mesa-study-*` com marcador válido e mais velhos que o TTL; nada alheio é lido/removido.
- **Captura específica**: `screencapture -x -o -l<ID>` (teste garante que nenhuma flag de tela/janela interativa aparece), janela única/ID explícito, listagem inteira revalidada antes/depois; helper e caminho de captura fixos no código.
- **Preservação**: nenhum arquivo de `desk/`, `core/`, `chat/`, bundle ou config foi tocado nesta revisão.

## 6. Limites de prova (o que **não** está validado)

- **Desktop**: carregamento real do mod, `$.process.run` ("CLI only" no tipo), `$.fs.stat({resolve})`/`realPath`, teto do campo `Svg` aceitar `null`, e o prompt de análise com `Read` — nada disso foi executado (proibido).
- **Captura real/TCC**: o binário `visual-check/windows` **não foi executado** (evitei listar janelas pessoais). Portanto: `CGPreflightScreenCaptureAccess`, mensagem de permissão, `screencapture -l` real e a revalidação com o helper real continuam não comprovados. O binário compilado é mais antigo que o `windows.swift`; contém as chaves do contrato, mas um rebuild/ensaio real continua pendente.
- **Inferência autenticada**: não executada.
- **Fake vs real**: o teste de criptografia usa um shape que o `pdfinfo` real não produz (achado C). Os demais fluxos fake (SVG/PNG/pdfinfo) foram contrastados com os smokes reais e batem.

## 7. Veredito

**Nenhum bloqueador** no host do mod: os contratos centrais do brief (argv sem shell, roots por realpath, leitura somente, cache privado com poda restrita, captura `-lID` com revalidação e ambiguidade recusada) estão implementados e provados pelos 52 testes host + 1 ponte, com Poppler real. O achado mais relevante é **A (Médio)**: uma root obsoleta na lista do consumidor derruba a leitura de páginas de outras roots — bug reproduzível com Poppler real e correção pequena. B e C são baixos e não afetam segurança. A validação no Desktop (incluindo `$.process.run`, o teto `Svg` com `null` e a captura/TCC real) continua sendo o caminho necessário e não foi feita aqui.
