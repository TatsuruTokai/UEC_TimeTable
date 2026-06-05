#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any


COURSE_NAMES = [
    "メディア情報学",
    "経営・社会情報学",
    "情報数理工学",
    "コンピュータサイエンス",
    "デザイン思考・データサイエンス",
    "セキュリティ情報学",
    "情報通信工学",
    "電子情報学",
    "計測・制御システム",
    "先端ロボティクス",
    "機械システム",
    "電子工学",
    "光工学",
    "物理工学",
    "化学生命工学",
]


def read_cp932_csv(path: Path) -> list[list[str]]:
    return list(csv.reader(path.read_text(encoding="cp932").splitlines()))


def admission_year_from_student_id(student_id: str) -> int | None:
    match = re.match(r"^(\d{2})", student_id)
    if not match:
        return None
    yy = int(match.group(1))
    return 2000 + yy if yy < 80 else 1900 + yy


def infer_cluster_and_course(affiliation: str) -> tuple[str | None, str | None]:
    cluster = None
    if "Ⅰ類" in affiliation or "I類" in affiliation:
        cluster = "Ⅰ類（情報系）"
    elif "Ⅱ類" in affiliation or "II類" in affiliation:
        cluster = "Ⅱ類（融合系）"
    elif "Ⅲ類" in affiliation or "III類" in affiliation:
        cluster = "Ⅲ類（理工系）"

    course = next((name for name in COURSE_NAMES if name in affiliation), None)
    if course is None and "化学生命" in affiliation:
        course = "化学生命工学"
    return cluster, course


def parse_kakutei_seiseki(path: str | Path) -> dict[str, Any]:
    path = Path(path)
    rows = read_cp932_csv(path)
    metadata: dict[str, str] = {}
    header_index = None
    for i, row in enumerate(rows):
        if row and row[0] == "No.":
            header_index = i
            break
        for j in range(0, len(row) - 1, 2):
            key = row[j].strip("[]")
            if key:
                metadata[key] = row[j + 1]
    if header_index is None:
        raise ValueError(f"No detail header row found in {path}")

    headers = rows[header_index]
    records = []
    for row in rows[header_index + 1:]:
        if not row:
            continue
        record = dict(zip(headers, row))
        if not record.get("No."):
            continue
        try:
            credits = float(record.get("単位数", "0") or 0)
        except ValueError:
            credits = 0.0
        category_parts = [
            record.get("科目大区分", ""),
            record.get("科目中区分", ""),
            record.get("科目小区分", ""),
        ]
        records.append({
            "no": record.get("No.", ""),
            "category_major": record.get("科目大区分", ""),
            "category_middle": record.get("科目中区分", ""),
            "category_minor": record.get("科目小区分", ""),
            "category_path": " / ".join(part for part in category_parts if part),
            "timetable_code": record.get("時間割コード", ""),
            "subject": record.get("科目", ""),
            "instructor": record.get("教員氏名", ""),
            "credits": credits,
            "earned_year": record.get("修得年度", ""),
            "earned_term": record.get("修得学期", ""),
            "grade": record.get("評語", ""),
            "pass_fail": record.get("合否", ""),
            "passed": record.get("合否", "") == "合",
        })

    student_id = metadata.get("学籍番号", "")
    affiliation = metadata.get("学生所属", "")
    cluster, course = infer_cluster_and_course(affiliation)
    return {
        "source_csv": str(path),
        "student": {
            "name": metadata.get("学生氏名", ""),
            "student_id": student_id,
            "affiliation": affiliation,
            "grade_year": metadata.get("年次", ""),
            "admission_year": admission_year_from_student_id(student_id),
            "cluster": cluster,
            "course": course,
        },
        "records": records,
        "passed_records": [record for record in records if record["passed"]],
        "record_count": len(records),
        "passed_count": sum(1 for record in records if record["passed"]),
        "passed_credits": sum(record["credits"] for record in records if record["passed"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--out")
    args = parser.parse_args()
    parsed = parse_kakutei_seiseki(args.csv_path)
    text = json.dumps(parsed, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()
