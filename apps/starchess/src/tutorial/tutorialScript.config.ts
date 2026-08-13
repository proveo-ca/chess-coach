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
        comment: "The pieces move the same as Chess! Except now the pieces have vision.",
        emotion: "watching",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|[1-9]/,
        },
        reactions: [
          {
            when: {
              kind: "chessSkin",
              chess: true,
            },
            comment: "Classic board, classic pieces for your reference.",
            emotion: "watching",
          },
        ],
      },
      {
        id: "pawn",
        title: "Pawn",
        board: {
          scfen: "SCFEN|7k/8/8/8/3P4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Pd4 + Ka1 cumulative vision. Queue Pd4\u2192d5, End.",
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
          },
        ],
      },
      {
        id: "knight",
        title: "Knight",
        board: {
          scfen: "SCFEN|7k/7p/8/8/3N4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Nd4 live. Queue Nd4\u2192e6, End \u2014 L-path + fog.",
        },
        comment: "The Knight now rides a Hoverbike! As it moves, it clears the fog, pay close attention!",
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
            comment: "Now move to g5",
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
          },
          {
            squares: [
              "e6",
            ],
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
            comment: "...Did you just set that King on fire?",
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
          },
        ],
      },
      {
        id: "rook-tank",
        title: "Rook (tank)",
        board: {
          scfen: "SCFEN|7k/3p4/8/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          rookMode: "tank",
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
          },
        ],
      },
      {
        id: "rook-siege",
        title: "Rook (siege)",
        board: {
          scfen: "SCFEN|7k/3p4/8/8/p2R3p/8/3p4/K7|0|33|P|G:11:11|Q:w:;b:|S:d4",
          stored: 4,
          rookMode: "siege",
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Siege rook on d4 \u2014 immobile 9\u00d79 vision. Explore fog; siege HE when you capture adjacent.",
        },
        comment: "This is the immobile rook mode; it has the biggest range. \nIt reveals the entire board when in the center!",
        emotion: "scanning",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|p]*\|/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|p]*\|/,
            },
            comment: "Four shells, four kills — siege owns the cross.",
            emotion: "happy",
          },
          {
            when: {
              kind: "timelineActive",
            },
            comment: "Boom + smoke on impact. Siege never slides — only shells.",
            emotion: "shocked",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|p]*\|/,
            },
            squares: [],
          },
          {
            squares: [
              "a4",
              "d2",
              "d7",
              "h4",
            ],
          },
        ],
      },
      {
        id: "queen",
        title: "Queen",
        board: {
          scfen: "SCFEN|7k/8/8/8/3Q4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Qd4 live. Queue Qd4\u2192d6, End \u2014 slide + fog.",
        },
        comment: "And finally, the Queen.",
        emotion: "watching",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|[1-9]/,
        },
      },
      {
        id: "mine",
        title: "Spider Mine",
        board: {
          scfen: "SCFEN|7k/8/8/8/8/8/8/4K3|0|33|P|G:11:11|M:w:a4|Q:w:;b:",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Live `M:w:a4` \u2014 mine lights only its own square under player fog.",
        },
        comment: "Hoverbikes can plant mines; they can only see their own squares. How? Let me show you!",
        emotion: "happy",
        action: {
          kind: "goSection",
          section: "specials",
          label: "See Specials",
        },
        reactions: [
          {
            when: {
              kind: "chessSkin",
              chess: true,
            },
            comment: "Even on wood, that mine is a one-square lantern.",
            emotion: "watching",
          },
        ],
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|[1-9]/,
        },
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
          docs: "d2 can classical-double for free (canister unused). Gas on a pawn queues a 1-square StarChess step \u00b7 End to resolve.",
        },
        comment: "See that gas canister in the bottom? Drag and drop it into a Marine. \nTry stacking a 2 pawn move with gas!",
        emotion: "idle",
        completeWhen: {
          kind: "queue",
          classical: true,
          specialKind: "pawnDouble",
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /[BF]=pawnDouble:/,
            },
            comment: "Oh, yeah!",
            emotion: "watching",
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
          specialKind: "spawn",
        },
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
        comment: "Use gas on a Hoverbike to deploy a mine. You can deploy the mine before or after moving!",
        emotion: "scanning",
        completeWhen: {
          kind: "scfen",
          re: /M:w:(?:[a-h][1-8]){2}/,
        },
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
            when: {
              kind: "scfen",
              re: /bishopSnipe:/,
            },
            comment: "Plan to attack that marine too!",
            emotion: "watching",
          },
          {
            when: {
              kind: "targeting",
              targetingKind: "bishopSnipe",
            },
            comment: "Now plan to attack that ship!",
            emotion: "scanning",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /bishopSnipe:/,
            },
            squares: [
              "e5",
            ],
          },
          {
            squares: [
              "h8",
            ],
          },
        ],
      },
      {
        id: "ship",
        title: "BattleShip",
        board: {
          scfen: "SCFEN|k6b/8/8/8/8/8/8/Q6K|21|33|P|G:31:33|Q:w:;b:B=bishopSnipe:h8:a1",
          stored: 4,
          endTurnAfterQueue: "first",
          armTimer: false,
          docs: "Tactical Jump costs 3 vespene: drag onto the BattleShip to arm targeting, click a highlighted visible empty square, then End to resolve.",
        },
        comment: "The BattleShip can teleport anywhere in the map in an instant. \nGassing it takes all 3 canisters.",
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
              re: /queenWarp:/,
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
          specialKind: "rookSiege",
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
    ],
  },
  {
    id: "king",
    label: "King Damage",
    stories: [
      {
        id: "king-hunt",
        title: "King Hunt",
        comment: "We're observing live combat! \nA Command Center crumbles after 3 attacks.",
        emotion: "watching",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|\d+\|0[0-3]\|/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|\d+\|2[0-3]\|/,
            },
            comment: "Checked, a fire represents the damage.",
            emotion: "shocked",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|\d+\|1[0-3]\|/,
            },
            comment: "Another hit and it's done",
            emotion: "thinking",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|\d+\|[0-3]0\|/,
            },
            comment: "Thinking the same thing",
            emotion: "happy",
          },
        ],
      },
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
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|b]*\|/,
        },
        restartWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|\d+\|0[0-3]\|/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /B=spawn:/,
            },
            comment: "Attack the Mecha!",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|\d+\|2[0-3]\|/,
            },
            comment: "Your Command Center is under attack! \nDeploy a Marine to save it.",
            emotion: "shocked",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /spawn:[^:;]*:f2/,
            },
            squares: [
              "g3",
            ],
          },
          {
            squares: [
              "f2",
            ],
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
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|bq]*\|/,
        },
        restartWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|\d+\|0[0-3]\|/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /spawn:[^:;]*:g2/,
            },
            comment: "Now, queue an attack on that ship with your Command Center",
            emotion: "watching",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|11\|1[0-3]\|/,
            },
            comment: "Cornered! Crush the enemy mecha by deploying a Marine onto its square.",
            emotion: "shocked",
          },
        ],
        hints: [
          {
            when: {
              kind: "scfen",
              re: /spawn:[^:;]*:g2/,
            },
            squares: [
              "h2",
            ],
          },
          {
            squares: [
              "g2",
            ],
          },
        ],
      },
      {
        id: "king-hunt-live",
        title: "King Hunt (live)",
        board: {
          scfen: "SCFEN|8/8/8/8/4k3/5P2/6P1/4N1BK|0|33|P|G:11:11|Q:w:;b:",
          stored: 1,
          opponent: "adjutant",
          choreography: "kingHuntGraduation",
        },
        comment: "The enemy King is overextended. \nPunish it!",
        emotion: "happy",
        completeWhen: {
          kind: "scfen",
          re: /SCFEN\|[^|]+\|\d+\|[0-3]0\|/,
        },
        reactions: [
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|\d+\|0[0-3]\|/,
            },
            comment: "Oh no! Give it another try, it's a lot to process",
            emotion: "shocked",
            action: {
              kind: "retryLesson",
              label: "Retry lesson",
            },
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|\d+\|[0-3]0\|/,
            },
            comment: "Thinking the same thing",
            emotion: "happy",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^|p]*p){2}[^|]*\|/,
            },
            comment: "Stop the enemy pawns! \nKeep a guard in g1 for your Command Center.",
            emotion: "shocked",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|(?:[^/]*\/){3}[^/]*P[^|]*\|\d+\|[23][0-3]\|/,
            },
            comment: "Yes, keep pushing your Marine. \nRemember Gas gives you an extra step!",
            emotion: "happy",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|\d+\|2[0-3]\|/,
            },
            comment: "Checked, a fire represents the damage.",
            emotion: "shocked",
          },
          {
            when: {
              kind: "scfen",
              re: /SCFEN\|[^|]+\|\d+\|1[0-3]\|/,
            },
            comment: "Another hit and it's done",
            emotion: "thinking",
          },
          {
            when: {
              kind: "reviewPhase",
              phase: "intent",
              turn: 1,
            },
            comment: "The enemy King is overextended. \nPunish it!. \nDeploy more units.",
            emotion: "watching",
          },
          {
            when: {
              kind: "turn",
              turn: 2,
            },
            comment: "Prioritize planting mines with your hoverbike!",
            emotion: "watching",
          },
        ],
        hints: [
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
            squares: [],
          },
        ],
      },
    ],
  },
] as const satisfies TutorialScriptConfig;
