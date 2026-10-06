"""One command from nothing to the map data the app reads (public/korea/admin).

python scripts/korea-data/make_map_data.py --sample      # 강남구 + 양평군 only, about 20 minutes
python scripts/korea-data/make_map_data.py              # all of Korea, about 2.5 hours
python scripts/korea-data/make_map_data.py --list        # the stages and what each makes
python scripts/korea-data/make_map_data.py --from admin  # continue from a stage
python scripts/korea-data/make_map_data.py --force roads # redo one stage (--force all: everything)

Stages, in order (each skips itself when its output exists, unless forced):
  download    pinned inputs into data/korea, checksums verified
  roads       roads.jsonl, every highway way of the extract (extract_roads.py)
  boundaries  area outlines, rivers, railways, fences for the walk level (extract_boundaries.py)
  admin       시도 → 시군구 → 읍면동 → 구획 → 블록 → 보행로 조각 (build_admin.py)
  roadlevel   what is left of each piece once every road is cut out (build_roads.py)
  validate    nesting and coverage checks over the result (validate_admin.py)

Needs Python 3.11+ and `pip install -r scripts/korea-data/requirements.txt`; about 8 GB of
free RAM for the full run and about 5 GB of disk (inputs and caches 2.5 GB, output 1.3 GB).
Everything lands in data/korea (inputs, caches) and public/korea (what the app serves);
neither is committed. The older tile sets (public/korea/base, detail, city …) are not part of this:
the app draws only public/korea/admin. See scripts/korea-data/README.md.
"""
import argparse
import hashlib
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RAW = ROOT / "data/korea"
ADMIN = ROOT / "public/korea/admin"

# Pinned inputs. The Geofabrik file is a dated snapshot (they delete old ones
# after a while: then pass your own copy with --pbf and expect other numbers).
PBF_URL = "https://download.geofabrik.de/asia/south-korea-260929.osm.pbf"
PBF_MD5 = "7775afecd9ccbf3285ace3f1fa2ec7f4"
ADMIN_URL = "https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson"
ADMIN_SHA256 = "c01ef44a0eb00978662ba7a6240ccb1da287fb52abd85104a1758969d391132f"
SAMPLE_SGG = "11680,41830"  # 강남구 (dense city) and 양평군 (rural)

STAGES = ["download", "roads", "boundaries", "admin", "roadlevel", "validate"]


def digest(path, algorithm):
    h = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url, path, algorithm, expected):
    """Download unless a file with the right checksum is already there."""
    import requests  # imported late so --list works without the dependencies

    if path.exists() and digest(path, algorithm) == expected:
        print(f"  have {path.name}")
        return
    print(f"  downloading {url}")
    part = path.with_name(path.name + ".part")
    with requests.get(url, stream=True, timeout=120) as response:
        response.raise_for_status()
        with part.open("wb") as out:
            for chunk in response.iter_content(1 << 20):
                out.write(chunk)
    if digest(part, algorithm) != expected:
        part.unlink()
        raise SystemExit(f"{path.name}: checksum differs from the pinned {algorithm} {expected[:12]}…. "
                         "The source changed or the download broke; see the pins in make_map_data.py.")
    part.replace(path)


def run(script, *args):
    command = [sys.executable, str(HERE / script), *args]
    print("  $", " ".join(["python", f"scripts/korea-data/{script}", *args]), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sample", action="store_true", help=f"only 시군구 {SAMPLE_SGG} (강남구, 양평군)")
    ap.add_argument("--sgg", help="comma-separated 시군구 codes instead of all")
    ap.add_argument("--from", dest="start", choices=STAGES, help="start at this stage")
    ap.add_argument("--only", choices=STAGES, help="run just this stage")
    ap.add_argument("--force", metavar="STAGE", help="redo a stage even if its output exists (or `all`)")
    ap.add_argument("--pbf", type=Path, help="use your own extract instead of the pinned download (no checksum)")
    ap.add_argument("--list", action="store_true", help="show the stages and stop")
    args = ap.parse_args()
    if args.list:
        print(__doc__)
        return
    sgg = SAMPLE_SGG if args.sample else args.sgg
    forced = set(STAGES) if args.force == "all" else {args.force} if args.force else set()
    if forced - set(STAGES):
        raise SystemExit(f"--force: unknown stage {forced - set(STAGES)}; stages are {', '.join(STAGES)}")
    stages = list(STAGES)
    if args.only:
        stages = [args.only]
    elif args.start:
        stages = stages[stages.index(args.start):]
    RAW.mkdir(parents=True, exist_ok=True)
    pbf = args.pbf or RAW / "south-korea.osm.pbf"
    admin_geojson = RAW / "HangJeongDong_ver20260701.geojson"
    sgg_args = ["--sgg", sgg] if sgg else []
    pbf_args = ["--pbf", str(pbf)] if args.pbf else []

    # done(): the stage's output is there, so it is skipped unless forced.
    # Partial (--sgg) runs always redo admin/roadlevel: they are the cheap part.
    def done(stage):
        if stage in forced:
            return False
        if stage == "download":
            return (pbf.exists() and admin_geojson.exists() and (args.pbf is not None or digest(pbf, "md5") == PBF_MD5)
                    and digest(admin_geojson, "sha256") == ADMIN_SHA256)
        return {
            "roads": (RAW / "roads.jsonl").exists(),
            "boundaries": (RAW / "boundaries.pkl").exists(),
            "admin": False if sgg else (ADMIN / "sido.json").exists() and (ADMIN / "block").is_dir(),
            "roadlevel": False if sgg else (ADMIN / "road").is_dir() and len(list((ADMIN / "road").iterdir())) >= 250,
            "validate": False,
        }[stage]

    def download():
        if not args.pbf:
            fetch(PBF_URL, pbf, "md5", PBF_MD5)
        fetch(ADMIN_URL, admin_geojson, "sha256", ADMIN_SHA256)

    actions = {
        "download": download,
        "roads": lambda: run("extract_roads.py", *pbf_args),
        "boundaries": lambda: run("extract_boundaries.py", *pbf_args),
        "admin": lambda: run("build_admin.py", *sgg_args),
        "roadlevel": lambda: run("build_roads.py", *sgg_args),
        "validate": lambda: run("validate_admin.py", *([sgg] if sgg else [])),
    }
    began = time.time()
    for stage in stages:
        if done(stage):
            print(f"[{stage}] already done (--force {stage} to redo)")
            continue
        print(f"[{stage}] starting", flush=True)
        started = time.time()
        actions[stage]()
        print(f"[{stage}] done in {(time.time() - started) / 60:.1f} min", flush=True)
    print(f"all done in {(time.time() - began) / 60:.1f} min. Start the app with `npm run dev` and zoom into 강남구 or 양평군.")


if __name__ == "__main__":
    main()
