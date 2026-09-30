// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { runChallengeMatch } from "./runChallengeMatch";
import type { ChallengeProgress, ScheduledMatch } from "./types";

const send = (message: unknown) => {
  if (!process.send || !process.connected) throw new Error("worker IPC unavailable");
  process.send(message, (error) => {
    if (error) process.exit(1);
  });
};

let requested = false;
process.on("message", async (message: unknown) => {
  if (requested || !message || typeof message !== "object" ||
      !("kind" in message) || message.kind !== "request" || !("request" in message)) {
    process.exit(1);
  }
  requested = true;
  try {
    const evidence = await runChallengeMatch(message.request as ScheduledMatch, {
      onProgress: (event: ChallengeProgress) => send(event),
    });
    send({ kind: "complete", evidence });
  } catch {
    process.exit(1);
  }
});
process.on("disconnect", () => process.exit(0));
send({ kind: "ready" });
