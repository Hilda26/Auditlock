export function assertSuccessfulReceipt(receipt){
  const receipts=receipt.consensus_data?.leader_receipt??[];
  const transfer=receipt.value_credited===true&&!!receipt.triggered_by&&receipts.length===0&&BigInt(receipt.value??0)>0n&&(receipt.statusName==='FINALIZED'||receipt.status===7);
  if(transfer)return;
  const proposals=receipts.filter(record=>record.mode==='leader'&&(!receipt.last_leader||String(record.node_config?.address??record.address??'').toLowerCase()===receipt.last_leader.toLowerCase()));
  const leader=proposals.at(-1);
  const succeeded=leader?.execution_result==='SUCCESS'||receipt.txExecutionResultName==='FINISHED_WITH_RETURN';
  if(!succeeded||(receipt.result_name&&receipt.result_name!=='MAJORITY_AGREE'))throw new Error('The transaction finalized without successful execution. Inspect its receipt before retrying.');
}
