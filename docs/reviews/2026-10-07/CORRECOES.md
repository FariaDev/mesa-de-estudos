# Correções da revisão — 2026-10-07

As sete issues da [revisão original](REVIEW-MESA-NAO-PUBLICADA.md) foram
corrigidas. A conferência visual levou a mais duas correções. Tudo permanece
local, sem publicação, atualização da instalação pessoal ou inferência com
provedor autenticado. Os defaults do autor não foram alterados nesta rodada.

## Correções

| Issue | Resultado | Evidência |
| --- | --- | --- |
| R1 — distribuição de agentes/impressão | Módulos realocados para `desk/src/agents/` e `desk/src/materials/`, com imports e assets ajustados. Esse caminho já é aceito pelo updater instalado da v0.4.7. | A função **real** `applyZip` da v0.4.7 entregou agentes, impressão e os módulos novos da raiz, mantendo `config.json`. [Resultado](zip-fix-evidence.json). |
| R2 — SDK ausente no bundle | O instalador usa `stageBundlePayload`, que copia dependências, peers obrigatórios e opcionais instalados, preservando versões aninhadas. | Testes com fonte removida; payload real isolado inicia o renderer, resolve/importa o SDK dentro do próprio pacote e gera PDF por Electron. [Log](validation-bundle-payload.log). |
| R3 — pergunta descartada antes do aceite | Lateral usa validação compartilhada, checkboxes para seleção múltipla e texto livre. Resposta inválida/recusada mantém cartão, dados e erro. Cartões só saem após aceite; duplicatas ficam bloqueadas durante a espera. Permissões e seleções também aguardam IPC. | Renderer real com canal controlado: vazio, múltiplas escolhas, texto livre, rejeição, aceite tardio, cancelamento e chave `__proto__`. [Log](validation-questions.log). |
| R4 — launcher Windows | Descoberta compartilhada entre main e diagnóstico inclui `~/.local/bin/claude.exe` no Windows e prioriza caminho configurado. | Teste de layout Windows com arquivos e execução simulados; não representa uma execução real em Windows. |
| R5 — userData do doctor | Caminho respeita plataforma, `APPDATA`, `XDG_CONFIG_HOME` e override explícito de runtime. | Testes dos caminhos macOS, Windows e Linux. |
| R6 — erro após relançamento | Listener de `pageerror` registrado também no renderer reaberto do teste de configurações. | [Integração de configurações](validation-settings.log) passou incluindo persistência normal em userData temporário, sem `LEARNING_DESK_RUNTIME`. |
| R7 — corrida do aviso | Teste aguarda `#update-notice` visível antes das verificações. | Aviso persistente e clicável, inclusive em 900×650. [Log](validation-settings.log). |

## Correções adicionais da conferência visual

- **Cabeçalho do lateral:** título, etiqueta do motor e ações passam a quebrar
  linha. A captura em janela de 1000×700 inclui verificação geométrica de que
  título/ações não se sobrepõem e a etiqueta permanece dentro do cabeçalho.
- **Radicais no PDF:** a regra que ocultava SVGs de assets também ocultava
  símbolos do KaTeX. A impressão preserva agora o SVG interno da fórmula.
  O teste de regressão inspeciona os vetores visíveis na janela real no momento
  de `printToPDF`, além de confirmar o PDF produzido. Ele
  [falhou antes da correção](regression-radical-before.log) e passou no gate
  final. A [captura do PDF](ui/04-materia.png) confirma os radicais desenhados.

## Validação final

- `MESA_GATE_CACHE=0 npm test`: **761 testes passaram**, zero falhas/pulos;
  gate de núcleo, provas, geração, paridade e sintaxe incluídos.
  [Log completo](validation-full.log).
- `bundle-payload-ui`: pacote real do instalador em diretório temporário,
  renderer do próprio pacote, import real do SDK sem loader falso e impressão
  real de PDF. Nenhuma inferência ou instalação pessoal.
- `free-study-integration-ui`: UI/preload/IPC reais, impressão, isolamento entre
  sessões e após restart, rotação, cancelamentos, promoção e reconexão.
  Motor Pi simulado. [Log](validation-free-integrated.log).
- `sidechat-ui-races`: aceite tardio, duplo clique, recusa/incerteza, streaming,
  ferramentas, mudança de escopo e conversa nova. [Log](validation-sidechat-races.log).
- `settings-resources-ui` e `sidechat-questions-ui`: integrações descritas na tabela.
- Script de capturas: **13 screenshots**, renderer sem erros e verificação do
  cabeçalho estreito. [Log](validation-screenshots.log).
- `git diff --check`: passou. Check sintático após os novos scripts: 218 arquivos.

## CodeRabbit

As sete correções foram revisadas contra um snapshot anterior às correções,
em um clone temporário; o checkout e o index do usuário não foram alterados
para criar essa base. **0 issues**, 46 arquivos revisados.
[Saída original](coderabbit-fixes.ndjson).

O ajuste responsivo e o script de capturas tiveram outra revisão:
**0 issues**, 2 arquivos revisados.
[Saída original](coderabbit-responsive.ndjson).

A revisão adicional da correção de impressão e seu teste não concluiu:
`Rate limit exceeded`. O CLI informou que as três revisões gratuitas disponíveis
foram usadas e indicou espera de **21 minutos** naquele momento. Alternativa:
conectar o repositório a uma organização/plano autorizado pelo
[dashboard do CodeRabbit](https://app.coderabbit.ai).
[Erro completo](coderabbit-print-rate-limit.ndjson).
Não há revisão externa concluída desse último ajuste; sua evidência é o teste
de regressão e a inspeção visual do PDF.

## Capturas e limites

[Galeria independente com 13 capturas](ui/galeria.html).
Os PNGs originais e seus títulos estão em [manifest.json](ui/manifest.json).
Incluem Livre, geração de material com Markdown/LaTeX, promoção para matéria,
rotação, configurações de recursos/leitores, conversa/perguntas/contexto do
lateral, tema escuro, aviso persistente e janela menor.

São screenshots da interface real em Electron, com conteúdo e estados de
demonstração. O aviso **v0.4.8 é simulado**; não representa uma release.
Este trabalho não valida taskbar/ícone em Windows real, credenciais/sessões de
provedor real, assinatura/LaunchServices do `.app` pessoal nem uma atualização
instalada de ponta a ponta. A aplicação ZIP e o payload foram verificados
isoladamente; não houve instalação, commit no checkout do usuário, push ou release.
