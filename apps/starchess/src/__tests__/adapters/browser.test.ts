import { describe, expect, it } from "vitest";

import {
  readArenaGameQuery,
  readReviewImport,
  readScfensQuery,
  readScfenQuery,
} from "~/adapters/browser";

describe("browser adapters", () => {
  it("readScfenQuery decodes single scfen", () => {
    const scfen = "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
    const search = `?scfen=${encodeURIComponent(scfen)}`;
    expect(readScfenQuery(search)).toBe(scfen);
  });

  it("readArenaGameQuery returns trimmed id", () => {
    expect(readArenaGameQuery("?game=abc-123")).toBe("abc-123");
    expect(readArenaGameQuery("?game=%20%20abc%20%20")).toBe("abc");
    expect(readArenaGameQuery("?game=")).toBeNull();
    expect(readArenaGameQuery("?other=1")).toBeNull();
  });

  it("readScfensQuery splits comma list and decodes", () => {
    const a = "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
    const b = "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:";
    const search = `?scfens=${encodeURIComponent(a)},${encodeURIComponent(b)}`;
    expect(readScfensQuery(search)).toEqual([a, b]);
    expect(readScfensQuery("?scfens=")).toBeNull();
    expect(readScfensQuery("?scfens=,,,")).toBeNull();
  });

  it("readReviewImport mutual exclusion game priority", () => {
    const a = "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
    const search = `?game=my-id&scfens=${encodeURIComponent(a)}`;
    expect(readReviewImport(search)).toEqual({ gameId: "my-id" });
    expect(readReviewImport(`?scfens=${encodeURIComponent(a)}`)).toEqual({
      scfens: [a],
    });
    expect(readReviewImport("?foo=bar")).toBeNull();
  });
});
