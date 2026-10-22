# Publicação e instalação da Mesa v0.4.6

- Review final CodeRabbit: 0 issues, 42 arquivos revisados.
- PR #1 mesa-e-conversa integrada: 02e5949e1a09ababb44f6e9b1832319a0f508c7e.
- PR #1 mesa-de-estudos integrada: ca2de2aa2d834b9bbee21d95dc598957ea7e23aa.
- Release estável: https://github.com/FariaDev/mesa-de-estudos/releases/tag/v0.4.6.
- Clone local atualizado por fast-forward; relatórios locais preservados.
- Bundle local e Info.plist em 0.4.6, certificado Learning Canvas Code Signing.
- Verificação codesign --deep --strict passou.
- Hashes da configuração e de 27 sessões conferidas: nenhuma alteração.
- Backup do bundle anterior: /private/tmp/mesa-v0.4.5-before-release.app (temporário).

Mesa 432 testes, Conversa 340 testes, público 418 aprovados/14 ignorados;
portões Bend 64/36 artefatos; testes Electron de divisores, settled e melhorias
aprovados novamente. Tests D2/A1 corrigidos nas suas premissas; 25 testes de
update passaram. Nenhuma máquina Linux/Windows executada. Não há CI
configurada nos repositórios.

Durable permanece uma proposta, sem pacote instalado ou migração de sessões.
Smoke completo do executável instalado: APP PASSED.
Testes splitter-ui, settled-ui e improvements-ui também passaram contra
o executável instalado, usando runtimes e Pi simulados isolados.
A configuração e as 27 sessões foram conferidas novamente após os testes;
nenhuma alteração. Uso normal com o modelo escolhido e captura do Xournal++
ainda depende de conferência no ambiente de estudo do usuário.
