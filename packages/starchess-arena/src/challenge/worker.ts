// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { createInterface } from "node:readline";
import { runChallengeMatch } from "./runChallengeMatch";
import type { ChallengeProgress, ScheduledMatch } from "./types";

const send = (message: unknown) => {
  process.stdout.write(`${JSON.stringify(message)}\n`, (error) => {
    if (error) process.exit(1);
  });
};

let requested = false;
createInterface({ input: process.stdin }).on("line", async (line) => {
  const message: unknown = JSON.parse(line);
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
send({ kind: "ready" });
