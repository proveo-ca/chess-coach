# SPEC: _spec/gpu-build.puml
begin
    set -l image 'docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038'
    set -l rust 'docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb'
    set -l gpu 'GPU-713c95e0-6952-a576-794b-9ef1fb527ff0'
    timeout --kill-after=3s 10s docker image inspect --format 'rust={{.Os}}/{{.Architecture}} {{.Id}}' "$rust"
    printf 'rust_inspect_exit=%s\n' "$status"
    set -l base (timeout --kill-after=3s 10s docker image inspect --format '{{.Os}}/{{.Architecture}} {{.Id}}' "$image")
    set -l base_exit $status
    printf 'bun_inspect_exit=%s bun=%s\n' "$base_exit" "$base"
    if test "$base_exit" -eq 0; and string match --quiet 'linux/amd64 *' -- "$base"
        if mkdir -p _work/gpu-owner-recovery/runs
            set -l evidence (mktemp -d _work/gpu-owner-recovery/runs/host-visibility-XXXXXXXX)
            if test -n "$evidence"
                timeout --kill-after=3s 30s docker run --pull=never \
                    --cidfile "$evidence/container.cid" \
                    --runtime=nvidia --gpus "device=$gpu" --user 1000:1000 \
                    --cpus=2 --memory=512m --pids-limit=64 \
                    --env "NVIDIA_VISIBLE_DEVICES=$gpu" \
                    --env NVIDIA_DRIVER_CAPABILITIES=compute,utility \
                    --entrypoint /bin/sh "$image" -ec '
                        smi=$(command -v nvidia-smi)
                        printf "nvidia-smi=%s\n" "$smi"
                        "$smi" --query-gpu=name,uuid,driver_version,memory.total,memory.free --format=csv
                        "$smi" -i "$NVIDIA_VISIBLE_DEVICES" -q -d MEMORY
                    ' >"$evidence/query.stdout" 2>"$evidence/query.stderr"
                set -l query_exit $status
                set -l cleanup_exit 125
                if test -s "$evidence/container.cid"
                    set -l cid (string trim -- (cat "$evidence/container.cid"))
                    if string match --quiet --regex '^[a-f0-9]{64}$' -- "$cid"
                        timeout --kill-after=3s 10s docker rm --force -- "$cid" >"$evidence/cleanup.stdout" 2>"$evidence/cleanup.stderr"
                        set cleanup_exit $status
                    else
                        printf '' >"$evidence/cleanup.stdout"
                        printf 'Invalid CID; cleanup is unverified.\n' >"$evidence/cleanup.stderr"
                    end
                else
                    printf '' >"$evidence/cleanup.stdout"
                    printf 'No CID captured; cleanup is unverified.\n' >"$evidence/cleanup.stderr"
                end
                cat "$evidence/query.stdout" "$evidence/query.stderr" "$evidence/cleanup.stdout" "$evidence/cleanup.stderr"
                printf 'query_exit=%s cleanup_exit=%s evidence=%s\n' "$query_exit" "$cleanup_exit" "$evidence"
            end
        end
    end
end
