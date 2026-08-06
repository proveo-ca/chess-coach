import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StarChessRedirect } from "~/screens/StarChessRedirect";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StarChessRedirect", () => {
  it("replaces to /starchess/ preserving search and hash", () => {
    const replace = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      search: "?scfen=SCFEN%7Ctest",
      hash: "#review",
      replace,
    });
    render(() => <StarChessRedirect />);
    expect(replace).toHaveBeenCalledWith("/starchess/?scfen=SCFEN%7Ctest#review");
  });
});
