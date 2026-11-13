// SPEC: _spec/packages/starchess-arena/invocation-effect-analysis.puml
export type InvocationCase = Readonly<{ name: string; source: string; expected: "pass" | "reject"; controlSource?: string }>;

const probe = (effect: string): string => `
  const data = { key: 1 };
  const other = { key: 1 };
  const values = [0, 1];
  function consume(value: unknown): void { void value; }
  ${effect}
  consume(values[data.key]);
  consume(values[other.key]);
`;

const cases: readonly InvocationCase[] = [
  {
    name: "seeded recursive array traversal with an unrelated writer",
    expected: "pass",
    source: `
      function walk(value: unknown): void { if (Array.isArray(value)) walk(value[0]); }
      function write(bag: { key: number }): void { bag.key = 2; }
      write({ key: 0 }); walk([[1]]);
    `,
  },
  {
    name: "grounded mutual recursive traversal",
    expected: "pass",
    source: `
      function first(value: unknown): void { if (Array.isArray(value)) second(value[0]); }
      function second(value: unknown): void { if (Array.isArray(value)) first(value[0]); }
      function write(bag: { key: number }): void { bag.key = 2; }
      write({ key: 0 }); first([[1]]);
    `,
  },
  {
    name: "recursive callback forwarding retains writer effects",
    expected: "reject",
    source: probe(`
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      function forward(callback: typeof write, bag: {key: number | string}, again: boolean): void {
        if (again) forward(callback, bag, false); else callback(bag);
      }
      forward(write, data, true);
    `),
  },
  ...[false, true].map(reverse => ({
    name: `same writer retains distinct bound and unbound arguments ${reverse ? "reverse" : "forward"}`,
    expected: "reject" as const,
    source: probe(`
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      function run(callback: (bag: {key: number | string}) => void, bag: {key: number | string}): void { callback(bag); }
      ${reverse ? "run(write, other); run(write.bind(null, data), other);" : "run(write.bind(null, data), other); run(write, other);"}
    `),
  })),
  {
    name: "recursive reflected callback retains writer effects",
    expected: "reject",
    source: probe(`
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      function forward(callback: typeof write, bag: {key: number | string}, again: boolean): void {
        if (again) forward(callback, bag, false); else Reflect.apply(callback, null, [bag]);
      }
      forward(write, data, true);
    `),
  },
  {
    name: "recursive callback default retains captured writer input",
    expected: "reject",
    source: probe(`
      function write(bag = data): void { bag.key = "constructor"; }
      function forward(callback: typeof write, again: boolean): void {
        if (again) forward(callback, false); else callback();
      }
      forward(write, true);
    `),
  },
  {
    name: "recursive rest forwarding retains every argument",
    expected: "reject",
    source: probe(`
      function write(...bags: {key: number | string}[]): void { for (const bag of bags) bag.key = "constructor"; }
      function forward(callback: typeof write, bags: [{key: number | string}, {key: number | string}], again: boolean): void {
        if (again) forward(callback, bags, false); else callback(...bags);
      }
      forward(write, [data, other], true);
    `),
  },
  {
    name: "recursive forwarding cannot hide a stale callback replacement",
    expected: "reject",
    source: probe(`
      function harmless(bag: {key: number | string}): void { void bag.key; }
      function write(bag: {key: number | string}): void { bag.key = "constructor"; }
      let callback = harmless;
      function forward(again: boolean): void { if (again) forward(false); else callback(data); }
      callback = write; forward(true);
    `),
  },
  {
    name: "recursive forwarding cannot hide intrinsic writes",
    expected: "reject",
    source: `
      function write(bag: object): void { Reflect.set(bag, "unsafe", 1); }
      function forward(callback: typeof write, bag: object, again: boolean): void {
        if (again) forward(callback, bag, false); else callback(bag);
      }
      forward(write, Array.prototype, true);
    `,
  },
];

export const invocationCases: readonly InvocationCase[] = cases.map(test =>
  test.expected === "reject" && test.source.includes('bag.key = "constructor";')
    ? { ...test, controlSource: test.source.replaceAll('bag.key = "constructor";', "void bag.key;") }
    : test);
