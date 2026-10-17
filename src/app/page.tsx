'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, CircleDot, Clock3, Copy, ExternalLink, FileCheck2, FileCode2, FileText, Fingerprint, FolderGit2, GitCommitHorizontal, Layers3, LayoutDashboard, LifeBuoy, LoaderCircle, LockKeyhole, Plus, Search, Shield, ShieldCheck, SlidersHorizontal, Wallet, X } from 'lucide-react';
import type { CalldataEncodable, TransactionHash } from 'genlayer-js/types';
import { addressArg, amount, configured, connectWallet, deployment, explain, money, read, short, submit, units, wait } from '@/lib/client';
import type { Address, Audit, AuditSummary, Board, Exhibit, Milestone } from '@/lib/types';
import { example } from '@/lib/example';

type DialogState = {kind:'create'|'evidence'|'delivery'|'dispute'|'rules'|'exhibit';milestone?:Milestone;exhibit?:Exhibit};
type Transaction = {hash:TransactionHash;label:string;state:'Pending'|'Finalized'|'Needs attention'|'Failed';createdAuditId?:string};
const emptyBoard:Board={version:'0.1.0',audits:'0',deposited:'0',locked:'0',claimable:'0',withdrawn:'0',currency:'GEN'};
const date=(timestamp:number)=>new Date(timestamp*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const when=(timestamp:number)=>new Date(timestamp*1000).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const label=(state:string)=>({OFFERED:'Awaiting auditor',ACTIVE:'In progress',SETTLED:'Settled',WAITING:'Not submitted',SUBMITTED:'In review',DISPUTED:'Challenged',PAID:'Paid',REFUNDED:'Refunded',SPLIT:'Split settlement'}[state]??state);

function Badge({state}:{state:string}) {return <span className={`badge ${state.toLowerCase()}`}><span/>{label(state)}</span>;}
function IconBox({children}:{children:ReactNode}) {return <span className="icon-box">{children}</span>;}
function CopyButton({value}:{value:string}) {const [copied,setCopied]=useState(false);return <button className="icon-button" aria-label="Copy value" onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}}}>{copied?<Check size={14}/>:<Copy size={14}/>}</button>;}

export default function Home() {
  const [account,setAccount]=useState<Address|null>(null);
  const [board,setBoard]=useState<Board>(emptyBoard);
  const [summaries,setSummaries]=useState<AuditSummary[]>([]);
  const [selectedId,setSelectedId]=useState('');
  const [audit,setAudit]=useState<Audit|null>(null);
  const [mode,setMode]=useState<'live'|'example'>(configured?'live':'example');
  const [section,setSection]=useState('Workspace');
  const [tab,setTab]=useState('Scope & milestones');
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('ALL');
  const [loading,setLoading]=useState(configured);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [dialog,setDialog]=useState<DialogState|null>(null);
  const [credit,setCredit]=useState('0');
  const [busy,setBusy]=useState(false);
  const [refreshVersion,setRefreshVersion]=useState(0);
  const [transaction,setTransaction]=useState<Transaction|null>(null);
  const transactionActive=useRef(false);
  const current=mode==='example'?example:audit;
  const isExample=mode==='example';
  const owner=!!account&&current?.owner.toLowerCase()===account.toLowerCase();
  const auditor=!!account&&current?.auditor.toLowerCase()===account.toLowerCase();
  const participant=owner||auditor;
  const pending=busy||transaction?.state==='Pending'||transaction?.state==='Needs attention';

  const refresh=useCallback(async()=>{
    if(!configured){setLoading(false);return;}
    try {
      const [totals,records]=await Promise.all([read<Board>('get_board'),read<AuditSummary[]>('list_audits',[0n,50n])]);
      setBoard(totals);setSummaries(records);setError('');
      setSelectedId(previous=>previous||records.find(record=>record.state==='ACTIVE')?.id||records.find(record=>record.milestones>1)?.id||records[0]?.id||'');
      if(account) setCredit((await read<{claimable:string}>('get_account',[addressArg(account)])).claimable);
    }catch(problem){setError(explain(problem));}finally{setLoading(false);}
  },[account]);

  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000);return()=>clearInterval(timer);},[refresh]);
  useEffect(()=>{
    if(!selectedId||!configured)return;
    let alive=true;
    setAudit(null);
    const load=async()=>{try{const record=await read<Audit>('get_audit',[selectedId]);if(alive)setAudit(record);}catch(problem){if(alive)setError(explain(problem));}};
    void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};
  },[selectedId,refreshVersion]);
  useEffect(()=>{
    const changed=()=>{setAccount(null);setCredit('0');setNotice('Wallet changed. Connect again to use the current account.');};
    window.ethereum?.on?.('accountsChanged',changed);
    return()=>window.ethereum?.removeListener?.('accountsChanged',changed);
  },[]);
  useEffect(()=>{try{const stored=localStorage.getItem('auditlock-pending');if(stored){const parsed=JSON.parse(stored) as Transaction;if(/^0x[0-9a-f]{64}$/i.test(parsed.hash))setTransaction({...parsed,state:'Needs attention'});}}catch{}},[]);

  async function connect() {try{setAccount(await connectWallet());setNotice('Wallet connected. Every write requires your signature.');setError('');}catch(problem){setError(explain(problem));}}
  async function track(item:Transaction) {
    if(transactionActive.current)return;
    transactionActive.current=true;setTransaction({...item,state:'Pending'});
    try {
      await wait(item.hash);setTransaction({...item,state:'Finalized'});localStorage.removeItem('auditlock-pending');
      setNotice(`${item.label} finalized successfully.`);await refresh();
      if(item.createdAuditId)setSelectedId(item.createdAuditId);
      setRefreshVersion(previous=>previous+1);
    }catch(problem){setError(explain(problem));const failed=/did not execute successfully/.test(explain(problem));setTransaction({...item,state:failed?'Failed':'Needs attention'});if(failed)localStorage.removeItem('auditlock-pending');}
    finally{transactionActive.current=false;}
  }
  async function transact(method:string,args:CalldataEncodable[],description:string,value=0n) {
    if(pending)return;
    if(!account){await connect();return;}
    if(isExample&&method!=='create_audit'&&method!=='withdraw'){setNotice('The example is read-only. Select the live registry to transact.');return;}
    setBusy(true);setError('');setNotice('Confirm the transaction in your wallet.');
    try {
      const hash=await submit(account,method,args,value);
      const item:Transaction={hash,label:description,state:'Pending',...(method==='create_audit'?{createdAuditId:String(args[0])}:{})};
      try{localStorage.setItem('auditlock-pending',JSON.stringify(item));}catch{}
      setDialog(null);setMode('live');await track(item);
    }catch(problem){setError(explain(problem));}finally{setBusy(false);}
  }

  const visible=summaries.filter(record=>(section!=='My audits'||(account&&[record.owner.toLowerCase(),record.auditor.toLowerCase()].includes(account.toLowerCase())))&&(statusFilter==='ALL'||record.state===statusFilter)&&`${record.id} ${record.title} ${record.repository}`.toLowerCase().includes(search.toLowerCase()));
  const active=summaries.filter(record=>record.state!=='SETTLED').length;
  const milestones=current?.milestones??[];
  const paid=milestones.reduce((sum,milestone)=>sum+BigInt(milestone.settlement?.auditor??0),0n);
  const refunded=milestones.reduce((sum,milestone)=>sum+BigInt(milestone.settlement?.owner??0),0n);
  const remaining=BigInt(current?.escrow??0)-paid-refunded;
  const total=BigInt(current?.escrow??1);
  const progress=total>0n?Number(paid*10000n/total)/100:0;

  function action(method:string,milestone?:Milestone) {
    if(!current)return;
    if(isExample){setNotice('This example is illustrative. Use a live engagement for wallet actions.');return;}
    void transact(method,[current.id,...(milestone?[milestone.id]:[])],method.replaceAll('_',' '));
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#" className="brand" aria-label="AUDITLOCK workspace"><span className="brand-mark"><LockKeyhole size={19}/></span>AUDITLOCK<span className="brand-period">.</span></a>
      <div className="workspace-selector"><span className="workspace-avatar">A</span><div>Audit workspace<small>GenLayer StudioNet</small></div><ChevronDown size={14}/></div>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="Main navigation">{[{name:'Workspace',icon:LayoutDashboard},{name:'My audits',icon:ShieldCheck},{name:'Evidence library',icon:FolderGit2}].map(({name,icon:Icon})=><button key={name} className={`nav-item ${section===name?'selected':''}`} onClick={()=>{setSection(name);if(name==='Evidence library')setTab('Evidence');else setTab('Scope & milestones');}}><Icon size={18}/>{name}{name==='Workspace'&&<span className="nav-count">{summaries.length}</span>}</button>)}</nav>
      <div className="sidebar-divider"/><span className="nav-label">RESOURCES</span>
      <button className="nav-item" onClick={()=>setDialog({kind:'rules'})}><BookOpen size={18}/>Settlement rules<ArrowUpRight size={14}/></button>
      <a className="nav-item" href="https://docs.genlayer.com/" target="_blank" rel="noreferrer"><LifeBuoy size={18}/>GenLayer docs<ArrowUpRight size={14}/></a>
      <div className="sidebar-bottom"><div className="network-indicator"><i/> BUILT ON GENLAYER</div><p>Defined scope.<br/>Verifiable delivery.<br/><span>Accountable settlement.</span></p><div className="testnet-note"><Shield size={14}/> Test network · no real funds</div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumbs">Workspace <ChevronRight size={13}/><strong>{section}</strong></div><div className="header-actions"><span className="network-pill"><i/>StudioNet <span>test GEN</span></span><button className="wallet-button" onClick={()=>void connect()}><Wallet size={15}/>{account?short(account):'Connect wallet'}</button></div></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow"><span/> SECURITY AUDIT OPERATIONS</div><h1>{section==='My audits'?'Your audit engagements':section==='Evidence library'?'The evidence desk':'Audit workspace'}</h1><p>Scope stays fixed. Payment follows delivery.</p></div><button className="button dark" onClick={()=>setDialog({kind:'create'})}><Plus size={17}/>New audit</button></div>
        <div className="stats-grid"><div className="stat-card"><span>Total escrow locked<LockKeyhole size={15}/></span><strong>{money(board.locked)}<small>GEN</small></strong><p><span className="small-dot"/>Held by the contract</p></div><div className="stat-card"><span>Active engagements<ShieldCheck size={16}/></span><strong>{String(active).padStart(2,'0')}</strong><p>{summaries.length} latest registered audits</p></div><div className="stat-card"><span>Withdrawn to wallets<ArrowUpRight size={16}/></span><strong>{money(board.withdrawn)}<small>GEN</small></strong><p>Recorded finalized withdrawals</p></div><div className="stat-card accent"><span>Your available credit<Wallet size={16}/></span><strong>{money(credit)}<small>GEN</small></strong><p>{account?'Ready for wallet withdrawal':'Connect a wallet to see your balance'}</p></div></div>
        {error&&<div role="alert" className="alert error"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
        {notice&&<div role="status" className="alert notice"><span>{notice}</span><button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
        {transaction&&<div className="transaction-banner"><LoaderCircle className={transaction.state==='Pending'?'spin':''} size={16}/><span>{transaction.label} · {transaction.state}</span><a href={`${deployment.explorer}/tx/${transaction.hash}`} target="_blank" rel="noreferrer">View transaction<ExternalLink size={12}/></a>{transaction.state==='Needs attention'&&<button onClick={()=>void track(transaction)}>Check finality</button>}</div>}
        <section className="registry panel" aria-label="Audit registry"><div className="registry-toolbar"><div className="segmented"><button className={!isExample?'active':''} onClick={()=>setMode('live')}>Live registry <span>{summaries.length}</span></button><button className={isExample?'active':''} onClick={()=>{setMode('example');setTab('Scope & milestones');}}>Example workspace</button></div><div className="registry-tools"><label className="search"><Search size={15}/><input aria-label="Search audits" placeholder="Search audits…" value={search} onChange={event=>setSearch(event.target.value)}/></label><label className="filter"><SlidersHorizontal size={14}/><select aria-label="Filter audits by status" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="OFFERED">Awaiting auditor</option><option value="ACTIVE">In progress</option><option value="SETTLED">Settled</option></select></label></div></div>
          {isExample?<div className="example-banner"><FileText size={15}/><strong>Example workspace</strong><span>Illustrative data · no deposit, transaction, or consensus ruling.</span></div>:loading?<div className="empty-state"><LoaderCircle className="spin" size={22}/><p>Reading finalized contract records…</p></div>:visible.length===0?<div className="empty-state"><ShieldCheck size={25}/><h3>{section==='My audits'&&!account?'Connect to see your audits':'No matching engagements'}</h3><p>{error?'The registry could not be loaded. Retry the connection.':'Create a funded audit, or explore the example workspace.'}</p><button className="button" onClick={()=>error?void refresh():setMode('example')}>{error?'Retry connection':'Explore example'}<ArrowRight size={14}/></button></div>:<div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>ENGAGEMENT</th><th>CODE REVISION</th><th>ESCROW</th><th>STATUS</th><th aria-label="Open audit"/></tr></thead><tbody>{visible.map(record=><tr key={record.id} className={selectedId===record.id?'selected-row':''}><td><button className="row-link" onClick={()=>{setSelectedId(record.id);setTab(section==='Evidence library'?'Evidence':'Scope & milestones');}}><IconBox><FileCode2 size={18}/></IconBox><span>{record.title}<small>{record.id} · {record.completed}/{record.milestones} milestones settled</small></span></button></td><td><span className="commit-chip"><GitCommitHorizontal size={13}/>{record.commit.slice(0,7)}</span></td><td className="table-amount">{money(record.escrow)}<small> GEN</small></td><td><Badge state={record.state}/></td><td><button className="icon-button" aria-label={`Open ${record.title}`} onClick={()=>setSelectedId(record.id)}><ArrowUpRight size={17}/></button></td></tr>)}</tbody></table></div>}
        </section>

        {!current&&!isExample&&selectedId&&<div className="empty-state"><LoaderCircle className="spin"/><p>Loading engagement…</p></div>}
        {current&&<div className="engagement-grid"><section className="engagement panel"><div className="engagement-heading"><div className="engagement-id"><span>{current.id}</span><span className="separator-dot">/</span>{isExample?'ILLUSTRATIVE ENGAGEMENT':'CONTRACT RECORD'}</div><div className="engagement-title"><h2>{current.title}</h2><Badge state={current.state}/></div><div className="engagement-meta"><span><FolderGit2 size={14}/>{current.repository.replace('https://github.com/','')}</span><span><Clock3 size={14}/>Due {date(current.deadline)}</span></div></div>
          <div className="revision-strip"><div className="revision-symbol"><GitCommitHorizontal size={19}/></div><div><span>FROZEN CODE REVISION</span><code>{current.commit}</code></div><CopyButton value={current.commit}/><div className="scope-seal"><Fingerprint size={16}/>Scope locked</div></div>
          <div className="detail-tabs" role="tablist" aria-label="Audit details">{['Scope & milestones','Evidence','Activity'].map(name=><button role="tab" aria-selected={tab===name} key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}>{name}{name==='Evidence'&&<span>{milestones.reduce((sum,milestone)=>sum+milestone.evidence.length,0)}</span>}</button>)}</div>
          {tab==='Scope & milestones'&&<div className="milestone-list">{milestones.map((milestone,index)=><article className="milestone" key={milestone.id}><div className="milestone-heading"><span className={`milestone-number ${milestone.state==='PAID'?'complete':''}`}>{milestone.state==='PAID'?<Check size={16}/>:String(index+1).padStart(2,'0')}</span><div><h3>{milestone.title}</h3><span>{milestone.id} · {milestone.criteria.length} acceptance criteria</span></div><div className="milestone-value">{money(milestone.amount)} <small>GEN</small><Badge state={milestone.state}/></div></div><div className="criteria">{milestone.criteria.map(criterion=>{const check=milestone.ruling?.checks.find(item=>item.criterion===criterion.id);return <div className="criterion" key={criterion.id}><span className={check?.status==='MET'?'criterion-icon met':'criterion-icon'}>{check?.status==='MET'?<Check size={12}/>:<span/>}</span><p>{criterion.text}{check&&<small className={`check-result ${check.status.toLowerCase()}`}>{check.status.replace('_',' ')} · {check.evidence.join(', ')||'Insufficient evidence'}</small>}</p><code>{criterion.id}</code></div>;})}</div>
            {milestone.delivery&&<div className="delivery-note"><FileCheck2 size={15}/><div><strong>Delivery submitted</strong><p>{milestone.delivery}</p>{milestone.state==='SUBMITTED'&&<small>Review closes {when(milestone.review_until)}</small>}</div></div>}
            {milestone.dispute&&<div className="dispute-note"><strong>Protocol challenge</strong><p>{milestone.dispute.grounds}</p><small>Response until {when(milestone.dispute.respond_until)} · Recovery after {when(milestone.dispute.resolve_until)}</small><small>{milestone.dispute.ready.length}/2 participants ready for early assessment</small></div>}
            {milestone.ruling&&<div className="ruling-note"><div><ShieldCheck size={17}/><strong>Recorded GenLayer assessment</strong><span>{milestone.ruling.outcome}</span></div><p>{milestone.ruling.reason}</p></div>}
            {milestone.settlement&&<div className="settlement-note"><CheckCheck size={15}/><div>{milestone.settlement.reason}<small>Auditor {money(milestone.settlement.auditor)} GEN · Protocol {money(milestone.settlement.owner)} GEN</small></div></div>}
            {!isExample&&<div className="milestone-actions">
              {participant&&['WAITING','SUBMITTED','DISPUTED'].includes(milestone.state)&&<button className="button small" disabled={pending} onClick={()=>setDialog({kind:'evidence',milestone})}><Plus size={14}/>Add evidence</button>}
              {auditor&&current.state==='ACTIVE'&&milestone.state==='WAITING'&&index===milestones.findIndex(item=>item.state!=='PAID')&&<button className="button dark small" disabled={pending} onClick={()=>setDialog({kind:'delivery',milestone})}>Submit delivery<ArrowRight size={13}/></button>}
              {owner&&milestone.state==='SUBMITTED'&&<><button className="button dark small" disabled={pending} onClick={()=>action('approve_delivery',milestone)}>Accept & release</button><button className="button small" disabled={pending||Date.now()/1000>=milestone.review_until} onClick={()=>setDialog({kind:'dispute',milestone})}>Challenge delivery</button></>}
              {milestone.state==='SUBMITTED'&&Date.now()/1000>=milestone.review_until&&<button className="button small" disabled={pending||!account} onClick={()=>action('settle_uncontested',milestone)}>Settle uncontested delivery</button>}
              {participant&&milestone.state==='DISPUTED'&&!milestone.dispute?.ready.includes(account!.toLowerCase())&&<button className="button small" disabled={pending} onClick={()=>action('mark_ready',milestone)}>Ready for assessment</button>}
              {milestone.state==='DISPUTED'&&<button className="button dark small" disabled={pending||!account||(Date.now()/1000<(milestone.dispute?.respond_until??0)&&milestone.dispute?.ready.length!==2)} onClick={()=>action('assess_delivery',milestone)}>Request GenLayer assessment</button>}
              {milestone.state==='DISPUTED'&&Date.now()/1000>=(milestone.dispute?.resolve_until??Infinity)&&<button className="button small" disabled={pending||!account} onClick={()=>action('recover_timeout',milestone)}>Recover timed-out escrow</button>}
            </div>}
            {isExample&&index===0&&<button className="text-button" onClick={()=>setTab('Evidence')}>Inspect example evidence<ArrowRight size={14}/></button>}
          </article>)}</div>}
          {tab==='Evidence'&&<div className="evidence-list"><div className="section-caption"><h3>Recorded exhibits</h3><span>Signed submissions · fixed content</span></div>{milestones.flatMap(milestone=>milestone.evidence.map(exhibit=><button className="exhibit-card" key={`${milestone.id}-${exhibit.id}`} onClick={()=>setDialog({kind:'exhibit',milestone,exhibit})}><span className="document-icon"><FileText size={23}/></span><div><h3>{exhibit.title}</h3><p>{milestone.id} / {exhibit.id} · {exhibit.role==='AUDITOR'?'Auditor':'Protocol'} submission</p><small>{exhibit.snapshot?'Source snapshot recorded':'Signed statement; no source snapshot'}</small></div><ArrowUpRight size={17}/></button>))}{milestones.every(milestone=>!milestone.evidence.length)&&<div className="empty-state"><FileText/><h3>No evidence recorded</h3><p>The accepted participants can add exhibits to each milestone.</p></div>}<p className="evidence-footnote">A content hash fixes the submitted record. It does not certify the truth of a report or the security of the code.</p></div>}
          {tab==='Activity'&&<div className="activity-list">{[...current.history].reverse().map((event,index)=><div className="activity-item" key={index}><span className="activity-dot"/><div><strong>{event.event}</strong><small>{short(event.actor)} · {when(event.at)}</small></div></div>)}</div>}
          <div className="scope-footer"><Fingerprint size={14}/><span>Scope digest <code>{short(current.scope_hash)}</code></span><CopyButton value={current.scope_hash}/></div>
        </section>

        <aside className="engagement-aside"><section className="escrow-card panel"><div className="card-label"><span className="small-dot"/>ENGAGEMENT ESCROW<LockKeyhole size={15}/></div><div className="escrow-amount">{money(current.escrow)}<span>GEN</span></div><p>{isExample?'Illustrative allocation':'Funded in StudioNet test GEN'}</p><div className="escrow-progress"><div style={{width:`${progress}%`}}/></div><div className="escrow-breakdown"><span><i className="legend-dot paid"/>Auditor credits<strong>{money(paid)} GEN</strong></span><span><i className="legend-dot"/>Still locked<strong>{money(remaining)} GEN</strong></span><span><i className="legend-dot refund"/>Protocol refunds<strong>{money(refunded)} GEN</strong></span></div><div className="credit-row"><span>Your withdrawable credit</span><strong>{money(credit)} GEN</strong></div><button className="button dark full" disabled={!account||BigInt(credit)===0n||pending} onClick={()=>void transact('withdraw',[],'Withdraw escrow credit')}><ArrowDownToLine size={15}/>Withdraw to wallet</button><small className="escrow-note">Settlement creates credit. Withdrawals are separate signed transactions.</small></section>
          <section className="participants-card panel"><h3>Agreement participants</h3><div className="participant"><span className="avatar protocol">P</span><div>Protocol owner<small>{short(current.owner)}</small></div><CopyButton value={current.owner}/></div><div className="participant"><span className="avatar auditor">A</span><div>Independent auditor<small>{short(current.auditor)}</small></div><CopyButton value={current.auditor}/></div>{!isExample&&current.state==='OFFERED'&&<div className="participant-actions">{auditor&&<button className="button dark full" disabled={pending} onClick={()=>action('accept_audit')}>Accept scope & rules</button>}{participant&&<button className="button full" disabled={pending} onClick={()=>action('cancel_unaccepted')}>Cancel unaccepted audit</button>}</div>}{!isExample&&current.state==='ACTIVE'&&Date.now()/1000>=current.deadline&&milestones.some(milestone=>milestone.state==='WAITING')&&<button className="button full" disabled={!account||pending} onClick={()=>action('expire_undelivered')}>Refund overdue undelivered work</button>}</section>
          <section className="principle-card"><span className="principle-icon"><ShieldCheck size={22}/></span><h3>Delivery is the question.</h3><p>GenLayer assesses the agreed audit deliverables against the evidence. A ruling is never a guarantee that the protocol is secure.</p><button className="text-button" onClick={()=>setDialog({kind:'rules'})}>How settlement works<ArrowUpRight size={14}/></button></section>
        </aside></div>}
        <footer className="page-footer"><span><ShieldCheck size={13}/>AUDITLOCK <span className="footer-divider">/</span> Scope. Evidence. Settlement.</span><div>{configured&&<a href={`${deployment.explorer}/address/${deployment.address}`} target="_blank" rel="noreferrer">Contract<ExternalLink size={12}/></a>}<a href="https://github.com/Hilda26/Auditlock" target="_blank" rel="noreferrer">Source<ExternalLink size={12}/></a><span>v0.1 · StudioNet test GEN</span></div></footer>
      </main>
    </div>
    {dialog&&<AuditDialog state={dialog} audit={current} busy={!!pending} close={()=>setDialog(null)} onSubmit={transact} account={account} connect={connect}/>}
  </div>;
}

function AuditDialog({state,audit,busy,close,onSubmit,account,connect}:{state:DialogState;audit:Audit|null;busy:boolean;close:()=>void;onSubmit:(method:string,args:CalldataEncodable[],description:string,value?:bigint)=>Promise<void>;account:Address|null;connect:()=>Promise<void>}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [problem,setProblem]=useState('');
  const [stages,setStages]=useState([{title:'Security audit report',amount:'0.007',criteria:'Cover all agreed contract modules at the frozen commit and provide a report coverage matrix.\nProvide reproduction steps for every finding, or document the absence of findings.'},{title:'Remediation review',amount:'0.003',criteria:'Review the agreed remediation commit and record the resolved or remaining status of each finding.'}]);
  const [agreed,setAgreed]=useState(false);
  useEffect(()=>{ref.current?.showModal();},[]);
  const title={create:'Establish an audit engagement',evidence:'Record delivery evidence',delivery:'Submit this milestone',dispute:'Challenge the delivery',rules:'The settlement agreement',exhibit:state.exhibit?.title??'Evidence'}[state.kind];
  const today=(()=>{const future=new Date(Date.now()+14*86400000);return new Date(future.getTime()-future.getTimezoneOffset()*60000).toISOString().slice(0,16);})();
  function updateStage(index:number,key:'title'|'amount'|'criteria',value:string){setStages(previous=>previous.map((stage,position)=>position===index?{...stage,[key]:value}:stage));}
  async function handle(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setProblem('');
    if(!account){await connect();return;}
    try {
      const data=new FormData(event.currentTarget);const value=(key:string)=>String(data.get(key)??'').trim();
      if(state.kind==='create') {
        const scope=stages.map(stage=>({title:stage.title.trim(),amount:amount(stage.amount).toString(),criteria:stage.criteria.split('\n').map(line=>line.trim()).filter(Boolean)}));
        if(scope.some(stage=>stage.criteria.length<1||stage.criteria.length>8||stage.criteria.some(criterion=>criterion.length<20||criterion.length>800)))throw new Error('Each milestone needs 1–8 criteria, each 20–800 characters.');
        if(!/^[0-9a-fA-F]{40}$/.test(value('commit')))throw new Error('Use a full 40-character commit SHA, not a branch or tag.');
        if(!agreed)throw new Error('Accept the frozen settlement rules before funding.');
        const total=scope.reduce((sum,stage)=>sum+BigInt(stage.amount),0n);
        await onSubmit('create_audit',[`AL-${Date.now().toString(36).toUpperCase()}`,value('title'),value('repository'),value('commit'),addressArg(value('auditor')),JSON.stringify(scope),BigInt(Math.floor(new Date(value('deadline')).getTime()/1000))],'Fund audit engagement',total);
      }else if(audit&&state.milestone){
        const args:CalldataEncodable[]=[audit.id,state.milestone.id];
        if(state.kind==='evidence')await onSubmit('add_evidence',[...args,value('title'),value('statement'),value('source')],'Record evidence');
        if(state.kind==='delivery')await onSubmit('submit_delivery',[...args,value('statement')],'Submit milestone delivery');
        if(state.kind==='dispute')await onSubmit('dispute_delivery',[...args,value('statement')],'Challenge milestone delivery');
      }
    }catch(error){setProblem(explain(error));}
  }
  return <dialog ref={ref} className={`modal ${state.kind==='create'?'wide':''}`} onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close();}}><div className="modal-heading"><div><div className="eyebrow">AUDITLOCK / {state.kind==='create'?'NEW ENGAGEMENT':state.milestone?.id??'PROTOCOL'}</div><h2>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20}/></button></div>
    {state.kind==='rules'?<div className="rules-content"><p>These rules are fixed when an owner funds an engagement and accepted when the invited auditor joins.</p><ol><li><strong>Frozen scope.</strong> The repository, full commit SHA, acceptance criteria, amounts, participants, and delivery deadline cannot be edited after funding.</li><li><strong>Sequential milestones.</strong> A later milestone can be delivered after its predecessor is paid. Evidence may be prepared earlier.</li><li><strong>48-hour review.</strong> The owner can accept immediately or challenge within 48 hours of delivery. Unchallenged delivery becomes payable after that period.</li><li><strong>24-hour response.</strong> A challenge opens a response window. Both parties can sign readiness to proceed early. New evidence resets readiness.</li><li><strong>Criterion-based consensus.</strong> All checks MET releases the milestone; any NOT_MET refunds it; otherwise UNCLEAR splits it 50/50. Refund or split ends the engagement and refunds undelivered milestones.</li><li><strong>Seven-day fallback.</strong> An unresolved challenge can be recovered after seven days using the same 50/50 split. That fallback is not a consensus judgment.</li><li><strong>Undelivered work.</strong> Unsubmitted milestones refund to the owner after the deadline. Timely submitted work retains its review rights.</li><li><strong>Withdrawal.</strong> Payments and refunds become individual withdrawal credits. Test GEN is the supported currency; USDC is not integrated.</li></ol><p>No application-level appeal is included in v0.1. Protocol transaction finality and appeals are separate. A recorded delivery assessment is not a security certification.</p></div>:state.kind==='exhibit'&&state.exhibit?<div className="exhibit-content"><div className="exhibit-metadata"><span>{state.milestone?.id} / {state.exhibit.id}</span><span>{state.exhibit.role} · {short(state.exhibit.author)}</span><span>{when(state.exhibit.at)}</span></div><h3>Signed statement</h3><pre>{state.exhibit.statement}</pre>{state.exhibit.snapshot&&<><h3>Recorded source snapshot</h3><pre>{state.exhibit.snapshot}</pre></>}{state.exhibit.source_url&&<a className="text-button" href={state.exhibit.source_url} target="_blank" rel="noreferrer">Source URL<ExternalLink size={13}/></a>}{state.exhibit.content_hash&&<div className="hash-block">Content SHA-256<code>{state.exhibit.content_hash}</code><CopyButton value={state.exhibit.content_hash}/></div>}<button className="button" onClick={()=>{const blob=new Blob([JSON.stringify(state.exhibit,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${audit?.id}-${state.milestone?.id}-${state.exhibit?.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}><ArrowDownToLine size={14}/>Export exhibit JSON</button></div>:<form onSubmit={handle}>
      {state.kind==='create'?<><div className="form-intro"><LockKeyhole size={17}/><span>Create the agreement before work starts. All terms become immutable when funded.</span></div><div className="form-grid"><label className="span-two">Engagement name<input name="title" required minLength={5} maxLength={120} placeholder="e.g. Cinder staking · security audit"/></label><label className="span-two">Public GitHub repository<input name="repository" type="url" pattern="https://github.com/.+/.+" required placeholder="https://github.com/organisation/protocol"/></label><label className="span-two">Full commit SHA<input className="mono" name="commit" required pattern="[0-9a-fA-F]{40}" placeholder="40-character code revision"/></label><label className="span-two">Auditor wallet<input className="mono" name="auditor" required pattern="0x[0-9a-fA-F]{40}" placeholder="0x…"/><small>A separate wallet must accept the engagement.</small></label><label className="span-two">Delivery deadline · your local time<input name="deadline" type="datetime-local" required defaultValue={today}/></label></div><div className="form-section-title"><h3>Funded milestones</h3><span>1–3 · paid in order</span></div>{stages.map((stage,index)=><div className="stage-editor" key={index}><div className="stage-top"><strong>Milestone {index+1}</strong>{stages.length>1&&<button type="button" className="text-button" onClick={()=>setStages(previous=>previous.filter((_,position)=>position!==index))}>Remove</button>}</div><div className="form-grid"><label>Title<input required minLength={3} maxLength={80} value={stage.title} onChange={event=>updateStage(index,'title',event.target.value)}/></label><label>Amount · test GEN<input required inputMode="decimal" value={stage.amount} onChange={event=>updateStage(index,'amount',event.target.value)}/></label><label className="span-two">Acceptance criteria · one per line<textarea rows={4} required value={stage.criteria} onChange={event=>updateStage(index,'criteria',event.target.value)}/></label></div></div>)}{stages.length<3&&<button type="button" className="button small" onClick={()=>setStages(previous=>[...previous,{title:'Additional review',amount:'0.001',criteria:''}])}><Plus size={14}/>Add milestone</button>}<label className="consent"><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)} required/><span>I accept the 48-hour review and 24-hour response windows. All MET pays the milestone; any NOT_MET refunds it; UNCLEAR or seven-day unresolved challenges split it 50/50. Refund or split ends the engagement and refunds later undelivered milestones. Test GEN only.</span></label></>:<><div className="form-intro"><FileCheck2 size={17}/><span>{state.milestone?.title} · {money(state.milestone?.amount??'0')} GEN</span></div>{state.kind==='evidence'&&<label>Exhibit title<input name="title" required minLength={3} maxLength={100} placeholder="e.g. Final audit report and coverage matrix"/></label>}<label>{state.kind==='evidence'?'Evidence statement / report text':state.kind==='dispute'?'Which acceptance condition was not met?':'Delivery statement'}<textarea name="statement" required minLength={30} maxLength={state.kind==='evidence'?6000:state.kind==='dispute'?4000:2000} rows={9} placeholder={state.kind==='dispute'?'Name the criterion and explain the specific missing deliverable. Add supporting exhibits separately.':'Describe the submitted work against the frozen code revision and acceptance criteria.'}/></label>{state.kind==='evidence'&&<><label>Public text source · optional<input name="source" type="url" pattern="https://raw.githubusercontent.com/.+" placeholder="https://raw.githubusercontent.com/…"/><small>Records up to 16,000 characters as a consensus snapshot. Prefer a commit-pinned raw URL.</small></label><p className="field-note">Evidence is public on-chain. Submit only material you intend to publish. A signed statement is an attributed claim; an attached snapshot preserves source content.</p></>}{state.kind==='delivery'&&<p className="field-note">Record auditor evidence first. Submission starts the owner’s 48-hour review period.</p>}</>}
      {problem&&<p role="alert" className="form-error">{problem}</p>}
      <div className="modal-actions"><button className="button" type="button" onClick={close}>Cancel</button><button className="button dark" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<Wallet size={15}/>} {!account?'Connect wallet':state.kind==='create'?'Fund & freeze scope':state.kind==='evidence'?'Sign & record evidence':state.kind==='delivery'?'Sign & submit delivery':'Sign & open challenge'}</button></div>
    </form>}
  </dialog>;
}
