# Private staged runtime protocol

## Goals

Use closed versioned JSON through independently owned main/reference child pipes.
Worker requests contain game operations and exact session/cursor bindings, never executable paths, hidden state, expected-artifact replacements or readiness booleans.
Only trusted launcher configuration selects fixed source-bound entrypoints and artifact expectations.
The protocol does not treat hashes or JSON parsing as runtime authority.

## Transaction

Each worker stages init/open/settlement without publishing a committed successor.
The coordinator validates both bounded results and independently compares their normalized canonical data.
It checks each recipient's next local boundary and contiguous event sequence against its committed prefix.
It ACKs the exact staged data only after all comparison checks pass.
It publishes the BOTH successor only after both commit acknowledgements pass.
If one worker commits and the other fails, the attempt fails and both processes must stop.
No partial public successor, rollback claim or continuing retry follows.

Each direction uses contiguous message ordinals.
Exact duplicate request bytes may return the same previously completed reply without reexecuting game work or facts.
Conflicting duplicates, gaps, wrong recipients/sessions/cursors and pending-operation reentry fail.
The coordinator owns the channel objects and never accepts a worker-supplied process or pipe identity.

## Modes and lifecycle

Native-proof mode permits exactly canonical init, open, pass/pass settlement and close.
It rejects model/feature/sampling/learning work and nonpass planning.
Policy mode retains checked stage barriers and fixed precommit observations; ACK precedes one private whole-pair admission.
No policy or opponent result exposes the first seat's queue to the other seat.

Close requires no pending transaction.
The positive native-proof close follows the completed pass boundary.
The close reply is not EOF or successful process reap.
The owned transport must separately close stdin, drain bounded stdout/stderr to EOF and observe successful exit/reap for both children.
Any deadline, byte, parse, comparison, stream or lifecycle failure revokes the attempt.
No clock reset, replacement child or fallback reference exists.

## Verification boundary

Unit tests may use explicit synthetic drivers/transports.
They cannot establish actual independent-reference execution, confinement, effective cgroups or the cold F9 positive.
Real F9 and runtime qualification require their separate fresh operational grants.
Keep the final `trainingReady` acceptance outside worker-controlled data.
