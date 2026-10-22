export type Address = `0x${string}`;
export type Exhibit = {id:string; title:string; statement:string; author:string; role:string; evidence_type:'PINNED_SOURCE'|'ATTESTATION'; source_url:string; snapshot:string; snapshot_hash:string; content_hash:string; at:number};
export type Criterion = {id:string; text:string};
export type Check = {criterion:string; status:'MET'|'NOT_MET'|'UNCLEAR'; evidence:string[]};
export type Milestone = {
  id:string; title:string; amount:string; criteria:Criterion[]; state:string; evidence:Exhibit[]; delivery:string; submitted_at:number; review_until:number;
  dispute:null|{grounds:string; opened_at:number; respond_until:number; resolve_until:number; ready:string[]};
  ruling:null|{checks:Check[]; reason:string; outcome:string; at:number; basis:string};
  settlement:null|{auditor:string; owner:string; reason:string; at:number};
};
export type Audit = {id:string; title:string; repository:string; commit:string; scope_hash:string; owner:string; auditor:string; created_at:number; deadline:number; escrow:string; state:string; milestones:Milestone[]; history:{at:number;actor:string;event:string}[]};
export type AuditSummary = Omit<Audit,'milestones'|'history'|'scope_hash'> & {milestones:number;completed:number};
export type Board = {version:string;audits:string;deposited:string;locked:string;claimable:string;withdrawn:string;currency:string};
