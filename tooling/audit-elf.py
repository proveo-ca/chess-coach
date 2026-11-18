# SPEC: _spec/gate-closure.puml
import hashlib
import json
import os
import sys
from pathlib import Path

from elftools.elf.elffile import ELFFile


def inspect(path: Path) -> dict:
    with path.open("rb") as handle:
        digest = hashlib.file_digest(handle, "sha256").hexdigest()
        length = os.fstat(handle.fileno()).st_size
        handle.seek(0)
        elf = ELFFile(handle)
        if (
            elf.elfclass != 64
            or not elf.little_endian
            or elf.header["e_machine"] != "EM_X86_64"
        ):
            raise ValueError("ELF audit: TARGET")
        needed, search, interpreters = [], [], []
        for segment in elf.iter_segments():
            if segment.header["p_type"] == "PT_INTERP":
                interpreters.append(segment.get_interp_name())
            if segment.header["p_type"] == "PT_DYNAMIC":
                for tag in segment.iter_tags():
                    if tag.entry.d_tag == "DT_NEEDED":
                        needed.append(tag.needed)
                    if tag.entry.d_tag == "DT_RPATH":
                        search.append({"kind": "RPATH", "value": tag.rpath})
                    if tag.entry.d_tag == "DT_RUNPATH":
                        search.append({"kind": "RUNPATH", "value": tag.runpath})
        return {
            "path": str(path),
            "byteLength": length,
            "sha256": digest,
            "machine": elf.header["e_machine"],
            "needed": needed,
            "searchPaths": search,
            "interpreters": interpreters,
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: audit-elf.py SELECTED_ELF...")
    print(
        json.dumps(
            {
                "scope": "STATIC_SELECTED_ELF_HEADERS_ONLY",
                "files": [inspect(Path(path)) for path in sys.argv[1:]],
            },
            indent=2,
        )
    )
