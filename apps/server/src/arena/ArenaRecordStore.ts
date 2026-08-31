/**
 * `ArenaRecordStore` — the server's arena run store.
 *
 * Phase 2 keeps finished `ArenaGameRecord`s in memory, paging out the oldest
 * run past the cap (50 by default) so a busy feed never unbounds memory. The
 * armed-and-ready web import/replay (Phase 3) reads from here — the GET route
 * is already the shared surface.
 *
 * // SPEC: _spec/apps/server/starchess-arena-feed.puml
 */

import type { ArenaGameRecord } from "@chess-coach/starchess-arena";

export const DEFAULT_ARENA_STORE_CAP = 50;

export class ArenaRecordStore {
  private readonly byId = new Map<string, ArenaGameRecord>();
  private readonly order: string[] = [];
  private readonly cap: number;

  constructor(cap: number = DEFAULT_ARENA_STORE_CAP) {
    this.cap = cap;
  }

  put(record: ArenaGameRecord): ArenaGameRecord {
    if (!this.byId.has(record.id)) this.order.push(record.id);
    this.byId.set(record.id, record);
    while (this.order.length > this.cap) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.byId.delete(oldest);
    }
    return record;
  }

  get(id: string): ArenaGameRecord | undefined {
    return this.byId.get(id);
  }

  all(): ArenaGameRecord[] {
    return this.order.map((id) => this.byId.get(id)!).filter(Boolean);
  }

  get size(): number {
    return this.byId.size;
  }
}
