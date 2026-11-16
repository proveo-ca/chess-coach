// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { rejectAccounting } from "../economic/accountingPrimitives";

export type ConstructionBlockId = "float64-construct" | "float64-encode" | "float64-decode" | "ref-construct" | "ref-equal" | "opening-construct";
type ConstructionQuote = Readonly<{ block: ConstructionBlockId; units: number }>;

const A = (arity: number): number => 32 + 8 * arity;
const R = (slots: number): number => 32 + 8 * slots;
const F = (slots: number): number => 64 + 16 * slots;
const P = (slots: number): number => R(slots) + F(slots) + 32 + 32;
const G = 64;
const H = (characters: number): number => 48 + characters * (A(1) + 4 + 24);
const From = (lanes: number): number => 96 + 32 * lanes;
const J = (lanes: number): number => 64 + 16 * lanes;

const float64Construction = 32 + H(16) + P(1);
const float64Encoding = 64 + 40 + 32 + A(3) + 64 + R(1) + 32 + From(16)
  + 8 * (A(1) + 8 + 32) + A(1) + J(16) + P(1) + A(2);
const float64Decoding = 32 + G + 40 + 32 + 8 * (16 + 2 * (A(1) + 24) + A(2) + 8) + A(2) + 64;
const refConstruction = 64 + H(64) + P(2);
const refEquality = 32 + 2 * G + 32 + (32 + 8 * 64);
const openingConstruction = 64 + 3 * P(2) + 3 * P(5);

const invoices: Readonly<Record<ConstructionBlockId, ConstructionQuote>> = Object.freeze({
  "float64-construct": Object.freeze({ block: "float64-construct", units: float64Construction }),
  "float64-encode": Object.freeze({ block: "float64-encode", units: float64Encoding }),
  "float64-decode": Object.freeze({ block: "float64-decode", units: float64Decoding }),
  "ref-construct": Object.freeze({ block: "ref-construct", units: refConstruction }),
  "ref-equal": Object.freeze({ block: "ref-equal", units: refEquality }),
  "opening-construct": Object.freeze({ block: "opening-construct", units: openingConstruction }),
});

export const quoteConstructionBlock = (value: unknown): ConstructionQuote => {
  if (typeof value !== "string" || value.length > 17 || (value !== "float64-construct" && value !== "float64-encode"
    && value !== "float64-decode" && value !== "ref-construct" && value !== "ref-equal"
    && value !== "opening-construct")) return rejectAccounting("INVOICE");
  return invoices[value];
};
