# SPEC: _spec/gpu-qualification.puml
function inspect_builder_image
    if not set -q CHESS_COACH_OPERATOR_HOST; or test "$CHESS_COACH_OPERATOR_HOST" != 1
        return 1
    end
    set -l evidence _work/gpu-owner-recovery/runs/host-builder-inputs-1
    if not mkdir "$evidence/.inspection-started"
        return 1
    end
    set -l image 'docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb'
    printf '125\n' >"$evidence/image.exit"
    printf '0\n' >"$evidence/run.attempted"
    printf '125\n' >"$evidence/run.exit"
    docker image inspect --format '{{.Os}}/{{.Architecture}} {{.Id}} {{json .RepoDigests}}' "$image" >"$evidence/image.stdout" 2>"$evidence/image.stderr"
    set -l image_status $status
    printf '%s\n' "$image_status" >"$evidence/image.exit"
    if test "$image_status" -ne 0
        return 1
    end
    set -l facts (string trim -- (cat "$evidence/image.stdout"))
    if not string match --quiet 'linux/amd64 sha256:*' -- "$facts"
        printf '126\n' >"$evidence/image.exit"
        printf 'The selected image is not linux/amd64.\n' >>"$evidence/image.stderr"
        return 1
    end
    printf '1\n' >"$evidence/run.attempted"
    docker run --pull=never --cpus=1 --memory=1g \
        --cidfile "$evidence/container.cid" --entrypoint /bin/sh "$image" -c '
        failed=0
        inspect() {
            printf "COMMAND="; printf " %s" "$@"; printf "\n"
            "$@"
            code=$?
            printf "COMMAND_EXIT=%s\n" "$code"
            if [ "$code" -ne 0 ]; then failed=1; fi
        }
        for tool in cc c++ ar ld getconf readelf; do
            inspect command -v "$tool"
        done
        inspect cc --version
        inspect c++ --version
        inspect ar --version
        inspect ld --version
        inspect getconf GNU_LIBC_VERSION
        inspect cat /etc/os-release
        library=$(c++ -print-file-name=libstdc++.so)
        code=$?
        printf "CXX_LIBRARY_EXIT=%s\nCXX_LIBRARY=%s\n" "$code" "$library"
        if [ "$code" -ne 0 ] || [ "$library" = libstdc++.so ] || [ ! -f "$library" ]; then failed=1; fi
        printf "COMPILATION_PERFORMED=false\nGPU_EXECUTION_PERFORMED=false\n"
        exit "$failed"
        ' >"$evidence/inspection.stdout" 2>"$evidence/inspection.stderr"
    set -l run_status $status
    printf '%s\n' "$run_status" >"$evidence/run.exit"
    return "$run_status"
end

function inspect_builder_inputs
    if not set -q CHESS_COACH_OPERATOR_HOST; or test "$CHESS_COACH_OPERATOR_HOST" != 1
        printf 'OPERATOR_HOST_ONLY: set CHESS_COACH_OPERATOR_HOST=1 on the approved host.\n' >&2
        return 1
    end
    for tool in docker timeout date sha256sum cat mkdir
        if not command -sq "$tool"
            printf 'Missing required host tool: %s\n' "$tool" >&2
            return 1
        end
    end
    if not test -f Cargo.lock; or not test -d _work/gpu-owner-recovery/runs
        printf 'Run from the approved repository root.\n' >&2
        return 1
    end
    set -l lock (sha256sum Cargo.lock)
    if not string match --quiet '77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955 *' -- "$lock"
        printf 'Frozen Cargo.lock mismatch.\n' >&2
        return 1
    end
    set -l evidence _work/gpu-owner-recovery/runs/host-builder-inputs-1
    if not mkdir "$evidence"
        printf 'Exclusive host run exists or cannot be created; do not retry.\n' >&2
        return 1
    end
    set -l image 'docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb'
    set -l pull_status 125
    set -l image_status 125
    set -l inspection_status 125
    set -l run_status 125
    set -l cleanup_status 125
    set -l run_attempted 0
    set -l cleanup_attempted 0
    set -l cid unavailable
    set -l started (date +%s)
    timeout --signal=KILL 600s docker pull "$image" >"$evidence/pull.stdout" 2>"$evidence/pull.stderr"
    set pull_status $status
    if test "$pull_status" -eq 0
        timeout --signal=KILL 60s (status fish-path) --no-config (status filename) --inspect >"$evidence/packet.stdout" 2>"$evidence/packet.stderr"
        set inspection_status $status
        if test -f "$evidence/image.exit"
            set image_status (string trim -- (cat "$evidence/image.exit"))
        end
        if test -f "$evidence/run.attempted"
            set run_attempted (string trim -- (cat "$evidence/run.attempted"))
        end
        if test -f "$evidence/run.exit"
            set run_status (string trim -- (cat "$evidence/run.exit"))
        end
    end
    if test "$run_attempted" -eq 1
        if test -s "$evidence/container.cid"
            set cid (string trim -- (cat "$evidence/container.cid"))
            if string match --quiet --regex '^[a-f0-9]{64}$' -- "$cid"
                set cleanup_attempted 1
                timeout --signal=KILL 30s docker rm --force -- "$cid" >"$evidence/cleanup.stdout" 2>"$evidence/cleanup.stderr"
                set cleanup_status $status
            end
        end
    end
    set -l result FAIL_OR_INCOMPLETE_INPUT_INSPECTION
    if test "$pull_status" -eq 0; and test "$inspection_status" -eq 0; and test "$image_status" -eq 0; and test "$run_status" -eq 0; and test "$cleanup_status" -eq 0
        set result PASS_INPUT_METADATA_ONLY
    end
    if not printf 'status=%s\nimage=%s\nlock=%s\nstarted=%s\nfinished=%s\npull_exit=%s\ninspection_exit=%s\nimage_exit=%s\nrun_attempted=%s\nrun_exit=%s\ncid=%s\ncleanup_attempted=%s\ncleanup_exit=%s\nremaining_pull_invocations=0\nremaining_container_invocations=0\nautomatic_retry_authorized=false\ncompilation_performed=false\ngpu_execution_performed=false\ntrainingReady=false\n' \
        "$result" "$image" "$lock" "$started" (date +%s) "$pull_status" "$inspection_status" "$image_status" "$run_attempted" "$run_status" "$cid" "$cleanup_attempted" "$cleanup_status" >"$evidence/receipt.txt"
        printf 'FAIL_RECEIPT_WRITE: preserve this evidence directory and do not retry.\n' >&2
        return 1
    end
    if not cat "$evidence/receipt.txt"
        return 1
    end
    if not printf 'evidence=%s\n' "$evidence"
        return 1
    end
    test "$result" = PASS_INPUT_METADATA_ONLY
end

if test (count $argv) -eq 1; and test "$argv[1]" = --inspect
    inspect_builder_image
else if test (count $argv) -eq 0
    inspect_builder_inputs
else
    printf 'No extra arguments are accepted.\n' >&2
    exit 1
end
