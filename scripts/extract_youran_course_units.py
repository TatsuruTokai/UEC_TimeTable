#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "source_pdfs"
OUT_DIR = ROOT / "youran_dataset"
SOURCE_PAGE = "https://kyoumu.office.uec.ac.jp/youran/youran.html"


COURSES = [
    ("I", "Ⅰ類（情報系）", "メディア情報学"),
    ("I", "Ⅰ類（情報系）", "経営・社会情報学"),
    ("I", "Ⅰ類（情報系）", "情報数理工学"),
    ("I", "Ⅰ類（情報系）", "コンピュータサイエンス"),
    ("I", "Ⅰ類（情報系）", "デザイン思考・データサイエンス"),
    ("II", "Ⅱ類（融合系）", "セキュリティ情報学"),
    ("II", "Ⅱ類（融合系）", "情報通信工学"),
    ("II", "Ⅱ類（融合系）", "電子情報学"),
    ("II", "Ⅱ類（融合系）", "計測・制御システム"),
    ("II", "Ⅱ類（融合系）", "先端ロボティクス"),
    ("III", "Ⅲ類（理工系）", "機械システム"),
    ("III", "Ⅲ類（理工系）", "電子工学"),
    ("III", "Ⅲ類（理工系）", "光工学"),
    ("III", "Ⅲ類（理工系）", "物理工学"),
    ("III", "Ⅲ類（理工系）", "化学生命工学"),
]


COURSE_ALIASES = {
    "メディア情報学": ["メディア情報学"],
    "経営・社会情報学": ["経営・社会情報学"],
    "情報数理工学": ["情報数理工学"],
    "コンピュータサイエンス": ["コンピュータサイエンス"],
    "デザイン思考・データサイエンス": ["デザイン思考・データサイエンス"],
    "セキュリティ情報学": ["セキュリティ情報学"],
    "情報通信工学": ["情報通信工学"],
    "電子情報学": ["電子情報学"],
    "計測・制御システム": ["計測・制御システム"],
    "先端ロボティクス": ["先端ロボティクス"],
    "機械システム": ["機械システム"],
    "電子工学": ["電子工学"],
    "光工学": ["光工学"],
    "物理工学": ["物理工学"],
    "化学生命工学": ["化学生命工学", "化学生命"],
}


REQUIREMENT_PAGES = [20, 21, 22, 23, 24, 25, 26]


def active_courses_for_year(year: int) -> list[tuple[str, str, str]]:
    if year <= 2022:
        return [item for item in COURSES if item[2] != "デザイン思考・データサイエンス"]
    return COURSES[:]


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\u3000", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def slug(text: str) -> str:
    mapping = str.maketrans({
        "Ⅰ": "I",
        "Ⅱ": "II",
        "Ⅲ": "III",
        "・": "_",
        "（": "_",
        "）": "",
        " ": "_",
        "　": "_",
    })
    return re.sub(r"_+", "_", text.translate(mapping)).strip("_")


def admission_year(path: Path) -> int:
    m = re.search(r"youran(\d{4})-gakuiki\.pdf", path.name)
    if not m:
        raise ValueError(path)
    return int(m.group(1))


def is_subject_table(table: list[list[Any]]) -> bool:
    flat = " ".join(clean(c) for row in table[:3] for c in row)
    compact = flat.replace(" ", "")
    if "ディプロマポリシ" in compact or "デイプロマポリシ" in compact:
        return False
    has_terms = all(str(i) in {clean(c) for row in table[:4] for c in row} for i in range(1, 9))
    has_subject_header = "授業科目" in compact and "単" in compact and "位" in compact
    has_code_rows = any(
        any(re.search(r"[A-Z]{2,4}\d{3}", clean(c)) for c in row)
        for row in table[:8]
    )
    return has_terms and (has_subject_header or has_code_rows)


def find_subject_columns(table: list[list[Any]]) -> tuple[int, int, int] | None:
    header_rows = table[:4]
    max_cols = max(len(r) for r in header_rows)
    col_text = []
    for col in range(max_cols):
        col_text.append(" ".join(clean(r[col]) for r in header_rows if col < len(r)))
    subject_col = next((i for i, v in enumerate(col_text) if "授業科目" in v.replace(" ", "")), None)
    code_col = next((i for i, v in enumerate(col_text) if "科目番号" in v.replace(" ", "")), None)
    credit_col = None
    for i, v in enumerate(col_text):
        compact = v.replace(" ", "")
        if "単位数" in compact:
            credit_col = i
            break
    if subject_col is None or credit_col is None:
        for row in table[2:8]:
            cells = [clean(c) for c in row]
            for i, cell in enumerate(cells):
                if re.search(r"[A-Z]{2,4}\d{3}", cell):
                    code_col = i
                    subject_col = next((j for j in range(i - 1, -1, -1) if cells[j]), i - 1)
                    credit_col = i + 1
                    return subject_col, code_col, credit_col
        return None
    return subject_col, code_col if code_col is not None else -1, credit_col


def requirement_type(category: str) -> str:
    compact = category.replace(" ", "")
    if "選択必修" in compact:
        return "選択必修"
    if "必修" in compact:
        return "必修"
    if "自由" in compact:
        return "自由"
    if "選択" in compact:
        return "選択"
    return "未判定"


def normalize_subject_row(
    row: list[Any],
    page_num: int,
    course: str,
    cluster: str,
    subject_col: int,
    code_col: int,
    credit_col: int,
    category_state: list[str],
    pdf_name: str,
) -> dict[str, Any] | None:
    row = [clean(c) for c in row]
    if len(row) <= max(subject_col, credit_col):
        return None
    subject = row[subject_col]
    if not subject or subject in {"授業科目", "授 業 科 目"}:
        return None
    if subject.startswith("※注") or subject.startswith("注"):
        return None
    if not re.search(r"\d", row[credit_col]):
        return None

    for i in range(min(subject_col, len(row))):
        value = row[i]
        if value:
            while len(category_state) <= i:
                category_state.append("")
            category_state[i] = value
    category = " / ".join(v for v in category_state[:subject_col] if v and v not in {"＃", "#"})

    semesters = []
    for offset, cell in enumerate(row[credit_col + 1: credit_col + 9], start=1):
        if cell:
            semesters.append({"semester": offset, "year": math.ceil(offset / 2), "hours": cell})
    years = sorted({s["year"] for s in semesters})

    return {
        "admission_year": int(pdf_name[6:10]),
        "cluster": cluster,
        "course": course,
        "subject": subject,
        "subject_code": row[code_col] if code_col >= 0 and code_col < len(row) else "",
        "credits": row[credit_col],
        "requirement_type": requirement_type(category),
        "category_path": category,
        "eligible_years": years,
        "semester_hours": semesters,
        "remarks": row[-1] if row else "",
        "source_pdf": pdf_name,
        "source_page": page_num,
        "source_url": f"https://kyoumu.office.uec.ac.jp/youran/{pdf_name}#page={page_num}",
    }


def detect_course(text: str) -> str | None:
    compact = re.sub(r"\s+", "", text)
    head = compact[:1200]
    for course, aliases in COURSE_ALIASES.items():
        for alias in aliases:
            alias_key = alias.replace("・", "")
            if alias_key in head.replace("・", "") and "プログ" in head:
                    return course
    return None


def extract_raw_requirement_pages(pdf: pdfplumber.PDF, pdf_name: str) -> dict[str, Any]:
    pages = []
    for page_num in REQUIREMENT_PAGES:
        if page_num > len(pdf.pages):
            continue
        page = pdf.pages[page_num - 1]
        text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
        tables = page.extract_tables()
        pages.append({
            "page": page_num,
            "source_url": f"https://kyoumu.office.uec.ac.jp/youran/{pdf_name}#page={page_num}",
            "text": text,
            "tables": tables,
        })
    return {"pages": pages}


def extract_graduation_units(raw_pages: dict[str, Any]) -> list[dict[str, Any]]:
    page25 = next((p for p in raw_pages["pages"] if p["page"] == 25 and p["tables"]), None)
    if not page25:
        return []
    table = page25["tables"][0]
    if len(table) < 3:
        return []
    header = [clean(c).replace("惜報", "情報").replace("セキュリプイ", "セキュリティ") for c in table[1]]
    course_cols = []
    remaining = COURSES[:]
    for idx, value in enumerate(header):
        value_key = value.replace("・", "").replace(" ", "")
        hit = None
        for item in remaining:
            _, cluster, course = item
            for alias in COURSE_ALIASES[course]:
                alias_key = alias.replace("・", "").replace(" ", "")
                if alias_key in value_key or value_key in alias_key:
                    hit = item
                    break
            if hit:
                break
        if hit:
            _, cluster, course = hit
            course_cols.append((idx, cluster, course))
            remaining.remove(hit)
    if len(course_cols) < 10:
        first_numeric = None
        for i, value in enumerate(table[2]):
            if re.fullmatch(r"\d+", clean(value)):
                first_numeric = i
                break
        if first_numeric is not None:
            max_cols = max(len(r) for r in table)
            year_match = re.search(r"youran(\d{4})-gakuiki", page25["source_url"])
            active = active_courses_for_year(int(year_match.group(1)) if year_match else 9999)
            course_cols = [
                (first_numeric + i, cluster, course)
                for i, (_, cluster, course) in enumerate(active)
                if first_numeric + i < max_cols
            ]
    rows = []
    major_state = ""
    middle_state = ""
    for row in table[2:]:
        cells = [clean(c) for c in row]
        if len(cells) < 4:
            continue
        if cells[0]:
            major_state = cells[0]
        if cells[1]:
            middle_state = cells[1]
        item = cells[2] or middle_state
        if not item:
            continue
        category = " / ".join(v for v in [major_state, middle_state, item] if v)
        for idx, cluster, course in course_cols:
            if idx < len(cells) and cells[idx]:
                credit = cells[idx]
                if not re.fullmatch(r"\d+(\.\d+)?", credit):
                    continue
                rows.append({
                    "cluster": cluster,
                    "course": course,
                    "category": category,
                    "credits": credit,
                    "source_page": 25,
                    "source_url": page25["source_url"],
                })
    return rows


def extract_pdf(path: Path) -> dict[str, Any]:
    year = admission_year(path)
    subjects: list[dict[str, Any]] = []
    with pdfplumber.open(path) as pdf:
        raw_requirements = extract_raw_requirement_pages(pdf, path.name)
        graduation_units = extract_graduation_units(raw_requirements)
        current_course = None
        current_cluster = None
        category_state: list[str] = []
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            detected = detect_course(text)
            if detected:
                current_course = detected
                current_cluster = next(c for _, c, name in COURSES if name == detected)
                category_state = []
            tables = page.extract_tables()
            for table in tables:
                if not current_course or not is_subject_table(table):
                    continue
                cols = find_subject_columns(table)
                if not cols:
                    continue
                subject_col, code_col, credit_col = cols
                for row in table[3:]:
                    rec = normalize_subject_row(
                        row, page_num, current_course, current_cluster or "",
                        subject_col, code_col, credit_col, category_state, path.name
                    )
                    if rec:
                        subjects.append(rec)
    return {
        "admission_year": year,
        "source_pdf": path.name,
        "source_url": f"https://kyoumu.office.uec.ac.jp/youran/{path.name}",
        "subjects": subjects,
        "requirements": {
            "third_year_promotion": {
                "label": "2年次終了時審査（3年次以降履修条件）",
                "source_pages": [20, 21],
                "note": "PDF本文および別表3を raw_requirement_pages.json に原表として保存。",
            },
            "fourth_year_promotion": {
                "label": "卒業研究着手審査（4年次相当）",
                "source_pages": [22, 23, 24],
                "note": "PDF本文および別表4を raw_requirement_pages.json に原表として保存。",
            },
            "graduation": {
                "label": "卒業所要単位",
                "source_pages": [25, 26],
                "units": graduation_units,
            },
            "raw_requirement_pages": raw_requirements,
        },
    }


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_course_files(year_data: dict[str, Any]) -> None:
    year = year_data["admission_year"]
    by_course: dict[str, list[dict[str, Any]]] = {}
    for row in year_data["subjects"]:
        by_course.setdefault(row["course"], []).append(row)
    grad = year_data["requirements"]["graduation"]["units"]
    grad_by_course: dict[str, list[dict[str, Any]]] = {}
    for row in grad:
        grad_by_course.setdefault(row["course"], []).append(row)

    for _, cluster, course in COURSES:
        course_dir = OUT_DIR / f"{cluster.split('（')[0]}_{slug(cluster)}" / slug(course) / str(year)
        course_dir.mkdir(parents=True, exist_ok=True)
        subjects = by_course.get(course, [])
        requirements = {
            "admission_year": year,
            "cluster": cluster,
            "course": course,
            "source_pdf": year_data["source_pdf"],
            "source_url": year_data["source_url"],
            "third_year_promotion": year_data["requirements"]["third_year_promotion"],
            "fourth_year_promotion": year_data["requirements"]["fourth_year_promotion"],
            "graduation_units": grad_by_course.get(course, []),
        }
        (course_dir / "subjects.json").write_text(json.dumps(subjects, ensure_ascii=False, indent=2), encoding="utf-8")
        (course_dir / "requirements.json").write_text(json.dumps(requirements, ensure_ascii=False, indent=2), encoding="utf-8")
        write_csv(
            course_dir / "subjects.csv",
            subjects,
            ["admission_year", "cluster", "course", "subject", "subject_code", "credits", "requirement_type", "category_path", "eligible_years", "remarks", "source_pdf", "source_page", "source_url"],
        )
        md = [
            f"# {year}年度入学 {cluster} {course}",
            "",
            f"- 出典: {year_data['source_url']}",
            "- `subjects.json/csv`: 科目・単位・必選区分・取得可能学年",
            "- `requirements.json`: 3年進級時、4年進級時、卒業時の必要単位",
            "",
            "## 卒業所要単位",
            "",
        ]
        for row in requirements["graduation_units"]:
            md.append(f"- {row['category']}: {row['credits']}単位")
        md += ["", "## 科目一覧", ""]
        for row in subjects:
            years = ",".join(map(str, row["eligible_years"])) or "未抽出"
            md.append(f"- {row['subject']} ({row['credits']}単位, {row['requirement_type']}, {years}年次, p.{row['source_page']})")
        (course_dir / "README.md").write_text("\n".join(md) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    all_years = []
    all_subjects = []
    all_grad = []
    for path in sorted(SOURCE_DIR.glob("youran20*-gakuiki.pdf")):
        data = extract_pdf(path)
        all_years.append(data)
        all_subjects.extend(data["subjects"])
        for row in data["requirements"]["graduation"]["units"]:
            row = dict(row)
            row["admission_year"] = data["admission_year"]
            row["source_pdf"] = data["source_pdf"]
            all_grad.append(row)
        raw_dir = OUT_DIR / "raw_tables" / str(data["admission_year"])
        raw_dir.mkdir(parents=True, exist_ok=True)
        (raw_dir / "requirement_pages.json").write_text(
            json.dumps(data["requirements"]["raw_requirement_pages"], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        write_course_files(data)

    (OUT_DIR / "all_subjects.json").write_text(json.dumps(all_subjects, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(
        OUT_DIR / "all_subjects.csv",
        all_subjects,
        ["admission_year", "cluster", "course", "subject", "subject_code", "credits", "requirement_type", "category_path", "eligible_years", "remarks", "source_pdf", "source_page", "source_url"],
    )
    (OUT_DIR / "graduation_requirements.json").write_text(json.dumps(all_grad, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(
        OUT_DIR / "graduation_requirements.csv",
        all_grad,
        ["admission_year", "cluster", "course", "category", "credits", "source_pdf", "source_page", "source_url"],
    )
    index = [
        "# UEC 情報理工学域 学修要覧 抽出データ",
        "",
        f"- 公式ページ: {SOURCE_PAGE}",
        "- 対象: 2020〜2026年度入学の情報理工学域（昼間コース）",
        "- 各類/コース/年度フォルダに `subjects.json`, `subjects.csv`, `requirements.json`, `README.md` を配置。",
        "- `raw_tables/<年度>/requirement_pages.json` に進級・卒業所要単位の原表テキストと抽出表を保存。",
        "",
        "## 全体ファイル",
        "",
        "- `all_subjects.json/csv`: 全年度・全コースの科目候補",
        "- `graduation_requirements.json/csv`: 卒業所要単位の正規化表",
        "",
    ]
    for _, cluster, course in COURSES:
        index.append(f"- {cluster} / {course}: `{cluster.split('（')[0]}_{slug(cluster)}/{slug(course)}/<年度>/`")
    (OUT_DIR / "README.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    print(f"subjects={len(all_subjects)} graduation_rows={len(all_grad)} out={OUT_DIR}")


if __name__ == "__main__":
    main()
