// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { constructCanonicalOpening, constructFloat64Hex, constructRef, type OwnedByteRef, type OwnedFloat64Hex, type OwnedPublicOpening } from "../economic/ownedKernel";
import { decodeOwnedNumber, encodeOwnedNumber, equalOwnedRefs } from "../economic/ownedScalars";
import { abortConstructionTicket, beginConstructionTicket, finishConstructionTicket, requireConstructionAccount } from "./constructionAccounting";
import type { ConstructionBlockId } from "./constructionInvoices";

const run = <T>(account: unknown, block: ConstructionBlockId, first?: unknown, second?: unknown): T => {
  const checked = requireConstructionAccount(account);
  const ticket = checked.debit.reserve(block);
  try {
    beginConstructionTicket(checked, ticket, block);
    let result: OwnedFloat64Hex | OwnedByteRef | OwnedPublicOpening | number | boolean;
    switch (block) {
      case "float64-construct": result = constructFloat64Hex(first as string); break;
      case "float64-encode": result = encodeOwnedNumber(first as number); break;
      case "float64-decode": result = decodeOwnedNumber(first); break;
      case "ref-construct": result = constructRef(first as number, second as string); break;
      case "ref-equal": result = equalOwnedRefs(first, second); break;
      case "opening-construct": result = constructCanonicalOpening(); break;
    }
    finishConstructionTicket(checked, ticket);
    return result as T;
  } catch (error) {
    try { abortConstructionTicket(checked, ticket); } catch {}
    throw error;
  }
};

export const accountedConstructFloat64 = (account: unknown, hex: string): OwnedFloat64Hex =>
  run(account, "float64-construct", hex);

export const accountedEncodeNumber = (account: unknown, value: number): OwnedFloat64Hex =>
  run(account, "float64-encode", value);

export const accountedDecodeNumber = (account: unknown, value: unknown): number =>
  run(account, "float64-decode", value);

export const accountedConstructRef = (account: unknown, byteLength: number, sha256: string): OwnedByteRef =>
  run(account, "ref-construct", byteLength, sha256);

export const accountedEqualRefs = (account: unknown, left: unknown, right: unknown): boolean =>
  run(account, "ref-equal", left, right);

export const accountedCanonicalOpening = (account: unknown): OwnedPublicOpening =>
  run(account, "opening-construct");
