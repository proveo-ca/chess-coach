// SPEC: _spec/gpu-input-transfer.puml
import { expect, test } from "bun:test";
import { quoteFish, renderHostReceive, renderHostReceive2 } from "./bootstrap";

const commit = "0123456789abcdef0123456789abcdef01234567";
const helperSha256 = "0123456789abcdef".repeat(4);
const directory = "_work/gpu-owner-recovery/runs/host-input-bootstrap-1";
const receipt = "_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json";
const prefix = "fish --no-config -c ";

function unquoteFish(quoted: string): string {
  expect(quoted.startsWith("'") && quoted.endsWith("'")).toBe(true);
  const value = quoted.slice(1, -1);
  let result = "";
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (character === "\\" && ["\\", "'"].includes(value[index + 1] ?? "")) result += value[++index];
    else { if (character === "'") throw Error("UNESCAPED_FISH_APOSTROPHE"); result += character; }
  }
  return result;
}

function bodyOf(command = renderHostReceive(commit, helperSha256)): string {
  expect(command.startsWith(prefix)).toBe(true);
  const quoted = command.slice(prefix.length);
  const parent = unquoteFish(quoted);
  const marker = "; timeout --signal=TERM --kill-after=5s 895s fish --no-config -c ";
  const end = "; set -l host_status $status;";
  expect(parent).toContain(marker);
  const wrapper = unquoteFish(parent.slice(parent.indexOf(marker) + marker.length, parent.indexOf(end)));
  const suffix = '; fish --no-config -n -c "$program"; or exit $status; fish --no-config -c "$program"';
  expect(wrapper.startsWith("set -l program ")).toBe(true);
  expect(wrapper.endsWith(suffix)).toBe(true);
  const inner = wrapper.slice("set -l program ".length, -suffix.length);
  return unquoteFish(inner);
}

test("renders one deterministic Fish command preserving nested backslashes and apostrophes", () => {
  const command = renderHostReceive(commit, helperSha256);
  expect(command).toBe(renderHostReceive(commit, helperSha256));
  expect(command).not.toMatch(/[\r\n\0]/);
  const body = bodyOf(command);
  expect(body).toContain("'Accept: application/vnd.github.raw+json'");
  expect(body).not.toMatch(/\$\(|\[\[|&&|\|\||\breturn\b/);
});

test("legacy run-1 rendering stays byte-identical to the retained published command", async () => {
  const expected = await Bun.file(new URL("../../runs/host-input-receive-handoff-1/host-command.fish", import.meta.url)).text();
  expect(renderHostReceive("33b29dd095a3582a02861cef0f155e675a6721cc", "091a431757ef83710a95156816e085cb1ed36b632e4923c9632695ffe821bafa") + "\n").toBe(expected);
});

test("run 2 places the whole bootstrap body under exact Mise pins with implicit installs disabled first", () => {
  const command = renderHostReceive2(commit, helperSha256), parent = unquoteFish(command.slice(prefix.length));
  const marker = "; timeout --signal=TERM --kill-after=5s 895s fish --no-config -c ";
  const end = ' > "$bootstrap/worker.stdout"';
  const wrapper = unquoteFish(parent.slice(parent.indexOf(marker) + marker.length, parent.indexOf(end)));
  const bodyStart = "set -l program ", bodyEnd = '; fish --no-config -n -c "$program"';
  const body = unquoteFish(wrapper.slice(wrapper.indexOf(bodyStart) + bodyStart.length, wrapper.indexOf(bodyEnd)));
  expect(wrapper).toContain('mise exec core:bun@1.4.0 core:rust@1.95.0 -- fish --no-config -c "$program" < /dev/null');
  for (const name of ["MISE_AUTO_INSTALL", "MISE_EXEC_AUTO_INSTALL", "MISE_TASK_RUN_AUTO_INSTALL"]) expect(wrapper.indexOf(`set -gx ${name} false`)).toBeLessThan(wrapper.indexOf("mise exec "));
  expect(wrapper.indexOf("fish --no-config -n -c")).toBeLessThan(wrapper.indexOf("mise exec "));
  expect(body).toContain("BUN_VERSION_MISMATCH"); expect(body).toContain("command bun --version");
  expect(body).toContain(`--approved-host-receive-2 '${commit}'`);
  expect(body).toContain("_work/gpu-owner-recovery/runs/host-input-bootstrap-2");
  expect(body).toContain("_work/gpu-owner-recovery/runs/host-input-receive-2/receipt.json");
  expect(body).not.toMatch(/host-input-bootstrap-1|host-input-receive-1|--approved-host-receive-1/);
  expect(parent).toContain('2> "$bootstrap/worker.stderr"');
  expect(parent).toContain('set -l host_status $status; printf \'%s\\n\' $host_status > "$bootstrap/command.exit"');
  expect(command).not.toMatch(/[\r\n\0]|mise install|mise trust|mise use|mise upgrade|rustc --version|cargo --version|\brm\b/);
});

test("rejects every non-full commit before returning a command", () => {
  const invalid: unknown[] = [undefined, null, 123, [], {}, "", "HEAD", "main", "v1.0.0", "a".repeat(39), "a".repeat(41), "g".repeat(40), `${commit}\n`, `${commit}\r`, ` ${commit}`, `${commit} `, `${commit};exit 0`, `$(printf ${commit})`, "'".repeat(40)];
  for (const value of invalid) expect(() => renderHostReceive(value as string, helperSha256)).toThrow("INVALID_SOURCE_COMMIT");
});

test("rejects every non-full helper digest before returning a command", () => {
  const invalid: unknown[] = [undefined, null, 123, [], {}, "", "sha256:" + helperSha256, "a".repeat(63), "a".repeat(65), "g".repeat(64), `${helperSha256}\n`, `${helperSha256}\r`, ` ${helperSha256}`, `${helperSha256} `, `${helperSha256};exit 0`, "'".repeat(64)];
  for (const value of invalid) expect(() => renderHostReceive(commit, value as string)).toThrow("INVALID_HELPER_SHA256");
});

test("lowercase pins agree with receiver validation and nested Fish literals round trip", () => {
  expect(() => renderHostReceive(commit.toUpperCase(), helperSha256)).toThrow("INVALID_SOURCE_COMMIT");
  expect(() => renderHostReceive(commit, helperSha256.toUpperCase())).toThrow("INVALID_HELPER_SHA256");
  for (const value of ["printf '%s\\n' 'value'", "a\\\\b'c", "tail\\", "\\'\\\\"]) {
    expect(unquoteFish(quoteFish(value))).toBe(value);
    expect(unquoteFish(unquoteFish(quoteFish(quoteFish(value))))).toBe(value);
    expect(unquoteFish(unquoteFish(unquoteFish(quoteFish(quoteFish(quoteFish(value))))))).toBe(value);
  }
});

test("sets only the ephemeral non-installing non-interactive environment", () => {
  const body = bodyOf();
  expect(body.startsWith("set -gx MISE_AUTO_INSTALL false; set -gx MISE_TASK_RUN_AUTO_INSTALL false; set -gx GH_PROMPT_DISABLED 1; ")).toBe(true);
  expect(body.match(/set -gx /g)).toHaveLength(4);
  expect(body).toContain("set -gx GH_DEBUG ''");
  expect(body).not.toMatch(/(?:^|; )(?:command )?(?:export|setenv|env)(?: |;)|GH_TOKEN|GITHUB_TOKEN|GH_CONFIG_DIR|\.config\//);
});

test("requires only existing tools and leaves the receiver's tar unused by the bootstrap", () => {
  const body = bodyOf();
  expect(body).toContain('for tool in bun gh tar sha256sum timeout fish wc mkdir cat; command -sq "$tool"; or bootstrap_fail \'HOST_TOOL_MISSING\'; end');
  expect(body.indexOf('for tool in ')).toBeLessThan(body.indexOf("command bun --version"));
  expect(body).not.toMatch(/(?:^|; )(?:(?:command|timeout) )?tar /);
});

test("takes exclusive ownership of just the bootstrap directory before writing any file", () => {
  const body = bodyOf();
  const parent = unquoteFish(renderHostReceive(commit, helperSha256).slice(prefix.length));
  expect(body).toContain(`set -g bootstrap '${directory}'`);
  expect(parent).toContain('command mkdir -- "$bootstrap"; or begin;');
  expect(parent.indexOf('command mkdir -- "$bootstrap"')).toBeLessThan(parent.indexOf("; timeout "));
  expect(body).not.toContain("command mkdir --");
  expect(body).not.toMatch(/mkdir -p|\b(?:rm|rmdir|mv|cp|chmod|chown|cd|ulimit)\b/);
});

test("retains separate bootstrap stdout and stderr labels without claiming a host pass", () => {
  const body = bodyOf();
  expect(body).toContain('printf \'\' > "$bootstrap/bootstrap.stdout" 2> "$bootstrap/bootstrap.stderr"');
  expect(body).toContain('function bootstrap_fail; printf \'%s\\n\' "$argv[1]" >&2; printf \'%s\\n\' "$argv[1]" >> "$bootstrap/bootstrap.stderr"; exit 1; end');
  expect(body).toContain('printf \'%s\\n\' "$argv[1]" >> "$bootstrap/bootstrap.stdout"');
  expect(body).not.toContain("PASS");
  expect(body).not.toMatch(/printenv|\bset -[a-z]*[SU]\b|gh auth|gh config/);
});

test("checks exact Bun 1.4.0 and records its immediate exit before any fetch", () => {
  const body = bodyOf();
  expect(body).toContain('command bun --version > "$bootstrap/bun-version.stdout" 2> "$bootstrap/bun-version.stderr"; set -l bun_status $status; printf \'%s\\n\' $bun_status > "$bootstrap/bun-version.exit"');
  expect(body).toContain("test $bun_status -eq 0; or bootstrap_fail 'BUN_VERSION_FAILED'");
  const check = 'test "$bun_version" = \'1.4.0\'; or bootstrap_fail \'BUN_VERSION_MISMATCH\'';
  expect(body).toContain('set -l bun_version (string collect < "$bootstrap/bun-version.stdout")');
  expect(body).toContain(check);
  expect(body.indexOf(check)).toBeLessThan(body.indexOf("55s gh api"));
});

test("fetches exactly one plaintext helper from the fixed repository at the full source commit", () => {
  const body = bodyOf();
  expect(body).toContain(`command timeout --signal=TERM --kill-after=5s 55s gh api --hostname github.com --method GET --header 'Accept: application/vnd.github.raw+json' 'repos/proveo-ca/chess-coach/contents/_work/gpu-owner-recovery/qualification/host-receive/receive.ts?ref=${commit}' > "$bootstrap/receive.ts" 2> "$bootstrap/gh-fetch.stderr"`);
  expect(body.match(/\bgh api\b/g)).toHaveLength(1);
  expect(body.match(/> "\$bootstrap\/receive\.ts"/g)).toHaveLength(1);
  expect(body).not.toMatch(/--jq|base64|--retry|\bcurl\b|\bwget\b|\bwhile\b/);
});

test("captures the fetch status immediately and stops on failure without removing partial source", () => {
  const body = bodyOf();
  expect(body).toContain('2> "$bootstrap/gh-fetch.stderr"; set -l fetch_status $status; printf \'%s\\n\' $fetch_status > "$bootstrap/fetch.exit"');
  expect(body).toContain('bootstrap_note "FETCH_EXIT=$fetch_status"; test $fetch_status -eq 0; or bootstrap_fail \'FETCH_FAILED\'');
  expect(body.indexOf("test $fetch_status -eq 0")).toBeLessThan(body.indexOf("command wc -c"));
  expect(body).not.toMatch(/\b(?:unlink|truncate|rm)\b/);
});

test("applies the 128 KiB source soft limit after the bounded fetch and before hashing or execution", () => {
  const body = bodyOf();
  const sizeCheck = 'test (command wc -c < "$bootstrap/receive.ts" 2> "$bootstrap/helper-size.stderr") -le 131072; or bootstrap_fail \'HELPER_SIZE_LIMIT\'';
  expect(body).toContain(sizeCheck);
  expect(body.indexOf("test $fetch_status -eq 0")).toBeLessThan(body.indexOf(sizeCheck));
  expect(body.indexOf(sizeCheck)).toBeLessThan(body.indexOf("| command sha256sum"));
  expect(body.indexOf(sizeCheck)).toBeLessThan(body.indexOf("command bun --no-env-file"));
  expect(body).not.toMatch(/quota|ulimit|head -c|dd if=/);
});

test("uses the supplied hash, captures both pipeline stages immediately, and fails closed", () => {
  const body = bodyOf();
  expect(body).toContain(`printf '%s  %s\\n' '${helperSha256}' "$bootstrap/receive.ts" | command sha256sum --check --status > "$bootstrap/helper-hash.stdout" 2> "$bootstrap/helper-hash.stderr"; set -l hash_status $pipestatus`);
  expect(body).toContain('printf \'%s\\n\' $hash_status[2] > "$bootstrap/helper-hash.exit"');
  expect(body).toContain("test $hash_status[1] -eq 0; or bootstrap_fail 'HELPER_HASH_INPUT_FAILED'");
  const guard = "test $hash_status[2] -eq 0; or bootstrap_fail 'HELPER_HASH_MISMATCH'";
  expect(body).toContain(guard);
  expect(body.indexOf(guard)).toBeLessThan(body.indexOf("command bun --no-env-file"));
  expect(body).not.toMatch(/\|[^;]*\band\b/);
});

test("executes only the verified helper directly with the exact two receiver arguments", () => {
  const body = bodyOf();
  const invocation = `command bun --no-env-file --no-install "$bootstrap/receive.ts" --approved-host-receive-1 '${commit}'`;
  expect(body).toContain(`bootstrap_note 'HELPER_HASH_VERIFIED'; ${invocation} > "$bootstrap/receive.stdout" 2> "$bootstrap/receive.stderr"; set -l receive_status $status`);
  expect(body.match(/command bun /g)).toHaveLength(2);
  expect(body.match(/--approved-host-receive-1/g)).toHaveLength(1);
  expect(body).not.toMatch(/\bbun (?:run|x|install|add|update)\b|--env-file|\beval\b|\bsource\b/);
});

test("retains receiver stdout, stderr, status and its exact receipt path", () => {
  const body = bodyOf();
  expect(body).toContain('set -l receive_status $status; printf \'%s\\n\' $receive_status > "$bootstrap/receive.exit"');
  expect(body).toContain('bootstrap_note "RECEIVE_EXIT=$receive_status"');
  expect(body).toContain(`if test -f '${receipt}'; command cat -- '${receipt}'; or bootstrap_fail 'RECEIVER_RECEIPT_READ_FAILED'; end; exit $receive_status`);
  expect(body.endsWith("exit $receive_status")).toBe(true);
  expect(body).toContain('command cat -- "$bootstrap/receive.stdout"; command cat -- "$bootstrap/receive.stderr" >&2');
});

test("host syntax checking precedes execution under the same outer deadline", () => {
  const parent = unquoteFish(renderHostReceive(commit, helperSha256).slice(prefix.length));
  expect(parent).toContain("fish --no-config -n -c");
  expect(parent.indexOf("fish --no-config -n -c")).toBeLessThan(parent.lastIndexOf("fish --no-config -c"));
  expect(parent).toContain("or exit $status");
  expect(parent).toContain("--kill-after=5s 895s");
  expect(parent).toContain('set -l host_status $status; printf \'%s\\n\' $host_status > "$bootstrap/command.exit"');
});

test("leaves receiver cache and evidence creation to the receiver", () => {
  const body = bodyOf();
  expect(body).not.toContain("_work/gpu-owner-recovery/cache/");
  expect(body.match(/_work\/gpu-owner-recovery\/runs\/host-input-receive-1/g)).toHaveLength(2);
  expect(body).not.toMatch(/plan\.json|verifier|writeFile|receive\.ts\s*=/);
});

test("does not install, authenticate, alter repositories, publish, or build host artifacts", () => {
  const body = bodyOf();
  expect(body).not.toMatch(/\b(?:sudo|ssh|scp|git|docker|podman|cargo|rustc|llvm|clang|nvcc|nvidia-smi|mise|npm|npx|apt|apt-get|brew)\b/i);
  expect(body).not.toMatch(/\bgh (?:auth|config|release|repo)\b|--method (?:POST|PUT|PATCH|DELETE)|git checkout|git reset|git push/);
  expect(body).not.toMatch(/\.tar(?:\.gz)?\b|\.manifest\.json\b|https?:\/\//);
});
