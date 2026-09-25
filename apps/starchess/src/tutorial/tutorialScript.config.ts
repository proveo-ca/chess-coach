// SPEC: _spec/apps/starchess/architecture/storybook-projection.puml
/**
 * Tutorial content config — single source of truth for lesson copy, board
 * seeds, hints, and advance/restart gates. **Data only**: no imports beyond the
 * type, no logic, no derived values. Types, accessors, and the line resolver
 * live in `tutorialScript.ts`.
 *
 * `as const satisfies` is what makes this a *checked* config: every `kind`,
 * `emotion`, `id`, and `squares` entry is validated against the discriminated
 * unions at compile time. A `.json` file cannot do that — JSON imports widen
 * to `string`, so a misspelled `kind` would only fail at runtime.
 */
import type { TutorialScriptConfig } from "~/tutorial/tutorialScript";

export const TUTORIAL_SCRIPT_CONFIG = [
  {
    id: "fog",
    label: "Fog of War",
    stories: [
      {
        id: "king",
        title: "King",
        board: {
          scfen: "SCFEN|7k/7p/8/8/3K4/8/8/8|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Kd4 live. Queue Kd4\u2192e5, End \u2014 slide + progressive fog.",
        },
        comment: "StarChess units move like Chess pieces. \n...But the board has fog. \n\nTry moving your King, watch the fog follow.",
        emotion: "watching",
        // Turn counter off 0 — the board only leaves turn 0 once a queued move
        // has resolved, and the lone white King is the only thing that can
        // queue one. So this is "any King move, judged after resolve".
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|[1-9]/,
        },
        hints: [
          {
            squares: [
              "c3",
            ],
            arrows: [{ from: "d4", to: "c3" }],
          },
        ],
      },
      {
        id: "pawn",
        title: "Pawn",
        board: {
          // Kc3, where the previous lesson's hint sends him \u2014 the pawn lesson
          // picks the King up where the King lesson left him.
          scfen: "SCFEN|7k/8/8/8/3P4/2K5/8/8|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Pd4 + Kc3 cumulative vision. Queue Pd4\u2192d5, End.",
        },
        comment: "With each piece having vision, slowly the fog of war clears.",
        emotion: "idle",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|/]*[NBRQ]/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^/]*\/[^/]*P/,
            },
            comment: "Go ahead promote. See how the pieces look!",
            emotion: "happy",
          },
        ],
        hints: [
          {
            squares: [
              "d8",
            ],
            arrows: [{ from: "d4", to: "d8" }],
          },
        ],
      },
      {
        id: "knight",
        title: "Knight",
        board: {
          scfen: "SCFEN|7k/7p/8/8/3N4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          alertLatch: "sticky",
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Nd4 live. Queue Nd4\u2192e6, End \u2014 L-path + fog.",
        },
        comment: "The Knight now rides a Hoverbike! As it moves, it clears the fog.",
        emotion: "watching",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|(?:[^/]*\/){3}6N1/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^/]*\/){3}6N1/,
            },
            comment: "Did you see that?!",
            emotion: "shocked",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^/]*\/){2}4N3/,
            },
            comment: "Now move to g5. \nPay attention to the h8 corner!",
            emotion: "watching",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^/]*\/){3}6N1/,
            },
            squares: [],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^/]*\/){2}4N3/,
            },
            squares: [
              "g5",
            ],
            alertSquares: [
              "h8",
            ],
            arrows: [{ from: "e6", to: "g5", via: "g6" }],
          },
          {
            squares: [
              "e6",
            ],
            arrows: [{ from: "d4", to: "e6", via: "d6" }],
          },
        ],
      },
      {
        id: "bishop",
        title: "Bishop",
        board: {
          scfen: "SCFEN|7k/6p1/8/8/3B4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Bd4 into fog toward h8. End discovers g7 \u2192 Bxg7 (king spared).",
        },
        comment: "Units capture just like Chess, if it wasn't for the fog...",
        emotion: "thinking",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|7k\/6B1\/.*\|32\|/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|7k\/6B1\/.*\|32\|/,
            },
            comment: "...Did you just set that King on fire? \n\nI'll explain that later.",
            emotion: "thinking",
          },
          {
            when: {
              kind: "reviewPhase",
              phase: "resolve",
            },
            comment: "A pawn blocks your way!?",
            emotion: "shocked",
          },
        ],
        hints: [
          {
            squares: [
              "h8",
            ],
            arrows: [{ from: "d4", to: "h8" }],
          },
        ],
      },
      {
        id: "rook-tank",
        title: "Rook (tank)",
        board: {
          scfen: "SCFEN|7k/3p4/8/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          tankMode: "tank",
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Tank Rd4\u2192d8 into fog. End: discover d7 \u2192 Rxd7.",
        },
        comment: "This is a rook, it would also capture if it wasn't for the fog...",
        emotion: "watching",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|[1-9]/,
        },
        reactions: [
          {
            when: {
              kind: "reviewPhase",
              phase: "resolve",
            },
            comment: "Reveal pawn on d7, capture.",
            emotion: "happy",
          },
        ],
        hints: [
          {
            squares: [
              "d8",
            ],
            arrows: [{ from: "d4", to: "d8" }],
          },
        ],
      },
      {
        id: "rook-siege",
        title: "Rook (siege)",
        board: {
          scfen: "SCFEN|7k/3p4/8/8/p2R3p/8/3p4/K7|0|33|P|G:11:11|Q:w:;b:|S:d4",
          stored: 4,
          tankMode: "siege",
          endTurnAfterQueue: "first",
          armTimer: false,
          objective: "Keep your siege tank on d4 alive — reduce the enemy to 1 pawn.",
          choreography: "siegeFocusCounter",
          docs: "Siege rook on d4 \u2014 immobile 9\u00d79 vision. Fire any square on the cross: empty ground still takes HE, and the first unit in the way intercepts.",
        },
        comment: "The rook has 2 modes, mobile and immobile. \n\n Prevent pawns from promoting!",
        emotion: "scanning",
        // Win when at most one black pawn remains — the d2
        // promotion 4→3 alone must not win. Lose when S:d4 is
        // gone. `endTurnAfterQueue: "first"` ends on one action,
        // so the player kills one highlighted pawn per turn.
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|(?!(?:[^|]*p){2})/,
        },
        restartWhen: {
          kind: "scfen",
          re: /^(?!.*\|S:[^|]*d4)/,
        },
        reactions: [
          {
            when: { kind: "lost", pieces: ["p"] },
            comment: "The rook has 2 modes, mobile and immobile. \n\n Prevent pawns from promoting!",
            emotion: "happy",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]*q[^|]*\|/,
            },
            comment: "It slipped away!",
            emotion: "shocked",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|(?:[3-9]|\d\d+)\|/,
            },
            squares: [
              "d7",
            ],
            arrows: [{ from: "d4", to: "d7" }],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|2\|/,
            },
            squares: [
              "d1",
            ],
            arrows: [{ from: "d4", to: "d1" }],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|1\|/,
            },
            squares: [
              "d2",
            ],
            arrows: [{ from: "d4", to: "d2" }],
          },
          {
            squares: [
              "h4",
            ],
            arrows: [{ from: "d4", to: "h4" }],
          },
        ],
      },
      {
        id: "queen",
        title: "Queen",
        board: {
          scfen: "SCFEN|7k/r4ppp/8/8/3Q4/8/PPb5/K7|0|33|P|G:11:11|Q:w:;b:|S:a7",
          stored: 4,
          tankMode: "siege",
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Black tank dug in on a7, sighted on white Pa2 with Ka1 behind; black mecha c2 spots. Queue Qd4xa7, End.",
        },
        comment: "The Queen has maximum mobility. Capture the threat in a7.",
        emotion: "shocked",
        completeWhen: { kind: "lost", pieces: ["r"] },
        reactions: [
          {
            when: { kind: "lost", pieces: ["r"] },
            comment: "No more threats!",
            emotion: "happy",
          },
        ],
        hints: [
          {
            squares: [
              "a7",
            ],
            arrows: [
              { from: "d4", to: "a7" },
            ],
          },
        ],
      },
      {
        id: "mine",
        title: "Spider Mine",
        board: {
          scfen: "SCFEN|r6k/8/8/8/8/8/1N1PPP2/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:a4;b:c3e4",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          choreography: "mineRa1Counter",
          docs: "Marines d2/e2/f2 + hoverbike b2 for vision, white mine a4 vs black mines c3/e4 + tank a8. Walk e2-e4, attack c3, then turn 3 auto-ends as black Ra1 trips the a4 mine.",
        },
        comment: "See what happens if a piece walks over that mine",
        emotion: "happy",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|(?:[3-9]|\d\d+)\|/,
        },
        reactions: [
          {
            when: {
              kind: "turn",
              turn: 3,
            },
            comment: "See what happens when exploring the fog uncovers a mine",
            emotion: "watching",
          },
          {
            when: {
              kind: "turn",
              turn: 2,
            },
            comment: "Mines can be targetted for attack",
            emotion: "watching",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|1\|/,
            },
            squares: [
              "c3",
            ],
            arrows: [{ from: "d2", to: "c3" }],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|0\|/,
            },
            squares: [
              "e4",
            ],
            arrows: [{ from: "e2", to: "e4" }],
          },
          {
            squares: [],
          },
        ],
      },
    ],
  },
  {
    id: "specials",
    label: "Special Moves",
    stories: [
      {
        id: "marine",
        title: "Marine",
        board: {
          scfen: "SCFEN|7k/8/8/8/8/4P3/3P4/4K3|1|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "moveAndSpecial",
          armTimer: false,
          docs: "Turn 1: move, then gas (order matters not). Turn 2: gas first for the slip-away, then move off the ghost \u00b7 End to resolve.",
        },
        comment: "Order a Marine to move.",
        emotion: "idle",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|(?:[3-9]|\d\d+)\|/,
        },
        /*
         * Four beats across two turns — turn 1 moves then gasses, turn 2
         * gasses then moves off the ghost. First match wins, so these run
         * most-specific first. The seed opens on SCFEN turn 1, so the second
         * window is turn field `2` and the lesson ends on field `3`.
         */
        reactions: [
          {
            // Turn-2 gas queued — the transparent ghost marks where the Marine
            // lands after the Extra Step; the follow-up classical starts there.
            when: {
              kind: "scfen",
              re: /^(?=SCFEN\|[^|]+\|2\|)(?=.*[BF]=stimStep:)/,
            },
            comment: "Now click that gas-ghost Marine and queue a move intent",
            emotion: "watching",
          },
          {
            // Turn-1 gas queued, before or after the move.
            when: {
              kind: "scfen",
              re: /^(?=SCFEN\|[^|]+\|1\|)(?=.*[BF]=stimStep:)/,
            },
            comment: "Oh, yeah!",
            emotion: "watching",
          },
          {
            // Second planning window, no gas yet — teach the slip-away.
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|2\|/,
            },
            comment: "Now the slipping away technique, drop a gas canister in your Marine",
            emotion: "scanning",
          },
          {
            // Turn-1 classical queued from a Marine square (d2 / e3 on this
            // seed); the King on e1 cannot match. First match wins, so once
            // gas is queued the cheer above takes over.
            when: {
              kind: "scfen",
              re: /^(?=SCFEN\|[^|]+\|1\|)(?=.*Q:w:[^;]*C=[de][23])/,
            },
            comment: "You just queued an intent! \nIt looks like a ghost. \n\nSee that gas canister in the bottom? Drag and drop it into that transparent Marine.",
            emotion: "idle",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /^(?=SCFEN\|[^|]+\|2\|)(?=.*[BF]=stimStep:)/,
            },
            squares: [
              "e5",
            ],
            arrows: [{ from: "e4", to: "e5" }],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|2\|/,
            },
            squares: [
              "e3",
            ],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|1\|/,
            },
            squares: [
              "d4",
            ],
            arrows: [{ from: "d2", to: "d4" }],
          },
          {
            squares: [],
          },
        ],
      },
      {
        id: "cc",
        title: "Command Center",
        board: {
          scfen: "SCFEN|r6k/8/8/8/3K4/8/8/7R|1|33|P|G:11:11|Q:w:;b:",
          stored: 12,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "1. Drag gas onto the command center on d4 \u2192 DeployModal. 2. Pick a unit. 3. Tap an adjacent empty square \u2014 queued spawn \u00b7 End to drop.",
        },
        comment: "The Command Center can deploy units with gas!",
        emotion: "watching",
        completeWhen: {
          kind: "queue",
          specialKind: "deploy",
        },
        reactions: [
          {
            // SCFEN field 3 is `<white lives><black lives>` (codec.ts) — the
            // second digit alone, so a chip to *our* Command Center does not
            // fire this. Black is the enemy here; the viewer is white.
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|[^|]+\|\d2\|/,
            },
            comment: "I'll explain attacks and King Damage later.",
            emotion: "watching",
          },
        ],
      },
      {
        id: "hoverbike",
        title: "Hoverbike",
        board: {
          scfen: "SCFEN|4k3/8/8/8/3N4/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "moveAndSpecial",
          armTimer: false,
          docs: "Drag gas onto the knight to queue a Spider Mine on its square \u00b7 End to drop. Stack order: gas then move, or move then gas.",
        },
        comment: "Drop a gas canister on that Hoverbike.",
        emotion: "scanning",
        // Two mines on the board (`M:w:` holds a square per mine).
        completeWhen: {
          kind: "scfen",
          re: /M:w:(?:[a-h][1-8]){2}/,
        },
        /*
         * Four beats across two turns — gas *then* move, then move *then* gas —
         * so the lesson shows the order does not matter. First match wins, so
         * these run most-specific first. Turn is SCFEN field 2.
         *
         * The second-turn prompt is pinned to turn `2` rather than "any turn but
         * the first": it announces the new turn, so repeating it on 3 and 4 (a
         * mine landing on a square that already held one leaves the objective
         * unmet) reads like the lesson restarting. Those later turns fall through
         * to the queued-intent beat above, or hold the last line — `holdTutorialLine`
         * keeps the previous reaction sticky rather than going quiet.
         */
        reactions: [
          {
            // Closing line once both mines are down; the file count is live.
            when: { kind: "mineGuard" },
            comment: "1 unit guarding 4 promoting files!",
            emotion: "happy",
          },
          {
            when: {
              kind: "scfen",
              re: /^(?=SCFEN\|[^|]+\|(?!1\|)\d+\|)(?=.*Q:w:[^;]*C=)/,
            },
            comment: "Now drop the gas canister on that transparent Hoverbike, it describes where will it be after moving; and let the turn finish.",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /^SCFEN\|[^|]+\|2\|/,
            },
            comment: "New turn, new mine.\nMove your Hoverbike",
            emotion: "scanning",
          },
          {
            when: {
              kind: "scfen",
              re: /^(?=SCFEN\|[^|]+\|1\|)(?=.*[BF]=spiderMine:)/,
            },
            comment: "You have queued a mine intent! \nNow move and let the turn finish",
            emotion: "happy",
          },
          {
            // Off-script: moved before gassing on turn 1. Without this the
            // bubble goes silent (holdTutorialLine will not revive an intro
            // once the player has acted), so restate the ask.
            when: {
              kind: "scfen",
              re: /^(?=SCFEN\|[^|]+\|1\|)(?=.*Q:w:[^;]*C=)/,
            },
            comment: "Drop a gas canister on that Hoverbike.",
            emotion: "scanning",
          },
        ],
        /*
         * d4 → c2 → a1: the two hops that, with a mine on each turn, leave one
         * Hoverbike watching the a–d files. The closing step rings the mines
         * and draws where the Hoverbike can strike from where it stopped.
         */
        hints: [
          { when: { kind: "mineGuard" } },
          {
            when: {
              kind: "scfen",
              re: /^SCFEN\|(?:[^/]*\/){6}2N[^/|]*\/[^|]*\|2\|/,
            },
            squares: ["a1"],
            arrows: [{ from: "c2", to: "a1", via: "a2" }],
          },
          {
            when: {
              kind: "scfen",
              re: /^SCFEN\|(?:[^/]*\/){4}3N[^|]*\|1\|/,
            },
            squares: ["c2"],
            arrows: [{ from: "d4", to: "c2", via: "d2" }],
          },
        ],
      },
      {
        id: "mecha",
        title: "Mecha",
        board: {
          scfen: "SCFEN|k6q/8/4P3/4p3/3B4/8/8/K7|11|33|P|G:22:22|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "moveAndSpecial",
          armTimer: false,
          docs: "Charon Booster Missiles costs 2 vespene: drag onto the Mecha to arm targeting, click the highlighted enemy queen, then End to fire.",
        },
        comment: "Mecha can see BattleShips anywhere in the board! \nGas your Mecha, it will cost 2 gas canisters.",
        emotion: "thinking",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|(?:[^/]*\/){3}4B3/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^/]*\/){3}4B3/,
            },
            comment: "It shoots up and down!",
            emotion: "happy",
          },
          {
            // Snipe is on the queue — targeting has already cleared, so this
            // and the arming beat below are mutually exclusive.
            when: {
              kind: "scfen",
              re: /charonMissiles:/,
            },
            comment:
              "You still have the classical Chess move/capture available. Order your Mecha to capture that Marine and let the turn finish.",
            emotion: "watching",
          },
          {
            // Gas landed, no target picked yet — live UI targeting state, which
            // never reaches SCFEN. `targetingKind` is what makes it trackable.
            when: {
              kind: "targeting",
              targetingKind: "charonMissiles",
            },
            comment: "Now aim the ship to complete your intention!",
            emotion: "scanning",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /charonMissiles:/,
            },
            squares: [
              "e5",
            ],
            arrows: [{ from: "d4", to: "e5" }],
          },
          {
            squares: [
              "h8",
            ],
            arrows: [{ from: "d4", to: "h8" }],
          },
        ],
      },
      {
        id: "ship",
        title: "BattleShip",
        board: {
          scfen: "SCFEN|k6b/8/8/8/8/8/8/Q6K|21|33|P|G:31:33|Q:w:;b:B=charonMissiles:h8:a1",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Tactical Jump costs 3 vespene: drag onto the BattleShip to arm targeting, click a highlighted visible empty square, then End to resolve.",
        },
        comment: "The BattleShip can teleport anywhere visible in the map in an instant. \nGassing it takes all 3 canisters.",
        emotion: "watching",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]*Q[^|]*\|(?:2[2-9]|[3-9]\d+)/,
        },
        restartWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|Q]*\|(?:2[2-9]|[3-9]\d+)/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|Q]*\|(?:2[2-9]|[3-9]\d+)/,
            },
            comment: "Bruh",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /tacticalJump:/,
            },
            comment: "Lightspeed escape!",
            emotion: "shocked",
          },
        ],
      },
      {
        id: "tank",
        title: "Siege Tank",
        board: {
          scfen: "SCFEN|7k/5p2/8/8/3R1R2/8/8/K7|11|33|P|G:22:22|Q:w:;b:|S:f4",
          stored: 12,
          endTurnAfterQueue: "moveAndSpecial",
          armTimer: false,
          docs: "Two Siege Tanks: d4 starts packed (tank), f4 starts sieged (S:f4). Drag gas onto either to queue a toggle \u00b7 End to pack/unpack. Capture the f7 pawn with the sieged tank (Cf4f7) to see the siege HE attack (not tank twins).",
        },
        comment: "The tank has 2 modes: sieged and mobile. \nGas can change the mode. \nTry stacking mode change with a move!",
        emotion: "happy",
        completeWhen: {
          kind: "queue",
          classical: true,
          specialKind: "siegeMode",
        },
      },
    ],
  },
  {
    id: "resolve",
    label: "Turn Resolution",
    stories: [
      {
        id: "combat-chain",
        title: "Combat Chain",
        comment: "We're now observers of a past combat. \nReplay it with the arrows on the top. \nNotice how turns are simultaneous!",
        emotion: "idle",
        intentArrows: true,
        completeWhen: {
          kind: "typewriter",
          turn: 3,
          beat: "resolve",
        },
        reactions: [
          {
            when: {
              kind: "reviewPhase",
              phase: "check",
            },
            comment: "Check phase: Turn-open shots before anyone queues intent.",
            emotion: "shocked",
          },
          {
            when: {
              kind: "reviewPhase",
              phase: "intent",
            },
            comment: "Intent: ghosts are promises. Nothing moves until next phase.",
            emotion: "watching",
          },
          {
            when: {
              kind: "reviewPhase",
              phase: "resolve",
            },
            comment: "Resolve: in the following order: \n1. (Gas) Specials \n2. Attacks \n3. Moves \n4. (Gas) Specials",
            emotion: "scanning",
          },
          {
            when: {
              kind: "timelineActive",
            },
            comment: "A classical Chess capture is split in attack/move. \nOnly survivors move.",
            emotion: "thinking",
          },
        ],
      },
      {
        id: "king-hunt",
        title: "King Hunt",
        comment: "We're observing a Command Center in the run! \nIt will crumble after 3 attacks.",
        emotion: "watching",
        intentArrows: true,
        completeWhen: { kind: "lives", own: 0 },
        reactions: [
          {
            when: { kind: "lives", own: 2 },
            comment: "Checked, a fire represents the damage.",
            emotion: "shocked",
          },
          {
            when: { kind: "lives", own: 1 },
            comment: "This guy would have fared better deploying units...",
            emotion: "thinking",
          },
          {
            when: { kind: "lives", enemy: 0 },
            comment: "Thinking the same thing",
            emotion: "happy",
          },
        ],
      },
    ],
  },
  {
    id: "king",
    label: "King Damage",
    stories: [
      {
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
        reactions: [
          // Mecha gone (no `b` in the placement) — the Command Center is no
          // longer under attack, so the panic line below must not ride out the
          // win. First, because reactions stick: only another reaction retires
          // the one before it.
          {
            when: { kind: "lost", pieces: ["b"] },
            comment: "Mecha down!",
            emotion: "happy",
          },
          {
            when: {
              kind: "scfen",
              re: /B=deploy:/,
            },
            comment: "Attack the Mecha!",
            emotion: "watching",
          },
          {
            // CC down to 2 HP *while the Mecha is still alive* — the `b` is what
            // makes "deploy a Marine to save it" actionable advice.
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]*b[^|]*\|\d+\|2[0-3]\|/,
            },
            comment: "Your Command Center is under attack! \nDeploy a Marine to save it.",
            emotion: "shocked",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /deploy:[^:;]*:f2/,
            },
            squares: [
              "g3",
            ],
            arrows: [{ from: "f2", to: "g3" }],
          },
          {
            squares: [
              "f2",
            ],
            arrows: [{ from: "e1", to: "f2" }],
          },
        ],
      },
      {
        id: "king-defense-2",
        title: "King Defense II",
        board: {
          scfen: "SCFEN|7k/8/8/8/8/8/6bq/6BK|11|33|P|G:22:22|B:1:1|Q:w:;b:",
          stored: 1,
          choreography: "kingDefenseIIChecks",
        },
        comment: "",
        emotion: "shocked",
        completeWhen: { kind: "lost", pieces: ["b", "q"] },
        restartWhen: { kind: "lives", own: 0 },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /deploy:[^:;]*:g2/,
            },
            comment: "Now, queue an attack on that ship with either your Command Center or Mecha.",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|11\|1[0-3]\|/,
            },
            comment: "Cornered! \n\nCrush the enemy mecha by deploying a Marine onto its square.",
            emotion: "shocked",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /deploy:[^:;]*:g2/,
            },
            squares: [
              "h2",
            ],
            arrows: [
              { from: "g1", to: "h2" },
              { from: "h1", to: "h2" },
            ],
          },
          {
            squares: [
              "g2",
            ],
            arrows: [{ from: "h1", to: "g2" }],
          },
        ],
      },
      {
        id: "king-defense-3",
        title: "King Defense III",
        board: {
          scfen: "SCFEN|k7/8/8/8/4n3/8/4PP1P/7K|1|13|P|G:11:11|Q:w:;b:C=e4f2",
          stored: 4,
          endTurnAfterQueue: "moveAndSpecial",
          docs: "Command Center on h1 at HP 1. Black has ne4 pre-queued onto f2 — from there it checks h1 next turn open. Only line: gas the f2 marine (B=stimStep:f2:f3) then Pf3×e4 — the B step lands before the attack phase, so the marine shoots the hoverbike off e4 and black's plan never moves.",
        },
        comment: "That hoverbike will end the game if it reaches f2. \nGas your marine in f2 and attack it before it can move!",
        emotion: "shocked",
        completeWhen: { kind: "lost", pieces: ["n"] },
        restartWhen: { kind: "lives", own: 0 },
        reactions: [
          {
            when: { kind: "lives", own: 0 },
            comment: "Bruh",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /[BF]=stimStep:f2/,
            },
            comment: "Now shoot it off e4!",
            emotion: "watching",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /[BF]=stimStep:f2/,
            },
            squares: [
              "e4",
            ],
            arrows: [{ from: "f3", to: "e4" }],
          },
          {
            squares: [
              "f2",
            ],
          },
        ],
      },
      {
        id: "king-defense-4",
        title: "King Defense IV",
        board: {
          scfen: "SCFEN|k7/8/8/4B3/8/8/4r3/5NPK|1|13|P|G:11:11|Q:w:;b:C=e2h2",
          stored: 4,
          endTurnAfterQueue: "first",
          docs: "Command Center on h1 at HP 1, guarded by Nf1 + Pg1. The hoverbike is the only unit whose vision reaches re2 — and e2 is off its move graph, so spotting is all it can do. Black has the tank pre-queued e2→h2, one square from the CC. Order Be5→h2: two movers land on the same tile in the move phase, so both die — the mecha trades itself for the tank.",
        },
        comment: "Your Hoverbike found a Tank... \nOrder either your Hoverbike or Mecha to h2 to cause a collision.",
        emotion: "thinking",
        completeWhen: { kind: "lost", pieces: ["r"] },
        restartWhen: { kind: "lives", own: 0 },
        reactions: [
          {
            when: { kind: "lives", own: 0 },
            comment: "Bruh",
            emotion: "watching",
          },
        ],
        hints: [
          {
            squares: [
              "h2",
            ],
            arrows: [
              { from: "e5", to: "h2" },
              { from: "f1", to: "h2", via: "f2" },
            ],
          },
        ],
      },
      {
        id: "king-defense-5",
        title: "Pawn Gas Defense",
        board: {
          scfen: "SCFEN|7k/8/8/8/1b6/8/2PR4/3K4|11|33|P|G:22:22|Q:w:;b:|S:d2",
          stored: 2,
          endTurnAfterQueue: "moveAndSpecial",
          choreography: "pawnGasDefenseCounter",
          objective: "Hold d1 — block c3, unsiege d2, leave to e2",
          docs: "White Kd1 + sieged Rd2 + Pc2 vs Bb4 + Kh8. Black B b4→d2 queued once on T11. Gas pawn c2→c3 (single step) blocks, gas unsiege d2, then R d2→e2. Win R e2 + K d1; fail R/K missing.",
        },
        comment: "That Mecha is gonna get your Tank! \n\nGas your Marine to body-block!",
        emotion: "shocked",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]*4R3\/3K4\|/,
        },
        restartWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|K]*\||SCFEN\|[^|R]*\|/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]*4R3\/3K4\|/,
            },
            comment: "Evacuated!",
            emotion: "happy",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|K]*\||SCFEN\|[^|R]*\|/,
            },
            comment: "Bruh",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /[BF]=siegeMode:d2/,
            },
            comment: "Now move your tank out of danger!",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /[BF]=stimStep:c2/,
            },
            comment: "Now, unsiege your tank by dropping a gas canister on it.",
            emotion: "watching",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /[BF]=siegeMode:d2/,
            },
            squares: [
              "e2",
            ],
            arrows: [{ from: "d2", to: "e2" }],
          },
          {
            when: {
              kind: "scfen",
              re: /[BF]=stimStep:c2/,
            },
            squares: [
              "d2",
            ],
          },
          {
            squares: [
              "c3",
            ],
            arrows: [
              { from: "c2", to: "c3" },
              { from: "b4", to: "d2" },
            ],
          },
        ],
      },
      {
        id: "king-defense-6",
        title: "Ship Snipe Defense",
        board: {
          scfen: "SCFEN|7k/8/8/3q4/4B3/8/5b1P/4N2K|21|13|P|G:33:33|Q:w:;b:",
          stored: 0,
          endTurnAfterQueue: "moveAndSpecial",
          choreography: "shipSnipeCounter",
          objective: "Catch the jump: Be4 to g2, then snipe f1 after it lands.",
          docs: "Ally CC h1 at HP 1 with g1/f1 free. Enemy ship warps to f1 in B phase. Move Be4→g2, then F snipe g2→f1 in the 2nd gas phase to catch it post-jump. White marine h2 holds the flank; ally hoverbike e1 screens the base. Enemy mecha f2 spots the jump square.",
        },
        comment: "That ship is jumping to f1 for your base! Move your Mecha to g2 first.",
        emotion: "shocked",
        completeWhen: { kind: "lost", pieces: ["q", "Q"] },
        restartWhen: { kind: "lives", own: 0 },
        reactions: [
          {
            when: { kind: "lost", pieces: ["q", "Q"] },
            comment: "Lightspeed blunder!",
            emotion: "happy",
          },
          {
            when: { kind: "lives", own: 0 },
            comment: "Bruh",
            emotion: "watching",
          },
          {
            when: {
              kind: "targeting",
              targetingKind: "charonMissiles",
            },
            comment: "Target f1. \n\nSneaky BattleShip will arrive to flying missiles.",
            emotion: "scanning",
          },
          {
            when: {
              kind: "scfen",
              re: /charonMissiles:/,
            },
            comment: "Locked on f1, end your turn!",
            emotion: "happy",
          },
          {
            when: {
              kind: "scfen",
              re: /Q:w:[^;]*C=e4g2/,
            },
            comment: "Now gas the Mecha ghost.",
            emotion: "scanning",
          },
          {
            when: {
              kind: "scfen",
              re: /tacticalJump:/,
            },
            comment: "I doubt the opponent wants to trade their BattleShip for your Mecha... \n\nMove your Mecha to g2.",
            emotion: "thinking",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /charonMissiles:/,
            },
            squares: [
              "f1",
            ],
            arrows: [{ from: "g2", to: "f1" }],
          },
          {
            when: {
              kind: "scfen",
              re: /Q:w:[^;]*C=e4g2/,
            },
            squares: [
              "f1",
            ],
            arrows: [
              { from: "g2", to: "f1" },
            ],
          },
          {
            squares: [
              "f1",
              "g2",
            ],
            arrows: [
              { from: "e4", to: "g2" },
              { from: "g2", to: "f1" },
            ],
          },
        ],
      },
      {
        id: "king-attack-1",
        title: "King Attack #1",
        board: {
          scfen: "SCFEN|kn1Q4/ppp5/8/8/3n4/8/r4P1P/1R4KB|11|32|P|G:20:22|B:4:6|Q:w:;b:C=b8d7,B=spiderMine:b8:b8|S:a2b1|M:w:;b:c6d4",
          stored: 4,
          endTurnAfterQueue: "first",
          choreography: "kingAttackTankCounter",
          /*
           * Timer on, like every other King lesson. This seed's black gas reads
           * 0 (spent on its queued mine), so turn-open refills it and moves the
           * SCFEN off the seed on mount — which used to retire the opening line
           * unread, and was why the timer was disabled here. `holdTutorialLine`
           * now re-baselines when turn-open checks land, so the line survives.
           */
          docs: "Enemy CC on a8 (HP 2) is smothered by a7/b7/b8, and b7 is the choke point every remaining line shares. Black's own queued turn opens rank 8 for free: nb8→d7 leaves the back rank and uncovers the fogged Qd8. One shot supplies the rest — Rb1 siege-fires b7 (without vacating), which simultaneously clears the h1-a8 diagonal for the x-raying Bh1. Two checkers at the turn-12 open take HP 2 to 0. Leave b7 alive and only the Ship connects (2→1); `kingAttackTankCounter` then deploys a Siege Tank onto b8 and shoots the Ship, which `restartWhen` reads as a retry. The choke point is a **Marine** — the enemy tank is dug in on a2 instead, where its rank-2 ray stops at the f2 marine and never reaches Kg1. Enemy mines sit on c6 and d4 (black's third lands on b8 from its own queued `spiderMine`, which is the side's cap): c6 is planted *on* the h1-a8 diagonal on purpose — mines are not FEN pieces, so they neither block the Bishop's check nor get spent by it (`starchess-core` `mine/mineChecks.test.ts`).",
        },
        comment: "Your Ship and Mecha are concealed by the fog! \n\n Aim your tank at b7 to open the line for your Mecha.",
        emotion: "watching--left",
        completeWhen: { kind: "lives", enemy: 0 },
        restartWhen: { kind: "lost", pieces: ["Q"] },
        reactions: [
          {
            when: { kind: "lost", pieces: ["Q"] },
            comment: "Bruh",
            emotion: "watching",
          },
          {
            /**
             * HP 0 — *both* checkers connected in the same pass, which is the
             * only outcome "stacked" describes. This is `completeWhen`'s gate
             * too: the line lands on the completing board, so the success
             * bubble inherits it (see `bubbleMessage` in TutorialScreen).
             */
            when: { kind: "lives", enemy: 0 },
            comment: "Stacked damage!",
            emotion: "happy",
          },
          {
            /**
             * HP 1 — only the Ship connected. Keeps this beat voiced: once the
             * board has moved off its baseline `holdTutorialLine` will not
             * revive the opening line, so with no reaction here the bubble goes
             * empty until the counterattack takes the Ship.
             */
            when: { kind: "lives", enemy: 1 },
            comment: "One attacker only. \nClear b7 so your Mecha fires too. \n\nIf your Ship dies, the Mecha will lose vision!",
            emotion: "thinking",
          },
        ],
        /*
         * The tank's target, plus the two lines that take the a8 CC from HP 2
         * to 0: the Ship's rank-8 shot once nb8→d7 vacates the back rank, and
         * the Bishop's h1-a8 diagonal once the tank clears b7. Both lines run
         * *through* fog, which is why a ring alone could not make the point.
         */
        hints: [
          {
            squares: [
              "b7",
            ],
            arrows: [
              { from: "b1", to: "b7" },
              { from: "h1", to: "a8" },
              { from: "d8", to: "a8" },
            ],
          },
        ],
      },
      {
        id: "king-attack-2",
        title: "King Attack #2",
        board: {
          scfen: "SCFEN|8/7Q/8/4p3/3bkn2/8/2b2R2/7K|21|33|P|G:33:33|B:0:3|Q:w:;b:|S:f2",
          stored: 0,
          opponent: "adjutant",
          docs: "A BattleShip and a dug-in Siege Tank against a five-unit escort, one of them a Mecha parked on c2. Turn 21 = tier-3 gas, so Tactical Jump (3 vespene) is affordable every turn — the whole point of the lesson. Qh7 already bears on the ke4 diagonal, so the opening turn chips it 3→2 for free; the coached opener is Tactical Jump h7→d2 stacked with the classical Qd2xc2 that takes the Mecha; the adjutant answers by deploying and shooting at the ship, so one that sits still dies early. Rf2 is immobile but owns the f-file and rank 2, which covers the nf4 flank and the approach to Kh1. White holds 0 minerals and cannot deploy: keep re-checking the Command Center from a fresh angle, and jump out when the escort closes.",
        },
        comment: "Juke this army with your ship! \nGas it up to escape danger.",
        emotion: "happy",
        completeWhen: { kind: "lives", enemy: 0 },
        restartWhen: { kind: "lost", pieces: ["Q"] },
        reactions: [
          {
            when: { kind: "lost", pieces: ["Q"] },
            comment: "Bruh",
            emotion: "watching",
          },
          {
            /**
             * Losing the Command Center is not the lesson's retry gate, so
             * nothing would remount it — offer the CTA the way King Attack #3
             * does, or the player is stranded on a terminal board.
             */
            when: { kind: "lives", own: 0 },
            comment: "They went around your ship and took the base. \nGive it another run.",
            emotion: "shocked",
            action: {
              kind: "retryLesson",
              label: "Retry lesson",
            },
          },
          {
            /**
             * Jumped to d2 on the opening turn, Attack/Move still open — the
             * Mecha on c2 is one square away. A warp queues on `B`, so it
             * resolves before the classical and the ship takes from d2.
             */
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|21\|(?!.*Q:w:[^;]*C=).*tacticalJump:h7:d2/,
            },
            comment: "Now queue a move from d2 to c2 \nand take out that Mecha!",
            emotion: "thinking",
          },
          {
            /**
             * Tactical Jump confirmed anywhere else on the opening turn — the
             * wire carries `B=tacticalJump:` and the turn field still reads 21.
             * Point at the flank the dug-in tank already covers.
             */
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|21\|.*tacticalJump:/,
            },
            comment: "Your tank can take out that Hoverbike",
            emotion: "thinking",
          },
          {
            /**
             * Catch-all, and it has to exist. Qh7 already checks ke4, so the
             * turn-open resolve runs on mount — `holdTutorialLine` sees
             * `timelineActive` and retires the opening line before it is read,
             * leaving an empty bubble. Same copy as `comment` on purpose: the
             * intro still feeds the objective, this keeps it on screen.
             */
            when: {
              kind: "scfen",
              re: /^SCFEN\|/,
            },
            comment: "Juke this army with your ship! \nGas it up to escape danger.",
            emotion: "happy",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|21\|(?!.*Q:w:[^;]*C=).*tacticalJump:h7:d2/,
            },
            squares: [
              "c2",
            ],
            arrows: [{ from: "d2", to: "c2" }],
          },
          {
            // Jump and capture both queued — nothing left to point at.
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|21\|.*tacticalJump:h7:d2/,
            },
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|21\|.*tacticalJump:/,
            },
            squares: [
              "f4",
            ],
            arrows: [{ from: "f2", to: "f4" }],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|21\|.*\|G:0/,
            },
            squares: [
              "f4",
            ],
            arrows: [{ from: "f2", to: "f4" }],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|21\|/,
            },
            squares: [
              "d2",
            ],
            fromBattleShip: true,
            arrows: [{ from: "h7", to: "d2" }],
          },
          {
            // After the scripted opener, the next jump is read from wherever
            // the ship stands — lit, empty, unattacked, re-checking if it can.
            when: { kind: "shipJuke" },
          },
        ],
      },
      {
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
        reactions: [
          {
            when: { kind: "lives", own: 0 },
            comment: "Oh no! Give it another try, it's a lot to process",
            emotion: "shocked",
            action: {
              kind: "retryLesson",
              label: "Retry lesson",
            },
          },
          {
            when: { kind: "lives", enemy: 0 },
            comment: "Thinking the same thing",
            emotion: "happy",
          },
          {
            when: { kind: "shipSniped" },
            comment: "Sniped!",
            emotion: "shocked",
            transient: true,
          },
          {
            when: {
              kind: "reviewPhase",
              phase: "resolve",
              turn: 1,
            },
            comment: "Enemy Command Center moved, I saw where!",
            emotion: "thinking",
            transient: true,
          },
          {
            when: { kind: "promotionChoice", phases: ["intent"] },
            comment: "Choose your promotion wisely: \nBattleShip, risk getting sniped \nTank, worse but harder to hit",
            emotion: "thinking",
          },
          {
            when: { kind: "mechaThreat", phases: ["intent"] },
            comment: "Threat that Command Center with your Mecha",
            emotion: "thinking",
          },
          {
            // g2×f3 frees a Command Center deploy square. A Mecha costs 3
            // minerals and looks down g2–a8; another Marine does not. The
            // classical Attack/Move still has to be open — this is the move
            // that vacates g2.
            when: { kind: "mechaDiagonal", phases: ["intent"] },
            comment: "Your Marine will vacate g2 after attacking, deploy a Mecha there instead of a Marine",
            emotion: "thinking",
          },
          {
            // Open Attack/Move, BattleShip or Tank on h8. A nearby Marine does
            // not hide the charge — the arrows are the coaching.
            when: { kind: "chargeH8", phases: ["intent"] },
            comment: "Go get 'em!",
          },
          {
            // One beat for every enemy Marine on the last three ranks. The
            // arrow is the unit that stops it; a queued stop yields the next one.
            when: { kind: "stopRunner" },
            comment: "Stop that Marine from promoting!",
            emotion: "shocked",
          },
          {
            when: { kind: "covers", square: "e1", kinds: ["n"] },
            comment: "Your Hoverbike already reaches e1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "e1", kinds: ["k"] },
            comment: "Your Command Center already covers e1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "e1", kinds: ["r"] },
            comment: "Your Tank already covers e1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "e1", kinds: ["b"] },
            comment: "Your Mecha already covers e1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "f1", kinds: ["n"] },
            comment: "Your Hoverbike already reaches f1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "f1", kinds: ["k"] },
            comment: "Your Command Center already covers f1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "f1", kinds: ["r"] },
            comment: "Your Tank already covers f1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "f1", kinds: ["b"] },
            comment: "Your Mecha already covers f1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "g1", kinds: ["n"] },
            comment: "Your Hoverbike already reaches g1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "g1", kinds: ["k"] },
            comment: "Your Command Center already covers g1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "g1", kinds: ["r"] },
            comment: "Your Tank already covers g1 — take it, no deploy needed!",
          },
          {
            when: { kind: "covers", square: "g1", kinds: ["b"] },
            comment: "Your Mecha already covers g1 — take it, no deploy needed!",
          },
          {
            when: { kind: "trajectory", from: "g2", to: "d5" },
            comment: "You have 3 minerals — deploy a Mecha on g2, then take d5!",
          },
          {
            when: { kind: "board", at: { d5: "k", c2: "N" }, notQueued: { kind: "spiderMine", from: "c2" } },
            comment: "Deploy a mine in c2 to discourage Marines from promoting",
          },
          {
            when: { kind: "board", at: { d5: "k", c2: "N" }, queued: { kind: "spiderMine", from: "c2" } },
            comment: "Ride the Hoverbike to b4 — it attacks the enemy Command Center!",
          },
          {
            when: { kind: "board", at: { g1: "q" }, notQueuedOnto: "g1" },
            comment: "Crush that BattleShip by deploying any unit on it!",
            emotion: "scanning",
          },
          {
            when: { kind: "board", at: { e1: "q" }, notQueuedOnto: "e1" },
            comment: "Enemy BattleShip on e1 — drop a Hoverbike on g2, then attack it!",
            emotion: "shocked"
          },
          {
            when: { kind: "board", at: { f1: "q" }, notQueuedOnto: "f1" },
            comment: "Enemy BattleShip on f1 — drop a Hoverbike on h2, then attack it!",
            emotion: "shocked"
          },
          {
            when: { kind: "board", at: { d5: "k", b4: "n" } },
            comment: "I saw the Command Center moving to d5, Hoverbike on b4.",
          },
          {
            when: { kind: "tankSiege", phases: ["intent"] },
            comment: "Drop Gas on it to siege for bigger range",
            emotion: "scanning",
          },
          {
            // Empty g2 takes a gas deploy. Empty h2 stays empty so the h-file marine can be pushed.
            when: { kind: "forwardDeploy", square: "g2", phases: ["intent"] },
            comment: "Deploy a Marine on g2 with Gas",
          },
          {
            when: {
              kind: "scfen",
              phases: ["intent"],
              re: /SCFEN\|(?:[^/]*\/){6}[^/|]*P(?=[/|])[^|]*\|[^|]*\|[^|]*\|[^|]*\|G:[1-9](?=.*\|Q:w:[^;]*C=h2h[34])/,
            },
            comment: "Keep pushing your h-file Marine by dropping gas on it",
          },
          {
            when: {
              kind: "scfen",
              phases: ["intent"],
              re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){6}[^/|]*P(?=[/|])/,
            },
            comment: "Move your h-file Marine from h2 to h4.",
          },
          {
            when: {
              kind: "scfen",
              phases: ["intent"],
              re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){5}[^/|]*P(?=[/|])/,
            },
            comment: "Keep pushing your h-file Marine on h3!",
          },
          {
            when: {
              kind: "scfen",
              phases: ["intent"],
              re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){4}[^/|]*P(?=[/|])/,
            },
            comment: "Keep pushing your h-file Marine on h4!",
          },
          {
            when: { kind: "backrankGuard" },
            comment: "Deploy a guard in g1 with Gas, then push your Marine!",
          },
          {
            when: { kind: "lives", enemy: 1, phases: ["check", "resolve"] },
            comment: "Yes! 1 more check!",
            emotion: "happy",
            transient: true,
          },
          {
            when: { kind: "lives", own: 2 },
            comment: "Checked, a fire represents the damage.",
            emotion: "shocked",
          },
          {
            when: { kind: "lives", own: 1 },
            comment: "Another hit and it's done",
            emotion: "thinking",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|0\|[^|]*\|[^|]*\|G:0/,
            },
            comment: "Centralize your Hoverbike",
          },
          {
            // Move is spent, gas is not — the other half of the turn.
            when: { kind: "gasOnMarine", phases: ["intent"] },
            comment: "Keep pushing your h-file Marine by dropping gas on it",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|[^|]*\|[^|]*\|[^|]*\|(?=.*\|Q:w:(?!;))/,
            },
            comment: "Review your queued orders, then End Turn.",
            emotion: "watching",
          },
          {
            when: {
              kind: "reviewPhase",
              phase: "intent",
              turn: 1,
            },
            comment: "The enemy is overextended. Punish it!. \n\nDeploy a Marine.",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|1\|[^|]*\|[^|]*\|G:[1-9]/,
            },
            comment: "Deploy a mine",
            emotion: "watching",
          },
          {
            // Last resort: nothing more specific matched and the Move slot
            // is still empty — keep the pressure on, never go silent.
            when: {
              kind: "scfen",
              re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)/,
            },
            comment: "Apply pressure to the enemy Command Center.",
            emotion: "thinking",
          },
        ],
        hints: [
          {
            when: {
              kind: "reviewPhase",
              phase: "resolve",
              turn: 1,
            },
            alertSquares: ["d5"],
          },
          {
            when: { kind: "promotionChoice", phases: ["intent"] },
          },
          {
            when: { kind: "mechaThreat", phases: ["intent"] },
            arrows: [{ from: "g2", to: "a8" }],
          },
          {
            when: { kind: "mechaDiagonal", phases: ["intent"] },
            squares: [
              "g2",
            ],
            arrows: [{ from: "g2", to: "a8" }],
          },
          {
            when: { kind: "chargeH8", phases: ["intent"] },
            arrows: [
              { from: "h8", to: "d8" },
              { from: "d8", to: "d5", tone: "alert" },
            ],
          },
          {
            when: { kind: "stopRunner" },
          },
          {
            when: { kind: "covers", square: "e1", kinds: ["n"] },
            squares: ["e1"],
          },
          {
            when: { kind: "covers", square: "e1", kinds: ["k"] },
            squares: ["e1"],
          },
          {
            when: { kind: "covers", square: "e1", kinds: ["r"] },
            squares: ["e1"],
          },
          {
            when: { kind: "covers", square: "e1", kinds: ["b"] },
            squares: ["e1"],
          },
          {
            when: { kind: "covers", square: "f1", kinds: ["n"] },
            squares: ["f1"],
          },
          {
            when: { kind: "covers", square: "f1", kinds: ["k"] },
            squares: ["f1"],
          },
          {
            when: { kind: "covers", square: "f1", kinds: ["r"] },
            squares: ["f1"],
          },
          {
            when: { kind: "covers", square: "f1", kinds: ["b"] },
            squares: ["f1"],
          },
          {
            when: { kind: "covers", square: "g1", kinds: ["n"] },
            squares: ["g1"],
          },
          {
            when: { kind: "covers", square: "g1", kinds: ["k"] },
            squares: ["g1"],
          },
          {
            when: { kind: "covers", square: "g1", kinds: ["r"] },
            squares: ["g1"],
          },
          {
            when: { kind: "covers", square: "g1", kinds: ["b"] },
            squares: ["g1"],
          },
          {
            when: { kind: "trajectory", from: "g2", to: "d5" },
            squares: ["g2", "d5"],
            arrows: [{ from: "g2", to: "d5" }],
          },
          {
            when: { kind: "board", at: { d5: "k", c2: "N" }, notQueued: { kind: "spiderMine", from: "c2" } },
            squares: ["c2"],
          },
          {
            // Intent only: the ride is still being queued. Resolve keeps the
            // b4 ring from the step below and drops the L arrows.
            when: { kind: "board", at: { d5: "k", c2: "N" }, queued: { kind: "spiderMine", from: "c2" }, phases: ["intent"] },
            squares: ["b4"],
            arrows: [
              { from: "c2", to: "b4", via: "c4" },
              { from: "b4", to: "d5", via: "d4", tone: "alert" },
            ],
          },
          {
            when: { kind: "board", at: { d5: "k", c2: "N" }, queued: { kind: "spiderMine", from: "c2" } },
            squares: ["b4"],
          },
          {
            when: { kind: "board", at: { g1: "q" }, notQueuedOnto: "g1" },
            squares: [
              "g1",
            ],
          },
          {
            when: { kind: "board", at: { e1: "q" }, notQueuedOnto: "e1" },
            squares: [
              "g2",
              "e1",
            ],
            arrows: [{ from: "g2", to: "e1", via: "e2" }],
          },
          {
            when: { kind: "board", at: { f1: "q" }, notQueuedOnto: "f1" },
            squares: [
              "h2",
              "f1",
            ],
            arrows: [{ from: "h2", to: "f1", via: "f2" }],
          },
          {
            when: { kind: "board", at: { d5: "k", b4: "n" } },
            squares: [
              "b4",
            ],
          },
          {
            when: { kind: "tankSiege", phases: ["intent"] },
            squares: ["h5"],
          },
          {
            when: { kind: "forwardDeploy", square: "g2", phases: ["intent"] },
            squares: ["g2"],
          },
          {
            when: {
              kind: "scfen",
              phases: ["intent"],
              re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){6}[^/|]*P(?=[/|])/,
            },
            squares: [
              "h2",
            ],
            arrows: [{ from: "h2", to: "h4" }],
          },
          {
            when: {
              kind: "scfen",
              phases: ["intent"],
              re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){5}[^/|]*P(?=[/|])/,
            },
            squares: [
              "h3",
            ],
            arrows: [{ from: "h3", to: "h5" }],
          },
          {
            when: {
              kind: "scfen",
              phases: ["intent"],
              re: /SCFEN\|(?!.*\|Q:w:[^;]*C=)(?:[^/]*\/){4}[^/|]*P(?=[/|])/,
            },
            squares: [
              "h4",
            ],
            arrows: [{ from: "h4", to: "h6" }],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^/]*\/){3}[^/|]*P(?=[/|])/,
            },
            squares: [
              "h5",
            ],
          },
          {
            when: { kind: "backrankGuard" },
            squares: [
              "g1",
            ],
            arrows: [{ from: "a1", to: "h1" }],
          },
          {
            when: { kind: "gasOnMarine", phases: ["intent"] },
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|0\|[^|]*\|[^|]*\|G:0/,
            },
            squares: [
              "c2",
            ],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|0\|/,
            },
            squares: [
              "h2",
            ],
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|1\|/,
            },
            squares: [
              "c2",
            ],
          },
          {
            // Fallback: nothing more specific matched. Ring + arrow whichever
            // ally unit already lines up the enemy Command Center, if any.
            when: { kind: "ccPressure" },
          },
          {
            squares: [],
          },
        ],
      },
      {
        id: "king-attack-4",
        title: "Turtled Opponent",
        board: {
          scfen:
            "SCFEN|3r4/pkp1n3/1pb1N3/2n1P3/3PRP2/N1PB4/8/4K3|12|33|P|G:22:22|M:w:b1|S:d8e4|Q:w:;b:",
          stored: 3,
          opponent: "adjutant",
          choreography: "kingHuntGraduation",
          docs: "Enemy Command Center on b7, Siege Tank sieged on d8, Marines on a7/b6/c7, Mecha on c6, Hoverbikes on c5/e7 — a fully turtled defense. Ally Command Center on e1, Marines on c3/d4/e5/f4, Hoverbikes on a3/e6, Siege Tank sieged on e4, Mecha on d3, a Mine on b1. Turn 12, 3 minerals each side.",
        },
        comment: "The enemy has dug in. Find the way through.",
        emotion: "thinking",
        completeWhen: { kind: "lives", enemy: 0 },
        restartWhen: { kind: "lives", own: 0 },
      },
    ],
  },
] as const satisfies TutorialScriptConfig;
