/**
 * Local oxlint plugin enforcing StarChess component architecture.
 * Ported from apps/chess/lint/architecture.ts; wired via oxlint.config.ts `jsPlugins`.
 *
 *   proveo-starchess/pure-primitive          — primitives/ must be presentational
 *   proveo-starchess/route-target-in-screens — <Route> targets must live in screens/
 *   proveo-starchess/own-css-module          — only import own same-named *.module.css
 *   proveo-starchess/no-cross-module-types   — shared types live in ~/types/
 *   proveo-starchess/no-raw-timer            — timers go through ~/adapters/timers
 *
 * NOTE: oxlint JS plugins are alpha. AST is ESTree-compatible.
 */

const SIDE_EFFECT_IMPORT_PREFIXES = ["~/app", "~/presentation/hooks"];
const SIDE_EFFECT_CALLS = new Set(["createEffect", "createRenderEffect", "onMount", "onCleanup"]);

const baseName = (filename: string): string =>
  (filename.split(/[\\/]/).pop() ?? "").replace(/\.(tsx|ts|jsx|js)$/, "");

const importedFrom = (src: string, prefixes: string[]): boolean =>
  prefixes.some((p) => src === p || src.startsWith(`${p}/`));

const norm = (filename: string): string => String(filename).replace(/\\/g, "/");
const isTestFile = (filename: string): boolean => /\.(test|spec)\.[jt]sx?$/.test(filename);

/** Primitives must be pure presentational components. */
const purePrimitive = {
  meta: {
    type: "problem",
    docs: {
      description: "Primitive components must be presentational (no side effects).",
    },
  },
  create(context: any) {
    if (!context.filename.includes("/components/primitives/")) return {};

    let offending: any = null;
    let kind = "";
    let importsAtom = false;
    const note = (node: any, k: string) => {
      if (!offending) {
        offending = node;
        kind = k;
      }
    };

    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string") return;
        const specs = node.specifiers ?? [];
        const typeOnly =
          node.importKind === "type" ||
          (specs.length > 0 && specs.every((s: any) => s.importKind === "type"));
        if (typeOnly) return;
        if (importedFrom(src, SIDE_EFFECT_IMPORT_PREFIXES)) {
          note(node, `imports app state/IO from "${src}"`);
        }
        if (src.includes("/components/atoms/")) importsAtom = true;
      },
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type === "Identifier" && SIDE_EFFECT_CALLS.has(callee.name)) {
          note(node, `calls ${callee.name}()`);
        }
      },
      "Program:exit"() {
        if (!offending) return;
        const dest = importsAtom
          ? "features/ (it composes an atom)"
          : "atoms/ (it owns a single stateful responsibility)";
        context.report({
          node: offending,
          message: `Primitive components must be presentational and free of side effects, but this one ${kind}. Move it to ${dest}.`,
        });
      },
    };
  },
};

/** Router <Route> targets must live in screens/. */
const routeTargetInScreens = {
  meta: {
    type: "problem",
    docs: {
      description: "Components used as <Route> targets must live in src/screens/.",
    },
  },
  create(context: any) {
    const importSource = new Map<string, string>();
    const targets: Array<{ name: string; node: any }> = [];

    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string") return;
        for (const spec of node.specifiers ?? []) {
          if (spec.local?.name) importSource.set(spec.local.name, src);
        }
      },
      JSXOpeningElement(node: any) {
        if (node.name?.type !== "JSXIdentifier" || node.name.name !== "Route") return;
        for (const attr of node.attributes ?? []) {
          if (attr.type !== "JSXAttribute" || attr.name?.name !== "component") continue;
          const val = attr.value;
          if (val?.type === "JSXExpressionContainer" && val.expression?.type === "Identifier") {
            targets.push({ name: val.expression.name, node: attr });
          }
        }
      },
      "Program:exit"() {
        for (const t of targets) {
          const src = importSource.get(t.name);
          if (src && !src.includes("/screens/")) {
            context.report({
              node: t.node,
              message: `Route target <${t.name}> is imported from "${src}", but route components must live in src/screens/. Relocate ${t.name} into screens/.`,
            });
          }
        }
      },
    };
  },
};

/** Only import your own same-named CSS module; globals exempt. */
const ownCssModule = {
  meta: {
    type: "problem",
    docs: {
      description: "A component may only import its own same-named CSS module.",
    },
  },
  create(context: any) {
    const fileBase = baseName(context.filename);
    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string") return;
        const match = src.match(/([^/\\]+)\.module\.css$/);
        if (!match) return;
        const moduleBase = match[1];
        if (moduleBase !== fileBase) {
          context.report({
            node,
            message: `"${moduleBase}.module.css" is not this component's stylesheet (expected "${fileBase}.module.css"). A component may only import its own CSS module — move shared styles to a global stylesheet or split the component.`,
          });
        }
      },
    };
  },
};

/**
 * Types shared across folders must live in ~/types/.
 */
const noCrossModuleTypes = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Types shared across folders must live in ~/types/, not be imported across modules.",
    },
  },
  create(context: any) {
    const fm = String(context.filename).match(/\/(?:src|tests)\/([^/]+)\//);
    const importerFolder = fm ? fm[1] : "";
    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string" || !src.startsWith("~/") || src.startsWith("~/types/")) return;
        const srcFolder = src.split("/")[1];
        const isComponents = srcFolder === "components";
        const crossFolder = srcFolder !== importerFolder;
        if (!isComponents && !crossFolder) return;
        const wholeIsType = node.importKind === "type";
        for (const spec of node.specifiers ?? []) {
          if (!wholeIsType && spec.importKind !== "type") continue;
          const name = spec.imported?.name ?? spec.local?.name ?? "type";
          context.report({
            node: spec,
            message: `Type "${name}" is imported across modules from "${src}". A type shared across folders (or any type from a component) must live in ~/types/ — move it there and import it from ~/types/.`,
          });
        }
      },
    };
  },
};

const RAW_TIMERS = new Set([
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "requestIdleCallback",
  "cancelIdleCallback",
]);
const TIMER_HOSTS = new Set(["window", "globalThis", "self"]);
const HOST_PROPS = new Set([...TIMER_HOSTS, "defaultView"]);
const KEY_PARENTS = new Set([
  "Property",
  "MethodDefinition",
  "PropertyDefinition",
  "TSPropertySignature",
  "TSMethodSignature",
]);

/** Time enters through ~/adapters/timers; only the browser adapter touches raw timers. */
const noRawTimer = {
  meta: {
    type: "problem",
    docs: {
      description: "Raw setTimeout/setInterval are banned; use ~/adapters/timers.",
    },
  },
  create(context: any) {
    const file = norm(context.filename);
    if (isTestFile(file) || file.includes("/__tests__/") || file.includes("/src/adapters/browser/")) {
      return {};
    }
    const report = (node: any, name: string) =>
      context.report({
        node,
        message: `Raw ${name} is banned in apps/starchess. Use createDelay/createRepeat (owner-bound) or schedule/repeat/sleep from ~/adapters/timers. See _spec/apps/starchess/architecture/reactivity.md R9.`,
      });
    const isLocal = (node: any): boolean => {
      for (let s = context.sourceCode.getScope(node); s; s = s.upper) {
        if ((s.set?.get(node.name)?.defs?.length ?? 0) > 0) return true;
      }
      return false;
    };
    const isHost = (node: any): boolean => {
      if (node?.type === "Identifier") return TIMER_HOSTS.has(node.name) && !isLocal(node);
      if (node?.type === "MemberExpression" && !node.computed) return HOST_PROPS.has(node.property?.name);
      return false;
    };
    const timerName = (key: any, computed: boolean): string | null => {
      if (!computed && key?.type === "Identifier") return RAW_TIMERS.has(key.name) ? key.name : null;
      if (key?.type === "Literal" && typeof key.value === "string") {
        return RAW_TIMERS.has(key.value) ? key.value : null;
      }
      return null;
    };
    return {
      Identifier(node: any) {
        if (!RAW_TIMERS.has(node.name)) return;
        const parent = node.parent;
        if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) return;
        if (KEY_PARENTS.has(parent?.type) && parent.key === node && !parent.computed) return;
        if (isLocal(node)) return;
        report(node, node.name);
      },
      MemberExpression(node: any) {
        const name = timerName(node.property, node.computed);
        if (name && isHost(node.object)) report(node, name);
      },
      VariableDeclarator(node: any) {
        if (node.id?.type !== "ObjectPattern" || !isHost(node.init)) return;
        for (const prop of node.id.properties ?? []) {
          const name = prop.type === "Property" ? timerName(prop.key, prop.computed) : null;
          if (name) report(prop, name);
        }
      },
      CallExpression(node: any) {
        const callee = node.callee;
        const reflectGet =
          callee?.type === "MemberExpression" &&
          callee.object?.type === "Identifier" &&
          callee.object.name === "Reflect" &&
          callee.property?.name === "get";
        if (!reflectGet || !isHost(node.arguments?.[0])) return;
        const name = timerName(node.arguments?.[1], true);
        if (name) report(node, name);
      },
    };
  },
};

const plugin = {
  meta: { name: "proveo-starchess" },
  rules: {
    "pure-primitive": purePrimitive,
    "route-target-in-screens": routeTargetInScreens,
    "own-css-module": ownCssModule,
    "no-cross-module-types": noCrossModuleTypes,
    "no-raw-timer": noRawTimer,
  },
};

export default plugin;
