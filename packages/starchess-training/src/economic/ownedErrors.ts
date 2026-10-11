// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
export type OwnedIngressCode = "PROVENANCE" | "FLOAT64" | "REF" | "CARRIER" | "BYTES" | "CANONICAL" | "INDEX";

export class OwnedIngressError extends Error {
  override readonly name = "OwnedIngressError";
  constructor(readonly code: OwnedIngressCode) {
    super(code);
  }
}

export const rejectOwned = (code: OwnedIngressCode): never => { throw new OwnedIngressError(code); };
