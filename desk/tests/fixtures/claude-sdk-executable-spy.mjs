// Observe only safe query identity/path fields in the synthetic SDK.
import fs from 'node:fs';
import {query as baseQuery,getSessionMessages} from './claude-sdk-fake.mjs';
export {getSessionMessages};
export function query(input){
 if(process.env.FAKE_CLAUDE_EXECUTABLE_TRACE)fs.appendFileSync(process.env.FAKE_CLAUDE_EXECUTABLE_TRACE,JSON.stringify({executable:input.options.pathToClaudeCodeExecutable,resume:input.options.resume||null,newSession:input.options.sessionId||null})+'\n');
 return baseQuery(input);
}
