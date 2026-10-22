/* Captura de janela no Windows — paridade com o `screencapture -l` do macOS
   (host do Conferir, `conferir-host.cjs`): acha o processo (por padrão o
   `xournalpp`; o Conferir com outros programas passa o do app escolhido),
   tira a janela pelo retângulo dela (WYSIWYG; fallback PrintWindow com
   PW_RENDERFULLCONTENT) e devolve {title, dataUrl}. `listWindows` lista os
   processos com janela para o seletor. Só PowerShell + .NET do próprio
   Windows — nada instalado, sem rede, sem telemetria.

   O script entra por `-File` num .ps1 temporário (sem quoting de linha de
   comando); os códigos de saída viram mensagens que o usuário resolve (abrir
   o Xournal++, restaurar a janela). Como no macOS, só PNG válido vira anexo. */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {message: uiMsg}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');
const execFileAsync=promisify(execFile);

const PROCESS_NAME='xournalpp';
const PNG_MAGIC=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

const DEFAULT_LABEL='Xournal++';

/* Erros por código de saída do script (os que o usuário sabe resolver). O
   `label` é o nome do app para mostrar; o padrão é o Xournal++ de sempre. */
function exitMessages(label=DEFAULT_LABEL){
 return {
  3:uiMsg('err.capture.openFirst',{app:label}),
  4:uiMsg('err.capture.minimized',{app:label}),
  5:uiMsg('err.capture.saveFail'),
 };
}
const EXIT_MESSAGES=exitMessages();

/* Nome de processo vira literal PowerShell entre aspas simples: aspas duplicadas
   e nada de quebra de linha (o nome vem da lista do sistema, não da pessoa, mas
   o script não confia nele). */
function psLiteral(value){
 return String(value).replace(/[\r\n]+/g,' ').replace(/'/g,"''");
}

/* O script: DPI-aware (o retângulo bate com os pixels físicos), acha a
   primeira janela do processo, copia os pixels do retângulo (PrintWindow se a
   cópia de tela falhar) e grava o PNG no caminho embutido. O título da janela
   sai no stdout (uma linha) — mesmo formato do listing do macOS. */
function buildScript(outFile,processName=PROCESS_NAME){
 const saida=psLiteral(outFile);
 const processo=psLiteral(processName);
 return `$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class MesaWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
'@
[void][MesaWin]::SetProcessDPIAware()
$procs=@(Get-Process -Name '${processo}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
if($procs.Count -eq 0){ exit 3 }
$p=$procs[0]
if([MesaWin]::IsIconic($p.MainWindowHandle)){ exit 4 }
$rect=New-Object MesaWin+RECT
[void][MesaWin]::GetWindowRect($p.MainWindowHandle,[ref]$rect)
$w=$rect.Right-$rect.Left
$h=$rect.Bottom-$rect.Top
if(($w -le 0) -or ($h -le 0)){ exit 4 }
$bmp=New-Object System.Drawing.Bitmap $w,$h
$g=[System.Drawing.Graphics]::FromImage($bmp)
$copied=$true
try { $g.CopyFromScreen($rect.Left,$rect.Top,0,0,$bmp.Size) } catch { $copied=$false }
$g.Dispose()
if(-not $copied){
  $g2=[System.Drawing.Graphics]::FromImage($bmp)
  $hdc=$g2.GetHdc()
  $printed=[MesaWin]::PrintWindow($p.MainWindowHandle,$hdc,2)
  $g2.ReleaseHdc($hdc)
  $g2.Dispose()
  if(-not $printed){ $bmp.Dispose(); exit 5 }
}
try { $bmp.Save('${saida}',[System.Drawing.Imaging.ImageFormat]::Png) } catch { $bmp.Dispose(); exit 5 }
$bmp.Dispose()
[Console]::Out.Write($p.MainWindowTitle)
`;
}

/* Executa o script e devolve {title, dataUrl} (mesmo formato do macOS).
   `exec` e `tmp` são injeção de teste — o caminho feliz usa os do sistema.
   `processName`/`label` escolhem o app (padrão: o Xournal++). */
async function captureWindow(opts={}){
 const {exec=execFileAsync,tmp=null,processName=PROCESS_NAME,label=DEFAULT_LABEL}=opts;
 const messages=exitMessages(label);
 const dir=tmp?tmp():fs.mkdtempSync(path.join(os.tmpdir(),'mesa-visual-'));
 const scriptPath=path.join(dir,'capture.ps1');
 const outFile=path.join(dir,'attempt.png');
 fs.writeFileSync(scriptPath,buildScript(outFile,processName));
 try{
  let stdout='';
  try{
   const r=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',scriptPath],{timeout:20000,maxBuffer:1024*1024});
   stdout=String(r&&r.stdout||'');
  }catch(e){
   const code=e&&e.code;
   if(messages[code])throw Error(messages[code]);
   throw Error(uiMsg('err.capture.failed',{app:label,reason:causeArg(e)}));
  }
  let bytes;
  try{bytes=fs.readFileSync(outFile);}catch{throw Error(uiMsg('err.capture.notPng'));}
  if(bytes.length<100||!bytes.subarray(0,8).equals(PNG_MAGIC))throw Error(uiMsg('err.capture.notPng'));
  return {title:stdout.trim()||label,dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
 }finally{
  try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
 }
}

const captureXournalWindow=opts=>captureWindow(opts);

/* Lista os processos com janela principal para o seletor do Conferir. Saída:
   [{id, app, title}] — `id` é o PID (texto) e `app` o nome do processo. O
   tamanho não vem daqui: minimizada cai na mensagem da captura. */
const LIST_SCRIPT=`$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$rows=@(Get-Process | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle } | ForEach-Object { [pscustomobject]@{ id=[string]$_.Id; app=$_.ProcessName; title=$_.MainWindowTitle } })
ConvertTo-Json -InputObject $rows -Compress
`;

async function listWindows(opts={}){
 const {exec=execFileAsync,tmp=null}=opts;
 const dir=tmp?tmp():fs.mkdtempSync(path.join(os.tmpdir(),'mesa-visual-'));
 const scriptPath=path.join(dir,'list.ps1');
 fs.writeFileSync(scriptPath,LIST_SCRIPT);
 try{
  let stdout='';
  try{
   const r=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',scriptPath],{timeout:20000,maxBuffer:1024*1024});
   stdout=String(r&&r.stdout||'');
  }catch(e){
   throw Error(uiMsg('err.capture.listFailed',{reason:causeArg(e)}));
  }
  let rows;
  try{rows=JSON.parse(stdout.trim()||'[]');}catch{throw Error(uiMsg('err.capture.listUnreadable'));}
  if(!Array.isArray(rows))rows=[rows];
  return rows.filter(r=>r&&typeof r==='object').map(r=>({id:String(r.id??''),app:String(r.app??''),title:String(r.title??'')})).filter(r=>r.id&&r.app);
 }finally{
  try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
 }
}

module.exports={PROCESS_NAME,PNG_MAGIC,EXIT_MESSAGES,exitMessages,buildScript,captureWindow,captureXournalWindow,listWindows,psLiteral};
