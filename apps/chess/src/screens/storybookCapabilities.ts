import { capabilities, setCapabilities } from "~/store/capabilitiesStore";

/** Storybook policy seam; runtime components continue to read capabilities only. */
export const setStorybookCapabilities = (value: ReturnType<typeof capabilities>) =>
  setCapabilities(value);
