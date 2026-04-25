#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from pathlib import Path


REQUIRED_PATHS = [
    r"E:\Projects\Playground\docs\KNOWLEDGE_OS_BRIDGE_2026-04-14.md",
    r"E:\Projects\Playground\docs\CATCHUP_GUIDE.md",
    r"C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\registries\user_decision_patterns.md",
    r"C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\registries\user_rejected_patterns.md",
    r"C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\registries\project_operating_contexts.md",
    r"C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\registries\local_business_constraints.md",
    r"C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\overview.md",
    r"C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\domains\ikimon_product_strategy.md",
    r"C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md",
    r"E:\Projects\f4051eaca1250fe9886237e926875b75efd92364eb5c127cac6894c712274db3-2026-04-12-11-11-37-3a4ac28f50354c10a83064eac58bac3c\_knowledge_os_staging\README.md",
]


def to_current_os_path(p: str) -> Path:
    """Resolve Windows-style paths on both Windows and WSL."""
    # Native path first
    native = Path(p)
    if native.exists():
        return native

    m = re.match(r"^([A-Za-z]):\\(.*)$", p)
    if m:
        drive = m.group(1).lower()
        rest = m.group(2).replace("\\", "/")
        wsl = Path(f"/mnt/{drive}/{rest}")
        if wsl.exists():
            return wsl
        return wsl

    return native


def main() -> int:
    ok = 0
    ng = 0

    print("== Knowledge OS Bridge Health Check ==")

    for raw in REQUIRED_PATHS:
        resolved = to_current_os_path(raw)
        exists = resolved.exists()
        mark = "OK" if exists else "NG"
        print(f"[{mark}] {raw}")
        print(f"     -> {resolved}")
        if exists:
            ok += 1
        else:
            ng += 1

    # Additional semantic check: CATCHUP guide points to bridge doc
    catchup = to_current_os_path(r"E:\Projects\Playground\docs\CATCHUP_GUIDE.md")
    bridge_link_ok = False
    if catchup.exists():
        txt = catchup.read_text(encoding="utf-8", errors="ignore")
        bridge_link_ok = "KNOWLEDGE_OS_BRIDGE_2026-04-14.md" in txt

    print("\n== Semantic checks ==")
    print(f"[{'OK' if bridge_link_ok else 'NG'}] CATCHUP_GUIDE contains bridge link")

    print("\n== Summary ==")
    print(f"paths_ok={ok} paths_ng={ng} bridge_link_ok={bridge_link_ok}")

    return 0 if ng == 0 and bridge_link_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
