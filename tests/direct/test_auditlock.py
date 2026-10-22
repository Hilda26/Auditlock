import json
from datetime import datetime, timezone
import pytest

DEADLINE = int(datetime(2026, 10, 22, 12, tzinfo=timezone.utc).timestamp())
CRITERIA = ["Cover the staking deposit and withdrawal functions at the frozen code revision.", "Provide reproduction steps for each finding, or explain the absence of findings."]
EVIDENCE = "The report covers Staking.sol deposit and withdrawal, documents the tested commit, and records zero vulnerabilities with a detailed coverage matrix."


@pytest.fixture
def ctx(direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie):
    direct_vm.warp("2026-10-17T12:00:00Z")
    return direct_deploy("contracts/AuditLock.py"), direct_vm, direct_alice, direct_bob, direct_charlie


def send(vm, account, method, *args, value=0):
    vm.sender = account
    vm.value = value
    try:
        return method(*args)
    finally:
        vm.value = 0


def scope():
    return json.dumps([{"title": "Audit report", "amount": "701", "criteria": CRITERIA}, {"title": "Remediation review", "amount": "300", "criteria": ["Review the agreed remediation changes and record the outcome of each prior finding."]}])


def create(ctx):
    contract, vm, owner, auditor, stranger = ctx
    send(vm, owner, contract.create_audit, "AL-001", "Staking contract audit", "https://github.com/example/staking", "a" * 40, auditor, scope(), DEADLINE, value=1001)
    return contract


def active(ctx):
    contract = create(ctx)
    send(ctx[1], ctx[3], contract.accept_audit, "AL-001")
    return contract


def delivered(ctx):
    contract = active(ctx)
    send(ctx[1], ctx[3], contract.add_evidence, "AL-001", "M1", "Frozen audit report", EVIDENCE, "")
    send(ctx[1], ctx[3], contract.submit_delivery, "AL-001", "M1", EVIDENCE)
    return contract


def disputed(ctx):
    contract = delivered(ctx)
    send(ctx[1], ctx[2], contract.dispute_delivery, "AL-001", "M1", "The submitted report omits required withdrawal coverage; examine criterion C1.")
    return contract


def ruling(ctx, statuses=("MET", "MET")):
    ctx[1].clear_mocks()
    ctx[1].mock_llm("AUDITLOCK's independent", json.dumps({"checks": [{"criterion": "C" + str(index + 1), "status": status, "evidence": ["E1"]} for index, status in enumerate(statuses)], "reason": "E1 provides recorded report coverage and supports the criterion assessment."}))


def assess(ctx, statuses=("MET", "MET")):
    ctx[1].warp("2026-10-19T12:00:00Z")
    ruling(ctx, statuses)
    send(ctx[1], ctx[4], ctx[0].assess_delivery, "AL-001", "M1")


def record(ctx):
    return json.loads(ctx[0].get_audit("AL-001"))


def balance(contract, account):
    return int(contract.get_account(account)["claimable"])


def conserve(contract):
    board = contract.get_board()
    assert int(board["deposited"]) == int(board["locked"]) + int(board["claimable"]) + int(board["withdrawn"])


def test_exact_funding_and_frozen_scope(ctx):
    contract = create(ctx)
    initial = record(ctx)
    assert len(initial["scope_hash"]) == 64
    assert initial["commit"] == "a" * 40
    assert contract.get_board()["locked"] == "1001"
    with ctx[1].expect_revert("already exists"):
        create(ctx)
    conserve(contract)


def test_rejects_wrong_funding_and_invalid_commit(ctx):
    contract, vm, owner, auditor, stranger = ctx
    with vm.expect_revert("40-character"):
        send(vm, owner, contract.create_audit, "AL-001", "Staking audit", "https://github.com/example/staking", "main", auditor, scope(), DEADLINE, value=1001)
    with vm.expect_revert("exact sum"):
        send(vm, owner, contract.create_audit, "AL-001", "Staking audit", "https://github.com/example/staking", "a" * 40, auditor, scope(), DEADLINE, value=1000)
    assert contract.get_board()["deposited"] == "0"


def test_only_invited_auditor_can_accept_and_work_cannot_be_cancelled(ctx):
    contract = create(ctx)
    with ctx[1].expect_revert("invited auditor"):
        send(ctx[1], ctx[4], contract.accept_audit, "AL-001")
    send(ctx[1], ctx[3], contract.accept_audit, "AL-001")
    with ctx[1].expect_revert("unaccepted"):
        send(ctx[1], ctx[2], contract.cancel_unaccepted, "AL-001")


def test_no_unauthorized_evidence_or_early_second_delivery(ctx):
    contract = active(ctx)
    with ctx[1].expect_revert("participants"):
        send(ctx[1], ctx[4], contract.add_evidence, "AL-001", "M1", "Report", EVIDENCE, "")
    send(ctx[1], ctx[3], contract.add_evidence, "AL-001", "M2", "Retest report", EVIDENCE, "")
    with ctx[1].expect_revert("preceding milestone"):
        send(ctx[1], ctx[3], contract.submit_delivery, "AL-001", "M2", EVIDENCE)


def test_pinned_source_must_match_frozen_repository_and_commit(ctx):
    contract = active(ctx)
    commit = "a" * 40
    valid_url = f"https://raw.githubusercontent.com/example/staking/{commit}/contracts/Staking.sol"
    ctx[1].mock_web(
        r"raw\.githubusercontent\.com/example/staking/" + commit + r"/contracts/Staking\.sol",
        {"status": 200, "body": "contract Staking { function deposit() external {} }"},
    )

    send(ctx[1], ctx[3], contract.add_evidence, "AL-001", "M1", "Pinned staking source", EVIDENCE, valid_url)
    exhibit = record(ctx)["milestones"][0]["evidence"][0]
    assert exhibit["source_url"] == valid_url
    assert exhibit["evidence_type"] == "PINNED_SOURCE"
    assert exhibit["snapshot"] == "contract Staking { function deposit() external {} }"

    with ctx[1].expect_revert("does not match the frozen audit repository"):
        send(ctx[1], ctx[3], contract.add_evidence, "AL-001", "M1", "Wrong repository", EVIDENCE, f"https://raw.githubusercontent.com/example/other-repository/{commit}/contracts/Staking.sol")
    with ctx[1].expect_revert("does not match the frozen audit commit"):
        send(ctx[1], ctx[3], contract.add_evidence, "AL-001", "M1", "Wrong revision", EVIDENCE, f"https://raw.githubusercontent.com/example/staking/{'b' * 40}/contracts/Staking.sol")
    assert len(record(ctx)["milestones"][0]["evidence"]) == 1


def test_statement_only_evidence_is_explicitly_an_attestation(ctx):
    contract = active(ctx)
    send(ctx[1], ctx[3], contract.add_evidence, "AL-001", "M1", "Attributed external context", EVIDENCE, "")
    exhibit = record(ctx)["milestones"][0]["evidence"][0]
    assert exhibit["evidence_type"] == "ATTESTATION"
    assert exhibit["source_url"] == ""
    assert exhibit["snapshot"] == ""


def test_approval_credits_once_and_preserves_next_milestone(ctx):
    contract = delivered(ctx)
    send(ctx[1], ctx[2], contract.approve_delivery, "AL-001", "M1")
    assert balance(contract, ctx[3]) == 701
    assert contract.get_board()["locked"] == "300"
    with ctx[1].expect_revert("approve submitted"):
        send(ctx[1], ctx[2], contract.approve_delivery, "AL-001", "M1")
    conserve(contract)


def test_uncontested_release_requires_full_window(ctx):
    contract = delivered(ctx)
    with ctx[1].expect_revert("48-hour"):
        send(ctx[1], ctx[4], contract.settle_uncontested, "AL-001", "M1")
    ctx[1].warp("2026-10-20T12:00:00Z")
    send(ctx[1], ctx[4], contract.settle_uncontested, "AL-001", "M1")
    assert balance(contract, ctx[3]) == 701
    with ctx[1].expect_revert("Only the protocol"):
        send(ctx[1], ctx[2], contract.dispute_delivery, "AL-001", "M1", EVIDENCE)


def test_readiness_requires_both_and_evidence_resets_it(ctx):
    contract = disputed(ctx)
    with ctx[1].expect_revert("response period"):
        send(ctx[1], ctx[2], contract.assess_delivery, "AL-001", "M1")
    send(ctx[1], ctx[2], contract.mark_ready, "AL-001", "M1")
    send(ctx[1], ctx[3], contract.add_evidence, "AL-001", "M1", "Auditor response", EVIDENCE, "")
    assert record(ctx)["milestones"][0]["dispute"]["ready"] == []
    send(ctx[1], ctx[2], contract.mark_ready, "AL-001", "M1")
    send(ctx[1], ctx[3], contract.mark_ready, "AL-001", "M1")
    ruling(ctx)
    send(ctx[1], ctx[2], contract.assess_delivery, "AL-001", "M1")
    assert balance(contract, ctx[3]) == 701


@pytest.mark.parametrize("statuses,payment,refund,state", [(("MET", "MET"), 701, 0, "PAID"), (("MET", "NOT_MET"), 0, 1001, "REFUNDED"), (("MET", "UNCLEAR"), 350, 651, "SPLIT")])
def test_consensus_settles_by_criteria_and_refunds_unused_retest(ctx, statuses, payment, refund, state):
    contract = disputed(ctx)
    assess(ctx, statuses)
    assert record(ctx)["milestones"][0]["state"] == state
    assert balance(contract, ctx[3]) == payment
    assert balance(contract, ctx[2]) == refund
    conserve(contract)


def test_validator_independently_checks_every_decision(ctx):
    disputed(ctx)
    assess(ctx)
    assert ctx[1].run_validator() is True
    ruling(ctx, ("MET", "UNCLEAR"))
    assert ctx[1].run_validator() is False


def test_malformed_judgment_does_not_move_escrow(ctx):
    contract = disputed(ctx)
    ctx[1].warp("2026-10-19T12:00:00Z")
    ctx[1].mock_llm("AUDITLOCK's independent", '{"checks":[],"reason":"Incomplete checks must not authorize any settlement."}')
    with ctx[1].expect_revert("Invalid assessment"):
        send(ctx[1], ctx[4], contract.assess_delivery, "AL-001", "M1")
    assert contract.get_board()["locked"] == "1001"
    assert record(ctx)["milestones"][0]["ruling"] is None
    conserve(contract)


def test_timeouts_have_bounded_conservative_fallback(ctx):
    contract = disputed(ctx)
    with ctx[1].expect_revert("timed-out"):
        send(ctx[1], ctx[4], contract.recover_timeout, "AL-001", "M1")
    ctx[1].warp("2026-10-25T12:00:00Z")
    send(ctx[1], ctx[4], contract.recover_timeout, "AL-001", "M1")
    assert balance(contract, ctx[3]) == 350
    assert balance(contract, ctx[2]) == 651
    assert record(ctx)["milestones"][0]["ruling"] is None
    assert record(ctx)["state"] == "SETTLED"
    conserve(contract)


def test_expiry_does_not_bypass_submitted_review(ctx):
    contract = delivered(ctx)
    ctx[1].warp("2026-10-23T12:00:00Z")
    send(ctx[1], ctx[4], contract.expire_undelivered, "AL-001")
    assert balance(contract, ctx[2]) == 300
    assert record(ctx)["milestones"][0]["state"] == "SUBMITTED"
    send(ctx[1], ctx[4], contract.settle_uncontested, "AL-001", "M1")
    assert record(ctx)["state"] == "SETTLED"
    conserve(contract)


def test_unaccepted_cancellation_refunds_entire_escrow(ctx):
    contract = create(ctx)
    send(ctx[1], ctx[2], contract.cancel_unaccepted, "AL-001")
    assert balance(contract, ctx[2]) == 1001
    assert record(ctx)["state"] == "SETTLED"
    conserve(contract)


def test_write_methods_reject_accidental_value(ctx):
    contract = create(ctx)
    with ctx[1].expect_revert("does not accept"):
        send(ctx[1], ctx[3], contract.accept_audit, "AL-001", value=1)
