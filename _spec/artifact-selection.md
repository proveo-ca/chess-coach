# Independent artifact selection

Status: SOURCE IMPLEMENTED / SYNTHETIC FIXTURES ONLY / NO RUNTIME OUTPUT REGISTRATION.

`packages/runtime/src/artifacts.ts` validates a standard closed file manifest against an externally supplied SHA-256 expectation.
The trusted launcher supplies the expected hash, required roles/paths and explicit manifest/file/count/aggregate-byte limits.
Worker messages supply none of those values.
Entries use strictly increasing relative paths, positive lengths and exact SHA-256 values.
The loader rejects traversal, missing roles, duplicates, substituted bytes, changed lengths and symlink components.
It hashes selected files sequentially with a bounded buffer.
Its returned data does not create execution authority or Gate0 acceptance.

## Trust and registration boundary

C1 trusts the operator-controlled immutable artifact store, host, manager and kernel.
This source does not implement same-opened-object execution custody or defend against hostile concurrent host mutation.
The supported read-only image and selected native-library/runtime closure remain separately qualified prerequisites.
The loader cannot infer that an unlisted file belongs to the selected executable closure.
The selected Cargo/compiler/native and TypeScript resolution inventories must supply that complete list.

Before any capture/build request, Executor must accept the required output roles, fixed runtime layout, explicit limits and registration procedure.
After that separately authorized build, register actual image/config/runtime/init/native-library/worker/reference/scorer/learner outputs against the frozen source and recipe.
Register the physical manifest bytes and their external hash independently before qualification selection.
Do not select new expectations from a worker report or silently refresh pins after failure.

`packages/runtime/tests/artifacts.test.ts` uses temporary synthetic files and independently held fixture pins.
Those fixtures do not register a real image, runtime or model.
C9 selects resource/storage/FD design ceilings.
Actual CPU placement, C13 storage target, independently frozen source/recipe expectations and Executor Gate0 acceptance remain open.
The explicit input roles and output-registration method are in [gate0-packet.md](gate0-packet.md).
