import { createEffect, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Modal } from "~/components/atoms/Modal";
import { Button } from "~/components/primitives/Button";
import { nerdModeUnlocked, playerName, setNerdModeUnlocked } from "~/store/settingsStore";
import { findNerdName } from "~/utils/nerdNames";

export const NerdModePrompt: Component = () => {
  const [open, setOpen] = createSignal(false);
  let dismissedName: string | null = null;

  createEffect(() => {
    const currentName = playerName().trim().toLocaleLowerCase();
    const shouldPrompt =
      !nerdModeUnlocked() && currentName !== dismissedName && findNerdName(currentName) !== null;
    setOpen(shouldPrompt);
  });

  return (
    <Modal open={open()} title="Activate nerd mode?" dismissible={false} showCloseButton={false}>
      <div style={{ display: "flex", gap: "0.75rem", "justify-content": "center" }}>
        <Button
          primary
          onClick={() => {
            setNerdModeUnlocked(true);
            setOpen(false);
          }}
        >
          yes
        </Button>
        <Button
          onClick={() => {
            dismissedName = playerName().trim().toLocaleLowerCase();
            setOpen(false);
          }}
        >
          keep chess classic
        </Button>
      </div>
    </Modal>
  );
};
