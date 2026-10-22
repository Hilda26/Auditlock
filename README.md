# AUDITLOCK

Evidence-based escrow for smart-contract security audit delivery, built on GenLayer.

[Open the live app](https://auditlock.vercel.app) · [Reviewer walkthrough](REVIEW.md) · [GitHub](https://github.com/Hilda26/Auditlock)

[Watch the recorded app and fresh live-test walkthrough](https://auditlock.vercel.app/walkthrough.html) · [Download MP4](https://auditlock.vercel.app/walkthrough/auditlock-live-walkthrough.mp4)

An owner funds an immutable audit agreement: public repository, full commit SHA, invited auditor, delivery deadline, and one to three paid milestones. The auditor accepts, records evidence, and submits each milestone. The owner can approve delivery or challenge a specific unmet acceptance condition. GenLayer independently evaluates the recorded agreement and evidence; deterministic contract logic applies the payment or refund.

**The question is whether the audit deliverables meet the agreement, not whether the protocol is secure.** Reports with zero vulnerabilities can satisfy an engagement. Finding count and claimed severity do not determine compensation.

## Currency and network

Version 0.1 uses **StudioNet test GEN**, not USDC. No mainnet or stablecoin settlement adapter is implemented. All public integration fixtures are labeled as tests; they are not professional audits of the referenced repositories.

Contract: `0x146e482A3172877b3EB5Cb03a04981135d3BE9C8`.

- [Contract explorer](https://explorer-studio.genlayer.com/address/0x146e482A3172877b3EB5Cb03a04981135d3BE9C8)
- [Deployment evidence](artifacts/deployment.json)
- [Live verification evidence](artifacts/live-verification.json)
- [Contract source](contracts/AuditLock.py)

## Run locally

Requires Node.js 22+ and Python 3.12 for contract tests.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3015`. Public reads do not require a wallet. Signed writes require a compatible injected browser wallet and StudioNet test GEN. The network and contract are configured in `src/lib/deployment.json`. No browser or server signing key is bundled.

The example workspace is explicitly illustrative and read-only. Live registry records are read from finalized contract state. Pending wallet transactions are saved locally by hash so a reload can resume checking finality without submitting again.

Automatic public reads run at two-minute intervals only while the document is visible. A request-limit response pauses automatic reads for five minutes. Transaction confirmation polling uses a fifteen-second interval. The SDK test runner backs off on explicit rate-limit rejections while retaining its signers in memory; it does not blindly resubmit unknown write failures.

## Settlement rules

Milestones are sequential: a later milestone can be submitted after the preceding one is paid. Each milestone has its own funded allocation. Accepted work cannot be unilaterally cancelled.

| Trigger | Auditor | Owner | Remaining undelivered milestones |
| --- | --- | --- | --- |
| Owner accepts | 100% of milestone | 0% | Remain funded |
| Delivery unchallenged for 48 hours | 100% | 0% | Remain funded |
| Consensus: every criterion MET | 100% | 0% | Remain funded |
| Consensus: at least one criterion NOT_MET | 0% | 100% | Refunded to owner |
| Consensus: no NOT_MET, at least one UNCLEAR | 50%, rounded down | Remainder | Refunded to owner |
| Challenge unresolved for seven days | 50%, rounded down | Remainder | Refunded to owner |
| Undelivered after agreed deadline | 0% | 100% of undelivered allocation | Refunded; submitted work retains review rights |
| Cancel before auditor accepts | 0% | 100% | Entire engagement refunded |

A challenge opens a 24-hour evidence response period. Both participants may sign readiness to proceed earlier. New evidence resets readiness. Assessment freezes implicitly when evidence closes or the assessment transaction executes. Readiness does not prevent another timely exhibit; that exhibit requires renewed readiness.

Version 0.1 has no application-level appeal. GenLayer protocol appeals and transaction finality are separate. The UI waits for successful finalized execution and checks child transfer transactions before reporting a withdrawal successful.

Settlement creates pull-payment credits. Each credited wallet withdraws its own balance through a native GEN external EVM transfer. There is no platform fee. Network fees are separate.

Accounting invariant: `deposited = locked + claimable + withdrawn`.

## Evidence and consensus

Participants record public signed statements and may optionally attach source code from the audited repository. A source URL must use `raw.githubusercontent.com` and identify the same GitHub owner, repository, and exact 40-character commit SHA frozen in the engagement. Mismatched repositories and revisions are rejected before retrieval. Accepted sources are retrieved at submission through strict equivalence, truncated to the first 16,000 characters, stored, hashed, and labeled `PINNED_SOURCE`.

Statement-only exhibits are labeled `ATTESTATION`. They may describe external context, but the evaluator treats them as attributed participant claims rather than code from the frozen revision. AuditLock does not accept external URLs as pinned-source evidence. A failed pinned-source retrieval reverts the submission. The hash covers the stored content, not an entire larger remote file.

Recorded content hashes establish the fixed submission, not the truth, authorship, or completeness of an audit report. The app does not execute proof-of-concept code or certify findings. Confidential audit material should not be placed in this public on-chain workflow.

Each validator independently repeats the criterion assessment. Consensus compares every criterion ID and its finite status (`MET`, `NOT_MET`, `UNCLEAR`), after validating all output fields and evidence citations. Explanations and choice among valid evidence citations may vary. The model cannot choose arbitrary payment amounts. Missing or conflicting evidence should produce UNCLEAR rather than an invented conclusive result. Malformed results fail without moving escrow; the challenge stays retryable until its recovery deadline.

## Verify

```sh
python -m pip install -r requirements-dev.txt
npm run test:contracts
genvm-lint check contracts/AuditLock.py --json
npm run typecheck
npm run build
```

The direct contract tests use the real pinned Python SDK with controlled model responses. They cover funding authorization, scope immutability, sequential milestones, review periods, readiness, output validation, independent validator disagreement, rounding, conservation, cancellation, and recovery. They are not proof of token transfers.

```sh
npm run deploy:contract
npm run test:live
```

Deployment uses `AUDITLOCK_DEPLOYER_PRIVATE_KEY` when provided through the process environment. Otherwise it creates a fresh in-memory StudioNet wallet and requests test GEN. It writes the pending deployment transaction before polling so a repeated command resumes the same deployment. Keys are never written to files.

Live verification creates separate fresh test wallets, funds a real escrow, records a public source snapshot, approves one milestone, disputes an explicitly incomplete remediation report, obtains real GenLayer consensus, checks exact refund allocation, verifies actual recipient balance changes through finalized child transfers, and exercises cancellation. The resulting JSON contains public addresses, receipts, and checks. A failed run is recorded as FAILED; it is not replaced with fabricated success. A repeated live-test command creates a new run with fresh wallets; it does not resume an interrupted run whose ephemeral keys have been lost.

## Recorded walkthrough

`WALKTHROUGH.md` contains the narration transcript. `artifacts/walkthrough-live-verification.json` contains the new run created during recording. The first rate-limited attempt is separately retained in `artifacts/walkthrough-attempt-rate-limited.json`; its accepted test escrow remains governed by its original deadline. The completed follow-up run is independently identified and verified. The canonical earlier `live-verification.json` is preserved.

The video assembles actual timed browser captures, with confirmation waits omitted between clips and offline synthetic narration. It shows real app navigation and form entry alongside individually confirmed SDK writes from a local operator console. Customer browser-wallet signatures are not recorded. No signing keys are displayed or persisted.

To reproduce the interactive console locally, run `node scripts/walkthrough/serve.mjs` and open `http://127.0.0.1:3016`. It binds only to loopback, accepts only same-origin POST requests, and executes the fixed test script. The console is an operator tool, not a production app feature. Successful recordings can be assembled with `scripts/walkthrough/narrate.ps1` and `scripts/walkthrough/build_video.py`; raw captured frames stay in ignored `artifacts/private/`.

Backoff regression checks: `node --test --test-isolation=none tests/network.test.mjs`.

## Architecture

- `contracts/AuditLock.py`: immutable agreements, custody, evidence, consensus, accounting, recovery, and withdrawals.
- `src/app/`: responsive audit workspace, forms, evidence inspection/export, activity, and settlement rules.
- `src/lib/client.ts`: public reads, browser-wallet writes, successful execution and finality checks.
- `scripts/`: contract deployment, live integration verification, and export of public proof artifacts.
- Next.js static export, with no application database or privileged settlement server.
- Vercel hosts the static app. GenLayer holds the agreement state and test GEN.

## Protocol references

- [GenLayer equivalence principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [Native GEN support](https://docs.genlayer.com/FAQ)

This is a testnet prototype for audit-delivery agreements. It has not received an independent security audit.
