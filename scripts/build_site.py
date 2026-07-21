from __future__ import annotations

import argparse
from datetime import datetime, timezone
import shutil
import subprocess
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.normalize_frequency import build_manifest
from scripts.validate_frequency import validate_data_root, write_storage_report

CUSTOM_DOMAIN = "gridfreq.com"
REQUIRED_DOMAIN_FILES = ("CNAME", "robots.txt", "sitemap.xml", "site.webmanifest")
OPTIONAL_DOMAIN_FILES = ("404.html", "LICENSE")


def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    for path in src.rglob("*"):
        if path.is_file():
            target = dst / path.relative_to(src)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)


def validate_cname(path: Path = Path("CNAME")) -> None:
    text = path.read_text(encoding="utf-8")
    normalized = text.replace("\r\n", "\n")
    if normalized not in (CUSTOM_DOMAIN, f"{CUSTOM_DOMAIN}\n"):
        raise ValueError("CNAME must contain exactly gridfreq.com")


def copy_domain_files(dist_root: Path, require_domain_files: bool = True) -> None:
    missing = [name for name in REQUIRED_DOMAIN_FILES if not Path(name).is_file()]
    if missing and require_domain_files:
        raise FileNotFoundError(f"Missing required GitHub Pages domain file(s): {', '.join(missing)}")
    if Path("CNAME").is_file():
        validate_cname(Path("CNAME"))
    for name in (*REQUIRED_DOMAIN_FILES, *OPTIONAL_DOMAIN_FILES):
        source = Path(name)
        if source.is_file():
            shutil.copy2(source, dist_root / name)


def git_commit_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return "unknown"


def write_index_with_build_metadata(source: Path, target: Path) -> None:
    text = source.read_text(encoding="utf-8")
    build_time = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    text = text.replace('name="gridfreq-build-commit" content="dev"', f'name="gridfreq-build-commit" content="{git_commit_sha()}"')
    text = text.replace('name="gridfreq-build-time" content="dev"', f'name="gridfreq-build-time" content="{build_time}"')
    target.write_text(text, encoding="utf-8", newline="\n")


def build_site(data_root: Path = Path("data"), dist_root: Path = Path("dist"), require_domain_files: bool = True) -> dict:
    resolved_dist = dist_root.resolve()
    resolved_cwd = Path.cwd().resolve()
    if resolved_dist == resolved_cwd or resolved_cwd not in resolved_dist.parents:
        raise ValueError(f"Refusing to build outside workspace: {resolved_dist}")
    if dist_root.exists():
        shutil.rmtree(dist_root)
    dist_root.mkdir(parents=True)
    write_index_with_build_metadata(Path("frekans_rapor_v1.html"), dist_root / "index.html")
    if Path("index.html").exists():
        shutil.copy2("index.html", dist_root / "source-index.html")
    copy_domain_files(dist_root, require_domain_files=bool(require_domain_files))
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
    parser.add_argument("--allow-missing-domain-files", action="store_true")
    args = parser.parse_args()
    result = build_site(Path(args.data_root), Path(args.dist), require_domain_files=not args.allow_missing_domain_files)
    print(result)
    return 1 if result["dataIssues"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
