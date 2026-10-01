import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("merge_csv", Path(__file__).parents[1] / "scripts/merge_csv.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MergeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.raw = self.root / "raw"
        self.raw.mkdir()
        self.row = {"response_id": "rq-one", "schema_version": "1", "study_id": "reading", "instrument_version": "1", "consent_version": "1", "data_mode": "live", "consent": "yes", **dict.fromkeys(module.ITEMS, "3"), "feedback": '日本語,「読解」\n"引用"'}

    def tearDown(self):
        self.temp.cleanup()

    def write(self, name, row):
        with (self.raw / name).open("w", encoding="utf-8-sig", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=row)
            writer.writeheader()
            writer.writerow(row)

    def test_bom_japanese_multiline_and_duplicate(self):
        self.write("one.csv", self.row)
        self.write("copy.csv", self.row)
        output = self.root / "all.csv"
        self.assertEqual(module.merge(self.raw, output), (1, 1, 0))
        self.assertEqual(output.read_bytes()[:3], b"\xef\xbb\xbf")
        with output.open(encoding="utf-8-sig", newline="") as file:
            self.assertEqual(list(csv.DictReader(file)), [self.row])

    def test_conflicting_duplicate_and_overwrite(self):
        self.write("one.csv", self.row)
        self.write("changed.csv", {**self.row, "A01": "5"})
        with self.assertRaisesRegex(ValueError, "同じID"):
            module.merge(self.raw, self.root / "all.csv")
        existing = self.root / "keep.csv"
        existing.write_text("keep")
        with self.assertRaisesRegex(ValueError, "既に存在"):
            module.merge(self.raw, existing)
        self.assertEqual(existing.read_text(), "keep")

    def test_preview_excluded_unless_requested(self):
        self.write("one.csv", {**self.row, "data_mode": "preview"})
        with self.assertRaisesRegex(ValueError, "結合する回答がありません"):
            module.merge(self.raw, self.root / "all.csv")
        self.assertEqual(module.merge(self.raw, self.root / "all.csv", True), (1, 0, 0))

    def test_version_mixing_rejected(self):
        self.write("one.csv", self.row)
        self.write("two.csv", {**self.row, "response_id": "rq-two", "instrument_version": "2"})
        with self.assertRaisesRegex(ValueError, "異なる調査"):
            module.merge(self.raw, self.root / "all.csv")

    def test_invalid_values_rejected(self):
        self.write("one.csv", {**self.row, "A01": "0"})
        with self.assertRaisesRegex(ValueError, "回答値が不正"):
            module.merge(self.raw, self.root / "all.csv")


if __name__ == "__main__":
    unittest.main()
