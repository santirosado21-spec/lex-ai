"""Build the private local pilot from the current checkout and npm lockfile."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RESOURCES = (
    "legal-library-catalog.json", "law-areas.json", "state-library-catalog.json",
    "state-library.jsonl", "public-library.sqlite.manifest.json", "legal-corpus.json",
    "model-catalog.json", "trade-pilot-lce.json", "legal-thesaurus.json",
    "mexico-jurisdictions.json", "public-library.sqlite",
)
REPORTS = ("comercio-exterior-piloto-2026-11-19.md", "rejon-instinct-2026-11-19.md")


def copy_file(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def package(output):
    output = output.resolve()
    if output.exists():
        raise FileExistsError(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["npm", "run", "build"], cwd=ROOT, check=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as scratch:
        app = Path(scratch) / "Rejon-Comercio"
        tracked = subprocess.check_output(
            ["git", "ls-files", "-z", "--", "server", "piloto", "resources/legal-task-skills", "resources/trade"],
            cwd=ROOT,
        )
        files = [Path(os.fsdecode(name)) for name in tracked.split(b"\0") if name]
        files.extend(Path("resources") / name for name in RESOURCES)
        files.extend(map(Path, ["package.json", "package-lock.json", "Abrir Rejon.command", "Abrir Rejon.cmd"]))
        for name in files:
            copy_file(ROOT / name, app / name)
        for name in REPORTS:
            copy_file(ROOT / "docs/qa" / name, app / "piloto" / name)
        shutil.copytree(ROOT / "dist", app / "dist")
        subprocess.run(["npm", "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline"], cwd=app, check=True)
        archive = Path(scratch) / "piloto.zip"
        subprocess.run(["zip", "-q", "-X", "-r", "-y", str(archive), app.name], cwd=scratch, check=True)
        with zipfile.ZipFile(archive) as bundle:
            if bundle.testzip() is not None:
                raise RuntimeError("El archivo comprimido tiene una entrada dañada.")
            for name in files:
                if bundle.read(f"{app.name}/{name.as_posix()}") != (ROOT / name).read_bytes():
                    raise RuntimeError(f"La copia de {name} difiere del archivo de origen.")
        # Both paths are on the same volume. Publish locally only after the full check.
        os.link(archive, output)
    print(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Ruta nueva para el ZIP privado.")
    package(parser.parse_args().output)
