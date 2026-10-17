# Review AUDITLOCK

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
