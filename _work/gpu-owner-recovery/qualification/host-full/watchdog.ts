// SPEC: _spec/gpu-full-qualification.puml
import { fullSelectors, requireValue, type FullPlan } from "./plan";

export function progressWatchdog(p: FullPlan, now: () => number) {
  let prefix = "", sequence = 0, active = false, complete = false, progress = 0, total = 0, started = 0, finished = 0;
  let samples = 0, lastQueryStartedMs = -Infinity, lastClock = -Infinity, failure: string | null = null;
  const fail = (reason: string): never => { failure ??= reason; throw Error(failure); };
  const clock = () => {
    const value = now();
    if (!Number.isFinite(value) || value < lastClock) fail("WATCHDOG_MONOTONIC_CLOCK_REQUIRED");
    lastClock = value;
    return value;
  };
  const fresh = () => {
    if (failure) throw Error(failure);
    const time = clock();
    if (active && !complete && time - progress >= p.guard.maxSampleAgeMs) fail("GPU_SAMPLE_PROGRESS_STALE");
  };
  return {
    read(text: string) {
      try {
        fresh();
        requireValue(Buffer.byteLength(text) <= p.limits.journalBytes && text.startsWith(prefix), "JOURNAL_BOUND_OR_PREFIX_CHANGED");
        const end = text.lastIndexOf("\n") + 1;
        for (const line of text.slice(prefix.length, end).split("\n").filter(Boolean)) {
          const e = JSON.parse(line);
          requireValue(!complete && e.version === "chess-coach.gpu-full-event.v1" && e.runId === p.runId && e.sequence === ++sequence, "JOURNAL_EVENT_IDENTITY_OR_ORDER");
          switch (e.kind) {
            case "guard-start": requireValue(!active && sequence === 1, "GUARD_START_ORDER"); active = true; progress = clock(); break;
            case "sample":
              requireValue(active && e.uuid === p.selectedUuid && Number.isSafeInteger(e.freeBytes) && Number.isSafeInteger(e.totalBytes)
                && e.totalBytes > 0 && e.freeBytes >= 0 && e.freeBytes <= e.totalBytes && Number.isFinite(e.queryStartedMs) && e.queryStartedMs >= 0, "JOURNAL_SAMPLE_REQUIRED");
              requireValue(e.query === samples + 1 && e.query <= p.limits.telemetryQueries
                && e.queryStartedMs - lastQueryStartedMs >= p.guard.sampleIntervalMs, "JOURNAL_SAMPLE_QUERY_ORDER");
              requireValue((total === 0 || total === e.totalBytes) && e.freeBytes >= (total === 0 ? p.guard.startupMinFreeBytes : p.guard.runningStopBelowFreeBytes), "JOURNAL_SAMPLE_CAPACITY_OR_HEADROOM");
              samples++; lastQueryStartedMs = e.queryStartedMs; total = e.totalBytes; progress = clock(); break;
            case "attempt-start": requireValue(active && total > 0 && started === finished && started < 6 && e.id === fullSelectors[started], "JOURNAL_ATTEMPT_ORDER"); started++; break;
            case "attempt-finish":
              requireValue(active && started === finished + 1 && finished < 6 && e.id === fullSelectors[finished], "JOURNAL_ATTEMPT_ORDER");
              requireValue(e.status === "PASS" && e.accepted === true, "JOURNAL_ATTEMPT_NOT_ACCEPTED"); finished++; break;
            case "abort": requireValue(typeof e.reason === "string" && e.reason.length > 0, "JOURNAL_ABORT_REASON"); fail("DRIVER_ABORT:" + e.reason);
            case "done": requireValue(active && total > 0 && fullSelectors.length === 6 && started === 6 && finished === 6, "JOURNAL_COMPLETE_SIX_REQUIRED"); complete = true; break;
            default: fail("JOURNAL_EVENT_KIND");
          }
        }
        prefix = text.slice(0, end);
        fresh();
      } catch (error) { fail(error instanceof Error ? error.message : "JOURNAL_INVALID"); }
    },
    finish(text: string) {
      try {
        this.read(text);
        requireValue(complete && text === prefix && failure === null, "COMPLETE_DRAINED_GUARD_JOURNAL_REQUIRED");
        return { guardComplete: true, events: sequence, samplesTotalBytes: total };
      } catch (error) { return fail(error instanceof Error ? error.message : "JOURNAL_INVALID"); }
    },
    fresh,
  };
}
