import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const origin='http://127.0.0.1:3016';
const output=path.join(root,'artifacts/walkthrough-live-verification.json');
const privateDirectory=path.join(root,'artifacts/private/walkthrough');
mkdirSync(privateDirectory,{recursive:true});
let child=null;
let exitCode=null;
let consoleText='';
let grantedStep=0;
let started=false;
let runStartedAt=0;
function snapshot(){try{const record=JSON.parse(readFileSync(output,'utf8'));return Date.parse(record.startedAt)>=runStartedAt?record:null;}catch{return null;}}
function respond(response,status,data){response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(data));}
const server=createServer(async(request,response)=>{
  if(request.url==='/'&&request.method==='GET'){
    response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src https://auditlock.vercel.app; connect-src 'self'"});
    response.end(readFileSync(path.join(root,'scripts/walkthrough/console.html')));return;
  }
  if(request.url==='/api/status'&&request.method==='GET'){respond(response,200,{started,exitCode,log:started?snapshot():null,console:consoleText.slice(-18000)});return;}
  if(request.method==='POST'&&request.headers.origin===origin){
    if(request.url==='/api/start'){
      if(started){respond(response,409,{error:'A run already exists in this server session.'});return;}
      started=true;
      runStartedAt=Date.now();
      child=spawn(process.execPath,['scripts/verify-live.mjs'],{cwd:root,env:{...process.env,AUDITLOCK_RUN_OUTPUT:'artifacts/walkthrough-live-verification.json',AUDITLOCK_INTERACTIVE_TEST:'1'},stdio:['pipe','pipe','pipe'],windowsHide:true});
      for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{consoleText+=data.toString();writeFileSync(path.join(privateDirectory,'live-console.txt'),consoleText);});
      child.on('exit',code=>{exitCode=code;});
      child.on('error',error=>{consoleText+=String(error);exitCode=-1;});
      respond(response,200,{started:true});return;
    }
    if(request.url==='/api/next'){
      const log=snapshot();
      if(!child||exitCode!==null||!log?.nextAction||log.nextAction.step<=grantedStep){respond(response,409,{error:'No new transaction awaits confirmation.'});return;}
      grantedStep=log.nextAction.step;
      child.stdin.write('\n');respond(response,200,{confirmedStep:grantedStep});return;
    }
  }
  respond(response,404,{error:'Not found'});
});
server.listen(3016,'127.0.0.1',()=>console.log('Local interactive test console:',origin));
process.on('SIGINT',()=>{child?.kill();server.close(()=>process.exit(0));});
