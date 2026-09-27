// SPEC: _spec/apps/starchess/match-store.puml, _spec/apps/starchess/architecture/reactivity/app-screens.md
import { batch, createSignal, type Accessor, type Setter } from "solid-js";

type Field = [Accessor<unknown>, Setter<unknown>];

export type ShellFields<T extends object> = {
  view: T;
  read: () => T;
  write: (next: T) => void;
};

export const createShellFields = <T extends object>(initial: T): ShellFields<T> => {
  let current = initial;
  const fields = new Map<PropertyKey, Field>();

  const field = (key: PropertyKey): Field => {
    let f = fields.get(key);
    if (!f) {
      f = createSignal<unknown>((current as Record<PropertyKey, unknown>)[key], {
        equals: Object.is,
      }) as Field;
      fields.set(key, f);
    }
    return f;
  };

  const view = new Proxy({} as T, {
    get: (_target, key) => field(key)[0](),
    has: (_target, key) => key in current,
    ownKeys: () => Reflect.ownKeys(current),
    getOwnPropertyDescriptor: (_target, key) =>
      key in current
        ? { enumerable: true, configurable: true, writable: false, value: field(key)[0]() }
        : undefined,
    set: () => {
      throw new Error("match shell is read-only — dispatch an action");
    },
    deleteProperty: () => {
      throw new Error("match shell is read-only — dispatch an action");
    },
  });

  const write = (next: T) => {
    if (next === current) return;
    const prev = current as Record<PropertyKey, unknown>;
    current = next;
    const now = next as Record<PropertyKey, unknown>;
    batch(() => {
      for (const [key, [, set]] of fields) {
        if (!Object.is(prev[key], now[key])) set(() => now[key]);
      }
    });
  };

  return { view, read: () => current, write };
};
