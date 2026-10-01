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
        self.row = {"response_id": "rq-one", "schema_version": "2", "study_id": "reading", "instrument_version": "2", "consent_version": "2", "data_mode": "live", "consent": "yes", "research_use_allowed": "yes", "record_type": "response", **dict.fromkeys(module.ITEMS, "3"), "free_learning_experience": '日本語,「読解」\n"引用"'}

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
        self.assertEqual(module.merge(self.raw, output), (1, 1, 0, 0))
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

    def test_edited_csv_formula_prefixes_are_neutralized_without_double_escaping(self):
        values = ['=1+1', '+1', '-1', '@SUM(A1)', '  =1', '\ufeff=1', '\tplain', '\rplain', '\nplain', "'=1+1", '001234', '山田 テスト']
        row = {**self.row, **{f"text_{i}": value for i, value in enumerate(values)}, '=extra_header': 'plain'}
        self.write("edited.csv", row)
        output = self.root / "all.csv"
        module.merge(self.raw, output)
        with output.open(encoding="utf-8-sig", newline="") as file:
            result = next(csv.DictReader(file))
        for i, value in enumerate(values):
            self.assertEqual(result[f"text_{i}"], "'" + value if i < 9 else value)
        self.assertEqual(result["'=extra_header"], 'plain')

    def test_preview_excluded_unless_requested(self):
        self.write("one.csv", {**self.row, "data_mode": "preview"})
        with self.assertRaisesRegex(ValueError, "結合する回答がありません"):
            module.merge(self.raw, self.root / "all.csv")
        self.assertEqual(module.merge(self.raw, self.root / "all.csv", True), (1, 0, 0, 0))

    def test_version_mixing_rejected(self):
        self.write("one.csv", self.row)
        self.write("two.csv", {**self.row, "response_id": "rq-two", "instrument_version": "3"})
        with self.assertRaisesRegex(ValueError, "異なる調査"):
            module.merge(self.raw, self.root / "all.csv")

    def test_invalid_values_rejected(self):
        self.write("one.csv", {**self.row, "A01": "0"})
        with self.assertRaisesRegex(ValueError, "回答値が不正"):
            module.merge(self.raw, self.root / "all.csv")

    def test_refusal_overrides_earlier_and_later_answers(self):
        refusal = {**self.row, "research_use_allowed": "no", "record_type": "refusal", "consent": "withdrawn", **dict.fromkeys(module.ITEMS, "")}
        for name in ("aaa_refusal.csv", "zzz_refusal.csv"):
            with self.subTest(name=name):
                self.write(name, refusal)
                self.write("middle.csv", self.row)
                self.write("changed.csv", {**self.row, "A01": "5"})
                self.write("kept.csv", {**self.row, "response_id": "rq-two"})
                output = self.root / name
                self.assertEqual(module.merge(self.raw, output, True), (1, 0, 0, 1))
                with output.open(encoding="utf-8-sig", newline="") as file:
                    self.assertEqual([row["response_id"] for row in csv.DictReader(file)], ["rq-two"])
                (self.raw / name).unlink()

    def test_only_refusals_never_written_even_with_preview_option(self):
        self.write("refusal.csv", {**self.row, "data_mode": "preview", "research_use_allowed": "no", "record_type": "refusal", "consent": "no", **dict.fromkeys(module.ITEMS, "")})
        with self.assertRaisesRegex(ValueError, "利用不可ID: 1件"):
            module.merge(self.raw, self.root / "all.csv", True)
        self.assertFalse((self.root / "all.csv").exists())

    def test_missing_permission_fails_closed(self):
        row = dict(self.row)
        del row["research_use_allowed"]
        self.write("missing.csv", row)
        with self.assertRaisesRegex(ValueError, "データ利用の意思"):
            module.merge(self.raw, self.root / "all.csv")

    def schema3(self):
        ids = module.ITEMS + module.L1_ITEMS
        return {**self.row, "schema_version": "3", **dict.fromkeys(module.L1_ITEMS, "3"), "presentation_order": "|".join(ids),
                "randomization_method": "language_blocks_and_within_language_v1", "language_block_order": "en|ja", "timing_method": "single_item_visible_focused_v1",
                **{f"{item}_{field}": "100" if field in {"rt_first_ms", "active_ms"} else "1" if field == "visit_n" else "0" for item in ids for field in module.TIMING_FIELDS}}

    def test_schema3_japanese_and_timing_retained_and_refusal_excluded(self):
        row = self.schema3()
        self.write("one.csv", row)
        self.write("refusal.csv", {**row, "response_id": "rq-refusal", "consent": "no", "research_use_allowed": "no", "record_type": "refusal"})
        output = self.root / "all.csv"
        self.assertEqual(module.merge(self.raw, output), (1, 0, 0, 1))
        with output.open(encoding="utf-8-sig", newline="") as file:
            self.assertEqual(list(csv.DictReader(file)), [row])

    def test_schema3_incomplete_or_invalid_timing_rejected(self):
        mutations = [lambda r: r.pop("J01"), lambda r: r.update(J01="6"), lambda r: r.update(J01_rt_first_ms="-1"), lambda r: r.update(J01_rt_first_ms="101"), lambda r: r.update(presentation_order="A01|A01")]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                row = self.schema3()
                mutate(row)
                self.write("one.csv", row)
                with self.assertRaises(ValueError):
                    module.merge(self.raw, self.root / "all.csv")

    def test_legacy_schema1_still_loads_separately(self):
        row = {**self.row, "schema_version": "1"}
        del row["research_use_allowed"]
        del row["record_type"]
        self.write("legacy.csv", row)
        self.assertEqual(module.merge(self.raw, self.root / "all.csv"), (1, 0, 0, 0))

    def test_schema4_identity_strings_and_refusal(self):
        row = {**self.schema3(), "schema_version": "4", "participant_name": '山田 "テスト",確認', "student_id": "001234"}
        self.write("one.csv", row)
        self.write("refusal.csv", {**row, "response_id": "rq-refusal", "participant_name": "", "student_id": "", "consent": "no", "research_use_allowed": "no", "record_type": "refusal"})
        output = self.root / "all.csv"
        self.assertEqual(module.merge(self.raw, output), (1, 0, 0, 1))
        with output.open(encoding="utf-8-sig", newline="") as file:
            self.assertEqual(list(csv.DictReader(file)), [row])

    def test_schema4_requires_identity_columns_but_accepts_blank_values(self):
        row = {**self.schema3(), "schema_version": "4", "participant_name": ""}
        self.write("one.csv", row)
        with self.assertRaisesRegex(ValueError, "氏名・学籍番号列"):
            module.merge(self.raw, self.root / "all.csv")
        self.write("one.csv", {**row, "student_id": ""})
        self.assertEqual(module.merge(self.raw, self.root / "all.csv"), (1, 0, 0, 0))


if __name__ == "__main__":
    unittest.main()
