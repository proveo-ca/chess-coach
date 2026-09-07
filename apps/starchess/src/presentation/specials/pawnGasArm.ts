/**
 * Compat shim — owned by `presentation/specials/arms/marineGas.ts`
 * (`marineGasArm`) and `presentation/specials/queue.ts`
 * (`specialTimingFor`, `tryQueue`). Deleted in plan phase 5.
 * // SPEC: _spec/apps/starchess/turn-input-sequence.puml
 */
export { specialTimingFor, tryQueue } from "~/presentation/specials/queue";
export { marineGasArm as pawnGasArm, marineGasArm } from "~/presentation/specials/arms/marineGas";
