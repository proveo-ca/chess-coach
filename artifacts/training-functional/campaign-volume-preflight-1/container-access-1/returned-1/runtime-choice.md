# Runtime choice after the blocked HOST probe

Use `sbx cp` for transfer and the existing microVM for isolated staging. Keep the packet2 HOST Docker design for this campaign unless a separately approved replacement is qualified.

| Requirement | Existing HOST Docker plan | Local `sbx` alternative |
| --- | --- | --- |
| Retained image with no pull | Packet2 refers to the digest in the HOST daemon. The probe's local image inspection succeeded. | A microVM has its own daemon and image store. HOST availability does not establish guest availability. A no-pull migration would require a verified transfer into that store. |
| Direct HOST Btrfs and SELinux | The operator binds the selected HOST paths and checks filesystem identity and live byte admission on HOST and inside the worker. Probe access remains unverified. | The existing sandbox sees `/mnt/training` through virtiofs and a separate kernel. That does not qualify the direct Btrfs or HOST SELinux contract, including the Btrfs-only unknown-entry handling. |
| GPU and limits | The packet uses the HOST NVIDIA runtime, a selected GPU, VRAM thresholds, and container limits including no additional swap. The campaign remains unrun. | Documented passthrough is experimental and assigns an unused NVIDIA GPU to the guest through VFIO. It requires IOMMU and guest drivers. Device identity, free-VRAM monitoring, CPU/RAM/swap limits, and the long-run lifecycle would need fresh equivalence evidence. |

Do not use the guest daemon to diagnose the HOST daemon. Inspecting guest state cannot explain the empty pre-start `ProcessLabel` from `unix:///var/run/docker.sock` on HOST. This comparison does not authorize new provisioning, GPU passthrough, policy changes, preparation, or training.

Sources:
- [Docker Sandboxes architecture](https://docs.docker.com/ai/sandboxes/architecture/#storage-and-persistence)
- [Docker Sandboxes GPU passthrough](https://docs.docker.com/ai/sandboxes/configuration/gpu-passthrough/)
- [`sbx cp`](https://docs.docker.com/reference/cli/sbx/cp/)
- [Packet2 Docker contract](../../../campaign-operator.ts)
