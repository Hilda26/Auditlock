import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createAccount} from 'genlayer-js';
import {addressArg,clientFor,finalized,json,read} from './network.mjs';

const deployment=JSON.parse(readFileSync('src/lib/deployment.json','utf8'));
assert.match(deployment.address,/^0x[0-9a-fA-F]{40}$/);
mkdirSync('artifacts',{recursive:true});
const runId=Date.now().toString(36).toUpperCase();
const owner=createAccount();
const auditor=createAccount();
const observer=createAccount();
const clients={owner:clientFor(owner),auditor:clientFor(auditor),observer:clientFor(observer)};
const accounts={owner,auditor,observer};
const log={status:'RUNNING',startedAt:new Date().toISOString(),runId,network:'GenLayer StudioNet',currency:'test GEN',contract:deployment.address,fixture:'Synthetic audit-delivery reports for integration testing. Not a professional security audit of OpenZeppelin.',owner:owner.address,auditor:auditor.address,transactions:[],withdrawals:[],checks:[]};
const output='artifacts/live-verification.json';
function save(){writeFileSync(output,json(log));}
function check(name,condition){assert.ok(condition,name);log.checks.push(name);save();console.log('PASS:',name);}
async function call(role,method,args=[],value=0n){
  const client=clients[role];
  const hash=await client.writeContract({address:deployment.address,functionName:method,args,value,consensusMaxRotations:3});
  const entry={role,method,hash,status:'PENDING'};log.transactions.push(entry);save();console.log(method,hash);
  entry.receipt=await finalized(client,hash);entry.status='FINALIZED_SUCCESS';save();
  return entry;
}
async function audit(id){return read(clients.observer,deployment.address,'get_audit',[id]);}
async function conservation(){const board=await read(clients.observer,deployment.address,'get_board');check('Contract conserves every deposited base unit',BigInt(board.deposited)===BigInt(board.locked)+BigInt(board.claimable)+BigInt(board.withdrawn));return board;}
async function withdraw(role){
  const account=accounts[role];const client=clients[role];
  const credit=BigInt((await read(client,deployment.address,'get_account',[addressArg(account.address)])).claimable);
  assert.ok(credit>0n);
  const before=await client.getBalance({address:account.address});
  const entry=await call(role,'withdraw');
  const children=await client.getTriggeredTransactionIds({hash:entry.hash});
  assert.ok(children.length>0,'Withdrawal must emit a child transfer');
  entry.transfers=[];
  for(const hash of children)entry.transfers.push({hash,receipt:await finalized(client,hash)});
  const after=await client.getBalance({address:account.address});
  const remaining=await read(client,deployment.address,'get_account',[addressArg(account.address)]);
  const withdrawal={role,hash:entry.hash,before:String(before),after:String(after),credited:String(credit),delta:String(BigInt(after)-BigInt(before)),remaining:remaining.claimable,childTransactions:children};
  log.withdrawals.push(withdrawal);
  log[`${role}Withdrawal`]=withdrawal;
  check(`${role} receives its full GEN withdrawal on-chain`,BigInt(after)-BigInt(before)===credit&&remaining.claimable==='0');
  save();
}

try{
  save();
  await Promise.all(Object.values(clients).map((client,index)=>client.request({method:'sim_fundAccount',params:[Object.values(accounts)[index].address,1]})));
  const commit='dbb6104ce834628e473d2173bbc9d47f81a9eec3';
  const repository='https://github.com/OpenZeppelin/openzeppelin-contracts';
  const id=`AL-LIVE-${runId}`;
  const scope=[
    {title:'Audit report · integration fixture',amount:'7000000000000000',criteria:[`Provide a written report naming commit ${commit} and the scoped ERC20 transfer and approve functions.`,`Include a function coverage matrix and a findings register; zero findings is an acceptable report result.`]},
    {title:'Remediation review · integration fixture',amount:'3000000000000000',criteria:['The remediation report must state a resolved or unresolved disposition for each of findings F-01 and F-02. A statement that no review was performed does not fulfill this obligation.']}
  ];
  log.auditId=id;
  await call('owner','create_audit',[id,'Live verification · ERC20 audit escrow',repository,commit,addressArg(auditor.address),JSON.stringify(scope),BigInt(Math.floor(Date.now()/1000)+14*86400)],10000000000000000n);
  let record=await audit(id);
  check('Exact code revision and funded milestone terms are stored',record.commit===commit&&record.escrow==='10000000000000000'&&record.milestones.length===2);
  await call('auditor','accept_audit',[id]);
  const report=`INTEGRATION TEST FIXTURE, NOT A PROFESSIONAL SECURITY AUDIT. Frozen code revision: ${commit}. Scoped file: contracts/token/ERC20/ERC20.sol. Functions: transfer(address,uint256) and approve(address,uint256). COVERAGE MATRIX: transfer — report review recorded; approve — report review recorded. FINDINGS REGISTER: zero findings recorded in this illustrative document. No security certification or claim of executed security testing is made. This report exists to test the escrow delivery workflow.`;
  await call('auditor','add_evidence',[id,'M1','ERC20 coverage report · test fixture',report,`https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/${commit}/contracts/token/ERC20/ERC20.sol`]);
  await call('auditor','submit_delivery',[id,'M1','Submitted the integration-test report with frozen revision, scoped functions, coverage matrix, and findings register.']);
  await call('owner','approve_delivery',[id,'M1']);
  record=await audit(id);
  check('Owner acceptance pays only the first milestone',record.milestones[0].state==='PAID'&&record.milestones[1].state==='WAITING');
  check('Public source content was snapshotted and hashed',record.milestones[0].evidence[0].snapshot.length>30&&record.milestones[0].evidence[0].snapshot_hash.length===64);
  await call('auditor','add_evidence',[id,'M2','Incomplete remediation report · test fixture','INTEGRATION TEST FIXTURE. No remediation review was performed. Neither F-01 nor F-02 has been assessed. This document contains no resolved or unresolved disposition for either finding. The agreed review was not delivered.','']);
  await call('auditor','submit_delivery',[id,'M2','Submitting this deliberately incomplete remediation document to exercise the real consensus refund path.']);
  await call('owner','dispute_delivery',[id,'M2','Criterion C1 requires a resolved or unresolved disposition for BOTH F-01 and F-02. E1 explicitly admits no review and provides neither disposition. The required remediation deliverable is absent.']);
  await call('owner','add_evidence',[id,'M2','Protocol comparison to criterion C1','The frozen criterion C1 requires finding-by-finding remediation outcomes. Auditor exhibit E1 explicitly states that neither finding was assessed and no review was delivered. This challenge concerns missing contractual deliverables, not the security of OpenZeppelin code.','']);
  await call('owner','mark_ready',[id,'M2']);
  await call('auditor','mark_ready',[id,'M2']);
  await call('observer','assess_delivery',[id,'M2']);
  record=await audit(id);
  log.ruling=record.milestones[1].ruling;
  check('Real GenLayer consensus finds the documented unmet criterion',record.milestones[1].ruling?.outcome==='REFUND'&&record.milestones[1].ruling.checks[0].status==='NOT_MET');
  check('Contested milestone refunds exactly its funded amount',record.milestones[1].settlement.owner==='3000000000000000'&&record.state==='SETTLED');
  await conservation();
  await withdraw('owner');
  await withdraw('auditor');
  const cancelled=`AL-CANCEL-${runId}`;
  log.cancelledAuditId=cancelled;
  await call('owner','create_audit',[cancelled,'Live verification · cancellation',repository,commit,addressArg(auditor.address),JSON.stringify([{title:'Unaccepted report',amount:'1000000000000000',criteria:['Deliver the agreed report against the exact code revision before the stated deadline.']}]),BigInt(Math.floor(Date.now()/1000)+86400)],1000000000000000n);
  await call('owner','cancel_unaccepted',[cancelled]);
  check('Unaccepted engagement refunds the full deposit',(await audit(cancelled)).milestones[0].settlement.owner==='1000000000000000');
  await withdraw('owner');
  log.finalBoard=await conservation();
  log.finalAudit=await audit(id);
  log.status='PASSED';log.completedAt=new Date().toISOString();save();
  console.log('ALL LIVE TESTS PASSED');
}catch(error){log.status='FAILED';log.failure=String(error);log.completedAt=new Date().toISOString();save();console.error('LIVE VERIFICATION FAILED:',String(error));process.exitCode=1;}
