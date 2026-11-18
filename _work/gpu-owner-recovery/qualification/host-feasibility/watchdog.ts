// SPEC: _spec/gpu-feasibility.puml
import { feasibilitySelectors, requireValue, type FeasibilityPlan } from "./plan";

export function progressWatchdog(p: FeasibilityPlan, now: () => number) {
  let prefix = "", sequence = 0, active = false, complete = false, progress = 0, total = 0, started = 0, finished = 0;
  let failure: string | null = null;
  const fail = (reason: string): never => { failure ??= reason; throw Error(failure); };
  const fresh = () => {
    if (failure) throw Error(failure);
    if (active && !complete && now() - progress >= p.guard.maxSampleAgeMs) fail("GPU_SAMPLE_PROGRESS_STALE");
  };
  return {
    read(text: string) {
      try {
        fresh();
        requireValue(Buffer.byteLength(text) <= p.limits.journalBytes && text.startsWith(prefix), "JOURNAL_BOUND_OR_PREFIX_CHANGED");
        const end = text.lastIndexOf("\n") + 1;
        for (const line of text.slice(prefix.length, end).split("\n").filter(Boolean)) {
          const e = JSON.parse(line);
          requireValue(!complete && e.version === "chess-coach.gpu-feasibility-event.v1" && e.runId === p.runId && e.sequence === ++sequence, "JOURNAL_EVENT_IDENTITY_OR_ORDER");
          switch (e.kind) {
            case "guard-start": requireValue(!active && sequence === 1, "GUARD_START_ORDER"); active = true; progress = now(); break;
            case "sample":
              requireValue(active && e.uuid === p.selectedUuid && Number.isSafeInteger(e.freeBytes) && Number.isSafeInteger(e.totalBytes)
                && e.totalBytes > 0 && e.freeBytes >= 0 && e.freeBytes <= e.totalBytes && Number.isFinite(e.queryStartedMs), "JOURNAL_SAMPLE_REQUIRED");
              requireValue((total === 0 || total === e.totalBytes) && e.freeBytes >= (total === 0 ? p.guard.startupMinFreeBytes : p.guard.runningStopBelowFreeBytes), "JOURNAL_SAMPLE_CAPACITY_OR_HEADROOM");
              total = e.totalBytes; progress = now(); break;
            case "attempt-start": requireValue(total > 0 && started === finished && e.id === feasibilitySelectors[started] && started < 2, "JOURNAL_ATTEMPT_ORDER"); started++; break;
            case "attempt-finish": requireValue(started === finished + 1 && e.id === feasibilitySelectors[finished], "JOURNAL_ATTEMPT_ORDER"); finished++; break;
            case "abort": requireValue(typeof e.reason === "string" && e.reason.length > 0, "JOURNAL_ABORT_REASON"); fail("DRIVER_ABORT:" + e.reason);
            case "done": requireValue(total > 0 && started === 2 && finished === 2, "JOURNAL_COMPLETE_PAIR_REQUIRED"); complete = true; break;
            default: fail("JOURNAL_EVENT_KIND");
          }
        }
        prefix = text.slice(0, end);
        fresh();
      } catch (error) { fail(error instanceof Error ? error.message : "JOURNAL_INVALID"); }
    },
    finish(text: string) {
      this.read(text);
      requireValue(complete && text === prefix && failure === null, "COMPLETE_DRAINED_GUARD_JOURNAL_REQUIRED");
      return { guardComplete: true, events: sequence, samplesTotalBytes: total };
    },
    fresh,
  };
}
