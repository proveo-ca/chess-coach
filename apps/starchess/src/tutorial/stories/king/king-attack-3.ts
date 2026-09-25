// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
import type { TutorialStoryScript } from "~/tutorial/tutorialScript";

export const kingAttack3 = {
  id: "king-attack-3",
  title: "King Attack #3",
  board: {
    scfen: "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|0|33|P|G:11:11|Q:w:;b:",
    stored: 1,
    alertLatch: "king",
    opponent: "adjutant",
  },
  comment: "Remember to use your Gas and your Move each turn",
  emotion: "happy",
  completeWhen: { kind: "lives", enemy: 0 },
  beats: [
    {
      when: { kind: "lives", own: 0 },
      say: "Oh no! Give it another try, it's a lot to process",
      emotion: "shocked",
      action: {
        kind: "retryLesson",
        label: "Retry lesson",
      },
    },
    {
      when: { kind: "lives", enemy: 0 },
      say: "Thinking the same thing",
      emotion: "happy",
    },
    {
      when: { kind: "shipSniped" },
      say: "Sniped!",
      emotion: "shocked",
      transient: true,
    },
    {
      turn: 1,
      phase: "resolve",
      say: "Enemy Command Center moved, I saw where!",
      emotion: "thinking",
      transient: true,
      mark: { alertSquares: ["d5"] },
    },
    {
      when: { kind: "promotionChoice", phases: ["intent"] },
      say: "Choose your promotion wisely: \nBattleShip, risk getting sniped \nTank, worse but harder to hit",
      emotion: "thinking",
      mark: {},
    },
    {
      when: { kind: "mechaThreat", phases: ["intent"] },
      say: "Threat that Command Center with your Mecha",
      emotion: "thinking",
      mark: { arrows: [{ from: "g2", to: "a8" }] },
    },
    {
      // g2×f3 frees a Command Center deploy square. A Mecha costs 3
      // minerals and looks down g2–a8; another Marine does not. The
      // classical Attack/Move still has to be open — this is the move
      // that vacates g2.
      when: { kind: "mechaDiagonal", phases: ["intent"] },
      say: "Your Marine will vacate g2 after attacking, deploy a Mecha there instead of a Marine",
      emotion: "thinking",
      mark: { squares: ["g2"], arrows: [{ from: "g2", to: "a8" }] },
    },
    {
      // Open Attack/Move, BattleShip or Tank on h8. A nearby Marine does
      // not hide the charge — the arrows are the coaching.
      when: { kind: "chargeH8", phases: ["intent"] },
      say: "Go get 'em!",
      mark: {
        arrows: [
          { from: "h8", to: "d8" },
          { from: "d8", to: "d5", tone: "alert" },
        ],
      },
    },
    {
      // One beat for every enemy Marine on the last three ranks. The
      // arrow is the unit that stops it; a queued stop yields the next one.
      when: { kind: "stopRunner" },
      say: "Stop that Marine from promoting!",
      emotion: "shocked",
      mark: {},
    },
    {
      when: { kind: "covers", square: "e1", kinds: ["n"] },
      say: "Your Hoverbike already reaches e1 — take it, no deploy needed!",
      mark: { squares: ["e1"] },
    },
    {
      when: { kind: "covers", square: "e1", kinds: ["k"] },
      say: "Your Command Center already covers e1 — take it, no deploy needed!",
      mark: { squares: ["e1"] },
    },
    {
      when: { kind: "covers", square: "e1", kinds: ["r"] },
      say: "Your Tank already covers e1 — take it, no deploy needed!",
      mark: { squares: ["e1"] },
    },
    {
      when: { kind: "covers", square: "e1", kinds: ["b"] },
      say: "Your Mecha already covers e1 — take it, no deploy needed!",
      mark: { squares: ["e1"] },
    },
    {
      when: { kind: "covers", square: "f1", kinds: ["n"] },
      say: "Your Hoverbike already reaches f1 — take it, no deploy needed!",
      mark: { squares: ["f1"] },
    },
    {
      when: { kind: "covers", square: "f1", kinds: ["k"] },
      say: "Your Command Center already covers f1 — take it, no deploy needed!",
      mark: { squares: ["f1"] },
    },
    {
      when: { kind: "covers", square: "f1", kinds: ["r"] },
      say: "Your Tank already covers f1 — take it, no deploy needed!",
      mark: { squares: ["f1"] },
    },
    {
      when: { kind: "covers", square: "f1", kinds: ["b"] },
      say: "Your Mecha already covers f1 — take it, no deploy needed!",
      mark: { squares: ["f1"] },
    },
    {
      when: { kind: "covers", square: "g1", kinds: ["n"] },
      say: "Your Hoverbike already reaches g1 — take it, no deploy needed!",
      mark: { squares: ["g1"] },
    },
    {
      when: { kind: "covers", square: "g1", kinds: ["k"] },
      say: "Your Command Center already covers g1 — take it, no deploy needed!",
      mark: { squares: ["g1"] },
    },
    {
      when: { kind: "covers", square: "g1", kinds: ["r"] },
      say: "Your Tank already covers g1 — take it, no deploy needed!",
      mark: { squares: ["g1"] },
    },
    {
      when: { kind: "covers", square: "g1", kinds: ["b"] },
      say: "Your Mecha already covers g1 — take it, no deploy needed!",
      mark: { squares: ["g1"] },
    },
    {
      when: { kind: "trajectory", from: "g2", to: "d5" },
      say: "You have 3 minerals — deploy a Mecha on g2, then take d5!",
      mark: { squares: ["g2", "d5"], arrows: [{ from: "g2", to: "d5" }] },
    },
    {
      when: { kind: "board", at: { d5: "k", c2: "N" }, notQueued: { kind: "spiderMine", from: "c2" } },
      say: "Deploy a mine in c2 to discourage Marines from promoting",
      mark: { squares: ["c2"] },
    },
    {
      when: { kind: "board", at: { d5: "k", c2: "N" }, queued: { kind: "spiderMine", from: "c2" } },
      say: "Ride the Hoverbike to b4 — it attacks the enemy Command Center!",
    },
    {
      when: { kind: "board", at: { g1: "q" }, notQueuedOnto: "g1" },
      say: "Crush that BattleShip by deploying any unit on it!",
      emotion: "scanning",
    },
    {
      when: { kind: "board", at: { e1: "q" }, notQueuedOnto: "e1" },
      say: "Enemy BattleShip on e1 — drop a Hoverbike on g2, then attack it!",
      emotion: "shocked"
    },
    {
      when: { kind: "board", at: { f1: "q" }, notQueuedOnto: "f1" },
      say: "Enemy BattleShip on f1 — drop a Hoverbike on h2, then attack it!",
      emotion: "shocked"
    },
    {
      when: { kind: "board", at: { d5: "k", b4: "n" } },
      say: "I saw the Command Center moving to d5, Hoverbike on b4.",
    },
    {
      when: { kind: "tankSiege", phases: ["intent"] },
      say: "Drop Gas on it to siege for bigger range",
      emotion: "scanning",
    },
    {
      // Empty g2 takes a gas deploy. Empty h2 stays empty so the h-file marine can be pushed.
      when: { kind: "forwardDeploy", square: "g2", phases: ["intent"] },
      say: "Deploy a Marine on g2 with Gas",
    },
    {
      phase: "intent",
      when: {
        kind: "scfen",
        re: /SCFEN\|(?:[^/]*\/){6}[^/|]*P(?=[/|])[^|]*\|[^|]*\|[^|]*\|[^|]*\|G:[1-9](?=.*\|Q:w:[^;]*C=h2h[34])/,
      },
      say: "Keep pushing your h-file Marine by dropping gas on it",
    },
    {
      phase: "intent",
      when: {
        kind: "scfen",
        re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){6}[^/|]*P(?=[/|])/,
      },
      say: "Move your h-file Marine from h2 to h4.",
    },
    {
      phase: "intent",
      when: {
        kind: "scfen",
        re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){5}[^/|]*P(?=[/|])/,
      },
      say: "Keep pushing your h-file Marine on h3!",
    },
    {
      phase: "intent",
      when: {
        kind: "scfen",
        re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){4}[^/|]*P(?=[/|])/,
      },
      say: "Keep pushing your h-file Marine on h4!",
    },
    {
      when: { kind: "backrankGuard" },
      say: "Deploy a guard in g1 with Gas, then push your Marine!",
    },
    {
      when: { kind: "lives", enemy: 1, phases: ["check", "resolve"] },
      say: "Yes! 1 more check!",
      emotion: "happy",
      transient: true,
    },
    {
      when: { kind: "lives", own: 2 },
      say: "Checked, a fire represents the damage.",
      emotion: "shocked",
    },
    {
      when: { kind: "lives", own: 1 },
      say: "Another hit and it's done",
      emotion: "thinking",
    },
    {
      when: {
        kind: "scfen",
        re: /SCFEN\|[^|]+\|0\|[^|]*\|[^|]*\|G:0/,
      },
      say: "Centralize your Hoverbike",
    },
    {
      // Move is spent, gas is not — the other half of the turn.
      when: { kind: "gasOnMarine", phases: ["intent"] },
      say: "Keep pushing your h-file Marine by dropping gas on it",
    },
    {
      when: {
        kind: "scfen",
        re: /SCFEN\|[^|]+\|[^|]*\|[^|]*\|[^|]*\|(?=.*\|Q:w:(?!;))/,
      },
      say: "Review your queued orders, then End Turn.",
      emotion: "watching",
    },
    {
      turn: 1,
      phase: "intent",
      say: "The enemy is overextended. Punish it!. \n\nDeploy a Marine.",
      emotion: "watching",
    },
    {
      when: {
        kind: "scfen",
        re: /SCFEN\|[^|]+\|1\|[^|]*\|[^|]*\|G:[1-9]/,
      },
      say: "Deploy a mine",
      emotion: "watching",
    },
    {
      // Last resort: nothing more specific matched and the Move slot
      // is still empty — keep the pressure on, never go silent.
      when: {
        kind: "scfen",
        re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)/,
      },
      say: "Apply pressure to the enemy Command Center.",
      emotion: "thinking",
    },
    {
      // Intent only: the ride is still being queued. Resolve keeps the
      // b4 ring from the step below and drops the L arrows.
      when: { kind: "board", at: { d5: "k", c2: "N" }, queued: { kind: "spiderMine", from: "c2" }, phases: ["intent"] },
      mark: {
        squares: ["b4"],
        arrows: [
          { from: "c2", to: "b4", via: "c4" },
          { from: "b4", to: "d5", via: "d4", tone: "alert" },
        ],
      },
    },
    {
      when: { kind: "board", at: { d5: "k", c2: "N" }, queued: { kind: "spiderMine", from: "c2" } },
      mark: { squares: ["b4"] },
    },
    {
      when: { kind: "board", at: { g1: "q" }, notQueuedOnto: "g1" },
      mark: { squares: ["g1"] },
    },
    {
      when: { kind: "board", at: { e1: "q" }, notQueuedOnto: "e1" },
      mark: { squares: ["g2", "e1"], arrows: [{ from: "g2", to: "e1", via: "e2" }] },
    },
    {
      when: { kind: "board", at: { f1: "q" }, notQueuedOnto: "f1" },
      mark: { squares: ["h2", "f1"], arrows: [{ from: "h2", to: "f1", via: "f2" }] },
    },
    {
      when: { kind: "board", at: { d5: "k", b4: "n" } },
      mark: { squares: ["b4"] },
    },
    {
      when: { kind: "tankSiege", phases: ["intent"] },
      mark: { squares: ["h5"] },
    },
    {
      when: { kind: "forwardDeploy", square: "g2", phases: ["intent"] },
      mark: { squares: ["g2"] },
    },
    {
      phase: "intent",
      when: {
        kind: "scfen",
        re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){6}[^/|]*P(?=[/|])/,
      },
      mark: { squares: ["h2"], arrows: [{ from: "h2", to: "h4" }] },
    },
    {
      phase: "intent",
      when: {
        kind: "scfen",
        re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){5}[^/|]*P(?=[/|])/,
      },
      mark: { squares: ["h3"], arrows: [{ from: "h3", to: "h5" }] },
    },
    {
      phase: "intent",
      when: {
        kind: "scfen",
        re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){4}[^/|]*P(?=[/|])/,
      },
      mark: { squares: ["h4"], arrows: [{ from: "h4", to: "h6" }] },
    },
    {
      when: {
        kind: "scfen",
        re: /SCFEN\|(?:[^/]*\/){3}[^/|]*P(?=[/|])/,
      },
      mark: { squares: ["h5"] },
    },
    {
      when: { kind: "backrankGuard" },
      mark: { squares: ["g1"], arrows: [{ from: "a1", to: "h1" }] },
    },
    {
      when: { kind: "gasOnMarine", phases: ["intent"] },
      mark: {},
    },
    {
      when: {
        kind: "scfen",
        re: /SCFEN\|[^|]+\|0\|[^|]*\|[^|]*\|G:0/,
      },
      mark: { squares: ["c2"] },
    },
    {
      when: {
        kind: "scfen",
        re: /SCFEN\|[^|]+\|0\|/,
      },
      mark: { squares: ["h2"] },
    },
    {
      when: {
        kind: "scfen",
        re: /SCFEN\|[^|]+\|1\|/,
      },
      mark: { squares: ["c2"] },
    },
    {
      // Fallback: nothing more specific matched. Ring + arrow whichever
      // ally unit already lines up the enemy Command Center, if any.
      when: { kind: "ccPressure" },
      mark: {},
    },
    {
      mark: { squares: [] },
    },
  ],
} satisfies TutorialStoryScript;
