# Quit antes do `ready` — investigação

Continua o item 4 de `fix-ui-intermitentes-2-resultado.md`: sob carga, o
Electron da Mesa recebeu o `app.quit()` do teste, o `ready` chegou uns 30 ms
depois, o boot (`main.cjs`, `app.whenReady().then(async…)`) viu `quitting` e
retornou, e o processo ficou vivo, sem renderer, até o SIGKILL.

**Conclusão:** o boot que encontra `quitting` e retorna **não** prende o
processo. A ordem "quit, depois ready" foi reproduzida de forma determinística
na Mesa real, com a mesma assinatura do `desk.log`, e o processo sempre saiu.
O candidato de correção (chamar `app.quit()` de novo, ou `app.exit()`) não
muda nada, nem pelo código do Electron nem medido. Por isso `main.cjs` não
mudou. A parada vista sob carga continua sem reprodução; a defesa que já existe
(`closeApp` com SIGKILL em 15 s) é a certa.

Electron 44.7.2, Playwright 1.64.1, macOS. Nenhuma inferência real, nenhuma
Mesa do usuário aberta: runtime temporário de teste (`newRuntime` + `deskEnv`,
Pi falso).

## Como o `ready` do app depende do Playwright

O `loader.js` do Playwright (`-r`) segura o evento `ready` e troca o
`app.whenReady()`. O app só fica pronto quando o Playwright avalia
`__playwright_run()` pelo inspetor do Node, e essa função ainda espera o
`ready` nativo (`await originalWhenReady`). O `electron.launch` só volta depois
desse `Runtime.evaluate`, e para isso a thread principal tem de atender o CDP.

No caso preso, o `launch` voltou, o `firstWindow` esperou 30 s e o `ready` do
app veio só depois do `before-quit`. As duas pontes registraram "encerrada", e
o `start()` só rejeita assim quando é chamado depois do `close()`. Então o
`ready` nativo atrasou mais de 30 s enquanto a thread principal ainda rodava JS.

## O que foi medido

Para controlar quando cada coisa chega, troquei o Playwright por um driver
mínimo do inspetor. Ele sobe o Electron com o mesmo `loader.js`, `--inspect=0` e
`--remote-debugging-port=0`, manda `app.quit()` e `__playwright_run()` nos
instantes pedidos e fecha o socket em "Waiting for the debugger to disconnect",
como o Playwright faz.

| Experimento | Resultado |
|---|---|
| Electron puro: `app.quit()` síncrono no script, em `setTimeout(0)`, dentro e logo depois do `will-finish-launching`, e no `ready` | sai sempre |
| Ticks de JS (`setInterval` 1 ms) entre `will-finish-launching` e `ready` | 0, com e sem carga de CPU (24 processos em 8 núcleos). O trecho dura cerca de 28 ms e é síncrono. |
| `__playwright_run()` 1,5 s **depois** do `ready` nativo (hipótese de microtarefa parada) | o app fica pronto na hora; hipótese descartada |
| **Mesa real**, `app.quit()` e, 0 a 100 ms depois, `__playwright_run()` (15 rodadas) | **15/15 saíram** em cerca de 1,15 s, com código 0. Em 9 rodadas o `desk.log` tem a assinatura do caso preso (as duas pontes "encerrada"); nas outras 6, com 10 a 100 ms de intervalo, o processo saiu antes do `run`. Nenhum Electron sobrou. |
| Mesmo boot num app mínimo, com `app.quit()` de novo ao ver `quitting` | nenhum `before-quit` novo: é no-op, e sai igual |
| Idem com `app.exit(7)` | sai com código 7, mas já estava saindo; só troca o código |
| `ready` nativo segurado: addon N-API que gira o `CFRunLoop` dentro do `will-finish-launching` (modo padrão, `NSModalPanelRunLoopMode` e `NSEventTrackingRunLoopMode`), com o quit nessa janela, no app mínimo pelo Playwright e na Mesa real (3 rodadas) | o `launch` do Playwright volta durante a espera, como no caso real. Mas o processo **não fica preso**: o AppKit lança `NSInternalInconsistencyException: NSApp with wrong _running count` em `-[NSApplication run]` e o processo morre com SIGTRAP, sem `ready` |

## Por que `app.quit()` / `app.exit()` não resolveria

Em `shell/browser/browser.cc` (v44.7.2):

- `Browser::Quit` retorna logo se `is_quitting_` já está ligado. O segundo
  `app.quit()` não faz nada; medido acima, nenhum `before-quit` novo.
- `Browser::ExitWithCode`, com o laço de mensagens pronto, grava o código e
  chama `Shutdown()`, que retorna logo se `is_shutdown_` já está ligado. Depois
  do primeiro quit, `app.exit()` só troca o código de saída; medido acima.
- `Shutdown()` posta a `QuitWhenIdleClosure` do laço principal. No macOS, essa
  closure vira `[NSApp stop:]`. Se o processo fica vivo depois disso, o problema
  é o laço do AppKit não parar, e nada no JS consegue pedir de novo. O
  experimento do `ready` segurado mostra que um `stop:` antes de o NSApp
  terminar o lançamento deixa o AppKit inconsistente (aqui virou exceção, não
  parada).

## O que fica aberto

- A parada real (processo vivo, thread principal ociosa no laço do AppKit, sem
  renderer) não foi reproduzida. O mais perto foi o `stop:` antes de o NSApp
  terminar o lançamento, que neste macOS dá exceção, não parada. Ver onde o
  AppKit espera sob carga exigiria um depurador. O `lldb` ficou parado no
  lançamento, provavelmente esperando a autorização de depuração do macOS.
- Se valer insistir, o próximo passo é uma amostra (`sample`) do processo
  preso **com** o tempo desde o `will-finish-launching` registrado. O teste
  saberia então se o quit chegou antes ou depois do `finishLaunching`.
- Se um dia for preciso proteger o app, e não só o teste, a saída teria de
  ser no processo (um `process.exit` com prazo quando o boot encontra
  `quitting`). Não foi feita: sem reprodução, não há como provar que ajuda.

Scripts dos experimentos (driver do inspetor, addon do spin, sondas) na pasta de
notas da sessão, fora do repositório.
