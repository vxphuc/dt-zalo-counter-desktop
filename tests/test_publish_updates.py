import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("publisher", Path(__file__).parents[1] / "deployment/publish-updates.py")
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.target = self.directory / "public"

    def bundle(self, version="1.0.4", payload=b"installer", bad_hash=False, extra=None, channel="win-x64"):
        platform, arch = channel.split("-")
        filename = f"DT-Zalo-Counter-Setup-{version}.exe" if platform == "win" else f"DT-Zalo-Counter-{version}-macOS-{arch}.dmg"
        files = {filename: payload}
        if platform == "win":
            files["latest.yml"] = f"version: {version}\n".encode()
        release = dict(schema=1, channel=channel, platform=platform, arch=arch, version=version, autoUpdate=platform == "win", metadata="latest.yml" if platform == "win" else None)
        release["files"] = [dict(name=name, size=len(data), sha256=hashlib.sha256(data).hexdigest()) for name, data in files.items()]
        if bad_hash:
            release["files"][0]["sha256"] = "0" * 64
        archive = self.directory / f"bundle-{version}.zip"
        with zipfile.ZipFile(archive, "w") as package:
            for name, data in files.items():
                package.writestr(channel + "/" + name, data)
            package.writestr(channel + "/release.json", json.dumps(release))
            if extra:
                package.writestr(extra, b"untrusted")
        return archive, filename

    def test_verify_only_and_bad_hash_never_write(self):
        archive, _ = self.bundle()
        publisher.publish(archive, self.target, verify_only=True)
        self.assertFalse(self.target.exists())
        archive, _ = self.bundle(bad_hash=True)
        with self.assertRaisesRegex(ValueError, "SHA256"):
            publisher.publish(archive, self.target)
        self.assertFalse(self.target.exists())

    def test_metadata_is_published_after_payload_and_old_installers_stay(self):
        archive, filename = self.bundle()
        order = []
        copy = publisher.atomic_copy
        def record(*args):
            order.append(args[2].name)
            return copy(*args)
        with patch.object(publisher, "atomic_copy", side_effect=record):
            publisher.publish(archive, self.target)
        self.assertEqual(order, [filename, "latest.yml", "release.json"])
        archive, new_filename = self.bundle("1.0.5", b"new installer")
        publisher.publish(archive, self.target)
        self.assertEqual((self.target / "win-x64" / filename).read_bytes(), b"installer")
        self.assertEqual((self.target / "win-x64" / new_filename).read_bytes(), b"new installer")

    def test_no_downgrade_or_reused_installer_bytes(self):
        archive, _ = self.bundle()
        publisher.publish(archive, self.target)
        archive, _ = self.bundle(payload=b"changed")
        with self.assertRaisesRegex(ValueError, "increase app version"):
            publisher.publish(archive, self.target)
        archive, _ = self.bundle("1.0.3")
        with self.assertRaisesRegex(ValueError, "older version"):
            publisher.publish(archive, self.target)
        self.assertEqual((self.target / "win-x64/latest.yml").read_text(), "version: 1.0.4\n")

    def test_unsafe_archive_path_is_rejected(self):
        archive, _ = self.bundle(extra="../escape")
        with self.assertRaisesRegex(ValueError, "Unsafe archive"):
            publisher.publish(archive, self.target)
        self.assertFalse(self.target.exists())

    def test_unsigned_mac_has_installer_without_enabling_feed(self):
        archive, filename = self.bundle(channel="mac-arm64")
        publisher.publish(archive, self.target)
        self.assertTrue((self.target / "mac-arm64" / filename).exists())
        self.assertFalse((self.target / "mac-arm64/latest-mac.yml").exists())


if __name__ == "__main__":
    unittest.main()
