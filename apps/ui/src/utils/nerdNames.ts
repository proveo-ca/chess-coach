import nerdNames from "~/data/nerd-names.json";

const normalizeName = (name: string) => name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const allNerdNames = Object.values(nerdNames).flat();

export const levenshteinDistance = (left: string, right: string): number => {
  const a = [...normalizeName(left)];
  const b = [...normalizeName(right)];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length] ?? a.length;
};

export const findNerdName = (playerName: string, maxDistance = 2): string | null => {
  const normalizedPlayerName = normalizeName(playerName);
  if (!normalizedPlayerName) return null;

  return (
    allNerdNames.find(
      (nerdName) => levenshteinDistance(normalizedPlayerName, nerdName) <= maxDistance,
    ) ?? null
  );
};
