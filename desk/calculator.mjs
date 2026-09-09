// Small numeric parser: no eval, assignments, property access, or executable input.
export function calculate(source, degrees = false) {
 const tokens=source.replace(/,/g,'.').match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z]+|[+\-*/^()%]|\S/g)||[];
 let i=0; const peek=()=>tokens[i]; const take=()=>tokens[i++];
 const trig=f=>x=>f(degrees?x*Math.PI/180:x);
 const functions={sin:trig(Math.sin),cos:trig(Math.cos),tan:trig(Math.tan),sqrt:Math.sqrt,abs:Math.abs,ln:Math.log,log:Math.log10,exp:Math.exp};
 function atom(){const t=take(); if(t==='('){const v=sum();if(take()!==')')throw Error('Feche os parênteses.');return v;}
 if(t==='pi')return Math.PI;if(t==='e')return Math.E;
 if(Object.hasOwn(functions,t)){if(take()!=='(')throw Error('Use parênteses na função.');const v=sum();if(take()!==')')throw Error('Feche os parênteses.');return functions[t](v);}
 if(t && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(t))return Number(t);
 throw Error('Expressão inválida. Use números, operadores e funções disponíveis.');}
 function power(){let v=atom();if(peek()==='^'){take();v=v**unary();}return v;}
 function unary(){if(peek()==='+'){take();return unary();}if(peek()==='-'){take();return -unary();}return power();}
 function product(){let v=unary();while(['*','/','%'].includes(peek())){const op=take(),r=unary();v=op==='*'?v*r:op==='/'?v/r:v%r;}return v;}
 function sum(){let v=product();while(['+','-'].includes(peek())){const op=take(),r=product();v=op==='+'?v+r:v-r;}return v;}
 if(source.length>500)throw Error('Expressão muito longa.');
 const result=sum();if(i!==tokens.length || !Number.isFinite(result))throw Error('Resultado indefinido ou expressão inválida.');
 return Number(result.toPrecision(12)).toString();
}
