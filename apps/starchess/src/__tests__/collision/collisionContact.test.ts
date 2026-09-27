import { describe, expect, it } from "vitest";

import { addScAction, endScTurn, parseScFen, placementToMap } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import { moveDurationMs as pieceMoveDurationMs } from "~/presentation/animations/moveTiming";
import { SETTLE_MS } from "~/presentation/constants";
import { playTimeline, projectResolveTimeline } from "~/presentation/timeline/timelinePlayer";
import { moveDurationMs } from "~/presentation/timeline/timings";
import type { TimelineCommitPatch } from "~/types/match";

type Commit = { t: number; patch: TimelineCommitPatch };

/** Virtual clock: jobs run in time order, and every commit is stamped with its time. */
const play = (scfen: string, white?: { from: Square; to: Square }) => {
  let snap = parseScFen(scfen);
  if (white) {
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: white.from, to: white.to },
    }).snapshot;
  }
  const result = endScTurn(snap, { skipTurnStartChecks: true });
  let now = 0;
  let seq = 0;
  const jobs: { at: number; seq: number; fn: () => void; live: boolean }[] = [];
  const scheduler = {
    delay: (ms: number, fn: () => void) => {
      const job = { at: now + ms, seq: seq++, fn, live: true };
      jobs.push(job);
      return () => {
        job.live = false;
      };
    },
  };
  const commits: Commit[] = [];
  playTimeline(result, scheduler, {
    onStart: () => {},
    onCommit: (patch) => commits.push({ t: now, patch }),
    onDone: () => {},
  });
  for (let i = 0; i < 2_000; i++) {
    const live = jobs.filter((j) => j.live).sort((a, b) => a.at - b.at || a.seq - b.seq);
    const job = live[0];
    if (!job) break;
    job.live = false;
    now = job.at;
    job.fn();
  }
  return { result, cues: projectResolveTimeline(result), commits };
};

const deathIds = (cues: ReturnType<typeof projectResolveTimeline>, at: Square) =>
  cues.filter((c) => c.kind === "death" && c.at === at).map((c) => c.id);

const firstCommitPlaying = (commits: Commit[], ids: string[]) =>
  commits.find((c) => ids.some((id) => c.patch.playingIds?.includes(id)));

const slideMs = (from: Square, to: Square) => moveDurationMs(from, to, { stim: false });

describe("move-phase collisions meet at the contact square", () => {
  it("defense-4: Mecha e5→h2 and Tank e2→h2 die on h2 the moment they meet, not after parking", () => {
    const { cues, commits } = play(
      "SCFEN|k7/8/8/4B3/8/8/4r3/5NPK|1|13|P|G:11:11|Q:w:;b:C=e2h2",
      { from: "e5", to: "h2" },
    );
    const movers = cues.filter((c) => c.kind === "move");
    expect(movers.map((m) => (m.kind === "move" ? `${m.from}${m.to}` : "")).sort()).toEqual(["e2h2", "e5h2"]);
    const deaths = cues.filter((c) => c.kind === "death" && c.at === "h2");
    expect(deaths).toHaveLength(2);
    expect(deaths.every((d) => d.kind === "death" && d.collision)).toBe(true);

    const contact = Math.max(slideMs("e5", "h2"), slideMs("e2", "h2"));
    const start = firstCommitPlaying(commits, deathIds(cues, "h2"))!;
    expect(start.t).toBe(contact);
    expect(start.t).toBeLessThan(contact + SETTLE_MS);

    const moverIds = movers.map((m) => m.id);
    expect(moverIds.some((id) => start.patch.playingIds?.includes(id))).toBe(false);
    const board = placementToMap(start.patch.placement!);
    expect(board.has("e5")).toBe(false);
    expect(board.has("e2")).toBe(false);
  });

  it("leaper vs slider: a Hoverbike and a Tank landing on h3 die when the later one touches down", () => {
    const { cues, commits } = play(
      "SCFEN|k7/8/7r/8/8/8/5N2/K7|1|33|P|G:11:11|Q:w:;b:C=h6h3",
      { from: "f2", to: "h3" },
    );
    const ids = deathIds(cues, "h3");
    expect(ids).toHaveLength(2);
    const contact = Math.max(pieceMoveDurationMs("f2", "h3", "n"), slideMs("h6", "h3"));
    expect(firstCommitPlaying(commits, ids)!.t).toBe(contact);
  });

  it("a Command Center taking a unit at contact: only the unit dies, the Command Center lands", () => {
    const { cues, commits } = play(
      "SCFEN|k7/8/8/8/8/4r3/8/3K4|1|33|P|G:11:11|Q:w:;b:C=e3e2",
      { from: "d1", to: "e2" },
    );
    const deaths = cues.filter((c) => c.kind === "death" && c.at === "e2");
    expect(deaths.map((d) => (d.kind === "death" ? `${d.color}${d.piece}` : ""))).toEqual(["br"]);
    const start = firstCommitPlaying(commits, deaths.map((d) => d.id))!;
    expect(start.t).toBe(Math.max(slideMs("e3", "e2"), slideMs("d1", "e2")));
    const last = [...commits].reverse().find((c) => c.patch.placement != null)!;
    const board = placementToMap(last.patch.placement!);
    expect(board.get("e2")).toMatchObject({ type: "k", color: "w" });
    expect(board.has("e3")).toBe(false);
  });

  it("a wave without a collision keeps its settle pacing", () => {
    const { cues, commits } = play(
      "SCFEN|k7/8/8/8/8/8/4R3/7K|1|33|P|G:11:11|Q:w:;b:",
      { from: "e2", to: "e5" },
    );
    expect(cues.some((c) => c.kind === "death")).toBe(false);
    const handBack = commits.find((c) => c.patch.placement != null && placementToMap(c.patch.placement).has("e5"))!;
    expect(handBack.t).toBe(slideMs("e2", "e5") + SETTLE_MS);
  });
});
