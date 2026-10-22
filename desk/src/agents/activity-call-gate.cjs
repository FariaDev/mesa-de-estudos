'use strict';
const crypto=require('node:crypto');
const {createCallRegistry,pickPayload}=require('../../activity-bridge.cjs');
const {message}=require('../i18n.mjs');
const {describeReceived}=require('../error-detail.mjs');

// The SDK handler has no tool-use ID. Only PreToolUse may mint a reference;
// model-supplied references and references from previous turns cannot publish.
function createActivityCallGate({current,publish}={}) {
 const registry=createCallRegistry();
 const turns=new Map();
 const context=()=>{
  const value=current();
  if(!value?.active||!value.conversationId||!value.runId)throw Error(message('err.activity.roundClosed'));
  return value;
 };
 const reserve=(input)=>{
  const scope=context();
  const {paramsHash}=pickPayload(input?.tool_input);
  const callRef=crypto.randomUUID();
  registry.registerCall({callRef,toolCallId:input?.tool_use_id,conversationId:scope.conversationId,generation:scope.generation,paramsHash});
  turns.set(callRef,scope.runId);
  while(turns.size>256)turns.delete(turns.keys().next().value);
  return registry.injectRef(input.tool_input,callRef);
 };
 const execute=async(args)=>{
  const scope=context();
  const {spec,callRef,paramsHash,activityId}=pickPayload(args);
  const identity=registry.resolve(callRef,{conversationId:scope.conversationId,generation:scope.generation,paramsHash});
  if(!identity||turns.get(callRef)!==scope.runId)throw Error(message('err.activity.callRefInvalid',{received:describeReceived(callRef)}));
  return publish({...spec,...(activityId?{activityId}:{}),toolCallId:identity.toolCallId,callRef});
 };
 return {reserve,execute,clear(){registry.clear();turns.clear();}};
}
module.exports={createActivityCallGate};
