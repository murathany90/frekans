from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def validate_data_root(data_root: Path) -> dict:
    issues = []
    warnings = []
    total_bytes = 0
    manifest_path = data_root / "manifest.json"
    manifest = {}
    active_days: set[tuple[str, str]] = set()
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for source, source_info in manifest.get("sources", {}).items():
            for local_date in source_info.get("availableDates", []):
                active_days.add((source, local_date))
    for path in data_root.rglob("*"):
        if path.is_file():
            total_bytes += path.stat().st_size
    for meta_path in data_root.glob("*/2026/[01][0-9]/*.meta.json"):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        source = meta["source"]
        local_date = meta["localDate"]
        stem = meta["localDate"].replace("-", "")
        frequency_path = meta_path.with_name(f"{stem}.frequency.i16")
        if not frequency_path.exists():
            issues.append(f"Missing binary for {meta['source']} {meta['localDate']}")
            continue
        expected_size = int(meta["expectedSamples"]) * 2
        actual_size = frequency_path.stat().st_size
        if actual_size != expected_size:
            issues.append(f"Unexpected binary size for {meta['source']} {meta['localDate']}: {actual_size} != {expected_size}")
        if meta.get("status") == "invalid":
            if (source, local_date) in active_days:
                issues.append(f"Invalid active day: {source} {local_date}")
            else:
                warnings.append(f"Invalid day excluded from active manifest: {source} {local_date}")
    for source, source_info in manifest.get("sources", {}).items():
        for local_date, files in source_info.get("files", {}).items():
            if (source, local_date) not in active_days:
                issues.append(f"Manifest file entry is not listed as available: {source} {local_date}")
            for file_type, rel_path in files.items():
                if not (data_root / rel_path).exists():
                    issues.append(f"Manifest points to missing {file_type} file for {source} {local_date}: {rel_path}")
    return {"totalBytes": total_bytes, "issues": issues, "warnings": warnings}


def write_storage_report(result: dict) -> None:
    root = Path("reports/data_quality")
    root.mkdir(parents=True, exist_ok=True)
    mib = result["totalBytes"] / (1024 * 1024)
    lines = [
        "# Storage Report",
        "",
        f"- Data bytes: {result['totalBytes']}",
        f"- Data MiB: {mib:.2f}",
        f"- Issue count: {len(result['issues'])}",
        f"- Warning count: {len(result.get('warnings', []))}",
        "",
        "## Issues",
        "",
        "\n".join(f"- {issue}" for issue in result["issues"]) or "None",
        "",
        "## Warnings",
        "",
        "\n".join(f"- {warning}" for warning in result.get("warnings", [])) or "None",
    ]
    (root / "storage_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate optimized frequency data files.")
    parser.add_argument("--data-root", default="data")
    args = parser.parse_args()
    result = validate_data_root(Path(args.data_root))
    write_storage_report(result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["issues"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
