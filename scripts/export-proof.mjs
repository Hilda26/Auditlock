import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync} from 'node:fs';
const deployment=JSON.parse(readFileSync('src/lib/deployment.json','utf8'));
const digest=createHash('sha256').update(readFileSync('contracts/AuditLock.py')).digest('hex');
if(deployment.sourceSha256&&digest!==deployment.sourceSha256)throw new Error('Contract source differs from the verified deployment.');
mkdirSync('public/verification',{recursive:true});
copyFileSync('contracts/AuditLock.py','public/verification/AuditLock.py');
for(const name of ['deployment.json','live-verification.json']){
  if(existsSync(`artifacts/${name}`))copyFileSync(`artifacts/${name}`,`public/verification/${name}`);
}
