/** Storybook toolbar theme → `document.documentElement` `data-theme`. */
export type StorybookTheme = "light" | "dark";

export const applyStorybookTheme = (theme: StorybookTheme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.body.style.background = "var(--bg-color)";
  document.body.style.color = "var(--text-color)";
};

export const storybookThemeGlobalTypes = {
  theme: {
    description: "Color theme",
    toolbar: {
      title: "Theme",
      icon: "circlehollow",
      items: [
        { value: "light", title: "Light", icon: "sun" },
        { value: "dark", title: "Dark", icon: "moon" },
      ],
      dynamicTitle: true,
    },
  },
} as const;

export const readStorybookTheme = (globals: Record<string, unknown>): StorybookTheme =>
  globals.theme === "light" ? "light" : "dark";
