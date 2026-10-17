import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

const base='https://auditlock.vercel.app';
const reportPath='artifacts/walkthrough-video.json';
const report=JSON.parse(readFileSync(reportPath,'utf8'));
const localProof=JSON.parse(readFileSync('artifacts/walkthrough-live-verification.json','utf8'));
const [video,captions,chapters,proof,attempt,player]=await Promise.all([
  fetch(`${base}/walkthrough/auditlock-live-walkthrough.mp4`),fetch(`${base}/walkthrough/captions.vtt`),
  fetch(`${base}/walkthrough/chapters.json`),fetch(`${base}/verification/walkthrough-live-verification.json`),
  fetch(`${base}/verification/walkthrough-attempt-rate-limited.json`),fetch(`${base}/walkthrough.html`)
]);
for(const response of [video,captions,chapters,proof,attempt,player])assert.equal(response.status,200);
assert.match(video.headers.get('content-type'),/video\/mp4/);
const actualHash=createHash('sha256').update(new Uint8Array(await video.arrayBuffer())).digest('hex');
assert.equal(actualHash,report.sha256,'Hosted video differs from the validated local file');
assert.ok((await captions.text()).startsWith('WEBVTT'));
assert.equal((await chapters.json()).length,report.chapters.length);
const actualProof=await proof.json();
assert.equal(actualProof.runId,localProof.runId);
assert.equal(actualProof.status,'PASSED');
assert.equal(actualProof.transactions.length,17);
assert.equal(actualProof.withdrawals.length,3);
const interrupted=await attempt.json();
assert.equal(interrupted.status,'FAILED');
assert.notEqual(interrupted.runId,actualProof.runId);
assert.match(await player.text(),/The recording includes a real failure/);
Object.assign(report,{status:'PASSED',watchUrl:`${base}/walkthrough.html`,downloadUrl:`${base}/walkthrough/auditlock-live-walkthrough.mp4`,hostedFileMatchesValidatedLocalFile:true,httpStatus:200,contentType:'video/mp4',hostedCheckedAt:new Date().toISOString()});
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,durationSeconds:report.durationSeconds,sha256:actualHash,hostedFileMatches:true,chapters:report.chapters.length,liveRun:actualProof.runId,publicTransactions:actualProof.transactions.length,withdrawals:actualProof.withdrawals.length},null,2));
