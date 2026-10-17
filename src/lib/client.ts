import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { CalldataAddress, TransactionHashVariant, TransactionStatus, type CalldataEncodable, type GenLayerTransaction, type TransactionHash } from 'genlayer-js/types';
import { formatUnits, isAddress, parseUnits } from 'viem';
import deployment from './deployment.json';
import type { Address } from './types';
export { deployment };
export const configured = isAddress(deployment.address) && !/^0x0{40}$/i.test(deployment.address);
export const short = (value:string) => value ? `${value.slice(0,6)}…${value.slice(-4)}` : '—';
export const units = (value:string|bigint) => formatUnits(BigInt(value || '0'),18);
export const money = (value:string|bigint) => {const [whole,fraction='']=units(value).split('.'); const trimmed=fraction.slice(0,5).replace(/0+$/,'');if(BigInt(value)>0n&&whole==='0'&&!trimmed)return '<0.00001';return `${whole}${trimmed?'.'+trimmed:''}`;};
export function amount(value:string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value.trim())) throw new Error('Enter a GEN amount with up to 18 decimal places.');
  const parsed=parseUnits(value.trim(),18);
  if(parsed<=0n) throw new Error('The amount must be positive.');
  return parsed;
}
export function addressArg(value:string) {
  if(!isAddress(value)||/^0x0{40}$/i.test(value)) throw new Error('Enter a valid nonzero wallet address.');
  return new CalldataAddress(Uint8Array.from(value.slice(2).match(/.{2}/g)!.map(byte=>parseInt(byte,16))));
}
export const publicClient = () => createClient({chain:studionet,endpoint:deployment.rpc});
let readCooldownUntil=0;
export async function read<T>(functionName:string,args:CalldataEncodable[]=[]):Promise<T> {
  if(!configured) throw new Error('Contract deployment is not configured.');
  if(Date.now()<readCooldownUntil)throw new Error('StudioNet request limit reached. Automatic reads are paused for five minutes; existing records remain visible.');
  try{
    const result=await publicClient().readContract({address:deployment.address as Address,functionName,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
    return (typeof result==='string'&&/^[\[{]/.test(result)?JSON.parse(result):result) as T;
  }catch(error){if(/rate limit|429/i.test(explain(error)))readCooldownUntil=Date.now()+300000;throw error;}
}
export async function connectWallet():Promise<Address> {
  if(!window.ethereum) throw new Error('Open this app in a browser with a compatible wallet to connect.');
  const accounts=await window.ethereum.request({method:'eth_requestAccounts'}) as Address[];
  if(!accounts[0]||!isAddress(accounts[0])) throw new Error('The wallet did not return an account.');
  return accounts[0];
}
export async function submit(account:Address,functionName:string,args:CalldataEncodable[],value=0n):Promise<TransactionHash> {
  if(!configured||!window.ethereum) throw new Error('A configured contract and connected browser wallet are required.');
  const current=await window.ethereum.request({method:'eth_accounts'}) as string[];
  if(current[0]?.toLowerCase()!==account.toLowerCase()) throw new Error('The wallet account changed. Reconnect before submitting.');
  const writer=createClient({chain:studionet,endpoint:deployment.rpc,account,provider:window.ethereum});
  await writer.connect('studionet');
  return await writer.writeContract({address:deployment.address as Address,functionName,args,value,consensusMaxRotations:3}) as TransactionHash;
}
export function assertSuccessful(receipt:GenLayerTransaction) {
  const raw=receipt as unknown as Record<string,unknown>;
  const consensus=raw.consensus_data as {leader_receipt?:{mode:string;execution_result:string;node_config?:{address:string};address?:string}[]} | undefined;
  const receipts=consensus?.leader_receipt??[];
  const transfer=raw.value_credited===true&&!!raw.triggered_by&&receipts.length===0&&BigInt(String(raw.value??0))>0n&&(raw.statusName==='FINALIZED'||raw.status===7);
  if(transfer)return;
  const leader=receipts.filter(item=>item.mode==='leader'&&(!raw.last_leader||String(item.node_config?.address??item.address??'').toLowerCase()===String(raw.last_leader).toLowerCase())).at(-1);
  if(!(leader?.execution_result==='SUCCESS'||raw.txExecutionResultName==='FINISHED_WITH_RETURN')||(raw.result_name&&raw.result_name!=='MAJORITY_AGREE')) throw new Error('Finalized transaction did not execute successfully. Inspect the receipt before retrying.');
}
export async function wait(hash:TransactionHash) {
  const client=publicClient();
  await client.waitForTransactionReceipt({hash,status:TransactionStatus.FINALIZED,interval:15000,retries:90});
  assertSuccessful(await client.getTransaction({hash}));
  for(const child of await client.getTriggeredTransactionIds({hash})) {
    await client.waitForTransactionReceipt({hash:child,status:TransactionStatus.FINALIZED,interval:15000,retries:90});
    assertSuccessful(await client.getTransaction({hash:child}));
  }
}
export function explain(error:unknown) {return (error instanceof Error?error.message:String(error)).slice(0,600);}
declare global {
  interface Window {ethereum?:{request:(args:{method:string;params?:unknown[]})=>Promise<unknown>;on?:(event:string,handler:(...args:unknown[])=>void)=>void;removeListener?:(event:string,handler:(...args:unknown[])=>void)=>void}}
}
