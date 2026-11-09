// SPEC: _spec/gpu-build.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");
const cpu = await read("tooling/runtime/Dockerfile");
const gpu = await read("tooling/runtime/Dockerfile.gpu");
const inputs = JSON.parse(await read("tooling/runtime/gpu-build-inputs.json"));
const logical = gpu.replace(/\\\n\s*/g, " ");
const commands = logical.split("\n").filter(line => line.startsWith("RUN "));

test("GPU recipe opts into the package feature without changing the CPU recipe", async () => {
  expect(inputs.recipe).toBe("tooling/runtime/Dockerfile.gpu");
  expect(inputs.cpuRecipe).toBe("tooling/runtime/Dockerfile");
  expect(inputs.nativePackage).toBe("chess-coach-policy-io");
  expect(inputs.feature).toBe("gpu-cuda");
  expect(commands[0]).toContain("-p chess-coach-policy-io --features gpu-cuda");
  expect(commands[0]).toContain("--locked --offline --jobs 2");
  expect(cpu).not.toContain("--features gpu-cuda");
  for (const name of ["learning", "policy-io"]) {
    const manifest = Bun.TOML.parse(await read(`crates/${name}/Cargo.toml`)) as { features: Record<string, string[]> };
    expect(manifest.features.default).toEqual([]);
    expect(manifest.features["gpu-cuda"]).toContain("burn/cuda");
    if (name === "policy-io") expect(manifest.features["gpu-cuda"]).toContain("chess-coach-learning/gpu-cuda");
  }
});

test("CUDA bindings require an explicit supported encoded version before Cargo", () => {
  expect(inputs.cuda.version).toBeNull();
  expect(inputs.cuda.bindingsCrate).toBe("cudarc 0.19.10");
  expect(gpu).toContain(`ARG ${inputs.cuda.buildArgument}\n`);
  expect(gpu).not.toContain(`ARG ${inputs.cuda.buildArgument}=`);
  expect(gpu).toContain("ENV CUDARC_CUDA_VERSION=${CUDARC_CUDA_VERSION}");
  const versions = commands[0]!.match(/in\s+([0-9|]+)\) ;;/)?.[1]?.split("|");
  expect(versions).toEqual(inputs.cuda.supportedBindingVersions);
  expect(versions).toEqual(["13040", "13030", "13020", "13010", "13000", "12090", "12080", "12060", "12050", "12040", "12030", "12020", "12010", "12000", "11080", "11070", "11060", "11050", "11040"]);
  expect(commands[0]).toContain("*) echo \"An explicit supported CUDARC_CUDA_VERSION is required\" >&2; exit 1 ;;");
  expect(commands[0]!.indexOf("esac")).toBeLessThan(commands[0]!.indexOf("cargo build"));
});

test("LLVM consumes an installed bundle at the actual bundler location", () => {
  expect(inputs.llvm.bundleVersion).toBe("23.1.0-4");
  expect(inputs.llvm.configVersion).toBe("23.1.0");
  expect(gpu).toContain("ENV XDG_DATA_HOME=/opt/tracel-data");
  expect(gpu).toContain(`COPY ${inputs.llvm.context}/ ${inputs.llvm.destination}/`);
  expect(commands[0]).toContain(`test -f ${inputs.llvm.destination}/${inputs.llvm.installationMarker}`);
  expect(commands[0]).toContain(`test -x ${inputs.llvm.destination}/bin/llvm-config`);
  expect(commands[0]).toContain(`test "$(${inputs.llvm.destination}/bin/llvm-config --version)" = "${inputs.llvm.configVersion}"`);
  expect(gpu).not.toContain("DOCS_RS");
  expect(gpu).not.toContain("LLVM_SYS_231_PREFIX");
  expect(gpu).not.toContain("touch ");
});

test("prepared builder and runtime inputs precede application outputs", () => {
  expect(gpu).toContain(`COPY ${inputs.builderDependencies.context}/ /`);
  expect(gpu).toContain(`COPY ${inputs.runtimeDependencies.context}/ /`);
  expect(gpu.indexOf(`COPY ${inputs.builderDependencies.context}/ /`)).toBeLessThan(gpu.indexOf("COPY current-native/"));
  expect(gpu.indexOf(`COPY ${inputs.builderDependencies.context}/ /`)).toBeLessThan(gpu.indexOf(`COPY ${inputs.llvm.context}/`));
  expect(gpu.indexOf(`COPY ${inputs.runtimeDependencies.context}/ /`)).toBeLessThan(gpu.indexOf("COPY --from=javascript /build/current/"));
  expect(inputs.cuda.backend).toBe("cubecl-llvm-nvptx");
  expect(gpu).toContain(`ENV CUDA_PATH=${inputs.cuda.root}`);
  expect(commands).toContain(`RUN --network=none test -s ${inputs.cuda.libdevice}`);
  expect(inputs.runtimeDependencies.requires).toContain("selected dynamically loaded userspace libraries");
  expect(inputs.runtimeDependencies.hostProvided).toEqual(["CUDA driver libcuda"]);
  expect(inputs.runtimeDependencies.excludes).toEqual(["CUDA driver replacement"]);
});

test("GPU and CPU recipes retain the same pinned stages and registered application copies", async () => {
  const lines = (source: string, prefix: string) => source.split("\n").filter(line => line.startsWith(prefix));
  expect(lines(gpu, "FROM ")).toEqual(lines(cpu, "FROM "));
  expect(lines(gpu, "COPY --from=")).toEqual(lines(cpu, "COPY --from="));
  expect(lines(gpu, "COPY --chmod=")).toEqual(lines(cpu, "COPY --chmod="));
  expect(inputs.binaries).toEqual(["policy-score", "policy-channel", "policy-initialize"]);
  for (const binary of inputs.binaries) expect(commands[0]).toContain(`--bin ${binary}`);
  expect(commands[0]).not.toContain("--workspace");
  const entries = JSON.parse(await read("tooling/reference-entrypoints.json")).entries as string[];
  expect(entries).toHaveLength(6);
  for (const entry of entries) expect(gpu).toContain(`/build/reference-output/${entry} /app/reference/${entry}`);
  for (const prefix of ["USER ", "ENTRYPOINT ", "CMD "]) expect(lines(gpu, prefix)).toEqual(lines(cpu, prefix));
});

test("recipe steps cannot silently provision missing compiler inputs", () => {
  expect(commands).toHaveLength(4);
  expect(commands.every(line => line.startsWith("RUN --network=none "))).toBe(true);
  for (const command of ["curl ", "wget ", "apt-get ", "mise install", "rustup update"]) expect(gpu).not.toContain(command);
  expect(gpu).not.toContain(".tar.xz");
  expect(gpu).not.toContain("cuda-llvm-request");
});

test("GPU feature selection leaves CPU master initialization and GPU failure semantics unchanged", async () => {
  const initialize = await read("crates/policy-io/src/bin/policy-initialize.rs");
  expect(initialize).toContain('["101", "102", "103", "104", "105"]');
  expect(initialize).toContain("let mut device = Device::flex();");
  expect(initialize).toContain("device.configure(FloatDType::F64)?;");
  expect(initialize).toContain("device.seed(master);");
  expect(initialize).not.toContain("Device::cuda");
  const selection = await read("crates/policy-io/src/device.rs");
  expect(selection).toContain('#[cfg(feature = "gpu-cuda")]\n    let mut device = Device::cuda(0);');
  expect(selection).toContain('#[cfg(not(feature = "gpu-cuda"))]\n    let mut device = Device::flex();');
  expect(selection).toContain(".configure(FloatDType::F64)");
});

test("unselected prepared inputs and static checks cannot become GPU qualification", () => {
  expect(inputs.version).toBe("chess-coach.gpu-build-inputs.v1");
  expect(inputs.status).toBe("AWAITING_PREPARED_INPUT_SELECTION");
  for (const role of [inputs.llvm, inputs.builderDependencies, inputs.runtimeDependencies]) expect(role.selection).toBeNull();
  expect(inputs.qualification).toEqual({ imageBuilt: false, actualHostExecuted: false, cudaGpuCodeExecuted: false, trainingReady: false });
});
