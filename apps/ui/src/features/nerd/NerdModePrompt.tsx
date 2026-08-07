import { createEffect, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Modal } from "~/components/atoms/Modal";
import { Button } from "~/components/primitives/Button";
import {
  nerdModeUnlocked,
  setNerdModeUnlocked,
} from "~/features/nerd/identity";
import { playerNameCommitTick } from "~/features/nerd/nameCommit";
import { findNerdName } from "~/features/nerd/nerdNames";
import {
  playerName,
  setPlayerIdentity,
} from "~/store/settingsStore";

/**
 * Close-enough StarCraft name (checked on name commit / blur) → choose path:
 * - Yes → standalone StarChess at `/starchess/`
 * - Keep chess classic → unlock the Nerd identity (classical chess + `public/pieces/nerd/`)
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
export const NerdModePrompt: Component = () => {
  const [open, setOpen] = createSignal(false);
  let dismissedName: string | null = null;

  createEffect(() => {
    // Depend on commit tick — ignore live keystrokes until blur / dice.
    const tick = playerNameCommitTick();
    if (tick === 0) {
      setOpen(false);
      return;
    }
    const currentName = playerName().trim().toLocaleLowerCase();
    const shouldPrompt =
      !nerdModeUnlocked() &&
      currentName !== dismissedName &&
      findNerdName(currentName) !== null;
    setOpen(shouldPrompt);
  });

  return (
    <Modal open={open()} title="Activate nerd mode?" dismissible={false} showCloseButton={false}>
      <div style={{ display: "flex", gap: "0.75rem", "justify-content": "center" }}>
        <Button
          primary
          onClick={() => {
            setOpen(false);
            const { search, hash } = window.location;
            window.location.assign(`/starchess/${search}${hash}`);
          }}
        >
          yes
        </Button>
        <Button
          onClick={() => {
            setNerdModeUnlocked(true);
            setPlayerIdentity("Nerd");
            setOpen(false);
          }}
        >
          keep chess classic
        </Button>
      </div>
    </Modal>
  );
};
