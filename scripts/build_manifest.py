from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.normalize_frequency import build_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Build data/manifest.json and per-source indexes.")
    parser.add_argument("--data-root", default="data")
    args = parser.parse_args()
    manifest = build_manifest(Path(args.data_root))
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
