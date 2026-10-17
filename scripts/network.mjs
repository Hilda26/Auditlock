import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { CalldataAddress, TransactionStatus, TransactionHashVariant } from 'genlayer-js/types';
import {assertSuccessfulReceipt} from '../src/lib/receipt.mjs';
export const endpoint = 'https://studio.genlayer.com/api';
export const clientFor = account => createClient({ chain: studionet, endpoint, account });
export const addressArg = address => new CalldataAddress(Uint8Array.from(Buffer.from(address.slice(2), 'hex')));
export function compactReceipt(receipt){
  if(!receipt||typeof receipt!=='object')return receipt;
  return {hash:receipt.hash,status:receipt.status,statusName:receipt.statusName,result:receipt.result,result_name:receipt.result_name,from_address:receipt.from_address,to_address:receipt.to_address,value:receipt.value,value_credited:receipt.value_credited,triggered_by:receipt.triggered_by,last_leader:receipt.last_leader,triggered_transactions:receipt.triggered_transactions,consensus_data:{votes:receipt.consensus_data?.votes,leader_receipt:receipt.consensus_data?.leader_receipt?.map(record=>({mode:record.mode,execution_result:record.execution_result,address:record.node_config?.address??record.address,result_status:record.result?.status??record.result_status,stderr:record.genvm_result?.stderr??record.stderr}))}};
}
export const json = value => JSON.stringify(value, (key,item) => key==='receipt'?compactReceipt(item):typeof item==='bigint'?item.toString():item, 2);
export const successful=assertSuccessfulReceipt;
export async function retryRead(operation) {
  for(let attempt=0;;attempt++){try{return await operation();}catch(error){if(attempt>=4)throw error;await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}
}
export async function finalized(client, hash) {
  const receipt = await retryRead(()=>client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, fullTransaction: true, interval: 5000, retries: 180 }));
  successful(receipt);
  return receipt;
}
export async function read(client, address, functionName, args = []) {
  const result = await retryRead(()=>client.readContract({ address, functionName, args, transactionHashVariant: TransactionHashVariant.LATEST_FINAL }));
  return typeof result === 'string' && /^[\[{]/.test(result) ? JSON.parse(result) : result;
}
