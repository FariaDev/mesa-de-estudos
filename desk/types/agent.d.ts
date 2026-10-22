/* Mensagens e eventos que o adaptador do Claude entrega ao serviço (#43 fase 3).
   Só o que os arquivos verificados leem; o resto do evento segue `unknown`. */
export type AgentContentPart = {type: string, text?: string, [field: string]: unknown};
export type AgentMessage = {role: string, uuid?: string, content?: AgentContentPart[], [field: string]: unknown};
export type AgentInitEvent = {type: 'init', executable?: string, executableNote?: string, conversationId?: string, [field: string]: unknown};
