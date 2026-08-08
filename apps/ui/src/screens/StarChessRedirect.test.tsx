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
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal("location", {
      ...window.location,
      search: "?scfen=SCFEN%7Ctest",
      hash: "#review",
      replace,
    });
    render(() => <StarChessRedirect />);
    expect(setItem).toHaveBeenCalledWith("starchess_from_chess", "1");
    expect(replace).toHaveBeenCalledWith("/starchess/?scfen=SCFEN%7Ctest#review");
  });
});
