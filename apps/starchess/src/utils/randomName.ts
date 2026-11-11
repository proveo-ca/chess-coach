import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator";

/**
 * Playful default like "Sneaky Otter" — same helper as Coach.
 * Browser exposes no real player identity.
 */
export const randomName = (): string =>
  uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: " ",
    style: "capital",
    length: 2,
  });
