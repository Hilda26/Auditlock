# Review AUDITLOCK

## Resubmission update: pinned-source provenance

The remaining evidence-provenance issue is fixed in implementation commit `db906091c3575d2b14c5d43e984a9c3eb0a4259a` (`Bind evidence snapshots to frozen revisions`).

### 1. Source snapshots are bound to the frozen revision

`add_evidence()` now validates every non-empty source URL before retrieval. The URL must:

- use the exact `https://raw.githubusercontent.com/` origin;
- contain an owner, repository, full 40-character hexadecimal revision, and file path;
- identify the same GitHub owner and repository as the immutable engagement record; and
- identify the exact commit SHA stored in that engagement.

Repository and commit comparisons are case-normalized. Branches, tags, abbreviated SHAs, URLs for another repository, and URLs for another commit are ineligible for pinned-source evidence and revert before any web fetch. New engagement repository URLs are also restricted to GitHub repository roots, avoiding ambiguous repository coordinates.

Accepted snapshots are stored with `evidence_type: "PINNED_SOURCE"`, along with the source URL, preserved excerpt, snapshot hash, and overall evidence-record hash. The relevant implementation is in [`contracts/AuditLock.py`](contracts/AuditLock.py).

### 2. External context is kept distinct

AuditLock does not accept an external URL or another repository as pinned-source evidence. A statement-only exhibit is stored as `evidence_type: "ATTESTATION"`. It may describe external context, but it remains an attributed participant claim rather than code retrieved from the frozen revision.

The GenLayer assessment prompt explicitly distinguishes these categories: only `PINNED_SOURCE` is contract-validated as coming from the frozen repository and commit, while `ATTESTATION` must never be treated as frozen-revision source. The evidence library, exhibit dialog, submission form, TypeScript model, example record, and README use the same labels.

### 3. Regression coverage and verification

[`tests/direct/test_auditlock.py`](tests/direct/test_auditlock.py) now demonstrates that:

- a raw URL for `example/staking` at the engagement's exact frozen commit is accepted, fetched, and labeled `PINNED_SOURCE`;
- a URL for `example/other-repository` at that commit is rejected;
- a URL for the correct repository at a different full commit is rejected;
- rejected submissions do not append evidence; and
- statement-only evidence is labeled `ATTESTATION` and has no source URL or snapshot.

Verification rerun on October 22, 2026:

```text
python -m pytest tests/direct -q
18 passed in 3.84s

npm run typecheck
tsc --noEmit
PASS

npx next build --webpack
Compiled successfully; TypeScript passed; 3/3 static pages generated
PASS
```

### 4. Updated live deployment

The fixed contract is deployed and verified on StudioNet:

- Contract: [`0xb3ded1f676915Bc206f1A677375Be33db9E90027`](https://explorer-studio.genlayer.com/address/0xb3ded1f676915Bc206f1A677375Be33db9E90027)
- Deployment transaction: [`0x6c0985f367ff794cb780a39890bd97368fac42b136ac56be9001409a07f42417`](https://explorer-studio.genlayer.com/tx/0x6c0985f367ff794cb780a39890bd97368fac42b136ac56be9001409a07f42417)
- Deployed source SHA-256: `dee1b0cdddddf94c0230a92bcad46b6ea36f3f4a45232f6a692edb37d8e7de29`
- Live verification run: `MVJ489GC`
- Live verification: **PASSED**, including 17 finalized parent transactions, three finalized withdrawal transfers, the pinned source snapshot, consensus settlement, and final `locked = 0`, `claimable = 0`
- Hosted verification: **PASSED** at [auditlock.vercel.app](https://auditlock.vercel.app), with HTTP 200 and matching published source, contract address, source digest, and live proof

The deployment-proof precheck now passes because the checked-in source digest matches this verified deployment. Evidence is available in [`artifacts/deployment.json`](artifacts/deployment.json), [`artifacts/live-verification.json`](artifacts/live-verification.json), and [`artifacts/hosted-verification.json`](artifacts/hosted-verification.json).

## Live deployment walkthrough

Open [auditlock.vercel.app](https://auditlock.vercel.app). A wallet is not needed to inspect the records.

[Watch the 7:52 recording of app testing and a new live run](https://auditlock.vercel.app/walkthrough.html). [Transcript](WALKTHROUGH.md). The recording-run receipts are separate from the original verification below.

## What to inspect

1. Select **Live registry**. The named live-verification engagements are actual on-chain integration records using StudioNet test GEN.
2. Open **Live verification · ERC20 audit escrow**. Inspect its repository, exact commit SHA, frozen acceptance criteria, amounts, participant addresses, and scope digest.
3. The first report milestone demonstrates owner acceptance and an auditor credit of **0.007 GEN**. The source exhibit includes a stored snapshot of a public Solidity file and its SHA-256 digest.
4. The remediation milestone contains an explicitly incomplete synthetic report and the protocol's criterion-specific challenge. Both participants signed readiness, and a third test wallet requested real GenLayer assessment.
5. Inspect the recorded criterion result: GenLayer returned **NOT_MET**, producing a **0.003 GEN owner refund** for the remediation milestone. The actual explanation and receipts are retained in `artifacts/live-verification.json` without substituting a mock outcome.
6. Open **Evidence** to inspect signed statements and the source snapshot. Open an exhibit and export its JSON to see its content digest and attribution.
7. Open **Activity** to inspect the lifecycle. Compare the public transaction receipts in [live verification](https://auditlock.vercel.app/verification/live-verification.json) and [deployment](https://auditlock.vercel.app/verification/deployment.json).
8. Inspect the separate cancellation record, which demonstrates a **0.001 GEN** refund before the auditor accepts. The live tests verified actual wallet increases for each withdrawal: **0.007 GEN** to the auditor, **0.003 GEN** to the owner from the disputed milestone, and **0.001 GEN** to the owner from cancellation. The run ended with **0 GEN locked** and **0 GEN claimable**.

The report fixtures are synthetic workflow tests, not professional audits of OpenZeppelin. The referenced code revision is public and fixed. GenLayer's actual consensus and the GEN transfers are real StudioNet operations.

## Create an engagement

1. Connect a compatible browser wallet with StudioNet test GEN.
2. Choose **New audit** and enter a public GitHub repository, full 40-character commit SHA, separate auditor wallet, and delivery deadline.
3. Define up to three sequential milestones with amounts in test GEN and precise acceptance criteria. Read the settlement rules and confirm funding with your wallet.
4. The invited auditor connects its own wallet and accepts the scope and rules.
5. The auditor records evidence against the milestone and submits delivery. The owner can accept or challenge during the 48-hour review period.
6. For a challenge, record responses and either wait 24 hours or have both participants explicitly sign readiness. Request assessment, wait for successful finality, and inspect the criterion results.
7. Credited parties withdraw with their own wallet signatures. A payment is not reported complete merely because the parent transaction finalized: the app checks the child transfer too.

The **Example workspace** is illustrative, read-only, and independent of live records. The test scripts exercise live SDK writes; browser-wallet signing still depends on a compatible installed wallet.

## Recovery and limits

- Unaccepted engagements can be cancelled by either participant; anyone can expire them after the deadline.
- Undelivered milestones refund after the agreed deadline. Submitted milestones retain their review window.
- Unresolved challenges have a seven-day recovery using the pre-agreed 50/50 fallback, without inventing a consensus ruling.
- A refund or split on a contested milestone ends the engagement and returns undelivered allocations.
- No USDC adapter, mainnet support, application appeal, audit-code execution, or security certification is claimed.
