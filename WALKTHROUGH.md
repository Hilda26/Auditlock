# AUDITLOCK recorded walkthrough

Actual app navigation, form entry, and a new live SDK integration run. Confirmation waits are omitted between recorded clips. Narration uses an offline synthetic voice. Signed writes use fresh in-memory test wallets; customer browser-wallet signing is not shown. Reports are synthetic fixtures, while the transactions, consensus, and transfers are real StudioNet operations. The first rate-limited attempt is retained and disclosed.

## 00:00:00 — The real app and test operator

This is Auditlock, the escrow workspace for security audit delivery. On the left is my local test operator. On the right is the actual deployed app. I am accepting a funded test agreement with a fresh auditor wallet.

## 00:00:13 — Define an audit engagement

The app's new audit form fixes the agreement before work starts. This form demonstration is separate from the signed SDK test transactions.

## 00:00:23 — Freeze code and acceptance terms

I enter a repository, its full commit hash, and the invited auditor wallet. Each milestone has its own funded amount and acceptance criteria. The browser form is real, but I am not signing a customer wallet here.

## 00:00:43 — A real network failure

The first attempt hits StudioNet's hourly request limit before report submission. Two transactions finalized. This failure is retained in the public evidence; it is not presented as a completed test.

## 00:00:56 — Retry with quota protection

I reduced unnecessary app polling and added request-limit backoff. Now I start a new run. The script creates fresh test wallets and retains them in memory while waiting for the service quota to recover. Confirmation waits are omitted between recorded clips.

## 00:01:18 — Fund a new live escrow

I confirm the owner transaction. It deposits point zero one test GEN into the real GenLayer contract, allocated across the report and remediation milestones.

## 00:01:33 — The auditor accepts

The separate auditor signs acceptance of the frozen scope and settlement rules. The contract, not this console, records that acceptance.

## 00:01:47 — Inspect the new frozen agreement

I select the new run in the actual live registry. Its contract record fixes the repository, full code revision, two milestone allocations, and acceptance criteria. The owner and auditor are distinct test wallets.

## 00:02:07 — Record report and source evidence

I record a synthetic audit report and a public source snapshot at the exact code revision. The report is a test fixture; its submission and content hash are real on-chain records.

## 00:02:22 — Submit milestone one

The auditor submits the first milestone for review. This starts the owner's forty-eight-hour challenge window.

## 00:02:37 — Inspect the actual report record

In the live app I inspect the new engagement, its frozen commit, acceptance criteria, and recorded report. Evidence is attributed to its submitting wallet. A snapshot preserves content; it does not certify code security.

## 00:02:57 — Accept the report milestone

The protocol owner accepts the report. Only its point zero zero seven GEN allocation becomes the auditor's withdrawal credit. The retest allocation stays locked.

## 00:03:13 — Inspect the stored source snapshot

The exhibit contains both the auditor's attributed statement and the source text retrieved at submission. Its content digest fixes that record for later review; it is not a claim that the code has been audited securely.

## 00:03:29 — Create the disputed test case

For the second milestone I deliberately submit a report admitting that neither required remediation check was performed. This provides a concrete unmet deliverable for the live consensus test.

## 00:03:44 — Submit the retest delivery

The auditor submits that incomplete retest document. The test concerns the agreed deliverable, not whether the referenced protocol is secure.

## 00:03:57 — Challenge a specific criterion

The owner challenges criterion C one, which requires an outcome for both findings. The challenge identifies exactly what the submitted report failed to provide.

## 00:04:11 — Record counter-evidence

The owner records a comparison between the frozen criterion and the auditor's own admission. Both sides' evidence remains available to GenLayer.

## 00:04:24 — Owner readiness

The owner signs readiness for assessment. One signature alone cannot shorten the response period.

## 00:04:35 — Auditor readiness

The auditor also signs readiness. Both parties have now explicitly agreed to proceed before the full response window ends.

## 00:04:45 — Request real GenLayer consensus

A third test wallet requests assessment. GenLayer validators independently evaluate the frozen agreement and recorded evidence. The console does not choose the ruling.

## 00:05:04 — Read the recorded ruling

The live app shows the actual accepted criterion result and explanation. Deterministic contract rules turn that result into the milestone's payment or refund. This is a delivery judgment, never a security certification.

## 00:05:32 — Withdraw the protocol refund

The owner withdraws its credit. The test checks the finalized child transfer and the owner's actual wallet balance change.

## 00:05:46 — Withdraw the auditor payment

The auditor separately withdraws its earned report payment. The test verifies the exact balance increase, not just a successful parent receipt.

## 00:06:00 — Review the rules and evidence

The app exposes the agreed review windows, criterion-based settlement, and timeout recovery. This walkthrough uses StudioNet test GEN and synthetic report fixtures. The transactions, consensus judgment, and transfers were executed on the real test network. Public receipts accompany the video.

## 00:06:23 — Create a cancellation test

I fund a separate point zero zero one GEN engagement to test cancellation before auditor acceptance.

## 00:06:37 — Cancel before acceptance

The owner cancels the unaccepted engagement. Its full deposit becomes a refund credit without affecting the completed audit.

## 00:06:49 — Withdraw the cancellation refund

The owner withdraws that cancellation refund. Again the test verifies both successful transfer finality and the actual wallet balance change.

## 00:07:03 — Inspect the real audit trail

The activity tab reconstructs this agreement's funding, acceptance, signed exhibits, submissions, challenge, and consensus settlement. These events come from the contract record for the new run, not a fabricated demonstration history.

## 00:07:24 — Verify the finished run

The completed run contains seventeen finalized parent transactions and three finalized withdrawal transfers. Every assertion passed, including exact payouts and contract-wide accounting conservation. The earlier interrupted fixture remains visible under its original deadline. No result has been replaced with a simulation.

Live run: `MVBU8AYB`. Audit: `AL-LIVE-MVBU8AYB`. Cancellation: `AL-CANCEL-MVBU8AYB`.
