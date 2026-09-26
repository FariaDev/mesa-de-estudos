// Small numeric parser: no eval, assignments, property access, or executable input.
export function calculate(source, degrees = false) {
 const tokens=source.replace(/,/g,'.').match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z]+|[+\-*/^()%]|\S/g)||[];
 let i=0; const peek=()=>tokens[i]; const take=()=>tokens[i++];
 const UNDEF='Resultado indefinido ou expressão inválida.';
 const undef=()=>{throw Error(UNDEF);};
 const rad=x=>degrees?x*Math.PI/180:x;
 /* Ângulos exatos: em GRAUS o teste é exato no valor digitado (90, 450, -90);
    em RAD é a igualdade exata com k·pi/2 (`pi/2`, `pi` e companhia chegam lá,
    e um ângulo 1 ULP fora não vira polo à toa). `quad` é o quadrante 0..3
    (0 = 0°, 1 = 90°, 2 = 180°, 3 = 270°) e null no ângulo comum: nele o
    seno/cosseno são exatos e o polo vira indefinido. */
 const quad=x=>{
  if(degrees)return x%90===0?((Math.round(x/90)%4)+4)%4:null;
  const q=Math.round(x/(Math.PI/2));
  return x===q*Math.PI/2?((q%4)+4)%4:null;
 };
 const SIN=[0,1,0,-1],COS=[1,0,-1,0];
 const sinOf=x=>{const q=quad(x);return q===null?Math.sin(rad(x)):SIN[q];};
 const cosOf=x=>{const q=quad(x);return q===null?Math.cos(rad(x)):COS[q];};
 const arc=f=>x=>{const v=f(x);return degrees?v*180/Math.PI:v;};
 const functions={
  sin:sinOf,
  cos:cosOf,
  tan:x=>{const q=quad(x);if(q===null)return Math.tan(rad(x));return q%2===1?undef():0;},
  sec:x=>cosOf(x)===0?undef():1/cosOf(x),
  csc:x=>sinOf(x)===0?undef():1/sinOf(x),
  cot:x=>sinOf(x)===0?undef():cosOf(x)/sinOf(x),
  asin:arc(Math.asin),acos:arc(Math.acos),atan:arc(Math.atan),
  sqrt:Math.sqrt,abs:Math.abs,ln:Math.log,log:Math.log10,exp:Math.exp
 };
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
 const result=sum();if(i!==tokens.length || !Number.isFinite(result))throw Error(UNDEF);
 return Number(result.toPrecision(12)).toString();
}
