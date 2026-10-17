import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createAccount} from 'genlayer-js';
import {clientFor,finalized,json,read} from './network.mjs';

mkdirSync('artifacts',{recursive:true});
const source=readFileSync('contracts/AuditLock.py','utf8');
const sourceSha256=createHash('sha256').update(source).digest('hex');
const path='artifacts/deployment-pending.json';
let pending=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
const previous=JSON.parse(readFileSync('src/lib/deployment.json','utf8'));
if(!pending&&previous.sourceSha256===sourceSha256&&previous.deploymentTransaction){
  pending={hash:previous.deploymentTransaction,sourceSha256};
  console.log('Verifying the already recorded deployment:',pending.hash);
}
if(pending&&pending.sourceSha256!==sourceSha256)throw new Error('Recorded deployment uses different source. Inspect its status before replacing it.');
const account=createAccount(process.env.AUDITLOCK_DEPLOYER_PRIVATE_KEY);
const client=clientFor(account);
if(!pending){
  if(!process.env.AUDITLOCK_DEPLOYER_PRIVATE_KEY)await client.request({method:'sim_fundAccount',params:[account.address,1]});
  const hash=await client.deployContract({code:source,args:[],consensusMaxRotations:3});
  pending={hash,sourceSha256,signer:account.address};
  writeFileSync(path,json(pending));console.log('Deployment submitted:',hash);
}
const receipt=await finalized(client,pending.hash);
const address=receipt.recipient??receipt.to_address??receipt.txDataDecoded?.contractAddress??receipt.data?.contract_address;
if(!/^0x[0-9a-fA-F]{40}$/.test(address??''))throw new Error('No valid deployment address in finalized receipt.');
const board=await read(client,address,'get_board');
if(board.version!=='0.1.0'||board.currency!=='GEN')throw new Error('Deployment readback failed.');
const deployment={address,rpc:'https://studio.genlayer.com/api',explorer:'https://explorer-studio.genlayer.com',chainId:61999,currency:'GEN',network:'StudioNet',sourceSha256,deploymentTransaction:pending.hash};
writeFileSync('src/lib/deployment.json',json(deployment));
writeFileSync('artifacts/deployment.json',json({...deployment,receipt,board}));
console.log('AUDITLOCK deployed and verified:',address);
