from __future__ import annotations

import argparse
import shutil
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.normalize_frequency import build_manifest
from scripts.validate_frequency import validate_data_root, write_storage_report


def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    for path in src.rglob("*"):
        if path.is_file():
            target = dst / path.relative_to(src)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)


def build_site(data_root: Path = Path("data"), dist_root: Path = Path("dist")) -> dict:
    resolved_dist = dist_root.resolve()
    resolved_cwd = Path.cwd().resolve()
    if resolved_dist == resolved_cwd or resolved_cwd not in resolved_dist.parents:
        raise ValueError(f"Refusing to build outside workspace: {resolved_dist}")
    if dist_root.exists():
        shutil.rmtree(dist_root)
    dist_root.mkdir(parents=True)
    shutil.copy2("frekans_rapor_v1.html", dist_root / "index.html")
    if Path("index.html").exists():
        shutil.copy2("index.html", dist_root / "source-index.html")
    copy_tree(Path("assets"), dist_root / "assets")
    build_manifest(data_root)
    copy_tree(data_root, dist_root / "data")
    validation = validate_data_root(data_root)
    write_storage_report(validation)
    total_bytes = sum(path.stat().st_size for path in dist_root.rglob("*") if path.is_file())
    return {"dist": str(dist_root), "bytes": total_bytes, "dataIssues": validation["issues"]}


def main() -> int:
    parser = argparse.ArgumentParser(description="Build GitHub Pages static dist output.")
    parser.add_argument("--data-root", default="data")
    parser.add_argument("--dist", default="dist")
    args = parser.parse_args()
    result = build_site(Path(args.data_root), Path(args.dist))
    print(result)
    return 1 if result["dataIssues"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
