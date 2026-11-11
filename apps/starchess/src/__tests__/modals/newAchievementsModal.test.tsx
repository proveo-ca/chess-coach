import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { achievementsFor } from "~/achievements/catalog";
import { NewAchievementsModal } from "~/components/features/NewAchievementsModal";
import type { AchievementBubble } from "~/types/achievements";

afterEach(cleanup);

const bubble = (shortId: string, level: AchievementBubble["level"]): AchievementBubble => ({
  id: `${shortId}-${level}`,
  shortId,
  level,
  origin: "e4",
  side: "w",
  icon: achievementsFor(shortId)[0]!.icon,
});

describe("NewAchievementsModal", () => {
  it("titles the sheet Achievements, without New", () => {
    render(() => (
      <NewAchievementsModal open earned={[bubble("stonks", 1)]} onContinue={() => {}} />
    ));
    expect(screen.getByText("Achievements")).toBeTruthy();
    expect(screen.queryByText(/new achievements/i)).toBeNull();
  });

  it("suffixes (new) only on badges raised past their stored level", () => {
    const fresh = bubble("stonks", 2);
    const repeat = bubble("medal", 1);
    render(() => (
      <NewAchievementsModal
        open
        earned={[fresh, repeat]}
        newShortIds={new Set(["stonks"])}
        onContinue={() => {}}
      />
    ));
    const [first, second] = screen.getAllByTestId("new-achievement");
    expect(first!.dataset.new).toBe("true");
    expect(first!.textContent).toContain("(new)");
    expect(second!.dataset.new).toBeUndefined();
    expect(second!.textContent).not.toContain("(new)");
  });
});
