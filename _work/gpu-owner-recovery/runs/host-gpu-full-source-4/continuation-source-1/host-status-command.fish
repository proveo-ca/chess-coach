command timeout --signal=TERM --kill-after=2s 30s (status fish-path) --no-config -c '# SPEC: _spec/gpu-full-qualification.puml
set -l root /home/gu1lty/Projects/proveo/chess-coach
set -l failed 0
if not test -d "$root"
    printf "FULL2_STATUS_REPOSITORY_MISSING\n"
    exit 1
end
for path in "$root/_work/gpu-owner-recovery/cache/host-gpu-full-2" "$root/_work/gpu-owner-recovery/runs/host-gpu-full-2"
    if test -e "$path"; or test -L "$path"
        printf "FULL2_PATH_PRESENT %s\n" "$path"
    else
        printf "FULL2_PATH_ABSENT %s\n" "$path"
    end
end
printf "FULL2_CONTAINER_METADATA_BEGIN\n"
command timeout --signal=TERM --kill-after=2s 10s env -u DOCKER_CONTEXT docker --host=unix:///var/run/docker.sock ps --all --no-trunc --filter label=chess-coach.gpu-full=host-gpu-full-2 --format "{{.ID}} {{.State}}" 2>&1 | command head -c 4096
set -l docker_exit $pipestatus[1]
printf "\nFULL2_CONTAINER_METADATA_END exit=%s\n" "$docker_exit"
if test "$docker_exit" -ne 0
    set failed 1
end
set -l receipt "$root/_work/gpu-owner-recovery/runs/host-gpu-full-2/receipt.json"
if test -f "$receipt"; and not test -L "$receipt"
    set -l receipt_bytes (command timeout --kill-after=2s 5s stat -c %s -- "$receipt")
    if string match -qr "^[0-9]+\$" -- "$receipt_bytes"; and test "$receipt_bytes" -le 2097152
        printf "FULL2_RECEIPT_BEGIN bytes=%s\n" "$receipt_bytes"
        command timeout --kill-after=2s 5s head -c 2097152 -- "$receipt"
        set -l read_exit $status
        printf "\nFULL2_RECEIPT_END exit=%s\n" "$read_exit"
        if test "$read_exit" -ne 0
            set failed 1
        end
    else
        printf "FULL2_RECEIPT_SIZE_UNKNOWN_OR_ABOVE_2_MIB\n"
        set failed 1
    end
else if test -e "$receipt"; or test -L "$receipt"
    printf "FULL2_RECEIPT_NOT_REGULAR_NOT_READ\n"
    set failed 1
else
    printf "FULL2_RECEIPT_ABSENT\n"
end
printf "FULL2_STATUS_ONLY_EXIT=%s\n" "$failed"
exit "$failed"
'
