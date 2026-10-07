# Mesa de Estudos v0.5.0

## Novidades

- **Aba Livre:** estude sem cadastrar matéria; cada conversa guarda seu título, materiais, rascunho e leitores. Abra PDFs sem alterar os originais.
- **PDF pelo tutor:** Pi e Claude podem escrever o material e preencher a prévia. Você revisa, edita e clica em **Salvar PDF e abrir**. O conteúdo preparado fica guardado para continuar depois.
- **Criar matéria:** leve a conversa Livre e os materiais para uma matéria nova, com preservação do histórico e recuperação de gravações interrompidas.
- **Chat lateral:** conversa independente com contexto dos PDFs e do principal, botão para atualizar contexto e ação para levar uma resposta ao rascunho principal.
- **Claude Code experimental:** opção de tutor com o binário original do usuário, seleção nativa de modelo/esforço, permissões, perguntas, cancelamento, histórico e proteção contra reenvio incerto. Continua experimental; a validação desta versão usa SDKs e conversas simuladas, sem inferência autenticada.
- **Configurações completas:** controles de Encerrar por hoje, Lista/questão e rascunho .xopp, recursos visíveis e layout de um ou dois leitores.
- **PDFs:** Girar em passos de 90°, orientação salva por documento e fórmulas com radicais preservados nos PDFs gerados.

## Correções

- Identidade e ícone próprios no Windows; aviso de atualização persistente no cabeçalho.
- Atalhos visíveis na aba Livre e margens dos botões corrigidas, incluindo janelas menores.
- Perguntas do lateral aceitam múltiplas escolhas e resposta livre e preservam os dados quando o envio é recusado.
- Pacote distribuído inclui os módulos de agentes, impressão, extensão de PDF e todas as dependências do SDK. Compatibilidade com a substituição ZIP do atualizador anterior foi conferida.
- DOMPurify atualizado para a versão corrigida; auditoria de dependências sem vulnerabilidades.

## Validação

Testes locais do núcleo, persistência, IPC, Electron, impressão real de PDF, SDKs nativos e payload isolado. Execução em Windows/Linux e inferência autenticada com provedores ainda não foram validadas nesta rodada. Os dados de estudo e a instalação pessoal não fazem parte do release.
