// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
export const CONSTRUCTION_WORK_CAP = 1048576 as const;
export type ConstructionAccountingCode = "PROVENANCE" | "NUMBER" | "WORK_CAP" | "LIFECYCLE" | "TICKET" | "TAMPER" | "INVOICE";

export class ConstructionAccountingError extends Error {
  override readonly name = "ConstructionAccountingError";
  constructor(readonly code: ConstructionAccountingCode) {
    super(code);
  }
}

export const rejectAccounting = (code: ConstructionAccountingCode): never => { throw new ConstructionAccountingError(code); };

const integer = Number.isSafeInteger;
const sameValue = Object.is;
export const reservePrimitive = (used: number, invoice: number): number => {
  if (typeof used !== "number" || typeof invoice !== "number" || !integer(used) || !integer(invoice) ||
      used < 0 || invoice < 0 || used > CONSTRUCTION_WORK_CAP || invoice > CONSTRUCTION_WORK_CAP ||
      sameValue(used, -0) || sameValue(invoice, -0)) return rejectAccounting("NUMBER");
  if (invoice > CONSTRUCTION_WORK_CAP - used) return rejectAccounting("WORK_CAP");
  return used + invoice;
};
