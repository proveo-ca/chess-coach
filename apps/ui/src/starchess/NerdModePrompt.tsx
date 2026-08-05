import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Modal } from "~/components/atoms/Modal";
import { Button } from "~/components/primitives/Button";
import {
  playerName,
  setPlayerIdentity,
} from "~/store/settingsStore";
import {
  nerdModeUnlocked,
  setNerdModeUnlocked,
} from "~/starchess/identity";
import { findNerdName } from "~/starchess/nerdNames";

/**
 * Close-enough StarCraft name → choose path:
 * - Yes → StarChess (`NerdScreen` / `/starchess`)
 * - Keep chess classic → unlock the Nerd identity (classical chess + `public/pieces/nerd/`)
 */
export const NerdModePrompt: Component = () => {
  const navigate = useNavigate();
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
            setOpen(false);
            navigate("/starchess");
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
