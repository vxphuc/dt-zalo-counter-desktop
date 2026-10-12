#!/usr/bin/env python3
"""Publish a verified GitHub update bundle; installers first, channel metadata last."""
import argparse
import hashlib
import json
import os
import re
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

CHANNELS = {"win-x64", "mac-x64", "mac-arm64", "linux-x64", "linux-arm64"}
VERSION = re.compile(r"\d+\.\d+\.\d+\Z")
NAME = re.compile(r"[A-Za-z0-9_.-]+\Z")

def version_tuple(value):
    if not isinstance(value, str) or not VERSION.fullmatch(value):
        raise ValueError("Only stable x.y.z releases may be published")
    return tuple(map(int, value.split(".")))

def verify_bundle(archive):
    records = []
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate archive members")
        for item in bundle.infolist():
            name = PurePosixPath(item.filename)
            if name.is_absolute() or ".." in name.parts or "\\" in item.filename or ((item.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError("Unsafe archive path/link")
        for manifest_name in names:
            if not manifest_name.endswith("/release.json"):
                continue
            manifest = json.loads(bundle.read(manifest_name))
            channel = manifest.get("channel")
            if channel not in CHANNELS or manifest.get("schema") != 1:
                raise ValueError("Unknown release channel/schema")
            version_tuple(manifest.get("version"))
            if channel != f'{manifest.get("platform")}-{manifest.get("arch")}' or PurePosixPath(manifest_name).parent.name != channel:
                raise ValueError("Release platform/architecture mismatch")
            prefix = str(PurePosixPath(manifest_name).parent) + "/"
            files = manifest.get("files", [])
            if not files or len({f["name"] for f in files}) != len(files):
                raise ValueError("Missing or duplicate payload files")
            expected_metadata = {"win-x64": "latest.yml", "mac-x64": "latest-mac.yml", "mac-arm64": "latest-mac.yml", "linux-x64": "latest-linux.yml", "linux-arm64": "latest-linux-arm64.yml"}[channel]
            if manifest.get("autoUpdate"):
                if manifest.get("metadata") != expected_metadata or expected_metadata not in {f["name"] for f in files}:
                    raise ValueError("Missing channel metadata")
            elif manifest.get("platform") != "mac" or manifest.get("metadata") is not None:
                raise ValueError("Only unsigned Mac installer bundles may omit update metadata")
            for file in files:
                filename = file["name"]
                if not NAME.fullmatch(filename) or not (filename == expected_metadata or (filename.startswith("DT-Zalo-Counter-") and manifest["version"] in filename and filename.endswith((".exe", ".dmg", ".zip", ".deb", ".AppImage", ".blockmap")))):
                    raise ValueError("Unsafe/unexpected payload filename")
                if filename != expected_metadata:
                    suffix = {"win": (".exe", ".exe.blockmap"), "mac": (".dmg", ".zip", ".dmg.blockmap", ".zip.blockmap"), "linux": (".AppImage", ".deb", ".AppImage.blockmap")}[manifest["platform"]]
                    if not filename.endswith(suffix) or (manifest["platform"] != "win" and f'-{manifest["arch"]}.' not in filename):
                        raise ValueError("Payload belongs to a different OS/architecture")
                member = bundle.getinfo(prefix + filename)
                if member.file_size != file["size"]:
                    raise ValueError("Payload size mismatch")
                checksum = hashlib.sha256()
                with bundle.open(member) as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        checksum.update(chunk)
                if checksum.hexdigest() != file["sha256"]:
                    raise ValueError("Payload SHA256 mismatch: " + filename)
            records.append((prefix, manifest))
    if not records or len({r[1]["channel"] for r in records}) != len(records) or len({r[1]["version"] for r in records}) != 1:
        raise ValueError("Missing, duplicate or mixed-version channel releases")
    return records

def atomic_copy(bundle, member, destination):
    fd, temporary = tempfile.mkstemp(prefix=".publish-", dir=destination.parent)
    try:
        with os.fdopen(fd, "wb") as stream, bundle.open(member) as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                stream.write(chunk)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def publish(archive, root, *, verify_only=False):
    records = verify_bundle(archive)
    root = Path(root).resolve()
    # Check every channel before modifying any of them. Never downgrade or reuse
    # an existing version's immutable installer filename with different bytes.
    for _, release in records:
        target = root / release["channel"]
        if target.is_symlink() or target.resolve().parent != root:
            raise ValueError("Publish channel must stay inside target root")
        previous = target / "release.json"
        if previous.is_symlink():
            raise ValueError("Release manifest must not be a symlink")
        if previous.exists():
            old = json.loads(previous.read_text())
            if version_tuple(old["version"]) > version_tuple(release["version"]):
                raise ValueError("Refusing to publish an older version")
        for file in release["files"]:
            destination = target / file["name"]
            if destination.is_symlink():
                raise ValueError("Existing payload must not be a symlink")
            if destination.exists() and file["name"] != release["metadata"]:
                digest = hashlib.sha256()
                with destination.open("rb") as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        digest.update(chunk)
                if digest.hexdigest() != file["sha256"]:
                    raise ValueError("Existing installer differs; increase app version first")
    if verify_only:
        print("Verified: " + ", ".join(r[1]["channel"] for r in records))
        return
    root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        for prefix, release in records:
            target = root / release["channel"]
            target.mkdir(mode=0o755, exist_ok=True)
            for file in release["files"]:
                if file["name"] != release["metadata"]:
                    atomic_copy(bundle, prefix + file["name"], target / file["name"])
            if release["metadata"]:
                atomic_copy(bundle, prefix + release["metadata"], target / release["metadata"])
            atomic_copy(bundle, prefix + "release.json", target / "release.json")
            print(f'Published {release["channel"]} {release["version"]}; auto-update={release["autoUpdate"]}')

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--root", type=Path, default=Path("/var/www/dt-zalo-counter-updates"))
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    publish(args.archive, args.root, verify_only=args.verify_only)
