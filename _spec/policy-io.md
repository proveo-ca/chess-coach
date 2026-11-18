# Standard numeric policy I/O

TypeScript owns recipient observations, candidate generation and encoding. Rust owns Burn scoring and learning. Do not create a second game engine in Rust.

`policy-score CONFIG_JSON NATIVE_RECORD` loads one standard JSON model configuration and one Burn-native record. It reads one JSON request from stdin through EOF, writes one JSON response plus LF and exits. Rust I/O and Serde own transport/serialization. No daemon, custom binary framing, bootstrap or canonical-JSON layer ships.

Configuration version `chess-coach.model-config.v1` binds `mlp-relu-32`, `chess-coach.features.v1`, input dimension 2271, hidden width 32 and native record SHA-256. Requests use `chess-coach.inference.v1`, feature version, bounded request ID, checkpoint hash, row count and row-major values. Validate exact tensor compatibility, F64 finite parameters, 1–512 rows, dimensions, finite bounded coordinates and matching model identity. Responses match IDs, feature version and row count. Serde's standard float-roundtrip feature replaces the old float-hex representation.

Input caps apply before parsing: JSON configuration 4 KiB, native record 1 MiB and request JSON 8 MiB. These caps do not implement shared OS-resource admission or original S0 deadlines. Nonfinite parameters/outputs fail. Invalid input exits nonzero with no logits on stdout. The operator supplies trusted native records; this is not an untrusted-checkpoint sandbox.

`initial-record` is a development example using seed 42, standard hidden initialization and a zero output head. It reads no game data and performs no optimizer step. Build binaries/examples before Bun process e2e tests.

Tests cover nonzero checkpoint round-trips, metadata/hash binding, F32 rejection, F64 subnormal/fraction round-trips, numerical overflow, malformed input and executable failure. The TypeScript process e2e now enumerates candidates from a validated recipient observation, encodes them, and invokes the native scorer instead of sending placeholder features or manually selected actions. The observation itself remains a synthetic fixture; no production resolver/producer or full game executes.

Versioned episode admission, shared-budget host supervision, simultaneous game resolution and rollout/evaluation remain pending. A valid config/hash does not prove producer authenticity or grant runtime/training authority.
