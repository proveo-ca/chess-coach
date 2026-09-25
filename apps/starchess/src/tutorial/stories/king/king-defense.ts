// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const kingDefense = {
  id: "king-defense",
  title: "King Defense",
  board: {
    scfen: "SCFEN|7k/8/8/8/8/8/7b/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:C=h2g3",
    stored: 4,
    choreography: "kingDefenseOpening",
  },
  comment: "",
  emotion: "shocked",
  completeWhen: { kind: "lost", pieces: ["b"] },
  restartWhen: { kind: "lives", own: 0 },
  beats: [
    // Mecha gone (no `b` in the placement) — the Command Center is no
    // longer under attack, so the panic line below must not ride out the
    // win. First, because reactions stick: only another reaction retires
    // the one before it.
    {
      when: { kind: "lost", pieces: ["b"] },
      say: "Mecha down!",
      emotion: "happy",
    },
    {
      when: { kind: "scfen", re: /B=deploy:/ },
      say: "Attack the Mecha!",
      emotion: "watching",
    },
    {
      // CC down to 2 HP *while the Mecha is still alive* — the `b` is what
      // makes "deploy a Marine to save it" actionable advice.
      when: { kind: "scfen", re: /SCFEN\|[^|]*b[^|]*\|\d+\|2[0-3]\|/ },
      say: "Your Command Center is under attack! \nDeploy a Marine to save it.",
      emotion: "shocked",
    },
    {
      when: { kind: "scfen", re: /deploy:[^:;]*:f2/ },
      mark: { squares: ["g3"], arrows: [{ from: "f2", to: "g3" }] },
    },
    {
      mark: { squares: ["f2"], arrows: [{ from: "e1", to: "f2" }] },
    },
  ],
} satisfies TutorialStoryScript;
