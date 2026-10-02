// Pointer capture can end without pointerup (focus loss, native gestures,
// cancelled input). A hover must never reuse a previous drag's state.
export function bindPointerDrag(element,move,finish=()=>{}){
 const win=element.ownerDocument.defaultView;
 let pointer=null;
 const end=event=>{
  if(pointer===null||(event?.pointerId!==undefined&&event.pointerId!==pointer))return;
  const id=pointer;pointer=null;
  if(element.hasPointerCapture(id))element.releasePointerCapture(id);
  finish();
 };
 element.addEventListener('pointerdown',event=>{
  if(pointer!==null||event.button!==0||event.isPrimary===false)return;
  try{element.setPointerCapture(event.pointerId);}catch{return;}
  pointer=event.pointerId;
  event.preventDefault();
 });
 element.addEventListener('pointermove',event=>{
  if(pointer===null||event.pointerId!==pointer)return;
  if(!(event.buttons&1)){end(event);return;}
  move(event);
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,end);
 win.addEventListener('blur',()=>end());
 element.ownerDocument.addEventListener('visibilitychange',()=>{if(element.ownerDocument.hidden)end();});
}
