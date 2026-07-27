import type { Square } from "chess.js";
import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
  type JSX,
} from "solid-js";

import {
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  ROOK_REST_AIM_DEG,
  type DemoPiece,
} from "~/broodwar/animations/attackAnim";
import {
  applyHiddenImgs,
  clearHiddenImgs,
  findBoardGrid,
  hideSquareImgs,
  revealSquareImgs,
  squareBoxStyle,
} from "~/broodwar/animations/boardGeom";
import { DEATH_MS } from "~/broodwar/animations/deathAnim";
import { InlineBishop } from "~/broodwar/animations/pieces/InlineBishop";
import { InlineKnight } from "~/broodwar/animations/pieces/InlineKnight";
import { InlinePawn } from "~/broodwar/animations/pieces/InlinePawn";
import { InlineRook } from "~/broodwar/animations/pieces/InlineRook";
import type { PieceColor } from "~/broodwar/animations/teamColors";
import type { AttackCue, DeathCue } from "~/broodwar/animations/types";
import { ChessBoard } from "~/components/features/ChessBoard";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/screens/nerdDemo/NerdCombatDemo.module.css";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setNerdModeUnlocked, setPlayerIdentity } from "~/store/settingsStore";

/** Frag flight = death start (capture impact). */
const KILL_DEATH_DELAY_MS = FRAG_FLIGHT_MS;

/** Quiet / capture slide (matches `.mover` CSS). */
const MOVE_MS = 550;

/**
 * Brood War: each turn resolves **two** moves at once (3 turns).
 * Reviewed with arrows — forward plays the turn, back jumps to the prior FEN.
 *
 * Start: white P d2, R c3, K e1; black p e5, B e8, N f6, k f8.
 * 1. d2-d4 & Be8-c6
 * 2. d4xe5 & Nf6-e4
 * 3. Rc3xc6 & Ne4xc3  (rook dies on c3 to the knight; bishop dies on c6)
 */
const FEN_START = "4bk2/8/5n2/4p3/8/2R5/3P4/4K3 w - - 0 1";
const FEN_AFTER_T1 = "5k2/8/2b2n2/4p3/3P4/2R5/8/4K3 w - - 0 1";
/** After turn-2 deaths: e5 empty, capturers not yet moved (P d4, N f6). */
const FEN_T2_DEAD = "5k2/8/2b2n2/8/3P4/2R5/8/4K3 w - - 0 1";
const FEN_AFTER_T2 = "5k2/8/2b5/4P3/4n3/2R5/8/4K3 w - - 0 1";
/** After turn-3 deaths: B+R gone; knight still on e4 until it occupies c3. */
const FEN_T3_DEAD = "5k2/8/8/4P3/4n3/8/8/4K3 w - - 0 1";
const FEN_AFTER_T3 = "5k2/8/8/4P3/8/2n5/8/4K3 w - - 0 1";

/** Review positions: index 0 = start, 1..3 = after that turn. */
const FENS = [FEN_START, FEN_AFTER_T1, FEN_AFTER_T2, FEN_AFTER_T3] as const;
const TOTAL_TURNS = 3;

const TURN_CAPTIONS = [
  "Start · use arrows to review turns",
  "1. d2-d4 & Be8-c6",
  "2. d4xe5 & Nf6-e4",
  "3. Rc3xc6 & Ne4xc3",
] as const;

type OverlayBox = { top: number; left: number; width: number; height: number };

type MoveCue = {
  id: string;
  piece: DemoPiece;
  color: PieceColor;
  from: Square;
  to: Square;
};

type SlideSpec = {
  piece: DemoPiece;
  color: PieceColor;
  from: Square;
  to: Square;
};

type CaptureSpec = {
  piece: DemoPiece;
  color: PieceColor;
  from: Square;
  to: Square;
  victim: { piece: DemoPiece; color: PieceColor };
  /** Attacker also dies (mutual / tanked). */
  dies?: boolean;
  /** When false, attacker never occupies `to` after the attack. */
  occupies?: boolean;
};

/**
 * Three Brood War turns on one board (+ fog), reviewed like a game:
 * arrows step turns (3 total). Forward plays the turn VFX; back jumps.
 * Attack/death overlays render via ChessBoard broodwar props.
 */
export const NerdCombatDemo: Component = () => {
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  const [caption, setCaption] = createSignal(TURN_CAPTIONS[0]);
  /** 0 = start; 1..3 = after that turn has resolved. */
  const [turnIndex, setTurnIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [attacks, setAttacks] = createSignal<AttackCue[]>([]);
  /** Attack ids whose hull has swapped to death art (stable cues — no remount). */
  const [attackDying, setAttackDying] = createSignal<Record<string, boolean>>({});
  const [deaths, setDeaths] = createSignal<DeathCue[]>([]);
  const [movers, setMovers] = createSignal<MoveCue[]>([]);
  const [moveProgress, setMoveProgress] = createSignal<Record<string, 0 | 1>>({});
  const [hidden, setHidden] = createSignal<Square[]>([]);

  let hostRef: HTMLDivElement | undefined;
  const timers: number[] = [];

  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };

  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  const prepare = () => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
  };

  const syncOverlay = () => {
    const host = hostRef;
    if (!host) return;
    const el = findBoardGrid(host);
    if (!el) return;
    const hr = host.getBoundingClientRect();
    const br = el.getBoundingClientRect();
    // Align to the board content box (inside the 4px border), matching ChessBoard.
    setOverlayBox({
      top: br.top - hr.top + el.clientTop,
      left: br.left - hr.left + el.clientLeft,
      width: el.clientWidth,
      height: el.clientHeight,
    });
    applyHiddenImgs(host, hidden());
  };

  const setFen = (fen: string) => {
    loadFen(fen);
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  };

  const hide = (...sqs: Square[]) => {
    setHidden((prev) => [...new Set([...prev, ...sqs])]);
    if (hostRef) hideSquareImgs(hostRef, sqs);
  };

  const reveal = (...sqs: Square[]) => {
    setHidden((prev) => prev.filter((s) => !sqs.includes(s)));
    if (hostRef) revealSquareImgs(hostRef, sqs);
  };

  const clearOverlays = () => {
    setAttacks([]);
    setAttackDying({});
    setDeaths([]);
    setMovers([]);
    setMoveProgress({});
    setHidden([]);
    if (hostRef) clearHiddenImgs(hostRef);
  };

  const showPosition = (index: number) => {
    clearTimers();
    clearOverlays();
    setTurnIndex(index);
    setPlaying(false);
    setFen(FENS[index]);
    setCaption(TURN_CAPTIONS[index]);
  };

  /** One or more pieces slide on stable DOM nodes, then one FEN commit. */
  const playSlides = (slides: SlideSpec[], fenAfter: string, onDone?: () => void) => {
    if (slides.length === 0) {
      setFen(fenAfter);
      onDone?.();
      return;
    }
    const stamp = Date.now();
    const cues: MoveCue[] = slides.map((s, i) => ({
      id: `${s.piece}-${s.from}-${s.to}-${stamp}-${i}`,
      piece: s.piece,
      color: s.color,
      from: s.from,
      to: s.to,
    }));
    const ids = cues.map((c) => c.id);

    hide(...slides.map((s) => s.from));
    setMovers((prev) => [...prev, ...cues]);
    setMoveProgress((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = 0;
      return next;
    });

    after(40, () => {
      setMoveProgress((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = 1;
        return next;
      });
    });

    after(40 + MOVE_MS, () => {
      const idSet = new Set(ids);
      setMovers((prev) => prev.filter((m) => !idSet.has(m.id)));
      setMoveProgress((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      setFen(fenAfter);
      reveal(...slides.map((s) => s.from));
      onDone?.();
    });
  };

  const spawnDeaths = (cues: Omit<DeathCue, "id">[]) => {
    const stamp = Date.now();
    const full: DeathCue[] = cues.map((c, i) => ({
      ...c,
      id: `death-${c.at}-${stamp}-${i}`,
    }));
    hide(...full.map((c) => c.at));
    setDeaths((prev) => [...prev, ...full]);
    after(DEATH_MS, () => {
      const ids = new Set(full.map((c) => c.id));
      setDeaths((prev) => prev.filter((d) => !ids.has(d.id)));
    });
  };

  /**
   * One or more captures in parallel: attack → playCaptured @ +250ms → occupy.
   * Every removed unit gets an explicit death cue (DeathAnimation). Mid-attack
   * hulls on those squares are interrupted so target impact FX can finish.
   */
  const playCaptures = (
    caps: CaptureSpec[],
    fenAfterDeath: string,
    fenAfterMove: string,
    extraSlides: SlideSpec[] = [],
    onDone?: () => void,
  ) => {
    const stamp = Date.now();
    const attackCues: AttackCue[] = caps.map((c, i) => ({
      id: `atk-${c.piece}-${c.from}-${stamp}-${i}`,
      piece: c.piece,
      color: c.color,
      from: c.from,
      to: c.to,
    }));
    const attackIds = new Set(attackCues.map((a) => a.id));

    hide(...caps.map((c) => c.from));
    setAttacks((prev) => [...prev, ...attackCues]);

    after(KILL_DEATH_DELAY_MS, () => {
      // Engine: each captured / destroyed unit → death animation (dedupe by square).
      const bySquare = new Map<Square, Omit<DeathCue, "id">>();
      for (const c of caps) {
        bySquare.set(c.to, {
          piece: c.victim.piece,
          color: c.victim.color,
          at: c.to,
        });
      }
      for (const c of caps) {
        if (!c.dies) continue;
        // Attacker also dies (e.g. mutual) — still a capture-style death cue.
        if (!bySquare.has(c.from)) {
          bySquare.set(c.from, { piece: c.piece, color: c.color, at: c.from });
        }
      }
      spawnDeaths([...bySquare.values()]);

      // Interrupt attack hulls sitting on squares that are now dying.
      const dyingSquares = new Set(bySquare.keys());
      setAttackDying((prev) => {
        const next = { ...prev };
        for (const a of attackCues) {
          if (dyingSquares.has(a.from)) next[a.id] = true;
        }
        return next;
      });

      after(DEATH_MS, () => {
        setFen(fenAfterDeath);
        reveal(...caps.map((c) => c.to));
      });
    });

    after(ATTACK_MS, () => {
      setAttacks((prev) => prev.filter((a) => !attackIds.has(a.id)));
      setAttackDying((prev) => {
        const next = { ...prev };
        for (const id of attackIds) delete next[id];
        return next;
      });

      const landings: SlideSpec[] = [
        ...caps
          .filter((c) => c.occupies !== false)
          .map((c) => ({ piece: c.piece, color: c.color, from: c.from, to: c.to })),
        ...extraSlides,
      ];

      const deadFrom = caps.filter((c) => c.dies || c.occupies === false).map((c) => c.from);
      if (deadFrom.length) reveal(...deadFrom);

      playSlides(landings, fenAfterMove, onDone);
    });
  };

  const finishTurn = (index: number) => {
    setTurnIndex(index);
    setPlaying(false);
    setCaption(TURN_CAPTIONS[index]);
  };

  /** Play turn `n` (1..3) from the position before it. */
  const playTurn = (n: 1 | 2 | 3) => {
    clearTimers();
    clearOverlays();
    setPlaying(true);
    setFen(FENS[n - 1]);
    setCaption(TURN_CAPTIONS[n]);

    if (n === 1) {
      playSlides(
        [
          { piece: "p", color: "w", from: "d2", to: "d4" },
          { piece: "b", color: "b", from: "e8", to: "c6" },
        ],
        FEN_AFTER_T1,
        () => finishTurn(1),
      );
      return;
    }

    if (n === 2) {
      playCaptures(
        [{ piece: "p", color: "w", from: "d4", to: "e5", victim: { piece: "p", color: "b" } }],
        FEN_T2_DEAD,
        FEN_AFTER_T2,
        [{ piece: "n", color: "b", from: "f6", to: "e4" }],
        () => finishTurn(2),
      );
      return;
    }

    playCaptures(
      [
        {
          piece: "r",
          color: "w",
          from: "c3",
          to: "c6",
          victim: { piece: "b", color: "b" },
          dies: true,
          occupies: false,
        },
        {
          piece: "n",
          color: "b",
          from: "e4",
          to: "c3",
          victim: { piece: "r", color: "w" },
        },
      ],
      FEN_T3_DEAD,
      FEN_AFTER_T3,
      [],
      () => finishTurn(3),
    );
  };

  const goBack = () => {
    if (playing()) return;
    const i = turnIndex();
    if (i <= 0) return;
    showPosition(i - 1);
  };

  const goForward = () => {
    if (playing()) return;
    const i = turnIndex();
    if (i >= TOTAL_TURNS) return;
    playTurn((i + 1) as 1 | 2 | 3);
  };

  onMount(() => {
    prepare();
    showPosition(0);
    const ro = new ResizeObserver(() => syncOverlay());
    const kick = () => {
      syncOverlay();
      if (hostRef) ro.observe(hostRef);
      const grid = hostRef ? findBoardGrid(hostRef) : null;
      if (grid) ro.observe(grid);
    };
    requestAnimationFrame(() => requestAnimationFrame(kick));
    window.addEventListener("resize", syncOverlay);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      }
    };
    window.addEventListener("keydown", onKey);

    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener("resize", syncOverlay);
      window.removeEventListener("keydown", onKey);
      clearTimers();
    });
  });

  createEffect(() => {
    void hidden();
    if (hostRef) applyHiddenImgs(hostRef, hidden());
  });

  const moverNode = (m: MoveCue): JSX.Element => {
    switch (m.piece) {
      case "b":
        return <InlineBishop color={m.color} face="front" />;
      case "r":
        return <InlineRook color={m.color} aimDeg={ROOK_REST_AIM_DEG} />;
      case "n":
        return <InlineKnight color={m.color} />;
      default:
        return <InlinePawn color={m.color} face="back" />;
    }
  };

  return (
    <div class={styles.demo}>
      <div class={styles.host} ref={hostRef}>
        <ChessBoard
          variant="eclipse"
          fogOfWar
          attackCues={attacks()}
          attackDying={attackDying()}
          deathCues={deaths()}
        />
        <Show when={movers().length > 0 ? overlayBox() : null}>
          {(box) => (
            <div
              class={styles.boardOverlay}
              data-broodwar-move-layer
              style={{
                top: `${box().top}px`,
                left: `${box().left}px`,
                width: `${box().width}px`,
                height: `${box().height}px`,
              }}
            >
              <For each={movers()}>
                {(m) => {
                  const sq = () => (moveProgress()[m.id] === 1 ? m.to : m.from);
                  return (
                    <div
                      class={styles.mover}
                      style={squareBoxStyle(sq(), box().width, box().height)}
                    >
                      <div class={styles.pieceFace}>{moverNode(m)}</div>
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </Show>
      </div>
      <div class={styles.reviewBar}>
        <DualNavButton
          inverted
          inline
          label={`Turn ${turnIndex()} / ${TOTAL_TURNS}`}
          onBack={goBack}
          onForward={goForward}
          backDisabled={playing() || turnIndex() <= 0}
          forwardDisabled={playing() || turnIndex() >= TOTAL_TURNS}
        />
      </div>
      <p class={styles.caption}>Review · Brood War combat · {caption()}</p>
    </div>
  );
};
