'use strict';

/* Permissões do ClaudeAdapter: política de caminhos, confirmação do aluno,
   AskUserQuestion, canUseTool e o hook PreToolUse. Métodos instalados no
   protótipo pelo claude-adapter.cjs (#43 fase 2). */

const crypto = require('node:crypto');
const path = require('node:path');
const {TOOL_NAME:TUTOR_PDF_TOOL}=require('./tutor-pdf.cjs');
const {ACTIVITY_TOOL_NAME,PREVIEW_TOOL_NAME}=require('./activity-tools.cjs');
const {GEOGEBRA_TOOL_NAME}=require('./geogebra-tool.cjs');
const {FIGURE_TOOL_NAME}=require('./figure-tool.cjs');
const {ALLOWED_TOOLS} = require('./claude-adapter-contract.cjs');
const {realpathBestEffort, canonicalPath, isInside, extractPathFromInput, normalizeUserQuestions} = require('./claude-adapter-input.cjs');

class ClaudeAdapterPermissions {
  _invalidatePermissions(message, turn = null, reason = null) {
    for (const [id, entry] of [...this._permissions.entries()]) {
      this._permissions.delete(id);
      if (turn) this._emitTurn(turn, 'permission_cancelled', reason ? {id, reason} : {id});
      else this._emit('permission_cancelled', reason ? {id, reason} : {id});
      entry.finish({behavior: 'deny', message});
    }
  }

  /* Prazo do pedido: ID vencido nega e sai da fila; nunca vira allow. */
  _expirePermission(id) {
    const entry = this._permissions.get(id);
    if (!entry || entry.done) return;
    this._emit('permission_cancelled', {id, reason: 'expired'});
    entry.finish({behavior: 'deny', message: 'O pedido expirou sem resposta'});
  }

  _permissionExpiresAt() {
    if (!this._permissionTtlMs) return null;
    return new Date(Date.now() + this._permissionTtlMs).toISOString();
  }

  _pathAllowed(real) {
    for (const file of this._toolPolicy.readPaths) {
      if (real === file) return true;
    }
    for (const root of this._toolPolicy.readRoots) {
      if (isInside(real, root)) return true;
    }
    return false;
  }

  _pathDecision(target) {
    let real;
    try {
      real = canonicalPath(target, this._cwd);
    } catch {
      return {allowed: false, reason: 'caminho inválido'};
    }
    if (this._pathAllowed(real)) return {allowed: true};
    return {allowed: false, reason: 'fora das pastas autorizadas desta sessão'};
  }

  /* Glob e Grep confinam a pasta base; só Glob interpreta o padrão como
     caminho e canonicaliza seus segmentos literais para barrar symlinks. */

  _globPatternDecision(toolName, input) {
    const pattern = String(input?.pattern || '');
    if (!pattern) return {allowed: true};
    if (toolName === 'Glob' && (path.isAbsolute(pattern) || pattern.startsWith('~'))) {
      return {allowed: false, reason: 'padrão absoluto fora da pasta controlada'};
    }
    const rawBase = typeof input?.path === 'string' && input.path ? input.path : (this._cwd || process.cwd());
    let current = canonicalPath(rawBase, this._cwd);
    if (!this._pathAllowed(current)) {
      return {allowed: false, reason: 'fora das pastas autorizadas desta sessão'};
    }
    if (toolName !== 'Glob') return {allowed: true};
    for (const segment of pattern.split(/[\\/]+/)) {
      if (!segment || segment === '.') continue;
      if (segment === '..') return {allowed: false, reason: 'padrão com ".." sairia da pasta controlada'};
      if (/[*?[\]{}]/.test(segment)) continue;
      current = path.join(current, segment);
      const real = realpathBestEffort(current);
      if (!this._pathAllowed(real)) {
        return {allowed: false, reason: 'o padrão atravessa um link fora das pastas autorizadas'};
      }
    }
    return {allowed: true};
  }

  _permissionRequestId(options) {
    return (typeof options?.requestId === 'string' && options.requestId)
      || (typeof options?.toolUseID === 'string' && options.toolUseID)
      || crypto.randomUUID();
  }

  /* Registro comum de pedido: prazo (ID que vence), abort do SDK, evento
     canônico e resolução única. `entry` carrega só o que o respond precisa. */

  _waitForPermission(request, entry, options) {
    const signal = options?.signal || null;
    return new Promise((resolve) => {
      entry.done = false;
      entry.finish = (result) => {
        if (entry.done) return;
        entry.done = true;
        this._permissions.delete(request.id);
        if (entry.timer) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }
        if (entry.onAbort && signal?.removeEventListener) signal.removeEventListener('abort', entry.onAbort);
        resolve(result);
      };
      entry.onAbort = () => {
        if (entry.done) return;
        this._emit('permission_cancelled', {id: request.id, reason: 'abort'});
        entry.finish({behavior: 'deny', message: 'A execução foi encerrada antes da resposta'});
      };
      if (signal) {
        if (signal.aborted) {
          entry.done = true;
          this._emit('permission_cancelled', {id: request.id, reason: 'abort'});
          resolve({behavior: 'deny', message: 'A execução foi encerrada antes da resposta'});
          return;
        }
        signal.addEventListener?.('abort', entry.onAbort, {once: true});
      }
      this._permissions.set(request.id, entry);
      if (this._permissionTtlMs > 0) {
        entry.timer = setTimeout(() => this._expirePermission(request.id), this._permissionTtlMs);
        entry.timer.unref?.();
      }
      this._emit('permission_request', request);
    });
  }

  _requestConfirmation(toolName, input, options, target) {
    const id = this._permissionRequestId(options);
    const pathTarget = target != null ? canonicalPath(target, this._cwd) : null;
    const request = {
      id,
      title: typeof options?.title === 'string' && options.title ? options.title : `Usar ${toolName}`,
      message: typeof options?.description === 'string' ? options.description : '',
      toolName,
      target: pathTarget,
      input,
      method: 'confirm',
      expiresAt: this._permissionExpiresAt(),
    };
    const entry = {
      id,
      method: 'confirm',
      toolName,
      input,
      requestId: options?.requestId || null,
      toolUseID: typeof options?.toolUseID === 'string' ? options.toolUseID : null,
    };
    return this._waitForPermission(request, entry, options);
  }

  /* AskUserQuestion: nenhuma concessão de ferramenta — o pedido é uma pergunta
     estruturada. O allow só sai pelo `respond({id, answers})` validado. */

  _requestUserInput(toolName, input, options) {
    const questions = normalizeUserQuestions(input?.questions);
    const id = this._permissionRequestId(options);
    if (!questions.length) {
      return Promise.resolve({behavior: 'deny', message: 'pergunta sem questões válidas (nada a responder)'});
    }
    const request = {
      id,
      title: typeof options?.title === 'string' && options.title ? options.title : 'Pergunta do Claude Code',
      message: typeof options?.description === 'string' && options.description
        ? options.description
        : (typeof options?.decisionReason === 'string' ? options.decisionReason : ''),
      toolName,
      method: 'question',
      questions,
      expiresAt: this._permissionExpiresAt(),
    };
    const entry = {
      id,
      method: 'question',
      toolName,
      input,
      requestId: options?.requestId || null,
      toolUseID: typeof options?.toolUseID === 'string' ? options.toolUseID : null,
      questions,
      rawQuestions: Array.isArray(input?.questions) ? input.questions : [],
    };
    return this._waitForPermission(request, entry, options);
  }

  _canUseTool(generation, toolName, input, options) {
    if (generation !== this._generation) return Promise.resolve({behavior: 'deny', message: 'conexão antiga'});
    if(toolName===TUTOR_PDF_TOOL&&this._createMaterial&&!this._closed)return Promise.resolve({behavior:'allow',updatedInput:input});
    if(toolName===ACTIVITY_TOOL_NAME&&this._activityCallGate&&!this._closed)return Promise.resolve({behavior:'allow',updatedInput:input});
    if(toolName===PREVIEW_TOOL_NAME&&this._previewActivity&&!this._closed)return Promise.resolve({behavior:'allow',updatedInput:input});
    if(toolName===FIGURE_TOOL_NAME&&this._viewFigure&&!this._closed)return Promise.resolve({behavior:'allow',updatedInput:input});
    if(toolName===GEOGEBRA_TOOL_NAME&&this._geogebra&&!this._closed)return Promise.resolve({behavior:'allow',updatedInput:input});
    if (toolName === 'AskUserQuestion') return this._requestUserInput(toolName, input, options);
    if (!ALLOWED_TOOLS.includes(toolName)) {
      return Promise.resolve({behavior: 'deny', message: `ferramenta não permitida nesta versão: ${toolName}`});
    }
    const target = extractPathFromInput(toolName, input);
    if (target != null) {
      const decision = this._pathDecision(target);
      if (!decision.allowed) return Promise.resolve({behavior: 'deny', message: decision.reason});
    }
    if (toolName === 'Glob' || toolName === 'Grep') {
      const decision = this._globPatternDecision(toolName, input);
      if (!decision.allowed) return Promise.resolve({behavior: 'deny', message: decision.reason});
    }
    return this._requestConfirmation(toolName, input, options, target);
  }

  /* Hook PreToolUse: aplica a política de caminhos inclusive em chamadas que o
     CLI auto-aprovaria (canUseTool não cobre essas). Nunca libera escrita;
     AskUserQuestion segue para o canUseTool, que exige respostas. */

  async _preToolUse(generation, input) {
    const deny = (reason) => ({
      continue: true,
      hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason},
    });
    if (generation !== this._generation) return deny('conexão antiga');
    const toolName = input?.tool_name;
    if(toolName===ACTIVITY_TOOL_NAME&&this._activityCallGate&&!this._closed){
      try{
        const updatedInput=this._activityCallGate.reserve(input);
        return {continue:true,hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',updatedInput}};
      }catch(error){return deny(error.message||'Não foi possível correlacionar a atividade.');}
    }
    if(toolName===TUTOR_PDF_TOOL&&this._createMaterial&&!this._closed)return {continue:true};
    if(toolName===PREVIEW_TOOL_NAME&&this._previewActivity&&!this._closed)return {continue:true};
    if(toolName===FIGURE_TOOL_NAME&&this._viewFigure&&!this._closed)return {continue:true};
    if(toolName===GEOGEBRA_TOOL_NAME&&this._geogebra&&!this._closed)return {continue:true};
    if (toolName === 'AskUserQuestion') return {continue: true};
    if (typeof toolName !== 'string' || !ALLOWED_TOOLS.includes(toolName)) {
      return deny(`ferramenta não permitida nesta versão: ${toolName || 'desconhecida'}`);
    }
    const target = extractPathFromInput(toolName, input?.tool_input);
    if (target != null) {
      const decision = this._pathDecision(target);
      if (!decision.allowed) return deny(decision.reason);
    }
    if (toolName === 'Glob' || toolName === 'Grep') {
      const decision = this._globPatternDecision(toolName, input?.tool_input);
      if (!decision.allowed) return deny(decision.reason);
    }
    return {continue: true};
  }
}

module.exports = {ClaudeAdapterPermissions};
