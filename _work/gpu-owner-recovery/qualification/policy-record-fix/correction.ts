// SPEC: _spec/gpu-host-build.puml
export const baselineCommit = "65febc83b9ab6e043b233f03d390d6b262538118";
export const nativePath = "crates/policy-io/tests/gpu.rs";
export const beforeWrite = "fs::write(&record_path, &record).unwrap();";
export const afterWrite = "fs::write(&record_path, &*record).unwrap();";
const header = "fn cuda_f64_policy_channel_subprocesses_agree_and_reload() {";
type Source = { path: string; sha256: string };

export function assertRecordSliceCorrection(before: string, after: string) {
  const start = before.indexOf(header), end = before.indexOf("\n}", start);
  if (start < 0 || end < 0 || before.split(header).length !== 2 || before.split(beforeWrite).length !== 2
    || !before.slice(start, end).includes(beforeWrite) || after !== before.replace(beforeWrite, afterWrite)) {
    throw Error("EXACT_GPU_POLICY_RECORD_SLICE_CORRECTION_REQUIRED");
  }
}

export function assertNativeGenerationDelta(before: Source[], after: Source[]) {
  if (before.length !== 65 || after.length !== 65 || new Set(before.map(row => row.path)).size !== 65
    || JSON.stringify(before.map(row => row.path)) !== JSON.stringify(after.map(row => row.path))) throw Error("UNCHANGED_NATIVE65_MEMBERSHIP_REQUIRED");
  const changed = before.filter((row, index) => row.sha256 !== after[index]!.sha256).map(row => row.path);
  if (changed.length !== 1 || changed[0] !== nativePath) throw Error("ONLY_GPU_POLICY_RECORD_SOURCE_MAY_CHANGE");
  return changed;
}
