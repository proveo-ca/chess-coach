// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { CONSTRUCTION_WORK_CAP, rejectAccounting, reservePrimitive, type ConstructionAccountingCode } from "../economic/accountingPrimitives";
import { quoteConstructionBlock, type ConstructionBlockId } from "./constructionInvoices";

export const CONSTRUCTION_BOOTSTRAP_UNITS = 2048;
export const CONSTRUCTION_GATE_UNITS = 512;
export const CONSTRUCTION_CLEANUP_UNITS = 512;
export const CONSTRUCTION_ENVELOPE_UNITS = 1024;

export type UnboundMeterStorage = { readonly limit: 1048576; used: number };
declare const ticketBrand: unique symbol;
export type ConstructionTicket = Readonly<{ [ticketBrand]: "private-construction-ticket" }>;
export type ConstructionAccount = Readonly<{
  meter: UnboundMeterStorage;
  owner: Readonly<{ enterOnce(): void; finish(): void; abort(): void }>;
  debit: Readonly<{ reserve(block: ConstructionBlockId): ConstructionTicket }>;
}>;
type Phase = "new" | "active" | "reserved" | "executing" | "finished" | "aborted" | "failed";
type Control = {
  account: ConstructionAccount | undefined; meter: UnboundMeterStorage; used: number;
  phase: Phase; gate: boolean; pending: ConstructionTicket | undefined;
};
type TicketControl = { control: Control; block: ConstructionBlockId; phase: "reserved" | "executing" | "expired" };
const accounts = new WeakMap<object, Control>();
const tickets = new WeakMap<object, TicketControl>();
const accountGet = WeakMap.prototype.get.bind(accounts);
const accountSet = WeakMap.prototype.set.bind(accounts);
const ticketGet = WeakMap.prototype.get.bind(tickets);
const ticketSet = WeakMap.prototype.set.bind(tickets);
const freeze = Object.freeze;
const define = Object.defineProperty;
const descriptor = Object.getOwnPropertyDescriptor;
const preventExtensions = Object.preventExtensions;

const controlFor = (value: unknown): Control => {
  if (value === null || typeof value !== "object") return rejectAccounting("PROVENANCE");
  const control = accountGet(value);
  if (!control) return rejectAccounting("PROVENANCE");
  return control;
};

const expire = (control: Control): void => {
  if (control.pending) {
    const ticket = ticketGet(control.pending);
    if (ticket) ticket.phase = "expired";
    control.pending = undefined;
  }
};

const fail = (control: Control, code: ConstructionAccountingCode): never => {
  expire(control);
  control.phase = "failed";
  control.gate = false;
  return rejectAccounting(code);
};

const checkUsage = (control: Control): void => {
  const used = descriptor(control.meter, "used")!;
  if (used.writable !== true || used.value !== control.used) fail(control, "TAMPER");
};

const takeGate = (control: Control, phase: "new" | "active"): void => {
  checkUsage(control);
  if (control.phase !== phase || !control.gate) fail(control, "LIFECYCLE");
  control.gate = false;
};

const reserve = (control: Control, units: number): void => {
  try {
    const next = reservePrimitive(control.used, units);
    control.used = next;
    control.meter.used = next;
  } catch (error) {
    expire(control);
    control.phase = "failed";
    control.gate = false;
    throw error;
  }
};

const requiredTicket = (control: Control, value: unknown): TicketControl => {
  if (value === null || typeof value !== "object") return fail(control, "TICKET");
  const ticket = ticketGet(value);
  if (!ticket || ticket.control !== control) return fail(control, "TICKET");
  return ticket;
};

export const requireConstructionAccount = (value: unknown): ConstructionAccount => controlFor(value).account!;

export const createConstructionAccount = (): ConstructionAccount => {
  const initial = reservePrimitive(0, CONSTRUCTION_BOOTSTRAP_UNITS + CONSTRUCTION_GATE_UNITS + CONSTRUCTION_CLEANUP_UNITS);
  const meter: UnboundMeterStorage = { limit: CONSTRUCTION_WORK_CAP, used: initial };
  const limitDescriptor = { __proto__: null, value: CONSTRUCTION_WORK_CAP, writable: false, configurable: false, enumerable: true };
  const usedDescriptor = { __proto__: null, value: initial, writable: true, configurable: false, enumerable: true };
  define(meter, "limit", limitDescriptor);
  define(meter, "used", usedDescriptor);
  preventExtensions(meter);
  const control: Control = { account: undefined, meter, used: initial, phase: "new", gate: true, pending: undefined };
  const owner = freeze({
    enterOnce(): void {
      takeGate(control, "new");
      reserve(control, CONSTRUCTION_GATE_UNITS);
      control.phase = "active";
      control.gate = true;
    },
    finish(): void {
      takeGate(control, "active");
      control.phase = "finished";
    },
    abort(): void {
      checkUsage(control);
      if (control.phase === "finished" || control.phase === "aborted" || control.phase === "failed") fail(control, "LIFECYCLE");
      expire(control);
      control.phase = "aborted";
      control.gate = false;
    },
  });
  const debit = freeze({
    reserve(block: ConstructionBlockId): ConstructionTicket {
      takeGate(control, "active");
      let quote;
      try { quote = quoteConstructionBlock(block); }
      catch (error) { control.phase = "failed"; throw error; }
      reserve(control, quote.units + CONSTRUCTION_ENVELOPE_UNITS + CONSTRUCTION_GATE_UNITS);
      const token = freeze({}) as ConstructionTicket;
      ticketSet(token, { control, block: quote.block, phase: "reserved" });
      control.pending = token;
      control.phase = "reserved";
      control.gate = true;
      return token;
    },
  });
  const account = freeze({ meter, owner, debit });
  control.account = account;
  accountSet(account, control);
  return account;
};

export const beginConstructionTicket = (account: unknown, value: unknown, block: ConstructionBlockId): void => {
  const control = controlFor(account);
  checkUsage(control);
  const ticket = requiredTicket(control, value);
  if (control.phase !== "reserved" || control.pending !== value || ticket.phase !== "reserved" || ticket.block !== block) fail(control, "TICKET");
  ticket.phase = "executing";
  control.phase = "executing";
};

export const finishConstructionTicket = (account: unknown, value: unknown): void => {
  const control = controlFor(account);
  checkUsage(control);
  const ticket = requiredTicket(control, value);
  if (control.phase !== "executing" || control.pending !== value || ticket.phase !== "executing") fail(control, "TICKET");
  expire(control);
  control.phase = "active";
};

export const abortConstructionTicket = (account: unknown, value: unknown): void => {
  const control = controlFor(account);
  checkUsage(control);
  const ticket = requiredTicket(control, value);
  if (control.phase !== "executing" || control.pending !== value || ticket.phase !== "executing") fail(control, "TICKET");
  expire(control);
  control.phase = "failed";
  control.gate = false;
};
