# Docker Sandboxes: storage and execution interface research

Status: ROOT CLI IDENTIFIED FROM OPERATOR REPORT / OFFICIAL STORAGE DOCS FOUND / INSTALLED SUBCOMMAND HELP PENDING.

## Official sources

- https://docs.docker.com/ai/sandboxes/architecture/
- https://docs.docker.com/ai/sandboxes/troubleshooting/
- https://docs.docker.com/ai/sandboxes/cloud/local-vs-cloud/
- https://docs.docker.com/reference/cli/sbx/create/
- https://docs.docker.com/reference/cli/sbx/exec/
- https://docs.docker.com/reference/cli/sbx/volume/

The fetched create/exec reference pages exposed titles only.
Do not fill installed flags from stale agent-specific examples or treat those empty page bodies as a complete CLI contract.
The operator's installed root help is authoritative for the discovered verb names, not their unobserved arguments.

## Documented storage controls

| Surface | Official documented control / behavior | Remaining obligation |
|---|---|---|
| Local VM root filesystem | `DOCKER_SANDBOXES_ROOT_SIZE` at creation; documented default 20 GB | Confirm installed-version support, size parsing and actual usable bytes |
| Independent Docker data disk | `DOCKER_SANDBOXES_DOCKER_SIZE` at creation; documented default 10 GB and minimum 512 MiB | Admit capture/build/image space separately from private experiment state |
| Clone-mode workspace | `DOCKER_SANDBOXES_CLONED_WORKSPACE_SIZE` at creation; examples use human-readable `100g` | Do not infer byte units, reuse the reference mount or select clone storage as state implicitly |
| Direct host workspace | Filesystem passthrough exposing actual host files; default paths preserve host absolute paths | Require exact selected mount and durability qualification; preserve the reference read-only |
| Mountless sandbox | Documented starting at sbx 0.42.0; image `WORKDIR` supplies the default workspace | Installed sbx version remains unknown; do not assume this behavior is available |
| Local lifecycle | Internal files persist across stops until sandbox removal | Never use removal/reset/prune as cleanup while state/evidence resides only inside that VM |
| Cloud backend | Separate compute, stores, policy, secrets and optional volumes; host paths are unavailable | No cloud choice, billing, API or resource operation is authorized by root-help discovery |

Docker explicitly states that the size environment variables do not resize existing volumes.
Do not enlarge, recreate, reset or remove the active coding sbx as a provisioning shortcut.
Do not execute a create/run command copied from troubleshooting as a read-only query.
Do not equate any nominal `200g` root/data/clone setting with 191,396,683,776 free usable bytes on an admitted private target.
Root, Docker data, cloned workspace, capture/build scratch, outside evidence and preserved historical disks need explicit physical coexistence accounting.
The hard 24,000,000,000-byte RAM / 12-thread aggregate ceiling remains unchanged.

## Installed contract to obtain next

`host:sbx-contract` collects only these six help pages using the existing bounded subprocess helper:

```text
sbx version --help
sbx create --help
sbx exec --help
sbx stop --help
sbx rm --help
sbx cp --help
```

Every invocation ends in `--help`.
No subcommand receives a sandbox identity or resource/allocation argument.
The first unsupported/failed help stops the packet without fallback or retry.
Version help must precede proposing a client/daemon version query.
Create help must precede selecting agent/template/workspace/resource flags.
Exec/lifecycle help must precede designing owned launch, I/O, exit propagation and cleanup.
Do not assume a CLI stop/removal receipt proves the selected job cgroup's disappearance or original-clock deadline compliance.

## Open design bindings

The outer sbx VM and its Docker daemon differ from the in-envelope training container and the trusted outside supervisor.
Map VM overhead, manager clients, outside control admission, observations and exact state backing before freezing Gate0.
Root help alone does not select local versus cloud execution, host CPU IDs, affinity, cgroup placement, image/template bytes, source mounts or filesystem identity.
Preserve C2, C8, C13, C15, C18, original deadlines, the final three-second cleanup, fixed planning permits and no operational retry/reset.
Keep seeding/provisioning/training tasks unwired until the actual supported contract, target and separate grants exist.
Gate0, F9 and R4 remain OPEN.
`trainingReady:false` remains unchanged.
