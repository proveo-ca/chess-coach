// SPEC: _spec/apps/starchess/vfx-tier.puml
import { pinVfxTier } from "~/store/vfxTierStore";

export const storybookVfxTierGlobalTypes = {
  vfxTier: {
    description: "Combat VFX tier (the menu CPU probe's full / lite)",
    toolbar: {
      title: "VFX",
      icon: "lightning",
      items: [
        { value: "full", title: "Full VFX" },
        { value: "lite", title: "Lite VFX" },
      ],
      dynamicTitle: true,
    },
  },
} as const;

export const applyStorybookVfxTier = (globals: Record<string, unknown>): void => {
  pinVfxTier(globals.vfxTier === "lite" ? "lite" : "full");
};
