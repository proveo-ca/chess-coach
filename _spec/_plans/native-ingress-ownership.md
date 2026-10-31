# F9 — proposed sole-owner accounting, custody and deadline contracts

**[Unverified] 2026-10-21 · DIRECT SAME-COUNTER ACCOUNTING SELECTED FOR DESIGN ONLY / NOT IMPLEMENTED / RUNTIME FEASIBILITY UNVERIFIED / AUTHORITY REALM UNSELECTED / FULL PLAN UNAPPROVED / IMPLEMENTATION + OPERATIONS BLOCKED · trainingReady:false.**

## 1. Scope, provenance and unchanged boundaries

This continuation proposes concrete contracts for the unresolved ownership obligations in [mechanisms §§5–6](native-ingress-mechanisms.md#5-shared-public-meter--mandatory-unresolved-contract) and [implementation §11](native-ingress-implementation.md#11-mechanism-contract-continuation--proposal-only). It is not an approved file/API/recipe/invoice plan or an implementation assignment.

Parent reports actual publication `ae80f3c8e773f090553d53cf5ab381b93b76d956`, Markdown only/1460 insertions, with matching remote/local tracking and a clean checkpoint. The supplied result location is `/tmp/opencode/f9-feasibility-publication-result.json`; the keeper did not read it or independently verify that checkpoint. This new draft and the two §12 appendices follow that publication and are not included in it. No second publication is automatic.

Source facts below come from parent direct reads and read-only advice: Architect `ses_e9ffaa0c2ffeu5F0IiWZ7rZOnD`, Backend `ses_e9ffaa0c1ffenDCYcxp6OPa7N2`, DevOps `ses_e9ffaa0baffeWHgJc5HB9iyW2Y`. The keeper neither reread source nor ran verification. Their advice supplies no new operational grant or positive Native evidence.

- A, manifest-free `tooling/native-ingress/`, remains selected for design only. R-OUT and R-IN are authority-realm candidates; neither is selected. User-selected direct same-counter accounting below does not select a physical realm; [§12](#12-selection-ledger--direct-accounting-design-only) records the instruction and its scope.
- Accepted [N1–N10](native-ingress-authority.md), existing F1 fees/results, O9, native DTOs/protocols, Configuration26, Versions21 and the public nonterminal AFTER-BEGIN visitor remain unchanged.
- Preserve ONE shared 1048576-unit reconstructed-window allowance, cold absolute10s and lifecycle300s including reserved3s cleanup. Separate generator2048 does not fund ingress. No renewal, fee increase, native exemption or new physical allowance follows.
- All M2/query/receipt grants are consumed. Reported Docker29.7.2/API1.55 and matching kernel strings establish neither installed identity, common namespaces, proc reachability nor actual capabilities. No generic mapping/root/metadata-choice reapproval is requested.
- This proposal grants no operational command, production-source change, installed-root/log/PATH/proc/socket/daemon/control/receipt access, network operation, build, capture or native execution. Lead-owned document checks and isolated arithmetic-model preparation remain separate from actual F1 or runtime verification.

## 2. Supplied source API — what exists, not a Native guarantee

| Supplied source anchor | Existing contract | Consequence for this proposal |
|---|---|---|
| `packages/training/src/ledger/work.rs:34–70` | `LedgerWork` has private `used`/`limit` fields and is not Clone. `new` starts used0, limit1048576. `with_limit(B)` accepts1..=1048576 and starts used0. | Reduced-meter availability remains a general API fact, not the selected Native constructor/path. Public constructors also permit unrelated fresh meters; the type alone does not enforce global Native-window ownership. Existing APIs remain unchanged for other consumers/tests. |
| Same ledger API | `charge(amount:u64)` uses checked addition and the limit. Failure leaves used unchanged; earlier successful charges remain consumed. `used`, `remaining`, `limit` only observe. | There is no reserve/split/merge/refund/remote-charge/authentication API. The historical unselected reservation below is accounting composition, not an existing reservation primitive or selected F9 mechanism. |
| `packages/training/src/feature_input.rs:98–138` | Initialize, advance and input take ordinary local `&mut LedgerWork`; they do not bind themselves to a unique Native window. | The selected design lends the SAME ONE direct counter to every F1 call. Conditional prepayment remains an unselected comparison, not an active implementation alternative. Call counts do not prove budget fit. |
| `apps/arena/src/economic_client.rs:70–90` | `Transaction::new` creates a fresh full counter and a deadline from now+10s. No inherited-window constructor exists. | Calling it later cannot implement F9 ownership. Existing pub(crate) fields permit minimum-tightening a deadline but do not constitute a new F9 ownership mechanism. |
| Existing `WorkerTransport` | Legacy transport launches through PATH/tsx. | Legacy execution is not source-captured F9 proof or an authority bootstrap. |

These API facts support local accounting composition only. They establish neither a genuine private Native capability nor the required actual observation/custody mechanism.

## 3. User-selected design — one direct owner, one direct counter

**USER-SELECTED DIRECT ACCOUNTING FOR DESIGN ONLY; NOT IMPLEMENTED; REALM UNSELECTED.** The selected direction uses a private reconstructed-window owner containing ONE `LedgerWork`, ONE `FeatureInputPair`, the original absolute clock origin, actual custody bindings and monotonic revocation state. The ONE counter has an inclusive 1_048_576-unit limit shared by BOTH seats. An independently trusted issuer captures the original `S0`/`t0` BEFORE ALL launch-causal work. After qualified initial G1, the Rust owner creates ONE `LedgerWork` at used0 and retains and validates the original `S0`/`t0` through a qualified safe nonrenewing bridge (OPEN), never recording owner-entry `now` as the origin. Its first successful direct debit precedes the earliest owed effect; if owed pre-owner work exists, STOP BEFORE that effect. No later `Transaction::new` may replace either resource origin. This direction is not full file/API/recipe/invoice-plan or constructor approval.

The selected design lends the SAME counter directly to every F1 call and every disjoint new public-work charge, including binding, control, read, decode and copy fees. Loans cannot escape the operation. No per-recipient, per-helper, per-transaction, separate cleanup meter, refusal replacement, reset, refund, prepaid reservation or subcounter belongs to the selected F9 path. Classify and precharge each owed operation on that SAME counter BEFORE its effects; successful earlier charges survive later refusal. These path restrictions do not ban or change existing `LedgerWork` public APIs or `with_limit` for other consumers/tests. Separately supervised private native-proof work remains physically bounded and cannot disguise public/R4 work. Exact fee values, the full direct invoice and aggregate resource fit remain OPEN; this selection supplies no new coefficients.

The prohibition concerns independently funded software-work meters/reservations/subbudgets, not ordinary length counters, telemetry or physical enforcement limits. Those bounds create no additional spendable work allowance.

The ordinary non-replayed lifecycle has initialize1, two logical advances and at most six unique recipient/boundary readouts; these are NOT total invocation caps. Preserve N5's charged immediate identical replay without reissuing facts, renewing logical progress slots or repeating the innovation fold. Existing `FeatureInputPair::advance` charges ENTRY and `ledger.advance` before returning Replayed; no free cache shortcut is specified. Replay uses the SAME funded counter and original deadlines. Total calls, replay-count/byte/work bounds and their invoice remain OPEN before implementation acceptance; OPEN permits neither unbounded/free replay nor a zero-default limit that disables N5. A failed call terminates the Native window; retained successful-prefix state cannot repair a failed tail through retry. Both recipients share the same allowance. None of these logical counts proves coefficients, invoice completeness or 1M fit.

Existing F1 publishes both recipient successors only when both work paths succeed. Preserve that local atomicity and its consumed failure prefix. A deadline/custody check AFTER a successful synchronous F1 call can still invalidate the Native window after its private pair state changed. Revoke and publish no external result; do not promise whole-transaction rollback or charge rollback.

This private wrapper is a future source design, not an accepted constructor or currently unforgeable crate boundary. Existing `Transaction` fields and public ledger constructors remain reachable elsewhere. A selected-closure audit must prove that every F9 path uses this owner and cannot substitute fresh meters or unchecked issuers. A `LedgerWork` value, model object or JSON report grants no authority.

R-OUT still lacks captured immutable host-Rust loading and exact container/attachment→Node binding. R-IN still lacks actual outer-check→inner live-issuer/accessor causality and a nonrenewing clock bridge. Direct accounting selects neither realm, forces no R-OUT placement and waives no missing check. It does not claim those mechanisms feasible or solved.

## 4. Conditional alternative — irreversible prepayment, not remote authority

### 4.1 Proposed accounting sequence using existing APIs

**HISTORICAL UNSELECTED COMPARISON.** Retain this conditional preselection proposal, its mathematics and counterexample for comparison only. It is not the selected F9 path, a fallback or an automatic switch. Its `with_limit(B)` composition is mathematical support, not a selected Native constructor. It does not add a Native DTO or an accepted prepaid-F1 constructor.

1. Let `L=1048576`. The sole outer owner retains its original counter and `t0`. Charge all owed outer startup/bootstrap work before its effects, even before an inner counter exists.
2. Choose a source-audited bound `B`, with `1≤B≤L` and `B≤outer.remaining`. `B` must cover ALL owed inner public work: unchanged F1 fees PLUS all selected disjoint new inner fees. Neither its actual value nor the coefficients/fit are set here. No unpaid F1 execution may estimate it.
3. Debit `outer.charge(B)` BEFORE any covered inner public effect. On failure, create no inner counter and authorize no covered effect. Charge separately owed reservation bookkeeping on its own disjoint schedule; it is not hidden in zero-cost model scaffolding.
4. Only after successful debit, create ONE `LedgerWork::with_limit(B)`. Its used value starts at ZERO, not `B`. Lend this same inner counter to all selected inner F1 and new-fee operations. Do not charge those F1 fees again against the outer meter.
5. Charge all disjoint outer work separately before effects: startup, reservation bookkeeping, transfers/copies in both directions, hashing, comparisons, control checks and cleanup. No operation disappears between outer and inner invoices. Private actual-native proof remains separately physically bounded, not a public-work exemption.
6. Refusal consumes its successful prefix. No fresh counter, replacement reservation, post-hoc authorization or unused-capacity refund follows. Closure forfeits unused inner capacity; the outer debit never decreases.

If a different proposal reserved F1 alone, it would still need globally paid coverage for every other inner public operation. This proposal instead makes `B` cover all owed inner public work, preventing that ambiguous gap. It does not change any existing F1 fee.

### 4.2 Conservation and stranded capacity

Let `E` be actual disjoint outer charges, including reservation bookkeeping but excluding the reservation debit itself. Let `U` be successful inner consumption and `B` the already-paid reservation.

```text
0 ≤ U ≤ B
outer.used = E + B ≤ L
actualSpent = E + U
outstanding = B - U
actualSpent + outstanding = E + B = outer.used

on closure:
  forfeited += outstanding
  outstanding = 0
  actualSpent + forfeited + outstanding = outer.used ≤ L
```

These are accounting quantities, not Native authorization tokens. Initializing the inner counter at used0 prevents double billing; its limit `B` bounds the prepaid work. Existing F1 fees, results and consumed failure prefixes remain the same for the same inputs and local budget. Whole-F9 acceptance is NOT equivalent to direct billing: prepayment strands unused capacity.

Explicit counterexample in INTEGER MODEL UNITS only: `L=10`, outer-before=`1`, reserved `B=8`, inner-used=`1`, later outer cost=`2`. Direct billing consumes `1+1+2=4≤10`; prepayment would require `1+8+2=11>10` and refuses the last outer charge. This neither proposes a smaller real F9 cap nor supplies an actual fee coefficient or fixed reservation.

### 4.3 What prepayment does not establish

Numeric `B`, `remainingUnits`, a serialized paid claim or a verified flag cannot establish a unique legitimate captured inner window. The arithmetic proves neither an authentic paid reservation, channel binding, replay exclusion, duplicate-peer exclusion nor outer-check→inner live-issuer/accessor authority. The existing ledger API provides no atomic cross-realm bridge.

R-IN bootstrap public work before the inner counter exists must already be globally debited and causally bounded before effects. Later data cannot retroactively authorize that work. Globally paid reservation uniqueness and binding to the actual inner state remain required mechanisms, not consequences of the equation.

A future private wrapper would need construction only after debit, no Clone/Deserialize/public-literal/verified-flag authority construction and no escaping mutable work reference. Such a wrapper is unapproved and does not by itself make the entire crate unforgeable. The detached JavaScript object below deliberately supplies none of these properties.

This conditional accounting composition alone cannot freeze the plan. Actual capture/custody, all required checks, private authority, nonrenewing clocks, disjoint coefficients and aggregate bounds remain unresolved.

## 5. Custody and revocation — proposed operational semantics, not kernel proof

### 5.1 State progression and authority boundary

| Proposed state | Permitted meaning / transition obligation |
|---|---|
| registered | Independent expected inputs exist as data. No live authority. |
| custodyBound | Actual required owned process/stream/loaded-byte relationships are bound. No authority from a claimed PID, model state or report. |
| checked | All required actual checks passed against independent expectations under that custody and the original clocks. A stale report cannot substitute. |
| active | A private live gate may permit the selected synchronous loans only while all continuing obligations hold. No escaping borrow; recheck every read and before/after callbacks. |
| normalClosing | Block new loans, quiesce existing loans and permanently revoke live permission BEFORE explicit wait/reap. Teardown is not another authority grant. |
| closed | Clean required EOF/reap/cleanup may produce an audit report only. Reports never restore live permission. |
| poisoned/revoked | Absorbing failure state from any stage. No reactivation, replacement window or report-based restoration. Failed cleanup invalidates the proof. |

These are proposed design states, not source classes or accepted constructors. No class constructs `RuntimeControls` from states, reports or modeled flags. Normal revocation may end in a verified audit report without live authority; a failure branch cannot be relabeled normal closure to recover proof.

### 5.2 Actual custody must precede the state labels

A directly owned Node `std::process::Child` can contribute a different custody relationship from a `Child` representing Docker CLI. Retaining a CLI child or attach stream is insufficient to own the container's Node process. A future mechanism must bind the exact container→Node PID/stream/context and captured executable/native backing handles. No such mechanism is established here.

Bind BOTH endpoints and actual daemon-init status to the same container identity/PID namespace where that topology is selected. Init is not Rust's child in the R-IN candidate: Rust is actually a child of daemon init. Do not infer init custody from a Node child handle. Other topologies must prove their own bindings without multiplying allowances.

An open read-only executable FD does not make its backing file immutable. Required same-FD hashing, captured read-only mount/root correspondence and the continuing-load invariant must hold together. Proc snapshots, FD possession or pre/post hashes alone are insufficient. Current privileges and proc/native-mapping reachability are unknown.

Preserve `#![forbid(unsafe_code)]`. This proposal assumes no unsafe syscall/prctl/pidfd implementation, CAP addition, new crate, privileged helper or namespace/posture grant. A missing safe mechanism remains a blocker, not implicit approval.

### 5.3 Potentially reaping polls require an exclusive gate

`Child::try_wait` may reap. Therefore the proposed validation contract is:

1. Close a temporary exclusive validation gate BEFORE any potentially reaping poll. Suspend use by the currently held read loan while validation runs; admit no concurrent issuance, accessor, PID-directed action or additional loan. Keeping that loan's identity does not permit it to read through the closed gate.
2. If the poll returns `Some` or an error, transition to permanent monotonic revocation BEFORE any further PID lookup, loan or report acceptance. Never use a saved PID after reap, even while retaining the `Child` object.
3. If it returns `None`, continue required checks under the SAME existing authority and original deadlines while preserving exclusivity as required. This is not new authority or a guarantee that the child stays alive after observation.
4. Reopen only the temporary gate if all required continuing checks still hold and no permanent revocation occurred. The existing suspended loan may then resume; no new authority is issued. A failed poll/check permanently invalidates it. For normal close, quiesce loans and permanently revoke BEFORE explicit wait.

This closes the proposed reap/reuse ordering gap; it does not promise instantaneous death detection, reserve a PID after reaping or prove actual kernel custody. Source-level concurrency, loan lifetime and failure scheduling still need an audited implementation.

## 6. One time origin and bounded completion

`t0` denotes the ORIGINAL accepted launch origin (called `S0` in the later sealed-launch design), not a new owner-entry clock. The sole owner retains that origin; if it enters later, its entry is a distinct `t_owner` and it cannot record a new `now` as `t0`. Derive cold deadline `t0+10s` and lifecycle deadline `t0+300s` from the original origin, including time before owner entry. The safe nonrenewing origin→owner clock bridge remains OPEN if `t0` precedes `t_owner`; no owed public effect may precede the sole meter and its precharge. Reserve the final3s of the lifecycle for cleanup; normal work must leave that reserve rather than start cleanup at300s. No helper/RPC/inner startup or later transaction renews either deadline.

Every issuance/control operation, accessor read and before/after-callback check must use the authoritative local absolute deadline applicable to that phase, tightened by all existing bounds. Minimum-tightening existing pub(crate) deadlines is possible source plumbing, not an implemented F9 inheritance API. An unrelated fresh `now+10s` is forbidden.

Synchronous F1 is not assumed preemptible. Check before it and immediately after it. A late postcheck revokes Native authority and prevents external publication even when successful F1 already changed private pair state; no rollback is promised. Cleanup remains within the original lifecycle bound, including failure cleanup. Timeout requests do not prove actual completion/reap.

Budget refusal does not excuse mandatory physical cleanup. Genuinely private supervision still needs its declared bounded envelope; it cannot conceal unpaid public/R4 processing. If owed public close/decode/check work cannot be prepaid, reject positive F9 acceptance rather than perform it unpaid or create a cleanup allowance. Forced teardown does not become clean-close/EOF/reap proof.

R-IN needs a genuine causal outer→inner deadline mechanism at issuance and EVERY accessor. Serialized `Instant`, wall-clock values, outer timeout alone or numeric remaining duration cannot supply that contract. Conditional prepayment does not solve the clock bridge. The actual safe observer, enforcement and bridge remain unestablished.

## 7. Physical accounting accompanies public accounting

One candidate shared container for Rust, BOTH Nodes and init must fit the aggregate 2CPU/4GiB/256-PID envelope. A shared container does not establish per-role RSS budgets: shared file pages and cgroup accounting prevent that inference.

Assign numerical envelopes to every outer controller/helper, build/runtime role, staging/output and storage peak, including coexistence. Source-bound mapping/hash scratch, byte/copy bounds and enforcement facilities still need calculation. No unbounded outer role, extra native physical allowance or R4/native public-fee exemption is created. Metadata and model arithmetic establish none of these quantities.

## 8. Independent verification obligations — proposed, not run

| Verification layer | Required cases / claim boundary |
|---|---|
| Existing source tests | Parent/advisor locate exact/one-below/current-caller-sharing anchors in `packages/training/tests/feature_input.rs:1174–1333`. They were not run here. They concern actual F1 behavior, unlike the abstract model below. |
| Future direct-owner source tests | Exactly one shared meter and pair; no fresh meter through helper/transaction/refusal; ordinary logical slots plus separately bounded charged immediate replay without reissued facts or renewed slots; successful-prefix retention and late-postcheck no-publication without rollback. |
| Historical unselected conditional-prepayment test obligations | Comparison only, not selected implementation work: refusal before covered effects; no child counter on failed debit; used0 after creation; same inner counter for F1/new fees; no double billing/refund; forfeiture; duplicate/replayed grants yield zero authority. |
| Future custody/source gates | Child death, potentially reaping poll/PID reuse, CLI-child versus Node-child type/custody confusion, stream/context crossing, both-child EOF/cleanup failure and no PID action after reap. Suspend use of a held loan and block additional issuance during exclusive validation; quiesce loans before close. |
| Future deadline/source gates | Original-t0 startup charges; no new transaction renewal; every accessor/callback check; synchronous overrun revocation; R-IN causal clock bridge; cleanup completion within the same lifecycle. |
| Future actual Native proof | Required independently expected/actual captured loading, init/full-policy/process/root/mapping/custody/enforcement checks after separately approved implementation and operations. Synthetic states never establish genuine authority. |

No Rust/core/native tests or operational probes ran. The independent arithmetic model below checks equations and the refusal model only; its passing run does not test actual F1 inputs/results, source side effects, authority or host feasibility.

## 9. Persisted pure arithmetic reference model — MODEL ONLY PASS

The fence imports ONLY `node:assert/strict`. It contains no filesystem/environment/proc/process-creation/network access and touches neither Rust nor Native objects. Ordinary trusted parent/Node startup activity is outside this mathematical model; this is not a claim of zero underlying system activity. There is no execution command or self-extracting filesystem wrapper here.

All charges are nonnegative BigInt u64 model quantities. The exhaustive local limits1..16 and the `L=10` example are INTEGER MODEL UNITS, not F9 invoice coefficients or proposed resource caps. The real-cap boundary cases retain `L=1048576`. Copying plain state objects below enumerates independent traces; it does not imply Rust `LedgerWork: Clone`.

The model deliberately returns a detached reservation object. That object is not a private Native capability and proves no authentic reservation, uniqueness, no-replay property, selected-closure discipline or cross-realm causality. Its arithmetic functions independently model the supplied API; they are not actual Rust API tests. Some traces continue charging after a failed model charge to check the non-poisoning counter API; a failed F9 window would revoke authority rather than continue native effects.

Parent extracted the exact fence and measured SHA-256 `9670d444402a5e220bc84c00b1e519450a4a3cff0dd59441ce13d312d10028bd`,5017 UTF-8 bytes/190 LF-terminated lines. Parse-only checking and the isolated `ABSTRACT_ACCOUNTING_MODEL_ONLY` run passed561348 assertions. The run imported only the builtin assertion module and made no actual LedgerWork/F1, daemon, installed-root or custody call. This is finite model coverage and selected u64 boundary checking, not a full-state proof of implementation, invoice fit or genuine execution.

<!-- BEGIN F9 ACCOUNTING REFERENCE MODEL -->
```js
import assert from 'node:assert/strict';

const L = 1048576n;
const U64 = (1n << 64n) - 1n;
let count = 0;

function eq(actual, expected) {
  assert.equal(actual, expected);
  count += 1;
}

function rejects(fn) {
  assert.throws(fn, RangeError);
  count += 1;
}

function isU64(n) {
  return typeof n === 'bigint' && n >= 0n && n <= U64;
}

function work(limit = L) {
  if (typeof limit !== 'bigint' || limit < 1n || limit > L) {
    throw new RangeError('model limit');
  }
  return { used: 0n, limit };
}

function charge(w, n) {
  if (!isU64(n)) throw new RangeError('model u64 charge');
  const next = w.used + n;
  if (next > U64 || next > w.limit) return false;
  w.used = next;
  return true;
}

function reserve(g, B) {
  if (typeof B !== 'bigint' || B < 1n || B > L) return null;
  if (!charge(g, B)) return null;
  return { local: work(B), paid: B };
}

// Plain-object enumeration.
function copy(w) {
  return { used: w.used, limit: w.limit };
}

for (let ell = 1n; ell <= 16n; ell += 1n) {
  for (let E = 0n; E <= ell; E += 1n) {
    for (let B = 0n; B <= ell + 1n; B += 1n) {
      const g = work(ell);
      eq(charge(g, E), true);
      const r = reserve(g, B);
      const valid = B > 0n && E + B <= ell;
      eq(r !== null, valid);
      if (!valid) {
        eq(r, null);
        eq(g.used, E);
        continue;
      }

      eq(r.paid, B);
      eq(r.local.used, 0n);
      eq(r.local.limit, B);
      eq(g.used, E + B);
      const remaining = ell - g.used;

      const exact = copy(r.local);
      eq(charge(exact, B), true);
      eq(exact.used, B);
      eq(charge(exact, 0n), true);
      eq(charge(exact, 1n), false);
      eq(exact.used, B);
      eq(g.used, E + B);

      for (let U = 0n; U <= B; U += 1n) {
        for (let C = 0n; C <= remaining + 1n; C += 1n) {
          const outer = copy(g);
          const inner = copy(r.local);
          eq(charge(inner, U), true);
          eq(inner.used, U);
          eq(outer.used, E + B);

          const beforeFailure = inner.used;
          eq(charge(inner, B - U + 1n), false);
          eq(inner.used, beforeFailure);
          eq(outer.used, E + B);

          const accepted = C <= remaining;
          const priorOuter = outer.used;
          eq(charge(outer, C), accepted);
          eq(outer.used, accepted ? priorOuter + C : priorOuter);
          const Efinal = E + (accepted ? C : 0n);
          const actualSpent = Efinal + U;
          let outstanding = B - U;
          let forfeited = 0n;
          eq(actualSpent + outstanding, outer.used);
          eq(outer.used <= ell, true);

          const debitBeforeClose = outer.used;
          forfeited += outstanding;
          outstanding = 0n;
          eq(actualSpent + forfeited + outstanding, outer.used);
          eq(outer.used, debitBeforeClose);
          eq(ell - outer.used, ell - debitBeforeClose);
        }
      }
    }
  }
}

// Direct-counter reference.
for (let ell = 1n; ell <= 16n; ell += 1n) {
  for (let S = 0n; S <= ell; S += 1n) {
    for (let F = 0n; F <= ell; F += 1n) {
      for (let C = 0n; C <= ell; C += 1n) {
        const shared = work(ell);
        let prefix = 0n;
        let allAccepted = true;
        for (const n of [S, F, C]) {
          const before = shared.used;
          const accepted = charge(shared, n);
          eq(accepted, prefix + n <= ell);
          if (accepted) prefix += n;
          else allAccepted = false;
          eq(shared.used, accepted ? before + n : before);
          eq(shared.used, prefix);
        }
        eq(allAccepted, S + F + C <= ell);
      }
    }
  }
}

const fresh = work();
eq(fresh.limit, L);
eq(fresh.used, 0n);
eq(fresh.limit - fresh.used, L);
for (const bad of [0n, -1n, L + 1n, 1, '1', null]) {
  rejects(() => work(bad));
}
for (const B of [0n, L, L + 1n]) {
  const g = work();
  const r = reserve(g, B);
  eq(r !== null, B === L);
  eq(g.used, B === L ? L : 0n);
  if (r !== null) {
    eq(r.local.used, 0n);
    eq(charge(r.local, L), true);
    eq(charge(r.local, 1n), false);
    eq(r.local.used, L);
    eq(g.used, L);
  }
}
for (const bad of [-1n, U64 + 1n, 1, '1', null]) {
  const g = work();
  rejects(() => charge(g, bad));
  eq(g.used, 0n);
  eq(reserve(g, bad), null);
  eq(g.used, 0n);
}

const overflow = work();
eq(charge(overflow, 1n), true);
eq(charge(overflow, U64), false);
eq(overflow.used, 1n);
eq(charge(overflow, L - 1n), true);
eq(charge(overflow, 0n), true);
eq(charge(overflow, 1n), false);
eq(overflow.used, L);

// Stranded-capacity example.
const direct = work(10n);
for (const n of [1n, 1n, 2n]) eq(charge(direct, n), true);
eq(direct.used, 4n);
const prepaid = work(10n);
eq(charge(prepaid, 1n), true);
const detached = reserve(prepaid, 8n);
eq(detached !== null, true);
eq(charge(detached.local, 1n), true);
eq(charge(prepaid, 2n), false);
eq(prepaid.used, 9n);
eq(detached.local.used, 1n);
eq(1n + 8n + 2n, 11n);
eq(1n + 1n + 2n, 4n);

eq(count >= 1000, true);
console.log(JSON.stringify({
  scope: 'ABSTRACT_ACCOUNTING_MODEL_ONLY',
  count,
}));
```
<!-- END F9 ACCOUNTING REFERENCE MODEL -->

## 10. Handoff — three meaningful design-only priorities

**PRESELECTION HISTORY; QUESTION RESOLVED.** Retain this heading/anchor and the former three-priority presentation as history, not a repeated choice. Executor subsequently instructed `Apply direct software accounting`; direct same-counter accounting is now selected for design only under §12. The alternatives below are not active fallback/switch paths. No physical realm is selected.

| Priority | Concrete next planning deliverable | Remaining authority boundary |
|---|---|---|
| **Develop direct single-owner baseline (formerly Recommended; now user-selected design direction)** | Specify the one-owner closure, direct same-counter lending, logical progress/readout slots plus separately bounded charged immediate replay, before/after gates and irreversible revocation against actual custody requirements. | No R-OUT/R-IN selection, feasibility claim, source implementation or operation. |
| Historical unselected: develop conditional irreversible prepayment | Specify globally paid reservation uniqueness/state/channel binding, all-inner invoice coverage and the actual causal authority/clock mechanisms. | Local arithmetic alone cannot approve a cross-realm mechanism or complete plan; comparison only. |
| Historical unselected: keep both conditional pending custody mechanisms | Compare exact capture/process/stream/FD binding and safe gate/reap mechanisms before choosing accounting placement. | Not the current accounting decision; no repeated root/mapping/metadata request, diagnostic permission or Native fallback. |

```text
notEstablished:
  full-training-closure
  genuine-native-authority
  whole-decision-adequacy
  calibration
  training-readiness
trainingReady: false
```

Only supplied public-API composition and accounting mathematics are supported here; the later selection is a design instruction, not implementation evidence. Genuine private authority, actual custody and host feasibility remain unestablished. No collection, fitting, calibration, training, activation, deployment or auto-publication follows.

## 11. Scoped preparation checks and review

**PRESELECTION PROPOSAL REVIEW RECORD ONLY.** The checks and verdicts below predate the direct-accounting selection delta. They do not review or approve this later delta; parent owns its subsequent documentation review.

Lead checked the four-document continuation scope, complete published PLAN suffix and implementation/mechanism prefixes, accepted bf38 and consumed M1/M2/feasibility program identities, eight local links/anchors and whitespace. All passed. The registered arithmetic fence passed parsing and561348 model-only assertions; no actual Rust/F1, custody, daemon or installed-root test ran.

Adversarial `ses_e9fe5c988ffeWCdO1rnQiAxoDt` resolved the MEDIUM inconsistent model-run status in both appendices; final findings NONE, DOCS READY yes and READY TO PRESENT three DESIGN-ONLY priorities yes. Security `ses_e9fe5c951ffefaBzv2X73XpqF0` resolved the same consistency finding and reported no new findings, DOCS READY yes / READY TO PRESENT yes. Backend `ses_e9ffaa0c1ffenDCYcxp6OPa7N2` confirmed the suspended-loan and logical-slot/replay wording corrections for presentation. These reviews select no strategy or realm and approve no escrow, implementation or operation. Subsequent changes remain uncommitted after publication `ae80f3c8`.

## 12. Selection ledger — direct accounting, design only

| Date | Actual user instruction excerpt | Selected meaning | Not granted |
|---|---|---|---|
| 2026-10-21 | `Apply direct software accounting` | Direct SAME-COUNTER software-work accounting selected FOR DESIGN: ONE `LedgerWork`, inclusive 1_048_576 units shared by BOTH seats, ONE `FeatureInputPair`, original clock origin, all owed F1/new public fees precharged on that counter before effects. This is an instruction excerpt, not a synthetic TUI option label. | No complete file/API/recipe/invoice plan, accepted constructor, physical authority realm, Native context/public protocol, source implementation or operational permission. `trainingReady:false`. |

The software-work counter is NOT gameplay gas or minerals. This selection changes no gameplay rule, feature count, horizon, H1, learning recipe, currency or native income. The user's description of strategy waiting adds no lookahead or Native-AI training authorization.

Next design work must specify actual custody, immutable loading, safe observers, full-policy/init mechanisms and the source-audited direct invoice, quantities and aggregate resources. These remain unresolved. Plan freeze still requires concrete mechanisms and required current source-audit prerequisites; actual new F9 proof follows separately approved implementation and operations, not a circular preimplementation-proof requirement. Direct accounting neither selects R-OUT nor waives checks.

Preserve existing F1 fee profiles/source/calls and N5 charged immediate identical replay. Logical progress/readout counts remain distinct from total invocation and physical caps. Cold absolute10s, lifecycle300s including reserved3s cleanup, separate generator2048, no refund/no extra1M, accepted N1–N10, O9/native DTO/Configuration26/Versions21/public nonterminal AFTER-BEGIN visitor and all five exclusions remain unchanged. The arithmetic fence and its parent-reported561348-assertion record remain historical model evidence, not a new run or actual implementation proof.

All M2/query/receipt grants remain consumed. No new probe, source change, capture, build, collection, fitting, training, activation, deployment or other operation follows. The four continuation drafts remain uncommitted after `ae80f3c8`; applying this design selection grants no automatic commit, push or publication. This scoped update changes only ownership and the post-publication §12 appendices; parent handles the current PLAN prefix and reviews the selection delta.

Final direct-selection documentation reviews: Adversarial `ses_e9fd570a8ffegRGg0wkWg9RpKu` and Security `ses_e9fd57074ffeRP3js30V6n7Dfl` reported no findings and DOCS READY yes for design-selection documentation only. Security received the complete four-file captured diff before its final verdict. Lead verified published-history/frozen-program/model preservation, nine local links/anchors and whitespace. No model rerun, actual Rust/F1 test, installed-root inspection or runtime operation accompanied this metadata-only selection update. These verdicts approve neither the full plan nor implementation or operations.

## 13. Immutable Rust owner launch — first prerequisite contract

**[Unverified] CURRENT: ROUTE B SEALED LAUNCH SELECTED FOR DESIGN INVESTIGATION ONLY / N3 ACTUAL RESOLUTION, LOADING AND CONTINUING READ-ONLY QUALIFICATION OPEN / NO QUALIFIED LOCAL LAUNCH MECHANISM / AUTHORITY REALM UNSELECTED / FULL PLAN + IMPLEMENTATION + OPERATIONS UNAPPROVED · trainingReady:false.**

### 13.1 Decision boundary and supplied findings

**CURRENT PRECEDENCE:** Executor's `agreed, proceed with your choice` binds the prior recommendation `Design sealed launch`: route B is selected for DESIGN INVESTIGATION ONLY under [§14](#14-sealed-launch-selection-ledger--design-investigation-only) and the [sealed-launch dossier](native-ingress-sealed-launch.md). The protective-backing A/fs-verity and scope-frozen C discussions below remain preselection history, not active fallback routes. This does not select R-OUT/R-IN, approve a dependency/interface or classify pre-owner work as free.

The first prerequisite is concrete: the Rust owner that performs actual checks, owns the DIRECT counter and F1, and issues private loans must itself execute the independently selected captured artifact under a qualified continuing-loading contract. A mutable existing host Rust binary does not establish this prerequisite. Neither a read-only FD, chmod, a read-only bind with writable aliases, nor pre/post hashes makes its backing immutable. This is an unresolved qualification, not a blanket claim that Linux cannot supply immutable executable backing.

Root A, manifest-free `tooling/native-ingress/`, and [§12's actual DIRECT selection](#12-selection-ledger--direct-accounting-design-only) remain selected for design only. Neither R-OUT nor R-IN is selected. This section narrows the next mechanism-design decision; it does not freeze the full file/API/recipe/invoice plan, assign source files or approve a new dependency, provisioning step or operation. The [mechanism §13 pointer](native-ingress-mechanisms.md#13-immutable-owner-launch--prerequisite-design-pointer) and [implementation §13 pointer](native-ingress-implementation.md#13-immutable-owner-launch--no-implementation-assignment) refer here without changing their published prefixes.

Parent supplies read-only advice from Architect `ses_e9fd07b78ffeOObw5EzY6RXrB6`, Backend `ses_e9fd07ad4ffecY0secdEFfftGC` and DevOps `ses_e9fd07ad3ffe6tGi96HKPSKl4J`. Kernel research used upstream web sources only, not an actual-kernel query. The architect's initial blanket missing-immutable-backing assessment was refined after that research: ordinary main-executable kernel write exclusion is a conditional candidate, not established local evidence. Parent additionally verified the upstream v7.0 HSM exception described below. These are supplied source findings, not keeper source audits, local measurements or approval verdicts on this appendix.

All existing M2/query/root/receipt grants remain consumed. Reported Docker29.7.2/API1.55 and kernel string7.0.12 establish neither actual kernel/daemon code and configuration nor process permissions. No actual immutable artifact, static Rust build, kernel exclusion, fs-verity state, seal set, executable-FD access or proc reachability has been observed here. Planning can continue; positive loading/custody readiness cannot. Full capture, exact recipe/RecipeRef, source/native graph, licenses, invoice and operations remain unapproved.

### 13.2 Conditional mechanism A — ordinary static-main executable exclusion

Upstream Linux distinguishes `get_write_access` from `deny_write_access` through inode `i_writecount`. In the ordinary nonexempt execution path, execution transfers write denial to `mm.exe_file` for that executable reference's lifetime. An ordinary writable file description or shared writable VMA prevents establishing the denial. Hardlink aliases refer to the same inode and participate in that exclusion. This mechanism does not inherently require a new crate or mount; the actual safe observation/launch interface and all qualification conditions remain open.

The candidate actual-main binding opens `/proc/self/exe` and uses metadata plus a bounded digest of that SAME FD, compared against independently registered expectations. It must not resolve the symlink and reopen its pathname. Replacing a pathname does not change the object referenced by that actual executable FD. The required observation still needs a safe, source-bound interface, permission qualification, explicit byte/work bounds and the paid ordering in G3 below.

**HSM exception — mandatory STOP gate.** In upstream Linux v7.0 `include/linux/fs.h` around lines2809–2830, `exe_file_deny_write_access` returns0 without invoking denial when `FMODE_FSNOTIFY_HSM(exe_file->f_mode)` applies. Its comment states that this mode is classified at file open and remains constant for the file's lifetime. The macro depends on `CONFIG_FANOTIFY_ACCESS_PERMISSIONS`. Consequently, successful exec, a version-string match or no watchers now does NOT prove that the owner's own mm holds write denial. The actual kernel, filesystem and executable-open path must be qualified as nonexempt; unknown means STOP. Upstream v7.0 is not identity/configuration evidence for the reported local7.0.12 build. No claim that this configuration is disabled, no invented `/proc/fdinfo` flags proof, and no write-open/write/mmap/ptrace/sysctl probe follows.

The denial ends with mm destruction, re-exec or executable-reference replacement. PID continuity does not prove continued exclusion. A pre-exec digest followed by `fexecve` can still race mutable backing; it cannot authenticate initially executed code by itself. Post-exec same-object proof is conditional on the explicitly trusted initial selected captured artifact, host/kernel and launcher in G1. A worker's blind self-hash, claimed self-image identity or reporting flag cannot establish that trust premise.

This candidate covers only qualified main-executable backing, not the ELF interpreter, native DSOs, runtime plugins, JIT or private process memory. A static-main proposal must establish from actual artifact metadata that there is no `PT_INTERP` and no `DT_NEEDED`, then audit that no runtime dynamic-loading/script/sysroot-native code escapes the separately selected executable backings. An assertion that a build is static is not that metadata. The reported GNU Rust1.95 installation proves neither a static output nor available static libraries/linker/target support. No extra Rust target or acquisition permission follows.

Remote-filesystem mutation, raw-block writes and layered backings exposing different inodes are outside ordinary same-inode exclusion. Process-memory mutation through ptrace or other means is also outside that file guarantee. The eventual contract must exclude those mutators or state an explicit trusted-mutator boundary; it cannot claim arbitrary instruction/memory attestation. Actual host-Rust process permissions and capabilities remain unestablished. Even a qualified main file leaves N3's full resolution/native-loading and continuing-confinement obligations open.

### 13.3 Conditional mechanism B — sealed executable memfd

A different candidate populates a memfd object, applies AND verifies `F_SEAL_WRITE | F_SEAL_GROW | F_SEAL_SHRINK`, hashes the resulting object against independent expectations, and executes that SAME object. Those verified seals provide a kernel-enforced content-immutability mechanism. `F_SEAL_FUTURE_WRITE` alone is insufficient because existing writable mappings can remain. This is a mechanism contract, not evidence that a suitable local object or safe launch path exists.

Executable permission and the kernel's `vm.memfd_noexec` hierarchy/policy can block this route. Failure means STOP, not a sysctl, seccomp or capability relaxation. A reviewed safe application interface for executable-FD launch is required under arena's `#![forbid(unsafe_code)]`. Do not assume a safe `std::os::unix::process::CommandExt` executable-FD API; `pre_exec` is unsafe. No particular library function is positively reviewed here.

Parent source reads locate two `rustix` versions,0.38.44 and1.1.5, in `Cargo.lock` around4975 and4988. `tooling/xtask/Cargo.toml` has target-unix `rustix=1.1.5` with `process` features; `apps/arena/Cargo.toml` normal dependencies are only `serde`, `serde_json` and `training-native`. Locked does not mean installed, approved for arena, or qualified for the necessary filesystem/execution features. Parent's attempted GitHub fetch of `bytecodealliance/rustix/v1.1.5/src/runtime.rs` returned404; the exact API remains UNVERIFIED, not positively reviewed. These source findings grant no crate acquisition or new inspection.

**ADDITIVE RESEARCH DELTA:** That404 and the preceding no-reviewed-API statement retain their historical scope; they do not establish absent implementation. Parent subsequently verified the rustix1.1.5 experimental runtime source: its raw-pointer `execveat` is UNSAFE and rejected for arena. Parent also verified nix0.31.3's SAFE direct-syscall `execveat`, returning `Result<Infallible>` and replacing the process rather than spawning a child. The [dossier §§9–10](native-ingress-sealed-launch.md#9-supplied-safe-api-catalog--upstream-signatures-not-dependency-approval) records signatures/features, the minimal proposed nix syscall entry and still-open dependency/interface/closure approval. None is local qualification or implementation permission.

Adding an arena normal dependency, additional features or a safe launch wrapper is a NEW DESIGN BOUNDARY. It requires explicit approval of the exact dependency/interface, selected source/native graph, licenses and capture closure before code or build. No dependency or source assignment follows from mentioning the candidate. Interpreter/libraries, trusted bootstrap and public startup work still need their own mechanisms. Sealing the main file alone does not satisfy full N3. A helper that hashes/copies/seals owed public bytes before the sole Rust owner exists leaves the G3 startup-accounting problem unresolved.

### 13.4 Conditional backing property — fs-verity

An already enabled fs-verity file on a supported filesystem can supply read-only content and verified reads, including mapped reads. Independent digest identity, actual-object binding and the complete loader/native closure remain separate requirements. This is an optional property of an existing backing, not a claim about Docker layers, tmpfs or archives.

Enabling the ioctl or copying/provisioning files is a separate write/new-interface decision requiring explicit approval. A copy does not inherit verity. No mount is inherently required for the mechanism, but actual filesystem support, state and permissions are unmeasured. No enable operation or support probe is authorized. This alternative also retains G1's initial trust and G3's classification of provisioning versus actual public execution checks.

### 13.5 Bootstrap gates — one owner before owed public work

Each gate is required; none is a model flag or an authority constructor. The order below states dependencies without pretending that a self-check can authenticate arbitrary initially executed code.

| Gate | Concrete prerequisite contract | Current STOP / approval boundary |
|---|---|---|
| **G1 — independently expected artifact and initial trust** | Register expected source/build/native closure, exact recipe and policy BEFORE runtime claims. A trusted launcher selects THAT captured object and the kernel runs it under an explicitly declared minimal root-trust premise. | Expected inputs are data, not executable trust or authority. If that initial-artifact/host/kernel/launcher premise lies outside the existing accepted boundary, obtain a new narrow decision. No observer flag, self-image claim or execution-truster recursion substitutes. |
| **G2 — actual backing property** | Qualify the exact kernel/filesystem semantics and actual object's immutability: ordinary main-executable exclusion only with the non-HSM condition established, verified full seals, or qualified existing fs-verity. | No current local qualification exists. Successful exec/version metadata, read-only FD, chmod, mount label or pre/post digest is not the missing property. Unknown means STOP. |
| **G3 — direct resources and paid actual binding** | An independently trusted issuer captures original `S0`/`t0` BEFORE ALL launch-causal work. After qualified initial G1, the Rust owner creates ONE direct `LedgerWork` at used0; it retains and validates that origin through a qualified safe nonrenewing bridge (OPEN), never substituting owner-entry `now`. Its first successful debit precedes the earliest owed effect; if owed pre-owner work exists, STOP BEFORE it. Compare actual same-FD/main and native-closure evidence to independent expectations within paid gates, before authority. | Declare the existing physical executable-load/root-trust envelope explicitly; do not relabel new public work as private/free launcher work. Provisioning versus actual public execution checks must be classified before the full plan. A pre-owner sealed helper's owed work is unresolved. No serialization/restoration, replacement/reset, subbudget or assumed counter continuation after exec is authorized. |
| **G4 — complete continuing loading and confinement** | Bind all actual interpreters, native DSOs, loader resolution and continuing executable sources; complete mixed host/model audits. A proposed static main requires actual no-`PT_INTERP`/no-`DT_NEEDED` metadata and audited runtime-loading restrictions. | Main-file protection is not library/instruction-memory proof. JIT and other Node executable sources belong to separately captured endpoint/container contracts; Rust-main protection does not cover them. Missing source/backing classification or continuing confinement means STOP. |
| **G5 — unchanged whole-window contract** | BOTH seats share the original inclusive1_048_576 limit and SAME counter for unchanged F1 plus all owed disjoint new work; no escrow. Original absolute10s covers launch/init/window/reference, and lifecycle300s includes reserved3s cleanup. | Make actual Rust startup/native-private versus public timing and work explicit; hide no fee. Source-audited coefficients, quantities, replay bounds and physical aggregate fit remain OPEN. The historical561348 model assertions qualify no kernel or actual F1 execution. |

Direct accounting forbids an implicit accounting handoff across a helper/exec boundary. This does not prove that every later legitimate capture/provisioning recipe is impossible. It requires a new accepted recipe and explicit classification before any exemption or continuity claim. Neither a generic launcher category nor an after-the-fact invoice makes already performed owed work paid.

### 13.6 Conditional R-OUT topology — candidate only, not selected or frozen

One candidate colocates the direct counter, F1 and actual public checks in ONE immutable captured host-Rust owner. ONE read-only, fully policy-constrained container runs the fixed worker as its main application under daemon init. A fixed independent reference is created through a daemon ExecID inside that SAME container, with an independent attachment. This is a design candidate only; no R-OUT decision, full-plan acceptance, container start or exec approval exists.

Exec creates execution and is MUTATING, not a read-only API query. It requires fresh exact approval. The candidate adds no dynamic caller selectors, in-container daemon socket or new mounts. A Rust child for Docker CLI is not the Node process or the process represented by ExecID. The required custody contract must join exact ContainerID, attachment and ExecID to actual Node PID, process lifetime, root, executable FD, raw frames and session. Actual safe Rust proc/access and lifecycle observation mechanisms remain unidentified; an identifier or inspect response alone cannot construct authority.

`Running:false` and an exit code alone do not establish clean reap of the reference. Container stop does not prove F9 cleanup. Both endpoint EOF, actual process termination/reap evidence and custody-preserving revocation must be specified. Any additional observer supplies raw evidence data only and needs an actual source-bound launch/channel relationship. It cannot add unmetered public helper work or an unknown physical role. An extra exec observer would itself require future explicit execution approval, not reuse a read-only grant.

Preserve the fixed existing Node protocol: start, one open, empty-pass settle, close. The independent reference imports neither EconomicReplay nor EconomicWorker and never treats worker claims as expected truth. ONE Rust F1 owner performs initialize1 and two logical advances with at most six unique recipient/boundary readouts, plus separately bounded charged N5 immediate identical replay on the SAME counter. These are logical counts, not total invocation caps or a fit proof; replay bounds remain OPEN. Preserve complete comparisons and ORIGINAL frame/boundary spans, not JSON reserialization. No Node-reported boolean delegates full-policy checking while concealing unpaid public work.

The entire unchanged policy remains required, including exact output binding, tmpfs, users, security settings, private PID/IPC and imported predicate bindings; resource limits alone are not policy parity. The host Rust role outside the container needs an explicit physical envelope and peak-coexistence calculation. It is not covered merely by the container's2CPU/4GiB/256-PID limits. Shared file pages/RSS observations do not establish per-role bounds. Safe custody, full-policy/init checks and aggregate enforcement remain independent blockers even if G2 is later qualified.

### 13.7 Private interface semantics — no approved Rust signatures

The following names describe private semantic responsibilities, not existing types, exact APIs, public wire DTOs, source assignments or an approved implementation:

| Conceptual responsibility | Required effect / refusal boundary |
|---|---|
| `begin-resource-owner` | An independently trusted issuer, not the owner, must capture original `S0` before ALL launch-causal work. After qualified G1, create the sole direct used0 counter; retain and validate independently issued `S0` through a qualified nonrenewing bridge (OPEN). The first successful debit must precede the earliest owed effect; STOP before any unpaid pre-owner work. This grants NO Native authority. |
| `bind_custody` | Use actual custody mechanisms; distinguish a directly owned Node `Child` from a container-endpoint lifecycle relationship and its observation data. Missing physical custody means STOP. |
| `check_loading`, `check_policy_init`, `validate_live` | Perform the actual required same-object, full-policy/init and continuing checks against independent expectations, within the paid ordering and original clocks. A name or successful scalar/model branch is not the physical mechanism. |
| `initialize`, `advance`, `recipient-visit`, `close` | Lend the SAME counter to unchanged F1 and all new owed work; preserve logical/replay semantics, before/after/every-accessor gates, absorbing revocation and explicit cleanup evidence. |

Authority types cannot be constructed from registered-input data, a report schema or a verified flag without the required actual checks. A conceptual private `RawCapturedReply<T>{original_frame,boundary_ranges,decoded}` retains evidence data; it is neither an existing type nor a new wire contract or approved API freeze. Original span identity must survive decoding and comparison.

Parent source findings state that existing typed transport loses original spans and that `preflight_bytes` occurs AFTER exchange and UTF-8 conversion. It therefore does not prove a new before-effect invoice. New bounded-read, retention, allocation and prepayment algorithms need their own explicit design/fee approval before implementation. Legacy PATH/tsx behavior remains untouched. Pure scalar counter/failure-code tests may check arithmetic and refusal only; they cannot synthesize physical custody, a trusted loaded artifact or positive authority. No new model is needed to qualify the kernel, because a synthetic model cannot do so.

### 13.8 Supplied upstream/source references — not local qualification

No URL was fetched and no source was reread by the keeper. These references identify the supplied research basis and its limits:

- [Linux v7.0 `include/linux/fs.h`](https://github.com/torvalds/linux/blob/v7.0/include/linux/fs.h): parent-verified HSM exception and open-time file-mode qualification. It is not the reported local7.0.12 build/configuration.
- [Linux v7.3 `fs/exec.c`](https://github.com/torvalds/linux/blob/v7.3/fs/exec.c) and [v7.3 `kernel/fork.c`](https://github.com/torvalds/linux/blob/v7.3/kernel/fork.c): advisor-read upstream main-executable/mm lifetime references, not installed-version evidence.
- [`proc_pid_exe`](https://man7.org/linux/man-pages/man5/proc_pid_exe.5.html), [`fexecve`](https://man7.org/linux/man-pages/man3/fexecve.3.html) and [`mmap`](https://man7.org/linux/man-pages/man2/mmap.2.html): object identity, mutable-file execution race and writable-mapping limitations; no local access proof.
- [Executable memfd policy](https://www.kernel.org/doc/html/latest/userspace-api/mfd_noexec.html), [`F_GET_SEALS`](https://man7.org/linux/man-pages/man2/F_GET_SEALS.2const.html) and [fs-verity](https://www.kernel.org/doc/html/latest/filesystems/fsverity.html): conditional kernel mechanisms, not observed policy/support/seals/verity state.
- [Rust `CommandExt`](https://doc.rust-lang.org/std/os/unix/process/trait.CommandExt.html): safe-interface boundary; no reviewed executable-FD launch API follows. Parent-read `Cargo.lock:4975,4988`, `tooling/xtask/Cargo.toml`, `apps/arena/Cargo.toml` and `apps/arena/src/lib.rs:2` supply dependency/unsafe-boundary facts only.
- [Docker Engine API v1.56 documentation](https://docs.docker.com/reference/api/engine/version/v1.56/): exec design reference only. Metadata reported API1.55; these docs do not establish a locally installed v1.56 API or actual daemon/process behavior.

### 13.9 New separate mechanism-design fork — parent review before any question

**PRESELECTION HISTORY; ROUTE DECISION RESOLVED.** This consequential design fork reopens no root, accounting, model or realm choice. At this earlier checkpoint no option was selected or proven viable; the later [§14 selection ledger](#14-sealed-launch-selection-ledger--design-investigation-only) selects B for design investigation only. The A/fs-verity and C alternatives below are retained history, not active fallback/switch paths. No option is qualified for capture/execution; the full file/API/recipe/invoice plan remains unapproved.

| Option | Actionable design-only next deliverable | Boundary retained |
|---|---|---|
| **A — Qualify existing protected backing** | Develop a minimal-scope qualification contract for existing backing, actual static/native closure, ordinary non-HSM kernel exclusion or already enabled fs-verity. Enumerate exact required evidence and later permissions; if the existing object cannot qualify, STOP. | No implicit dependency, mount, provisioning, inspection or execution. A may be the minimal-scope candidate, but no viable local backing is proved. |
| **B — Develop sealed-executable launch** | Propose an explicit design extension for a reviewed SAFE executable-FD interface/dependency/features and bootstrap/provisioning classification, preserving `forbid(unsafe_code)`, full policy and all caps. | Exact API/graph/libraries/licenses/capture and grants stay OPEN. Explicit approval must precede adding dependency/provisioning concepts to the full plan. No dependency/file/package/build/system change or allowance handoff now. |
| **C — Keep scope frozen** | Record immutable-loading and physical-custody gates as STOP; continue only other design specifications without a GO claim. | No new mechanism, dependency, provisioning or operational approval; no positive Native authority or readiness. |

The later route-B design selection does not approve consequential dependency/interface, bootstrap-classification or full-plan decisions. Do not repeat this resolved route question. This appendix asks no approval question and creates no operation packet. It grants no commands, tests, hashes, Git action, agents, installed-root/proc/PATH/log/control/receipt/socket/daemon access, network, source edits, dependency acquisition, capture, build or native execution. Parent owns the current PLAN-prefix update and subsequent review; earlier publication and selection-review records do not approve the later dossier.

Final read-only §13/navigation reviews: Adversarial `ses_e9fb73f0cffee44FNIWTHFLQ3P` and Security `ses_e9fb73e93ffer3SIUS7vuXoWTp` reported no findings, DOCS READY yes and READY TO PRESENT the three new DESIGN-ONLY options yes. Lead document checks passed four-file scope, published-history/frozen-program/model preservation,15 local links/anchors and whitespace. No model rerun or local kernel/process/backing qualification ran. These presentation verdicts select no mechanism, dependency, provisioning, realm or operation.

Preserve all accepted N1–N10, F1 fees/source/calls, O9, native DTO/protocols, Configuration26, Versions21, the public nonterminal AFTER-BEGIN visitor, no refund/no extra1M, separate generator2048 and the existing clocks/cleanup. The §9 model fence, parent-reported SHA-256 `9670d444402a5e220bc84c00b1e519450a4a3cff0dd59441ce13d312d10028bd`,5017 bytes/190 lines and561348 assertions remain untouched historical arithmetic evidence, not a new run. All five exclusions remain: full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration and training-readiness are not established. `trainingReady:false`.

## 14. Sealed-launch selection ledger — design investigation only

**[Unverified] ROUTE B DESIGN-SELECTED / SAFE SYSCALL CANDIDATE IDENTIFIED / BOOTSTRAP CLASSIFICATION + TIME ORIGIN OPEN / NO LOCAL QUALIFICATION / FULL PLAN + IMPLEMENTATION + OPERATIONS UNAPPROVED · trainingReady:false.**

| Date | Actual instruction excerpt | Prior recommendation / effective scope | Not granted |
|---|---|---|---|
| 2026-10-21 | `agreed, proceed with your choice` | `Design sealed launch`: select route B for DESIGN INVESTIGATION ONLY, not a literal TUI selection. Develop the staged contract and supplied safe-API catalog in [native-ingress-sealed-launch.md](native-ingress-sealed-launch.md). | No R-OUT/R-IN architecture, accepted Native API, full file/API/recipe/invoice plan, nix dependency, host provisioning, source implementation or operational permission. |

The dossier specifies independent static-ELF expectations; proposed bounded fixed-artifact preparation; verified content seals before same-FD hashing; exact-FD native exec with one same-object binding FD; and paid owner initialization comparing actual `/proc/self/exe` live dev/inode against that object. These are proposed obligations, not observed object/seal/exec/proc properties or authority constructors. Dynamic loader/DSO alternatives and protective A/fs-verity/C routes are not selected fallbacks.

Preparation classification is PROPOSED, NOT ACCEPTED. Any pre-owner owed public work means STOP; no relabeling as free provisioning, post-hoc debit, escrow, meter restoration/continuation across exec or re-exec of an active owner follows. The trusted launch-staging role, safe spawn/handoff, earlier clock origin and startup control gates remain OPEN. No fresh10s, serialized Instant or remaining-ms flag solves them here.

DIRECT remains ONE inclusive1_048_576 counter for BOTH seats and unchanged F1 plus all owed public work, with original cold10s/lifecycle300s/reserved3s cleanup and separate generator2048. Exact dependency/interface approval, source/native graph, installed-byte/static-artifact recipe, fees and finite physical envelopes precede code/build/full-plan freeze. Source/API research is not installed-cache, kernel/configuration, custody or runtime qualification.

The four existing continuation drafts remain retained; this new dossier makes five-draft scope including the parent-owned PLAN prefix. No previous publication, consumed M1/M2/query/receipt grant, accepted bf38 mapping or model/program bytes change or renew. No new model/script/test/hash/source read or runtime probe ran. The original arithmetic fence, its5017 bytes/190 lines and historical561348 assertions retain their old scope. All five exclusions and `trainingReady:false` remain. Parent handles PLAN navigation and review; no automatic publication follows.

## 15. TS-to-Rust bootstrap correspondence and remaining gates

**[Unverified] 2026-10-22 · SOURCE AUDIT DOCUMENTED / NOT RUNTIME QUALIFIED / NO F9 RUST BOOTSTRAP FEE OR CONSTRUCTOR SELECTED · trainingReady:false.**

### 15.1 Authorization, baseline and correction

Executor selected `Audit coverage (Recommended)`, then authorized three planning-document updates, not a policy exception.
Parent owns the PLAN-prefix update; this appendix and [sealed-launch §15](native-ingress-sealed-launch.md#15-preparation-classification-and-original-launch-clock) own the two dossier additions.
The supplied source baseline is `6c146887`; the user-approved documentation worktree is `/tmp/opencode/f9-bootstrap-correspondence`, branch `docs/f9-bootstrap-correspondence`.
Earlier UNCOMMITTED/unpublished labels describe their prior checkpoints, not current publication proof.
Parent handles subsequent review and authorized Git/publication steps; this appendix asserts no completed verification, publication or PR outcome.

Supplied source-audit advice comes from Architect `ses_e9dcf2e92ffekmMxRwwSm277dY` and Backend `ses_e9dcf2e91ffeIDkPqyqm1MqgB5`.
The keeper did not execute the cited source or tests; SOURCE INSPECTED below describes supplied audit evidence only.
The earlier assertion that a bootstrap root base case necessarily needs invention was too broad: the TS source already supplies a concrete private construction/admission base case.
That correction does not make TS B1 automatically valid for Rust or select its fees, constructor or authority boundary for F9.
No agent selected a new bootstrap root; the architect's earlier `Selected` wording was withdrawn, not a human decision.
Root A and DIRECT retain only their existing design-selection scope; the exact Rust bootstrap mechanism remains OPEN.

### 15.2 Supplied TS source facts — not transferable authority

All TS paths in this subsection are relative to `packages/starchess-training/`.

| Source anchor | Audited fact / limit |
|---|---|
| `src/economic/invoices.ts:21–26` | Bootstrap2048 + gate512 + closure512 =3072. These TS constants are not selected F9 Rust coefficients. |
| `src/economic/ownedKernel.ts:374–382` | The actual private constructor initializes used from that source constant, without a prior ledger debit, in private UNADMITTED state. This is the TS construction base case, not general caller-provided credit. |
| `src/economic/ownedKernel.ts:385–388` | Successful admission adds512, producing3584. Neither3072 nor3584 is the whole F9 cost. |
| `src/coordinator/constructionAccounting.ts:90–98`; `src/economic/accountingPrimitives.ts:16–21` | `reservePrimitive(0,3072)` uses validated arithmetic. It is not transferable paid credit or permission to adopt UnboundStorage; B1 prohibits that adoption. |
| `src/coordinator/sourcePolicy.ts:15–19` | The policy constrains the exact TS constructor/module/importer/types. Those TS source restrictions do not establish Rust cross-crate privacy. |
| `src/coordinator/planningScope.ts:64–80` | TS planning checks authorization permit, source and model before construction. This is TS PLAN scope, not an F9 PlanPermit or authority import. |
| `src/coordinator/sourceBootstrap.ts:252–262,282–285` | Explicit `RUNTIME_IMAGE_BINDING_UNSUPPORTED` occurs before source-seal publication. Positive runtime-image binding is NOT qualified. |
| `src/__tests__/planningLedger.test.ts:40–60,149–166,181–189` | SOURCE INSPECTED, NOT EXECUTED. These test anchors establish no new PASS or Native-runtime evidence. |

### 15.3 Correspondence — existing code versus F9 obligation

| Concern | Existing TS / existing Rust | Remaining F9 contract |
|---|---|---|
| Construction root | TS private3072 initialization above; Rust `packages/training/src/ledger/work.rs:34–70` starts used0. | Specify exact Rust operations and one nonduplicable owner construction/debit base case. No automatic3072 port, caller-selected used/cap or exec restoration. |
| Ordinary charge | TS construction does not redefine Rust `work.rs:61–70`: failed charge leaves used unchanged and does not poison the primitive. | Preserve that public API; a failed F9 wrapper revokes independently and retains successful prior expenditure. |
| F1 lending | Rust `packages/training/src/feature_input.rs:98–133` takes the same mutable counter; existing ENTRY128 and other F1 fees remain. | BOTH seats share ONE inclusive1_048_576 allowance. Each bounded N5 replay owes its existing charged-replay fees; do not double-bill covered work within an invocation or renew logical slots. No root-bootstrap inference follows. |
| Private host boundary | TS constructor/import graph is source-constrained; Rust private fields are not a cross-crate friend mechanism. | Audit the actual closed graph and one-time creation. No constructor API is selected; do not assign training a public constructor or treat arena `pub(crate)` as friendship. |
| Admission | TS PLAN authorization/model checks are not F9 authority. | Check independent expected source and actual runtime evidence; no PlanPermit/A2/model-history gate port. Accounting alone grants no Native authority. |
| Absorbing failure | Non-poisoning `LedgerWork` remains unchanged. | Wrapper failure preserves spent work, blocks normal work/new loans and permits only bounded, already-covered mandatory cleanup; no replacement allowance. |
| Live staging | Proposed `NativeActive` loans are live before close, not post-close audit objects. | Validate every read and before/after callbacks. A late postcheck rejects future/staged publication, not prior reads or private F1 state through imaginary rollback. |
| Close | F9 still requires exact EOF/reap before FINAL audit acceptance. | Revoke/quiesce before wait/reap; do not move all live handoff after closure. Forced teardown is not positive clean-close proof. |
| Original clock | `apps/arena/src/economic_client.rs:70–90` creates fresh resources/now+10s; `apps/arena/src/economic.rs:711–719` replaces them per window in the legacy path. | Legacy behavior is not F9 renewal permission. Bind the original launch origin through all required live gates. |

### 15.4 Disjoint invoice and boundary still to freeze

| Invoice partition | Required coverage, not a new fee schedule |
|---|---|
| Root/control construction | Account once for construction/debit, first gate and bounded failure coverage; specify the base case before effects. |
| Actual runtime binding | Cover actual FD type, seals, length, digest, dev/inode, source comparison and copies, distinct from artifact preparation. |
| Additional control/staging/publication | Cover each additional check, bounded read/copy and staging/publication operation without overlapping another partition. |
| Existing F1 | Retain the old F1 schedule separately and lend the SAME counter; do not bill its work twice. |
| Closing/failure | Cover actual mandatory close/failure work before effects; reserve physical cleanup time without creating free public work. |

These partitions select no coefficients, free credit or complete1M/physical-fit claim.
Do not invent a new global exception unless an exact proposed operation demonstrates a concrete conflict requiring human decision.
Closed loading/source graphs, trusted artifact/host/kernel/launcher premises, actual Node custody, full policy/init and continuing checks remain independently required.

### 15.5 Remaining gates and future tests — NOT RUN

Freeze exact Rust bootstrap operations/private boundary, source-audited disjoint invoice/first-failure coverage, safe clock/custody mechanisms and bounded recipes/envelopes first.
Bring consequential choices to Executor when concrete options are ready; no pending choice is needed to document these OPEN obligations.
Full-plan review, exact implementation approval and operational approval remain separate gates.

| Future verification family | Required refusal / continuity case — NOT RUN |
|---|---|
| Owner uniqueness | Duplicate owner, caller-supplied used/cap and exec restoration yield no substitute authority. |
| Refusal semantics | Failed charge revokes the wrapper while leaving ordinary `LedgerWork` semantics and prior expenditure unchanged. |
| Shared F1/replay | Both seats and bounded immediate replay use one counter; charge each replay's existing fees without double-billing its covered work or renewing logical slots. |
| Actual identity | Same hash with wrong dev/inode fails; descriptor claims cannot replace actual binding. |
| Live borrow/staging | Expiry and late postchecks prevent final staged acceptance without claiming rollback of prior reads/private state. |
| Lifecycle | EOF/reap and launch/load timing remain under the original origin, including failure cleanup. |

Preserve accepted bf38/D1/B1/O9, N1–N10, inclusive1_048_576, cold10s, lifecycle300s including reserved3s, separate generator2048, unchanged F1, gameplay gas/minerals/H1 and native DTO/protocol/Configuration26/Versions21 labels.
All five exclusions remain; no collection, fitting, training, activation or readiness follows. `trainingReady:false`.

## 16. Earlier-owner topology comparison — source-only STOP

**[Unverified] DESIGN INVESTIGATION ONLY.** Executor selected `Earlier owner`, not an authority realm, interface, fee, exemption, implementation or operation. Compare conditional accounting continuity separately from **actual** Node process/stream custody. [§3](#3-user-selected-design--one-direct-owner-one-direct-counter) requires one `LedgerWork` directly lent to F1; [§6](#6-one-time-origin-and-bounded-completion) keeps `t0=S0` and forbids renewal. [`LedgerWork::new/charge`](../../packages/training/src/ledger/work.rs#L34-L70) starts used0 and retains successful charges; [`FeatureInputPair`](../../packages/training/src/feature_input.rs#L97-L138) takes local `&mut LedgerWork`. Neither API supplies cross-process authority.

| Topology | Accounting / first STOP | Actual Node/stream custody / source-only discriminator |
|---|---|---|
| **A · Trusted Rust owner stays host** | **Conditional continuity only:** an independently trusted issuer must capture original `S0` before ALL applicable launch-causal work; after qualified G1, independently trusted captured immutable host Rust creates the sole direct used0 meter, retains and validates original `S0` through a qualified nonrenewing bridge (OPEN), and keeps local `&mut` F1 loans in one address space. Its first successful debit must precede the earliest owed effect. STOP before any unpaid pre-owner effect or untrusted owner; no later origin/constructor may replace either resource. | **R-OUT STOP:** even if the counter is continuous, no independently qualified actual main/reference Node handles exist before PID-derived `/proc` access, nor independently bound attachment→actual Node FD0/1/2 routes. [R-OUT observer class 2](native-ingress-r-out-observer-packet.md#class-2--ownership-and-conditional-proc-candidates) and its [published-interface assessment](native-ingress-r-out-observer-packet.md#r-out-published-interface-assessment--design-only) leave both joins unsolved. [`WorkerTransport`](../../apps/arena/src/worker_transport.rs#L72-L135) and [`bridge`](../../apps/arena/src/bridge.rs#L75-L127) retain **host** PATH/tsx Node children and local streams, not container capture. |
| **B · Host owner then `execve` into container** | **STOP at exec:** [`execve(2)`](https://man7.org/linux/man-pages/man2/execve.2.html) replaces the caller's program/address space, including its Rust heap and meter; retained non-CLOEXEC FDs do **not** retain `LedgerWork` or `FeatureInputPair`. Continuing after exec would require prohibited restoration/serialization or a second meter. Exec alone does not move the caller into a Docker container. [`setns(2)`](https://man7.org/linux/man-pages/man2/setns.2.html) changes PID placement for **future children**, not the caller; user/mount/PID changes have capability and shared-state/multithread restrictions. Native in-process namespace/privilege movement is neither qualified nor approved. | Even a surviving FD is not an authenticated container→actual Node child or attachment→FD0/1/2 route. Namespace entry alone does not supply the unchanged Docker full-policy container, live root or actual FD custody; [R-OUT observer](native-ingress-r-out-observer-packet.md#class-2--ownership-and-conditional-proc-candidates) remains STOP. Source discriminator: local Rust meter/borrow signatures above versus the process-replacing `execve` contract; no repo source shows a continuous counter through exec. |
| **C · Host owner delegates to inner Rust** | **STOP at first owed cross-process effect:** local `&mut LedgerWork` cannot traverse the process boundary. A remote ACK or serialized balance alone, or historical outer prepayment, is **not DIRECT**. An outer owner directly charging each effect on **F1's actual same counter** would require independently qualified synchronous before-effect control, actual peer/process/FD identity and live issuance/accessor gates; no such API/channel exists. See [R-IN gated-start](native-ingress-r-in-custody-contract.md#gated-start-partial-order-and-bootstrap-cycles--stop). | Two inner Node children might conditionally simplify local pipe custody, not prove captured child identity, inherited FD isolation or causal outer-policy→inner use. [`run.mjs:144–172`](../../packages/starchess-arena/hermetic/run.mjs#L144-L172) creates/inspects/attaches a **Node** container, never an inner Rust owner or bound live gate; [`WorkerTransport`](../../apps/arena/src/worker_transport.rs#L72-L135) is host-only. STOP before treating either as actual inner custody. |
| **D · One initial inner owner (gated-start comparison)** | **STOP before launch** if any required pre-owner public posture, trust, startup or cleanup effect cannot be paid on its future meter. First control message, independent initial trust, original `S0` bridge and live outer→inner gate remain unresolved; moving initial ownership inward is not an *earlier* owner without a new accepted mechanism. [R-IN gated-start rows 0–5](native-ingress-r-in-custody-contract.md#gated-start-partial-order-and-bootstrap-cycles--stop). | Conditional direct inner children are not yet independently bound to captured binaries, FD routes, actual init/root or unchanged full policy. Existing [`run.mjs:144–172`](../../packages/starchess-arena/hermetic/run.mjs#L144-L172) launches Node, not Rust. STOP before positive authority. |

**Disposition: no qualified topology; STOP.** Keep ONE **1_048_576 DIRECT** counter for BOTH seats, unchanged F1 fees and successful failure prefix, original cold **10s** and lifecycle **300s including final 3s** cleanup, and unchanged full policy/init and accepted N1–N10. Local kernel, daemon, namespace and permission facts remain unverified. This source comparison creates no new operation, mock, root/proc/daemon read, Native proof, training or approval; `trainingReady:false`.
