// SPEC: _spec/classical-resolution.puml
import { expect, test } from "bun:test";
import * as core from "../src";
import { applyPathRevealAttack, applyPathRevealCCShot, applyPendingCCShots, createCanonicalGame,
  mapToPlacement, placementToMap, resolveTurn } from "../src";
import type { ResolveAttack, ResolveTurnInput, ScPiece, Square } from "../src";

function input(pieces: readonly (readonly [Square, ScPiece["type"], "w" | "b"])[]): ResolveTurnInput {
  return { placement: mapToPlacement(new Map(pieces.map(([at, type, color]) => [at, { type, color }]))),
    ccLives: { w: 3, b: 3 }, white: null, black: null };
}

test("pass preserves the initialized board and does not mutate its input", () => {
  const game = createCanonicalGame();
  const request = { placement: game.snapshot.placement, ccLives: game.snapshot.ccLives, white: null, black: null };
  const before = structuredClone(request);
  const result = resolveTurn(request);
  expect(result.afterAll).toEqual({ placement: request.placement, ccLives: { w: 3, b: 3 }, mines: [] });
  expect(result.attacks).toEqual([]);
  expect(result.moves).toEqual([]);
  expect(request).toEqual(before);
  expect(Reflect.has(core, "resolveClassical")).toBe(false);
});

test("public classical resolution rejects unsupported native-double shapes", () => {
  const request = input([["a1", "k", "w"], ["h8", "k", "b"], ["e3", "p", "w"]]);
  request.white = { color: "w", from: "e3", to: "e5" };
  const before = structuredClone(request);
  expect(() => resolveTurn(request)).toThrow(core.ScValidateError);
  expect(request).toEqual(before);
});

test("visible mutual captures retire the whole attack wave before movement", () => {
  const request = input([["a1", "k", "w"], ["h8", "k", "b"], ["a4", "r", "w"], ["h4", "r", "b"]]);
  request.white = { color: "w", from: "a4", to: "h4" };
  request.black = { color: "b", from: "h4", to: "a4" };
  const result = resolveTurn(request);
  expect(result.attacks).toHaveLength(2);
  expect(result.moves).toEqual([]);
  expect([...placementToMap(result.afterAll.placement).keys()].sort()).toEqual(["a1", "h8"]);
});

test("unseen departing Hoverbikes swap instead of inventing capture witnesses", () => {
  const request = input([["a1", "k", "w"], ["h8", "k", "b"], ["c3", "n", "w"], ["d5", "n", "b"]]);
  request.white = { color: "w", from: "c3", to: "d5" };
  request.black = { color: "b", from: "d5", to: "c3" };
  request.isTargetVisible = () => false;
  const result = resolveTurn(request);
  expect(result.attacks).toEqual([]);
  expect(result.moveCollisions).toEqual([]);
  expect(result.moves).toHaveLength(2);
  const board = placementToMap(result.afterAll.placement);
  expect(board.get("d5")).toEqual({ type: "n", color: "w" });
  expect(board.get("c3")).toEqual({ type: "n", color: "b" });
});

test("simultaneous Marine arrival destroys both movers", () => {
  const request = input([["a1", "k", "w"], ["h8", "k", "b"], ["d3", "p", "w"], ["d5", "p", "b"]]);
  request.white = { color: "w", from: "d3", to: "d4" };
  request.black = { color: "b", from: "d5", to: "d4" };
  const result = resolveTurn(request);
  expect(result.moveCollisions).toHaveLength(2);
  expect(result.moves).toHaveLength(2);
  expect(placementToMap(result.afterAll.placement).has("d4")).toBe(false);
});

test("two moving Command Centers cancel contact without unit destruction", () => {
  const request = input([["d3", "k", "w"], ["d5", "k", "b"]]);
  request.white = { color: "w", from: "d3", to: "d4" };
  request.black = { color: "b", from: "d5", to: "d4" };
  const result = resolveTurn(request);
  expect(result.moves).toEqual([]);
  expect(result.moveCollisions).toEqual([]);
  expect(result.afterAll.placement).toBe(request.placement);
  expect(result.afterAll.ccLives).toEqual({ w: 3, b: 3 });
});

test("a Command Center takes a simultaneously arriving nonCC mover", () => {
  const request = input([["d3", "k", "w"], ["h8", "k", "b"], ["d5", "p", "b"]]);
  request.white = { color: "w", from: "d3", to: "d4" };
  request.black = { color: "b", from: "d5", to: "d4" };
  const result = resolveTurn(request);
  expect(result.moveCollisions).toHaveLength(1);
  expect(placementToMap(result.afterAll.placement).get("d4")).toEqual({ type: "k", color: "w" });
  expect(placementToMap(result.afterAll.placement).has("d5")).toBe(false);
});

test("a later slider stops short of an already landed Command Center", () => {
  const request = input([["d3", "k", "w"], ["h8", "k", "b"], ["d7", "r", "b"]]);
  request.white = { color: "w", from: "d3", to: "d4" };
  request.black = { color: "b", from: "d7", to: "d4" };
  const result = resolveTurn(request);
  const board = placementToMap(result.afterAll.placement);
  expect(board.get("d4")).toEqual({ type: "k", color: "w" });
  expect(board.get("d5")).toEqual({ type: "r", color: "b" });
  expect(result.moveCollisions).toEqual([]);
});

test("landing mine death cancels a later potential mover contact", () => {
  const request = input([["a1", "k", "w"], ["h8", "k", "b"], ["d3", "p", "w"], ["d6", "r", "b"]]);
  request.white = { color: "w", from: "d3", to: "d4" };
  request.black = { color: "b", from: "d6", to: "d4" };
  request.mines = [{ color: "b", at: "d4" }];
  const result = resolveTurn(request);
  expect(result.mineTriggers).toHaveLength(1);
  expect(result.moveCollisions).toEqual([]);
  expect(result.afterAll.mines).toEqual([]);
  expect(placementToMap(result.afterAll.placement).get("d4")).toEqual({ type: "r", color: "b" });
});

for (const promotion of ["n", "b", "r", "q"] as const) {
  test(`only surviving last-rank Marine arrivals promote to ${promotion}`, () => {
    const request = input([["e1", "k", "w"], ["h8", "k", "b"], ["a7", "p", "w"]]);
    request.white = { color: "w", from: "a7", to: "a8", promotion };
    const result = resolveTurn(request);
    expect(placementToMap(result.afterMove.placement).get("a8")?.type).toBe("p");
    expect(placementToMap(result.afterAll.placement).get("a8")?.type).toBe(promotion);
    expect(result.promotions).toHaveLength(1);
    const mined = resolveTurn({ ...request, mines: [{ color: "b", at: "a8" }] });
    expect(mined.promotions).toEqual([]);
    expect(placementToMap(mined.afterAll.placement).has("a8")).toBe(false);
  });
}

test("sieged visible empty fire shells without moving and unseen empty fire fizzles", () => {
  const request = input([["e1", "k", "w"], ["h8", "k", "b"], ["a1", "r", "w"]]);
  request.white = { color: "w", from: "a1", to: "a8" };
  request.siegedTanks = ["a1"];
  const visible = resolveTurn(request);
  expect(visible.attacks).toEqual([{ kind: "shelling", piece: "r", color: "w", from: "a1", to: "a8" }]);
  expect(visible.moves).toEqual([]);
  expect(resolveTurn({ ...request, isTargetVisible: () => false }).attacks).toEqual([]);
});

test("Marine empty diagonal mine clearing requires current target visibility", () => {
  const request = input([["a1", "k", "w"], ["h8", "k", "b"], ["d3", "p", "w"]]);
  request.white = { color: "w", from: "d3", to: "e4" };
  request.mines = [{ color: "b", at: "e4" }];
  const visible = resolveTurn(request);
  expect(visible.attacks).toHaveLength(1);
  expect(visible.afterAll.mines).toEqual([]);
  expect(placementToMap(visible.afterAll.placement).get("e4")?.type).toBe("p");
  const fogged = resolveTurn({ ...request, isTargetVisible: () => false });
  expect(fogged.attacks).toEqual([]);
  expect(fogged.afterAll.placement).toBe(request.placement);
  expect(fogged.afterAll.mines).toEqual([...request.mines!]);
});

test("pending CC rays hit blockers and clear every mine on a consumed tile", () => {
  const placement = input([["e1", "k", "w"], ["a8", "k", "b"], ["a1", "r", "w"], ["a4", "b", "b"]]).placement;
  const result = applyPendingCCShots({ placement, ccLives: { w: 3, b: 3 }, pending: [{ color: "w", piece: "r", from: "a1", to: "a8" }],
    mines: [{ color: "b", at: "a4" }, { color: "w", at: "a4" }] });
  expect(result.attacks).toEqual([{ kind: "capture", piece: "r", color: "w", from: "a1", to: "a4",
    victim: { piece: "b", color: "b" }, occupies: false, collision: true, mineColor: "b" }]);
  expect(result.mines).toEqual([]);
  expect(result.ccLives.b).toBe(3);
  expect(placementToMap(result.placement).get("a1")?.type).toBe("r");
});

test("pending shots execute White before Black even when both lives reach zero", () => {
  const placement = input([["a1", "k", "w"], ["b1", "k", "b"]]).placement;
  const result = applyPendingCCShots({ placement, ccLives: { w: 1, b: 1 }, pending: [
    { color: "b", piece: "k", from: "b1", to: "a1" }, { color: "w", piece: "k", from: "a1", to: "b1" },
  ] });
  expect(result.attacks.map(attack => attack.color)).toEqual(["w", "b"]);
  expect(result.ccLives).toEqual({ w: 0, b: 0 });
});

test("deferred path capture verifies live actor and victim descriptors", () => {
  const snapshot = { placement: input([["e1", "k", "w"], ["h8", "k", "b"], ["a1", "r", "w"], ["a8", "b", "b"]]).placement,
    mines: [], ccLives: { w: 3, b: 3 } };
  const attack: ResolveAttack = { kind: "capture", piece: "r", color: "w", from: "a3", to: "a8", victim: { piece: "b", color: "b" },
    pathRevealFrom: "a1", pathRevealSteps: 2, occupies: true };
  expect(applyPathRevealAttack(snapshot, attack).fired).toBe(true);
  expect(applyPathRevealAttack(snapshot, { ...attack, victim: { piece: "p", color: "b" } }).fired).toBe(false);
  expect(applyPathRevealAttack(snapshot, { ...attack, piece: "q" }).fired).toBe(false);
  expect(placementToMap(snapshot.placement).get("a1")?.type).toBe("r");
});

test("deferred CC shot refuses an occupied stop square before changing lives", () => {
  const snapshot = { placement: input([["e1", "k", "w"], ["a8", "k", "b"], ["a1", "r", "w"], ["a7", "p", "w"]]).placement,
    mines: [], ccLives: { w: 3, b: 3 } };
  const attack: Extract<ResolveAttack, { kind: "ccShot" }> = { kind: "ccShot", piece: "r", color: "w", from: "a3", to: "a8", target: "b",
    livesAfter: 0, pathRevealFrom: "a1", pathRevealSteps: 2, stopAt: "a7" };
  expect(applyPathRevealCCShot(snapshot, attack)).toMatchObject({ fired: false, ccLives: { w: 3, b: 3 } });
  expect(applyPathRevealCCShot(snapshot, { ...attack, stopAt: "a6" })).toMatchObject({ fired: true, ccLives: { w: 3, b: 2 } });
});
