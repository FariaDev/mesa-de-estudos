'use strict';

/* Sessão do ClaudeAdapter: carga do SDK, Query viva, opções, consumo do fluxo
   e despacho das mensagens do sistema. Métodos instalados no protótipo pelo
   claude-adapter.cjs (#43 fase 2). */

const {message: uiMsg} = require('../i18n.mjs');
const {TOOL_NAME:TUTOR_PDF_TOOL}=require('./tutor-pdf.cjs');
const {ACTIVITY_TOOL_NAME,PREVIEW_TOOL_NAME}=require('./activity-tools.cjs');
const {GEOGEBRA_TOOL_NAME}=require('./geogebra-tool.cjs');
const {FIGURE_TOOL_NAME}=require('./figure-tool.cjs');
const {createStudyToolsServer}=require('./study-tools.cjs');
/* Política pura de liquidação do turno (correlação, fim de consulta, falhas
   nativas, retry e recusa): o adaptador mede os fatos e aplica o veredito. */
const turnPolicy = require('./claude-turn-policy.cjs');
const {CLAUDE_CLIENT_APP, SDK_TOOLS, DISALLOWED_TOOLS, ClaudeAdapterError, MessageQueue} = require('./claude-adapter-contract.cjs');
const {errorText} = require('./claude-adapter-input.cjs');

class ClaudeAdapterQuery {
  async _loadSdk() {
    if (this._sdk) return this._sdk;
    if (this._sdkLoader) {
      this._sdk = await this._sdkLoader();
      return this._sdk;
    }
    this._sdk = await import('@anthropic-ai/claude-agent-sdk');
    return this._sdk;
  }

  async _ensureQuery() {
    if (this._query && !this._queryDead) return this._query;
    let queryFn = this._queryFactory;
    if (!queryFn) {
      const sdk = await this._loadSdk();
      queryFn = typeof sdk?.query === 'function'
        ? sdk.query
        : sdk?.default?.query;
    }
    if (typeof queryFn !== 'function') {
      throw new ClaudeAdapterError('CLAUDE_SDK_UNAVAILABLE', 'query() indisponível no SDK oficial', null, true);
    }
    const generation = this._generation;
    const queue = new MessageQueue();
    queue.onTaken = (item) => {
      /* O item passou pelo yield: a sessão nativa passa a existir de fato. É
         isso (não a mera criação da Query de catálogo) que autoriza `resume`. */
      this._promptDelivered = true;
      const turn = this._turn;
      if (turn && !turn.finalized && item === turn.item) turn.taken = true;
    };
    const options = this._buildOptions(generation);
    if(this._createMaterial||this._createActivity||this._geogebra||this._viewFigure){
      const guard=fn=>args=>{
        if(generation!==this._generation||this._closed)throw Error(uiMsg('err.claude.sessionClosed'));
        return fn(args);
      };
      options.mcpServers={mesa:await createStudyToolsServer({
        createMaterial:this._createMaterial?guard(args=>this._createMaterial(args)):null,
        createActivity:this._activityCallGate?guard(args=>this._activityCallGate.execute(args)):null,
        previewActivity:this._previewActivity?guard(args=>this._previewActivity(args)):null,
        viewFigure:this._viewFigure?guard(args=>this._viewFigure(args)):null,
        tutorLanguage:this._tutorLanguage(),
        geogebra:this._geogebra?{run:guard(args=>this._geogebra.run(args)),state:guard(()=>this._geogebra.state()),screenshot:guard(()=>this._geogebra.screenshot())}:null,
      })};
      options.allowedTools=[...(this._createMaterial?[TUTOR_PDF_TOOL]:[]),...(this._createActivity?[ACTIVITY_TOOL_NAME]:[]),...(this._previewActivity?[PREVIEW_TOOL_NAME]:[]),...(this._viewFigure?[FIGURE_TOOL_NAME]:[]),...(this._geogebra?[GEOGEBRA_TOOL_NAME]:[])];
    }
    if(generation!==this._generation||this._closed)throw new ClaudeAdapterError('CLAUDE_QUERY_STALE',uiMsg('err.claude.queryStale'),null,true);
    const query = await Promise.resolve(queryFn({prompt: queue, options}));
    if (generation !== this._generation) {
      try {
        if (query && typeof query.close === 'function') query.close();
      } catch {
        /* descartar consulta velha não pode derrubar o envio */
      }
      throw new ClaudeAdapterError('CLAUDE_QUERY_STALE', uiMsg('err.claude.queryStale'), null, true);
    }
    if (!query || typeof query[Symbol.asyncIterator] !== 'function') {
      try {
        if (query && typeof query.close === 'function') query.close();
      } catch {
        /* fechar o que não é iterador não pode derrubar a recusa */
      }
      throw new ClaudeAdapterError('CLAUDE_SDK_UNAVAILABLE', 'query() do SDK não devolveu um iterador', null, true);
    }
    this._queue = queue;
    this._query = query;
    this._queryDead = false;
    this._consume(query, generation);
    return query;
  }

  _buildOptions(generation) {
    const options = {
      cwd: this._cwd,
      ...(this._persistSession ? {} : {persistSession: false}),
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: {},
      tools: [...SDK_TOOLS],
      disallowedTools: [...DISALLOWED_TOOLS],
      permissionMode: 'default',
      includePartialMessages: true,
      /* Flag PÚBLICA da CLI: ecoa a mensagem do usuário de volta com
         `isReplay: true`, que é a evidência de aceite usada pela ponte. */
      extraArgs: {'replay-user-messages': null},
      canUseTool: (toolName, input, opts) => this._canUseTool(generation, toolName, input, opts),
      hooks: {PreToolUse: [{hooks: [async (input) => this._preToolUse(generation, input)]}]},
      env: this._spawnEnv(),
    };
    if (this._noTools) {
      options.tools = [];
      options.disallowedTools = [...SDK_TOOLS, ...DISALLOWED_TOOLS];
    }
    if (this._claudePath) options.pathToClaudeCodeExecutable = this._claudePath;
    if (this._systemPrompt) options.systemPrompt = this._systemPrompt;
    if (this._sessionId) {
      /* ID explícito vindo do registro: na primeira consulta ele É o ID nativo
         (retomada por ID exato depois); ao reconectar, `resume` com o mesmo ID.
         Nunca se combinam `sessionId` e `resume` na mesma consulta. A retomada
         exige prompt JÁ ENTREGUE: a Query de catálogo sem prompt não conta. */
      if (this._resume || this._promptDelivered) options.resume = this._sessionId;
      else options.sessionId = this._sessionId;
    }
    return options;
  }

  /* Env do subprocesso: mescla process.env + overrides; desliga o
     auto-update SÓ deste processo (sem tocar em config global). */

  _spawnEnv() {
    const base = {...process.env};
    if (this._childEnv) Object.assign(base, this._childEnv);
    base.CLAUDE_AGENT_SDK_CLIENT_APP = CLAUDE_CLIENT_APP;
    base.DISABLE_AUTOUPDATER = '1';
    return base;
  }

  async _consume(query, generation) {
    let failure = null;
    try {
      for await (const message of query) {
        if (generation !== this._generation) return;
        try {
          await this._handleMessage(message);
        } catch (error) {
          this._emit('warning', {message: `mensagem ignorada (${errorText(error)})`, code: 'CLAUDE_MESSAGE_DISCARDED'});
        }
      }
    } catch (error) {
      failure = error;
    } finally {
      if (generation === this._generation) await this._finishQuery(failure);
    }
  }

  async _finishQuery(failure) {
    this._queryDead = true;
    this._query = null;
    this._queue = null;
    this._failOpenSteers('err.claude.steerQueryEnded');
    this._failOpenCompaction();
    /* A Query morreu: o catálogo e o estado nativo dela não valem mais. A
       escolha DESEJADA fica para a próxima inicialização explícita. */
    this._controlsState = 'idle';
    this._controlsCatalog = null;
    this._controlsError = null;
    this._nativeSelection = {model: null, effort: null};
    this._invalidatePermissions('Consulta encerrada', this._turn, 'query_end');
    const turn = this._turn;
    /* Fim NATIVO observado (`endKind:'query'`), com ou sem erro de iterador.
       Cancelamento explícito + aceite comprovado + não degradado ⇒ settled
       cancelled sem incerteza; qualquer outra combinação preserva a espera. */
    const end = turn && !turn.finalized
      ? turnPolicy.classifyQueryEnd({
        accepted: turn.acceptResolved,
        taken: turn.taken,
        phase: turn.phase,
        cancelled: this._cancelRequested,
        degraded: turn.degraded,
        endKind: 'query',
        failure: failure || null,
      })
      : null;
    /* Cancelamento comprovado com fim nativo observado não vira erro fatal de
       consulta: o turn_end cancelled/uncertain é o desfecho. */
    const settledCancelledEnd = Boolean(end && end.outcome === 'settled' && end.cancelled === true);
    if (failure && !settledCancelledEnd) {
      this._emit('error', {message: `consulta do Claude Code terminou com erro: ${errorText(failure)}`, code: 'CLAUDE_QUERY_ERROR'});
    }
    if (end) {
      await this._enqueue(turn, () => this._finalizeTurn(turn, end.outcome, {
        cancelled: end.cancelled,
        isError: true,
        message: failure ? `consulta encerrada (${errorText(failure)})` : 'consulta encerrada sem confirmação',
        reason: 'query-ended',
      }));
      return;
    }
    if (!failure && this._connected && !this._closed) {
      this._emit('warning', {message: 'o processo do Claude Code terminou sem turno em andamento', code: 'CLAUDE_QUERY_ENDED'});
    }
  }

  /* Sessão divergente nunca muda a identidade em silêncio: avisa uma vez e o
     evento é descartado (nem conteúdo, nem correlação). */

  _sessionMatches(message) {
    const sid = typeof message?.session_id === 'string' && message.session_id ? message.session_id : null;
    if (!sid) return true;
    if (!this._sessionId) {
      this._sessionId = sid;
      return true;
    }
    if (sid === this._sessionId) return true;
    if (!this._foreignSessions.has(sid)) {
      this._foreignSessions.add(sid);
      this._emit('warning', {
        message: 'evento de outra sessão do Claude Code foi ignorado; a identidade desta sessão não muda',
        code: 'CLAUDE_SESSION_MISMATCH',
      });
    }
    return false;
  }

  async _handleMessage(message) {
    if (!message || typeof message !== 'object') return;
    const subagent = message.parent_tool_use_id != null;
    if (!subagent && !this._sessionMatches(message)) return;
    /* A janela do medidor é fato do MODELO: vale de qualquer `result`, mesmo
       de outro envio (que a correlação abaixo descarta). */
    if (!subagent && message.type === 'result') this._noteModelUsage(message);
    if (!subagent && await this._routeSteerEcho(message)) return;
    if (!subagent && this._routeCompactionResult(message)) return;

    const turn = this._turn;
    if (!subagent && turn && !turn.finalized) {
      const correlation = turnPolicy.correlationEvidence(message, this._turnEchoUuid(turn, message));
      if (correlation.evidence === 'match') {
        if (!turn.acceptResolved) {
          if (turn.phase === 'transmitting') {
            await this._enqueue(turn, () => this._resolveAccepted(turn));
          } else {
            this._noteLateAck(turn);
          }
        }
      } else if (correlation.evidence === 'mismatch') {
        /* Eco estrangeiro EXPLÍCITO (result ou não) marca o turno para sempre:
           nenhum result sem eco deste turno pode liquidá-lo depois. */
        turn.foreignSeen = true;
        if (message.type === 'result') {
          this._emitTurn(turn, 'warning', {message: 'resultado de outro envio foi ignorado; o turno atual continua', code: 'CLAUDE_RESULT_FOREIGN'});
          return;
        }
        if (!turn.foreignWarned) {
          turn.foreignWarned = true;
          this._emitTurn(turn, 'warning', {message: 'mensagem de outro envio foi ignorada na sessão principal', code: 'CLAUDE_MESSAGE_FOREIGN'});
        }
        return;
      }
    }

    if (message.type === 'user' && message.isReplay === true) return;

    switch (message.type) {
      case 'system':
        this._handleSystem(message);
        break;
      case 'rate_limit_event':
        this._handleRateLimit(message);
        break;
      case 'auth_status':
        if (message.error) {
          this._emit('warning', {message: `estado de autenticação: ${String(message.error)}`, code: 'CLAUDE_AUTH_STATUS'});
        }
        break;
      case 'stream_event':
        this._handleStreamEvent(message);
        break;
      case 'assistant':
        this._handleAssistant(message);
        break;
      case 'user':
        this._handleUser(message);
        break;
      case 'result':
        await this._handleResult(message);
        break;
      default:
        break;
    }
  }

  _noteLateAck(turn) {
    if (turn.lateAckWarned || turn.acceptResolved) return;
    turn.lateAckWarned = true;
    this._emitTurn(turn, 'warning', {
      message: 'confirmação atrasada ignorada: o turno já não aguardava aceite (nada é repetido)',
      code: 'CLAUDE_LATE_ACK',
    });
  }

  _handleSystem(message) {
    if (message.parent_tool_use_id != null) return;
    const subtype = message.subtype;
    if (subtype === 'init') {
      if (typeof message.claude_code_version === 'string' && message.claude_code_version) this._version = message.claude_code_version;
      if (typeof message.model === 'string' && message.model) this._model = message.model;
      this._emitInitOnce(this._turn);
      const servers = Array.isArray(message.mcp_servers) ? message.mcp_servers : [];
      const unexpected = servers.filter(server=>!((this._createMaterial||this._createActivity||this._geogebra)&&server?.name==='mesa'));
      if (unexpected.length) {
        this._emit('warning', {message: `MCP inesperado nesta sessão: ${unexpected.map((server) => server?.name).filter(Boolean).join(', ')}`, code: 'CLAUDE_MCP_UNEXPECTED'});
      }
      return;
    }
    if (subtype === 'commands_changed') {
      this._noteCommandsChanged(message);
      return;
    }
    if (this._routeCompactionSystem(message)) return;
    if (subtype === 'informational' && (message.level === 'warning' || message.level === 'suggestion')) {
      this._emit('warning', {message: String(message.content || ''), code: 'CLAUDE_INFORMATIONAL'});
      return;
    }
    if (subtype === 'api_retry') {
      this._handleApiRetry(message);
      return;
    }
    if (subtype === 'rate_limit_event') {
      this._handleRateLimit(message);
      return;
    }
    if (subtype === 'model_refusal_fallback' || subtype === 'model_refusal_no_fallback') {
      this._handleRefusalNotice(message);
    }
  }

  /* `api_retry` nativo (SDK pinado): preserva tentativa/máximo/atraso/status,
     com o código canônico (429/529 inclusos). NUNCA encerra turno, não mexe em
     entrega/fila e não reenvia; o mesmo attempt é deduplicado no turno. */
}

module.exports = {ClaudeAdapterQuery};
