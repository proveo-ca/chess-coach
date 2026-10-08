import { createInterface } from "node:readline";

const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`);
createInterface({ input: process.stdin }).on("line", () => {
  send({ kind: "phase", phase: "candidate-plan", planningOrdinal: 0, turn: 0, side: "w" });
  setTimeout(() => send({ kind: "phase", phase: "settlement", planningOrdinal: 0, turn: 0 }), 20);
  setInterval(() => {}, 1000);
});
send({ kind: "ready" });
