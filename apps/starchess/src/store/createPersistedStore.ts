import { createEffect, createRoot } from "solid-js";
import { type SetStoreFunction, createStore } from "solid-js/store";

/**
 * Solid store mirrored to `localStorage` under `key`.
 * Same pattern as Coach `apps/ui` — shared origin shares the blob.
 */
export function createPersistedStore<T extends object>(
  key: string,
  initialValue: T,
): [T, SetStoreFunction<T>] {
  let state = initialValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<T>;
      state = { ...initialValue, ...parsed };
    }
  } catch (e) {
    console.error(`Failed to load state for key: ${key}`, e);
  }

  const [store, setStore] = createStore<T>(state);

  createRoot(() => {
    createEffect(() => {
      try {
        localStorage.setItem(key, JSON.stringify(store));
      } catch (e) {
        console.error(`Failed to save state for key: ${key}`, e);
      }
    });
  });

  return [store, setStore];
}

/**
 * Coach + StarChess share `chess_coach_settings_state`. StarChess only owns
 * `playerName` — patch that field so other Coach settings are not wiped.
 */
export function createSharedSettingsFieldStore<T extends object>(
  key: string,
  initialValue: T,
): [T, SetStoreFunction<T>] {
  let state = initialValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<T>;
      state = { ...initialValue, ...parsed };
    }
  } catch (e) {
    console.error(`Failed to load state for key: ${key}`, e);
  }

  const [store, setStore] = createStore<T>(state);

  createRoot(() => {
    createEffect(() => {
      try {
        // Touch store fields so Solid tracks them.
        const patch = { ...store } as Record<string, unknown>;
        let existing: Record<string, unknown> = {};
        try {
          const raw = localStorage.getItem(key);
          if (raw) existing = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          existing = {};
        }
        localStorage.setItem(key, JSON.stringify({ ...existing, ...patch }));
      } catch (e) {
        console.error(`Failed to save state for key: ${key}`, e);
      }
    });
  });

  return [store, setStore];
}
