#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from urllib.request import urlretrieve

from pypdf import PdfReader


BASE_URL = "https://kyoumu.office.uec.ac.jp/timet/"
ACADEMIC_YEAR = 2026
RAW_DIR = Path("extracted/raw_pdfs")
PUBLIC_OUTPUT = Path("public/data/uec_timetable_entries_2026.json")
EXTRACTED_OUTPUT = Path("extracted/uec_timetable_entries_2026.json")
ALL_SUBJECTS = Path("public/data/all_subjects.json")
SUBJECTS_BY_GRADE = Path("public/data/uec_timetable_subjects_by_grade_2026.json")

DAY_IDS = ["mon", "tue", "wed", "thu", "fri", "sat"]
DAY_LABELS = {
    "mon": "月",
    "tue": "火",
    "wed": "水",
    "thu": "木",
    "fri": "金",
    "sat": "土",
}

PDFS = [
    {"file": "A1.pdf", "grade": 1, "semester": "first", "label": "第1学期", "columns": 12},
    {"file": "English1.pdf", "grade": 1, "semester": "first", "label": "前学期", "kind": "english"},
    {"file": "2gai1.pdf", "grade": 1, "semester": "first", "label": "前学期", "kind": "second_language"},
    {"file": "A2.pdf", "grade": 1, "semester": "second", "label": "第2学期", "columns": 12},
    {"file": "English2.pdf", "grade": 1, "semester": "second", "label": "後学期", "kind": "english"},
    {"file": "2gai2.pdf", "grade": 1, "semester": "second", "label": "後学期", "kind": "second_language"},
    {"file": "A3.pdf", "grade": 2, "semester": "first", "label": "第3学期", "columns": 15},
    {"file": "English3.pdf", "grade": 2, "semester": "first", "label": "前学期", "kind": "english"},
    {"file": "A4.pdf", "grade": 2, "semester": "second", "label": "第4学期", "columns": 15},
    {"file": "English4.pdf", "grade": 2, "semester": "second", "label": "後学期", "kind": "english"},
    {"file": "A5.pdf", "grade": 3, "semester": "first", "label": "第5学期", "columns": 15},
    {"file": "jyoukyu7.pdf", "grade": 3, "semester": "first", "label": "前学期", "kind": "list"},
    {"file": "A6.pdf", "grade": 3, "semester": "second", "label": "第6学期", "columns": 15},
    {"file": "jyoukyu8.pdf", "grade": 3, "semester": "second", "label": "後学期", "kind": "list"},
    {"file": "A7.pdf", "grade": 4, "semester": "first", "label": "第7学期", "columns": 15},
    {"file": "jyoukyu7.pdf", "grade": 4, "semester": "first", "label": "前学期", "kind": "list"},
    {"file": "inrenkei1.pdf", "grade": 4, "semester": "first", "label": "前学期", "columns": 15},
    {"file": "A8.pdf", "grade": 4, "semester": "second", "label": "第8学期", "columns": 15},
    {"file": "jyoukyu8.pdf", "grade": 4, "semester": "second", "label": "後学期", "kind": "list"},
    {"file": "inrenkei2.pdf", "grade": 4, "semester": "second", "label": "後学期", "columns": 15},
]


@dataclass(frozen=True)
class TextItem:
    x: float
    y: float
    font_size: float
    text: str


def compact(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("ー", "ー")
    value = re.sub(r"\s+", "", value)
    value = value.replace("（仮）", "")
    return value


def normalize_subject(value: str) -> str:
    value = compact(value)
    value = re.sub(r"※注\d+", "", value)
    value = re.sub(r"【[^】]+】", "", value)
    return value


def ensure_pdf(filename: str) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / filename
    if not path.exists():
        urlretrieve(BASE_URL + filename, path)
    return path


def load_subject_names() -> dict[int, set[str]]:
    names_by_grade: dict[int, set[str]] = defaultdict(set)
    all_subjects = json.loads(ALL_SUBJECTS.read_text())
    for row in all_subjects:
        subject = str(row.get("subject") or "").strip()
        if not subject:
            continue
        for year in row.get("eligible_years") or []:
            if isinstance(year, int) and 1 <= year <= 4:
                names_by_grade[year].add(subject)

    grade_subjects = json.loads(SUBJECTS_BY_GRADE.read_text())
    for label, payload in grade_subjects.get("grades", {}).items():
        grade = int(re.sub(r"\D", "", label) or 0)
        if grade:
            names_by_grade[grade].update(payload.get("subjects") or [])

    common_subjects = []
    for payload in grade_subjects.get("common", {}).values():
        common_subjects.extend(payload.get("subjects") or [])
    for grade in range(1, 5):
        names_by_grade[grade].update(common_subjects)

    for grade, names in names_by_grade.items():
        names.update(
            [
                "Academic Spoken English Ⅰ",
                "Academic Written English Ⅰ",
                "Academic Spoken English Ⅱ",
                "Academic Written English Ⅱ",
                "Academic English for the Second Year Ⅰ",
                "Academic English for the Second Year Ⅱ",
                "言語文化基礎科目Ⅱ",
            ]
        )
        names_by_grade[grade] = {name for name in names if len(normalize_subject(name)) >= 2}
    return names_by_grade


def extract_items(path: Path) -> tuple[list[TextItem], float, float]:
    reader = PdfReader(str(path))
    items: list[TextItem] = []
    width = float(reader.pages[0].mediabox.width)
    height = float(reader.pages[0].mediabox.height)

    def visitor(text, _cm, tm, _font_dict, font_size):
        text = text.strip()
        if not text:
            return
        x, y = float(tm[4]), float(tm[5])
        if -5 <= x <= width + 5 and -5 <= y <= height + 5:
            items.append(TextItem(x=x, y=y, font_size=float(font_size), text=text))

    for page in reader.pages:
        page.extract_text(visitor_text=visitor)
    return items, width, height


def line_text(items: list[TextItem]) -> str:
    return "".join(item.text for item in sorted(items, key=lambda item: (item.x, -item.y)))


def row_text(items: list[TextItem]) -> str:
    lines: dict[int, list[TextItem]] = defaultdict(list)
    for item in items:
        lines[round(item.y)].append(item)
    return " ".join(line_text(line) for _, line in sorted(lines.items(), key=lambda pair: -pair[0]))


def get_period_rows(items: list[TextItem], width: float) -> list[dict[str, float | int | str]]:
    left_markers = [
        item
        for item in items
        if item.text in {"1", "2", "3", "4", "5"}
        and item.x < width * 0.18
        and item.font_size >= 4
        and item.y > 80
    ]
    by_y: dict[int, TextItem] = {}
    for item in left_markers:
        key = round(item.y)
        current = by_y.get(key)
        if not current or item.x < current.x:
            by_y[key] = item
    markers = sorted(by_y.values(), key=lambda item: -item.y)

    rows = []
    day_index = -1
    previous_period = 99
    for index, item in enumerate(markers):
        period = int(item.text)
        if period == 1 or period <= previous_period:
            day_index += 1
        previous_period = period
        if day_index >= len(DAY_IDS):
            continue
        prev_y = markers[index - 1].y if index > 0 else item.y + 18
        next_y = markers[index + 1].y if index + 1 < len(markers) else item.y - 18
        rows.append(
            {
                "day": DAY_IDS[day_index],
                "period": period,
                "center": item.y,
                "top": (prev_y + item.y) / 2,
                "bottom": (item.y + next_y) / 2,
                "marker_x": item.x,
            }
        )
    return rows


def candidate_subjects_for_grade(subject_names: dict[int, set[str]], grade: int) -> list[tuple[str, str]]:
    names = set(subject_names.get(grade, set()))
    if grade >= 3:
        names.update(subject_names.get(4, set()))
    preferred_by_norm: dict[str, str] = {}
    for name in names:
        norm = normalize_subject(name)
        if len(norm) < 2:
            continue
        current = preferred_by_norm.get(norm)
        if not current:
            preferred_by_norm[norm] = name
            continue
        if ("Ⅰ" in name or "Ⅱ" in name) and "I" in current:
            preferred_by_norm[norm] = name
        elif len(name) < len(current):
            preferred_by_norm[norm] = name
    result = [(name, norm) for norm, name in preferred_by_norm.items()]
    return sorted(result, key=lambda pair: len(pair[1]), reverse=True)


def find_subjects(text: str, candidates: list[tuple[str, str]]) -> list[str]:
    norm_text = normalize_subject(text)
    matches: list[tuple[str, str]] = []
    for subject, norm in candidates:
        if norm and norm in norm_text:
            matches.append((subject, norm))
    filtered = []
    for subject, norm in matches:
        if any(norm != other_norm and norm in other_norm for _, other_norm in matches):
            continue
        filtered.append(subject)
    return list(dict.fromkeys(filtered))


def infer_column_range(items: list[TextItem], row: dict[str, float | int | str], width: float, columns: int | None) -> tuple[float, float, int | None]:
    left = float(row["marker_x"]) + 4
    right_period_numbers = [item.x for item in items if item.text in {"1", "2", "3", "4", "5"} and item.x > width * 0.75]
    right = min(right_period_numbers) - 4 if right_period_numbers else width - 35
    return left, right, columns


def split_row_items(
    items: list[TextItem],
    row: dict[str, float | int | str],
    width: float,
    columns: int | None,
) -> list[tuple[str | None, list[TextItem]]]:
    left, right, columns = infer_column_range(items, row, width, columns)
    row_items = [item for item in items if float(row["bottom"]) <= item.y < float(row["top"]) and left <= item.x <= right]
    segments: list[tuple[str | None, list[TextItem]]] = [("all", row_items)]
    if columns and columns > 1:
        column_width = (right - left) / columns
        for index in range(columns):
            start = left + index * column_width - 2
            end = left + (index + 1) * column_width + 2
            cell_items = [item for item in row_items if start <= item.x < end]
            if cell_items:
                segments.append((f"列{index + 1}", cell_items))
    return segments


def is_noise_subject(subject: str) -> bool:
    compacted = normalize_subject(subject)
    if compacted in {"教職科目", "集中講義", "数学補習授業"}:
        return True
    return False


def make_id(entry: dict[str, object]) -> str:
    raw = "|".join(str(entry.get(key, "")) for key in ["source_pdf", "grade", "semester", "dayOfWeek", "period", "periodEnd", "subject", "classLabel"])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:14]


def parse_grid_pdf(meta: dict[str, object], subject_names: dict[int, set[str]]) -> list[dict[str, object]]:
    path = ensure_pdf(str(meta["file"]))
    items, width, _height = extract_items(path)
    rows = get_period_rows(items, width)
    candidates = candidate_subjects_for_grade(subject_names, int(meta["grade"]))
    raw_entries: dict[tuple[object, ...], dict[str, object]] = {}
    for row in rows:
        if int(row["period"]) > 5:
            continue
        for class_label, segment_items in split_row_items(items, row, width, meta.get("columns")):
            text = row_text(segment_items)
            if not text:
                continue
            for subject in find_subjects(text, candidates):
                if is_noise_subject(subject):
                    continue
                key = (subject, row["day"], row["period"], meta["file"], meta["grade"], meta["semester"])
                raw_entries[key] = {
                    "academicYear": ACADEMIC_YEAR,
                    "grade": meta["grade"],
                    "semester": meta["semester"],
                    "termLabel": meta["label"],
                    "dayOfWeek": row["day"],
                    "dayLabel": DAY_LABELS[str(row["day"])],
                    "period": row["period"],
                    "periodEnd": row["period"],
                    "subject": subject,
                    "classLabel": "",
                    "sourcePdf": meta["file"],
                    "sourceUrl": BASE_URL + str(meta["file"]),
                }

    entries = list(raw_entries.values())
    entries.sort(key=lambda item: (str(item["subject"]), str(item["dayOfWeek"]), int(item["period"]), str(item.get("classLabel") or "")))
    return entries


DAY_PATTERN = r"(月|火|水|木|金|土)(?:曜(?:日)?)?"
PERIOD_PATTERN = r"([1-7１-７])限|([1-7１-７])時限"


def parse_list_pdf(meta: dict[str, object], subject_names: dict[int, set[str]]) -> list[dict[str, object]]:
    path = ensure_pdf(str(meta["file"]))
    reader = PdfReader(str(path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    candidates = candidate_subjects_for_grade(subject_names, int(meta["grade"]))
    entries: dict[tuple[object, ...], dict[str, object]] = {}
    current_day: str | None = None
    current_period: int | None = None
    recent_lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        day_match = re.search(DAY_PATTERN, line)
        if day_match:
            current_day = {value: key for key, value in DAY_LABELS.items()}[day_match.group(1)]
        period_match = re.search(PERIOD_PATTERN, line)
        if period_match:
            digit = period_match.group(1) or period_match.group(2)
            current_period = int(unicodedata.normalize("NFKC", digit))
        if not current_day or not current_period or current_period > 5:
            recent_lines = (recent_lines + [line])[-3:]
            continue
        search_line = " ".join([*recent_lines[-2:], line])
        for subject in find_subjects(search_line, candidates):
            if is_noise_subject(subject):
                continue
            key = (subject, current_day, current_period, meta["file"], meta["grade"], meta["semester"])
            entries[key] = {
                "academicYear": ACADEMIC_YEAR,
                "grade": meta["grade"],
                "semester": meta["semester"],
                "termLabel": meta["label"],
                "dayOfWeek": current_day,
                "dayLabel": DAY_LABELS[current_day],
                "period": current_period,
                "periodEnd": current_period,
                "subject": subject,
                "classLabel": "",
                "sourcePdf": meta["file"],
                "sourceUrl": BASE_URL + str(meta["file"]),
            }
        recent_lines = (recent_lines + [line])[-3:]
    return list(entries.values())


def parse_pdf(meta: dict[str, object], subject_names: dict[int, set[str]]) -> list[dict[str, object]]:
    if meta.get("kind") in {"list", "english", "second_language"}:
        return parse_list_pdf(meta, subject_names)
    return parse_grid_pdf(meta, subject_names)


def merge_entries(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    dedup: dict[tuple[object, ...], dict[str, object]] = {}
    for entry in entries:
        key = (
            entry["grade"],
            entry["semester"],
            entry["subject"],
            entry["dayOfWeek"],
            entry["period"],
            entry.get("periodEnd") or entry["period"],
        )
        dedup[key] = entry
    result = []
    for entry in dedup.values():
        entry["id"] = make_id(entry)
        result.append(entry)
    result.sort(key=lambda item: (int(item["grade"]), str(item["semester"]), str(item["dayOfWeek"]), int(item["period"]), str(item["subject"])))
    return result


def main() -> None:
    subject_names = load_subject_names()
    entries: list[dict[str, object]] = []
    for meta in PDFS:
        entries.extend(parse_pdf(meta, subject_names))
    entries = merge_entries(entries)
    payload = {
        "version": 1,
        "academicYear": ACADEMIC_YEAR,
        "sourceSite": BASE_URL,
        "generatedFrom": sorted({str(item["sourcePdf"]) for item in entries}),
        "extractionNote": "PDF座標から曜日・時限を推定し、学修要覧/時間割科目名と照合した補助データです。教員・教室の最終確認は公式時間割とシラバスを参照してください。",
        "entries": entries,
    }
    for output in [PUBLIC_OUTPUT, EXTRACTED_OUTPUT]:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {len(entries)} entries")


if __name__ == "__main__":
    main()
