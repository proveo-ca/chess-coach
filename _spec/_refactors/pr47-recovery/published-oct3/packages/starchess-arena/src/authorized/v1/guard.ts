// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { fail } from "../../challengeContract/validation";

export const guardDto = (value: unknown, path = "$"): void => {
  const ancestors = new WeakSet<object>();
  const visit = (current: unknown, at: string): void => {
    if (current === null || typeof current !== "object") {
      if (!["undefined", "string", "number", "boolean"].includes(typeof current) && current !== null) fail(at);
      return;
    }
    if (ancestors.has(current)) return fail(at);
    const isArray = Array.isArray(current);
    const prototype = Object.getPrototypeOf(current);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return fail(at);
    ancestors.add(current);
    const keys = Reflect.ownKeys(current);
    if (isArray) {
      const length = Object.getOwnPropertyDescriptor(current, "length");
      if (!length || !Object.hasOwn(length, "value") || !Number.isSafeInteger(length.value) ||
        length.value < 0 || keys.length !== length.value + 1) return fail(at, "ARRAY");
      for (let index = 0; index < length.value; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return fail(at, "ARRAY");
        visit(descriptor.value, `${at}[${index}]`);
      }
    } else {
      for (const key of keys) {
        if (typeof key !== "string") return fail(at);
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return fail(`${at}.${key}`);
        visit(descriptor.value, `${at}.${key}`);
      }
    }
    ancestors.delete(current);
  };
  visit(value, path);
};
