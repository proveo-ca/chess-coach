// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import { collectSourceInventory } from "../src/challenge/sourceInventory";

if (process.argv.length !== 3) throw new Error("Expected repository root");
const inventory = collectSourceInventory(process.argv[2]);
if (inventory.audit.passed !== true) throw new Error("Source inventory audit failed");
process.stdout.write(JSON.stringify(inventory) + "\n");
