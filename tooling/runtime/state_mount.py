# SPEC: _spec/checkpoint-runtime.puml
from dataclasses import dataclass
import re


@dataclass(frozen=True)
class DedicatedStateMount:
    source: str

    def check(self) -> None:
        if not re.fullmatch(r"/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*", self.source):
            raise ValueError("State mount: SOURCE")
        if any(
            part in (".", "..") for part in self.source.split("/")
        ) or self.source in ("/home", "/tmp", "/var", "/run", "/state"):
            raise ValueError("State mount: DEDICATED_SOURCE")

    def arguments(self) -> list[str]:
        self.check()
        return [
            "--mount",
            f"type=bind,source={self.source},target=/state,bind-propagation=rprivate",
        ]

    def verify(self, mounts: list[dict]) -> None:
        self.check()
        state = [mount for mount in mounts if mount.get("Destination") == "/state"]
        if len(state) != 1:
            raise RuntimeError("State mount: EXACT_TARGET")
        selected = state[0]
        if (
            selected.get("Type") != "bind"
            or selected.get("Source") != self.source
            or selected.get("RW") is not True
            or selected.get("Propagation") != "rprivate"
        ):
            raise RuntimeError("State mount: EXACT_POLICY")
        for mount in mounts:
            if mount is not selected and (
                mount.get("Type") != "tmpfs" or mount.get("Destination") != "/tmp"
            ):
                raise RuntimeError("State mount: EXTRA_MOUNT")
