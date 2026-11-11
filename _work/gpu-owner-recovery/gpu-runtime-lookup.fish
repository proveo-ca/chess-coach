# SPEC: _spec/gpu-build.puml
begin
    printf 'scope=READ_ONLY_CLIENT_ENDPOINT_AND_SHELL_MACHINE_PATHS\n'
    for variable in DOCKER_HOST DOCKER_CONTEXT
        if set -qx $variable
            printf '%s=%s\n' "$variable" "$$variable"
        else
            printf '%s=<unset>\n' "$variable"
        end
    end

    timeout --kill-after=3s 10s docker version --format 'client={{.Client.Version}}/{{.Client.Os}}/{{.Client.Arch}} {{if .Server}}server={{.Server.Version}}/{{.Server.Os}}/{{.Server.Arch}}{{else}}server=unavailable{{end}}'
    printf 'docker_version_exit=%s\n' "$status"
    timeout --kill-after=3s 10s docker info --format 'serverOS={{.OperatingSystem}} osType={{.OSType}} architecture={{.Architecture}} defaultRuntime={{.DefaultRuntime}} runtimes={{json .Runtimes}}'
    printf 'docker_info_exit=%s\n' "$status"
    set -l context (timeout --kill-after=3s 10s docker context show)
    set -l context_exit $status
    printf 'context_show_exit=%s context=%s\n' "$context_exit" "$context"
    if test "$context_exit" -eq 0; and test (count $context) -eq 1; and test -n "$context"
        timeout --kill-after=3s 10s docker context inspect --format 'context={{.Name}} contextEndpoint={{.Endpoints.docker.Host}}' -- "$context"
        printf 'context_inspect_exit=%s\n' "$status"
    end

    printf 'shell_machine_os_release:\n'
    if test -r /etc/os-release
        cat /etc/os-release
    else
        printf '/etc/os-release=<unavailable>\n'
    end
    for tool in nvidia-container-runtime nvidia-container-runtime-hook nvidia-container-cli nvidia-ctk runc
        set -l resolved (command -s -- "$tool")
        set -l lookup_exit $status
        printf 'shell_path_lookup tool=%s exit=%s path=%s\n' "$tool" "$lookup_exit" "$resolved"
        for directory in /usr/bin /usr/sbin /usr/local/bin /usr/local/sbin /bin /sbin
            set -l candidate "$directory/$tool"
            if test -e "$candidate"; or test -L "$candidate"
                set -l executable false
                if test -x "$candidate"
                    set executable true
                end
                printf 'shell_machine_candidate=%s executable=%s\n' "$candidate" "$executable"
            end
        end
    end
    printf 'client_endpoint_and_shell_paths_do_not_prove_daemon_host_or_daemon_containerd_PATH=true\n'
end
