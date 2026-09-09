# Conferência visual do Pi (macOS)

Parte do produto **Mesa de Estudos**: o Xournal++ continua como editor de escrita; esta extensão envia a janela visível ao Pi somente após um pedido. A mesa de referências é o aplicativo em `desk/`.

## Uso

Em uma sessão Pi no vault ou em seus cursos, execute `/reload` uma vez após a instalação. Mantenha o Xournal++ aberto, não minimizado, no desktop atual (pode estar no monitor externo ou atrás de outra janela).

- `confere minha resposta` / `confira minha resolução`: captura e anexa a imagem ao pedido.
- `/conferir`: captura e pede uma avaliação breve.
- `/conferir explique cada passo`: captura com sua pergunta específica.
- `/visual-janelas`: lista IDs de janelas do Xournal++.
- `/visual-alvo 123`: escolhe uma delas para a sessão atual.
- `/visual-alvo auto`: volta à seleção automática; só funciona quando há uma única janela candidata.

Texto ditado ao terminal funciona como texto digitado. Esta extensão não instala reconhecimento de voz, microfone ou escuta contínua. Pedidos que já possuem imagens anexadas não recebem outra captura automática. Frases naturais fora dos padrões reconhecidos podem usar `/conferir`.

## Escopo e limites

A captura mostra somente o conteúdo visível do Xournal++, incluindo escrita não salva. Não lê o `.xopp`, não salva ou modifica a resolução e não inclui páginas fora da visualização. Ajuste o zoom quando necessário. PDF/formulário em outras janelas não são capturados: informe a fonte ao Pi quando o enunciado não estiver visível.

Não há observação contínua nem ferramenta de captura autônoma do modelo. Cada pedido reconhecido ou comando explícito gera uma captura. Não há fallback para tela inteira, outra aplicação ou imagem antiga. Falhas bloqueiam a conferência automática e mostram o motivo.

O PNG temporário é removido após a leitura. A imagem enviada passa a integrar a conversa do Pi e pode ser persistida no JSONL e enviada ao provedor do modelo, como qualquer imagem anexada. O espelho Markdown existente pode não mostrar esse anexo.

O macOS deve permitir Gravação de Tela ao aplicativo que executa Pi (por exemplo Ghostty). As permissões do Codex e do terminal são independentes. Se necessário: Ajustes do Sistema > Privacidade e Segurança > Gravação de Tela; depois reinicie o aplicativo conforme o macOS solicitar.

## Implementação e testes

`windows.swift` enumera janelas visíveis via CoreGraphics, sem ativá-las. `core.ts` seleciona exclusivamente Xournal++ e usa `/usr/sbin/screencapture -lID` para capturar a janela. `index.ts` integra comandos e transformação explícita de entrada do Pi.

Compilar no macOS:

```sh
swiftc windows.swift -o windows
node --test core.test.ts
```

Não execute o teste real com documentos sensíveis: ele envia a janela atual ao provedor configurado no Pi. Use uma resolução de teste e uma sessão efêmera.
