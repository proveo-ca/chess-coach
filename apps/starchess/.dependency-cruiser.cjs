// SPEC: _spec/apps/starchess/architecture/layers.puml
/** @type {import('dependency-cruiser').IConfiguration} */
const src = (dir) => `^src/${dir}/`;
const APP_SIDE = ["app", "screens", "demos", "store", "tutorial", "achievements"];

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: { path: "^src/" },
      to: { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } },
    },
    {
      name: "primitives-stay-presentational",
      comment: "components/primitives import nothing stateful and no other layer's components.",
      severity: "error",
      from: { path: src("components/primitives") },
      to: {
        path: [...APP_SIDE, "hooks", "presentation", "components/atoms", "components/features"].map(src),
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "atoms-below-features",
      severity: "error",
      from: { path: src("components/atoms") },
      to: { path: src("components/features"), dependencyTypesNot: ["type-only"] },
    },
    {
      name: "components-below-routes",
      severity: "error",
      from: { path: src("components") },
      to: { path: ["screens", "demos"].map(src), dependencyTypesNot: ["type-only"] },
    },
    {
      name: "pieces-below-animations",
      comment: "CLAUDE.md piece-art rule: animations import pieces, never the reverse.",
      severity: "error",
      from: { path: src("presentation/pieces") },
      to: { path: src("presentation/animations") },
    },
    {
      name: "presentation-below-app",
      comment: "Presentation receives match state through props or a port, never by reaching into app/. UI-wide flag stores (store/) stay readable.",
      severity: "error",
      from: { path: src("presentation") },
      to: { path: APP_SIDE.filter((d) => d !== "store").map(src), dependencyTypesNot: ["type-only"] },
    },
    {
      name: "store-below-ui",
      severity: "error",
      from: { path: src("store") },
      to: { path: ["components", "presentation", "screens", "demos"].map(src), dependencyTypesNot: ["type-only"] },
    },
    {
      name: "types-are-leaves",
      severity: "error",
      from: { path: src("types") },
      to: { path: "^src/", pathNot: src("types"), dependencyTypesNot: ["type-only"] },
    },
    {
      name: "timers-through-adapter",
      comment: "Only adapters/ may import the browser adapter; app code uses ~/adapters/timers.",
      severity: "error",
      from: { path: "^src/", pathNot: ["^src/adapters/", "^src/app/MatchStoreContext\\.tsx$"] },
      to: { path: "^src/adapters/browser/index\\.ts$", reachable: false },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["__tests__", "\\.stories\\.tsx?$", "\\.module\\.css$"] },
    tsConfig: { fileName: "tsconfig.app.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js"] },
  },
};
