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

PERIOD_TIMES = {
    1: ("09:00", "10:30"),
    2: ("10:40", "12:10"),
    3: ("13:00", "14:30"),
    4: ("14:40", "16:10"),
    5: ("16:15", "17:45"),
}


def override(
    subject: str,
    grade: int,
    semester: str,
    term_label: str,
    source_pdf: str,
    day: str,
    period: int,
    period_end: int,
    *,
    class_label: str = "",
    start_time: str | None = None,
    end_time: str | None = None,
    remove_subjects: list[str] | None = None,
    note: str | None = None,
) -> dict[str, object]:
    return {
        "subject": subject,
        "grade": grade,
        "semester": semester,
        "termLabel": term_label,
        "sourcePdf": source_pdf,
        "dayOfWeek": day,
        "period": period,
        "periodEnd": period_end,
        "classLabel": class_label,
        "startTime": start_time,
        "endTime": end_time,
        "removeSubjects": remove_subjects or [],
        "note": note or "PDF上の結合セル・分割セルを補正した時間割候補です。",
    }


IRREGULAR_GRID_OVERRIDES: list[dict[str, object]] = [
    override(
        "工学基礎数学および演習",
        2,
        "first",
        "第3学期",
        "A3.pdf",
        "fri",
        1,
        2,
        class_label="Ⅲ類 電子工学・光工学・化学生命工学",
        start_time="09:45",
        end_time="12:10",
        remove_subjects=["工学基礎数学"],
        note="PDF上で「工学基礎数学」と「および演習」が別行に分割されるため補正しています。",
    ),
    override("理工学基礎実験", 2, "second", "第4学期", "A4.pdf", "thu", 3, 4, class_label="Ⅲ類 電子工学・光工学・物理工学・化学生命工学"),
]

for subject_name in ["情報数理工学実験第一", "コンピュータサイエンス実験第一"]:
    for day_id in ["mon", "wed"]:
        IRREGULAR_GRID_OVERRIDES.append(override(subject_name, 3, "first", "第5学期", "A5.pdf", day_id, 3, 4))

for subject_name in ["電子工学実験第一", "光工学実験第一", "物理工学実験第一", "化学生命工学実験第一"]:
    IRREGULAR_GRID_OVERRIDES.append(override(subject_name, 3, "first", "第5学期", "A5.pdf", "wed", 2, 4))

for subject_name in ["電子工学実験第一", "光工学実験第一", "物理工学実験第一"]:
    IRREGULAR_GRID_OVERRIDES.append(override(subject_name, 3, "first", "第5学期", "A5.pdf", "thu", 2, 4))

for subject_name in ["情報通信工学実験A", "電子情報学実験A"]:
    IRREGULAR_GRID_OVERRIDES.append(override(subject_name, 3, "first", "第5学期", "A5.pdf", "fri", 2, 4, remove_subjects=[subject_name.replace("A", "Ａ")]))

for subject_name in ["メカトロニクス基礎実験A", "知能機械工学基礎実験第一"]:
    IRREGULAR_GRID_OVERRIDES.append(override(subject_name, 3, "first", "第5学期", "A5.pdf", "fri", 3, 4))

for subject_name in ["情報数理工学実験第二A", "情報数理工学実験第二B", "コンピュータサイエンス実験第二A", "コンピュータサイエンス実験第二B"]:
    for day_id in ["mon", "wed"]:
        IRREGULAR_GRID_OVERRIDES.append(
            override(
                subject_name,
                3,
                "second",
                "第6学期",
                "A6.pdf",
                day_id,
                3,
                4,
                remove_subjects=["コンピュータサイエンス実験"],
            )
        )

for subject_name, day_id in [
    ("経営・社会情報学実験", "mon"),
    ("デザイン思考・データサイエンス実験", "mon"),
    ("物理工学実験第二", "mon"),
    ("セキュリティ情報学実験", "tue"),
    ("電子工学実験第二", "tue"),
    ("光工学実験第二", "wed"),
    ("化学生命工学実験第二", "wed"),
    ("メディア情報学実験", "thu"),
]:
    IRREGULAR_GRID_OVERRIDES.append(override(subject_name, 3, "second", "第6学期", "A6.pdf", day_id, 2, 4, remove_subjects=["情報学実験"]))

for subject_name in ["情報通信工学実験B1", "情報通信工学実験B2", "電子情報学実験B1", "電子情報学実験B2"]:
    IRREGULAR_GRID_OVERRIDES.append(
        override(
            subject_name,
            3,
            "second",
            "第6学期",
            "A6.pdf",
            "fri",
            2,
            4,
            remove_subjects=["情報通信工学実験B1・B2", "電子情報学実験B1・B2", "情報通信工学実験Bl", "電子情報学実験Bl"],
        )
    )

for subject_name in ["メカトロニクス基礎実験B", "知能機械工学基礎実験第二"]:
    IRREGULAR_GRID_OVERRIDES.append(override(subject_name, 3, "second", "第6学期", "A6.pdf", "fri", 3, 4))


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


def periods_overlap(left: dict[str, object], right: dict[str, object]) -> bool:
    left_start = int(left["period"])
    left_end = int(left.get("periodEnd") or left_start)
    right_start = int(right["period"])
    right_end = int(right.get("periodEnd") or right_start)
    return left_start <= right_end and right_start <= left_end


def override_matches_entry(override_entry: dict[str, object], entry: dict[str, object]) -> bool:
    if entry.get("grade") != override_entry.get("grade"):
        return False
    if entry.get("semester") != override_entry.get("semester"):
        return False
    if entry.get("sourcePdf") != override_entry.get("sourcePdf"):
        return False
    if entry.get("dayOfWeek") != override_entry.get("dayOfWeek"):
        return False
    subjects = {str(override_entry["subject"]), *(str(subject) for subject in override_entry.get("removeSubjects", []))}
    if normalize_subject(str(entry.get("subject") or "")) not in {normalize_subject(subject) for subject in subjects}:
        return False
    return periods_overlap(entry, override_entry)


def apply_irregular_grid_overrides(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    result = list(entries)
    for item in IRREGULAR_GRID_OVERRIDES:
        period = int(item["period"])
        period_end = int(item["periodEnd"])
        start_time, _ = PERIOD_TIMES[period]
        _, end_time = PERIOD_TIMES[period_end]
        entry: dict[str, object] = {
            "academicYear": ACADEMIC_YEAR,
            "grade": item["grade"],
            "semester": item["semester"],
            "termLabel": item["termLabel"],
            "dayOfWeek": item["dayOfWeek"],
            "dayLabel": DAY_LABELS[str(item["dayOfWeek"])],
            "period": period,
            "periodEnd": period_end,
            "subject": item["subject"],
            "classLabel": item.get("classLabel") or "",
            "sourcePdf": item["sourcePdf"],
            "sourceUrl": BASE_URL + str(item["sourcePdf"]),
            "note": item["note"],
        }
        if item.get("startTime") or item.get("endTime"):
            entry["startTime"] = item.get("startTime") or start_time
            entry["endTime"] = item.get("endTime") or end_time
        result = [existing for existing in result if not override_matches_entry(item, existing)]
        result.append(entry)
    return result


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
    entries = apply_irregular_grid_overrides(entries)
    entries = merge_entries(entries)
    payload = {
        "version": 1,
        "academicYear": ACADEMIC_YEAR,
        "sourceSite": BASE_URL,
        "generatedFrom": sorted({str(item["sourcePdf"]) for item in entries}),
        "extractionNote": "PDF座標から曜日・時限を推定し、学修要覧/時間割科目名と照合した補助データです。PDF上の結合セル・分割セルで通常抽出が1時限化する科目は補正しています。教員・教室の最終確認は公式時間割とシラバスを参照してください。",
        "entries": entries,
    }
    for output in [PUBLIC_OUTPUT, EXTRACTED_OUTPUT]:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {len(entries)} entries")


if __name__ == "__main__":
    main()
