#!/usr/bin/env python3
"""個別CSVを結合。利用不可の記録と同じIDの回答は、順序によらず必ず除外する。"""
import argparse
import csv
from pathlib import Path

ITEMS = [f"A{i:02}" for i in range(1, 24)] + [f"B{i:02}" for i in range(1, 10)] + ["AC01"]
L1_ITEMS = [f"J{i:02}" for i in range(1, 8)]
TIMING_FIELDS = ["rt_first_ms", "active_ms", "visit_n", "change_n", "pause_n"]
VALID = {"1", "2", "3", "4", "5", "NA", "SKIP"}


def merge(folder, output, include_preview=False):
    paths = sorted(Path(folder).glob("*.csv"))
    if not paths:
        raise ValueError("入力フォルダにCSVがありません。")
    if Path(output).exists():
        raise ValueError("出力先が既に存在します。別のファイル名を指定してください。")
    candidates, prohibited_ids = [], set()
    required = set(ITEMS + ["response_id", "schema_version", "study_id", "instrument_version", "consent_version", "data_mode", "consent"])
    # 先に利用不可のIDをすべて確認する。以前の回答や再保存された回答にも優先する。
    for path in paths:
        with path.open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            if not reader.fieldnames or not required.issubset(reader.fieldnames) or len(set(reader.fieldnames)) != len(reader.fieldnames):
                raise ValueError(f"{path.name}: 必要な列がない、または列が重複しています。")
            for row in reader:
                if None in row or None in row.values():
                    raise ValueError(f"{path.name}: 列数が一致しない行があります。")
                if not row["response_id"].startswith("rq-"):
                    raise ValueError(f"{path.name}: 回答者IDが不正です。")
                if row["data_mode"] not in {"preview", "live"} or row["schema_version"] not in {"1", "2", "3", "4"}:
                    raise ValueError(f"{path.name}: モード・スキーマが不正です。")
                if row["schema_version"] in {"3", "4"}:
                    new_columns = set(L1_ITEMS + ["randomization_method", "language_block_order", "timing_method", "presentation_order"] + [f"{item}_{field}" for item in ITEMS + L1_ITEMS for field in TIMING_FIELDS])
                    if not new_columns.issubset(reader.fieldnames):
                        raise ValueError(f"{path.name}: スキーマ3・4の項目・計時列が不足しています。")
                if row["schema_version"] == "4" and not {"participant_name", "student_id"}.issubset(reader.fieldnames):
                    raise ValueError(f"{path.name}: スキーマ4の氏名・学籍番号列が不足しています。")
                if row["schema_version"] in {"2", "3", "4"}:
                    if row.get("research_use_allowed") == "no" and row.get("record_type") == "refusal" and row["consent"] in {"no", "withdrawn"}:
                        prohibited_ids.add(row["response_id"])
                        continue
                    if row.get("research_use_allowed") != "yes" or row.get("record_type") != "response":
                        raise ValueError(f"{path.name}: データ利用の意思が不正・不明です。")
                if row["consent"] != "yes":
                    raise ValueError(f"{path.name}: 研究利用への同意がありません。")
                candidates.append((path.name, reader.fieldnames, row))
    records, headers, signature = {}, None, None
    duplicate_count = preview_count = 0
    for name, columns, row in candidates:
        if row["response_id"] in prohibited_ids:
            continue
        if row["data_mode"] == "preview" and not include_preview:
            preview_count += 1
            continue
        current = tuple(row[key] for key in ("schema_version", "study_id", "instrument_version", "consent_version", "data_mode"))
        if signature is None:
            signature, headers = current, columns
        if current != signature or columns != headers:
            raise ValueError(f"{name}: 異なる調査・質問紙版・同意版・モード・列構成を一緒に結合できません。")
        item_ids = ITEMS + L1_ITEMS if row["schema_version"] in {"3", "4"} else ITEMS
        if any(row[item] not in VALID for item in item_ids):
            raise ValueError(f"{name}: 項目の回答値が不正です。")
        if row["schema_version"] in {"3", "4"}:
            order = row["presentation_order"].split("|")
            if len(order) != len(item_ids) or set(order) != set(item_ids):
                raise ValueError(f"{name}: 提示順に欠落・重複があります。")
            for item in item_ids:
                values = [row[f"{item}_{field}"] for field in TIMING_FIELDS]
                if any(value and (not value.isascii() or not value.isdigit()) for value in values):
                    raise ValueError(f"{name}: 計時値は非負の整数または空欄である必要があります。")
                first, active = values[:2]
                if first and active and int(first) > int(active):
                    raise ValueError(f"{name}: 初回回答時間が累積表示時間を超えています。")
        response_id = row["response_id"]
        if response_id in records:
            if records[response_id] != row:
                raise ValueError(f"{name}: 同じIDで内容が異なります。原本を確認してください（{response_id}）。")
            duplicate_count += 1
        records[response_id] = row
    if not records:
        raise ValueError(f"結合する回答がありません。除外した試作回答: {preview_count}件、利用不可ID: {len(prohibited_ids)}件。試作確認には --include-preview を指定します（利用不可IDは常に除外）。")
    with Path(output).open("x", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers, lineterminator="\r\n", quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(records.values())
    return len(records), duplicate_count, preview_count, len(prohibited_ids)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", help="個別CSVと利用不可記録を入れた入力フォルダ")
    parser.add_argument("output", help="新しい出力CSVのパス（入力フォルダ外を推奨）")
    parser.add_argument("--include-preview", action="store_true")
    args = parser.parse_args()
    try:
        n, duplicate, preview, prohibited = merge(args.folder, args.output, args.include_preview)
        print(f"結合: {n}件 / 同内容の重複除去: {duplicate}件 / 試作回答の除外: {preview}件 / 利用不可IDの除外: {prohibited}件")
    except (ValueError, OSError, csv.Error, UnicodeError) as error:
        parser.exit(1, f"エラー: {error}\n")
