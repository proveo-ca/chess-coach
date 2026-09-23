export type PlayerColorPref = "w" | "b" | "random";
export type Difficulty = "intermediate" | "advanced" | "expert";
export type PieceSet =
  | "cburnett"
  | "selena"
  | "gord"
  | "manuel"
  | "nerd"
  | "nerd-height"
  | "nerd-space"
  | "nerd-weight";
/** Classical-chess Nerd identity skins (Storybook / future picker). */
export type NerdPieceSet = Extract<PieceSet, "nerd" | `nerd-${string}`>;
export type PlayerIdentity = "Human" | "Cat" | "Dog" | "Rat" | "Nerd";
