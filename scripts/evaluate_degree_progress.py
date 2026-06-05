#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

from parse_kakutei_seiseki import parse_kakutei_seiseki


ROOT = Path(__file__).resolve().parents[1]
YOURAN_DIR = ROOT / "youran_dataset"
REPORT_DIR = ROOT / "degree_audit_reports"

COURSE_DIRS = {
    "メディア情報学": "Ⅰ類_I類_情報系/メディア情報学",
    "経営・社会情報学": "Ⅰ類_I類_情報系/経営_社会情報学",
    "情報数理工学": "Ⅰ類_I類_情報系/情報数理工学",
    "コンピュータサイエンス": "Ⅰ類_I類_情報系/コンピュータサイエンス",
    "デザイン思考・データサイエンス": "Ⅰ類_I類_情報系/デザイン思考_データサイエンス",
    "セキュリティ情報学": "Ⅱ類_II類_融合系/セキュリティ情報学",
    "情報通信工学": "Ⅱ類_II類_融合系/情報通信工学",
    "電子情報学": "Ⅱ類_II類_融合系/電子情報学",
    "計測・制御システム": "Ⅱ類_II類_融合系/計測_制御システム",
    "先端ロボティクス": "Ⅱ類_II類_融合系/先端ロボティクス",
    "機械システム": "Ⅲ類_III類_理工系/機械システム",
    "電子工学": "Ⅲ類_III類_理工系/電子工学",
    "光工学": "Ⅲ類_III類_理工系/光工学",
    "物理工学": "Ⅲ類_III類_理工系/物理工学",
    "化学生命工学": "Ⅲ類_III類_理工系/化学生命工学",
}

SUBTOTAL_IDS = {"subtotal.general", "subtotal.practice", "subtotal.specialized", "total.graduation"}
OPTIONAL_BUCKET_IDS = {"general.advanced", "common.extra"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compact(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    replacements = {
        "Ⅰ": "I",
        "Ⅱ": "II",
        "Ⅲ": "III",
        "Ⅳ": "IV",
        "Ⅴ": "V",
        "Ⅵ": "VI",
        "Ⅶ": "VII",
        "Ⅷ": "VIII",
        "Ａ": "A",
        "Ｂ": "B",
        "Ｃ": "C",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    text = re.sub(r"[ 　]", "", text)
    text = re.sub(r"（[ⅠⅡⅢI]+類）|\([ⅠⅡⅢI]+類\)", "", text)
    return text


def normalize_category_path(path: str, category_aliases: dict[str, str]) -> str | None:
    if path in category_aliases:
        return category_aliases[path]
    key = compact(path)
    compact_aliases = {compact(k): v for k, v in category_aliases.items()}
    if key in compact_aliases:
        return compact_aliases[key]

    if "人文・社会科学科目" in path:
        return "general.human_social"
    if "言語文化基礎科目" in path and ("II" in compact(path) or "Ⅱ" in path):
        return "general.language.basic_ii"
    if "言語文化基礎科目" in path:
        return "general.language.basic_i"
    if "言語文化応用科目" in path:
        return "general.language.applied_i"
    if "言語文化演習科目" in path:
        return "general.language.seminar"
    if "健康・スポーツ科学科目" in path:
        return "general.health_sports"
    if "理工系教" in path:
        return "general.science_liberal"
    if "上級科目" in path or "特別講義" in path:
        return "general.advanced"
    if "初年次導入科目" in path:
        return "practice.first_year"
    if "データサイエンス科目" in path:
        return "practice.data_science"
    if "倫理・キャリア教育科目" in path:
        return "practice.ethics_career"
    if "技術英語科目" in path:
        return "practice.technical_english"
    if "理数基礎科目" in path:
        return "specialized.math_science_foundation"
    if "類共通基礎科目" in path or "類基共礎通科目" in compact(path) or "基類礎共科通目" in compact(path):
        if "選択必修" in path:
            return "specialized.cluster_foundation.elective_required"
        if "選択" in path:
            return "specialized.cluster_foundation.elective"
        return "specialized.cluster_foundation.required"
    if "類専門科目" in path or "類科専目門" in compact(path) or "科類専目門" in compact(path):
        if "選択必修" in path:
            return "specialized.course.elective_required"
        if "選択" in path:
            return "specialized.course.elective"
        return "specialized.course.required"
    if "共通単位" in path:
        return "common.extra"
    if "合計" in path:
        return "total.graduation"
    return None


def normalize_subject_name(name: str, aliases: dict[str, str]) -> str:
    name = aliases.get(name, name)
    name = re.sub(r"（[ⅠⅡⅢI]+類）|\([ⅠⅡⅢI]+類\)", "", name)
    return compact(name)


def course_dataset_dir(course: str, year: int) -> Path:
    if course not in COURSE_DIRS:
        raise ValueError(f"Unsupported course: {course}")
    return YOURAN_DIR / COURSE_DIRS[course] / str(year)


def load_course_dataset(course: str, year: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    base = course_dataset_dir(course, year)
    requirements = load_json(base / "requirements.json")
    subjects = load_json(base / "subjects.json")
    return requirements, subjects


def build_requirements(
    requirements: dict[str, Any],
    category_aliases: dict[str, str],
    category_labels: dict[str, str],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    normalized: dict[str, dict[str, Any]] = {}
    unmatched = []
    for row in requirements.get("graduation_units", []):
        category_id = normalize_category_path(row["category"], category_aliases)
        if category_id is None:
            unmatched.append(row)
            continue
        credits = float(row["credits"])
        normalized[category_id] = {
            "category_id": category_id,
            "label": category_labels.get(category_id, category_id),
            "required_credits": credits,
            "source_category": row["category"],
            "source_page": row["source_page"],
            "source_url": row["source_url"],
        }
    return normalized, unmatched


def bucket_earned(records: list[dict[str, Any]], category_aliases: dict[str, str]) -> tuple[dict[str, float], list[dict[str, Any]]]:
    earned = defaultdict(float)
    unmatched = []
    for record in records:
        category_id = normalize_category_path(record["category_path"], category_aliases)
        if category_id is None:
            unmatched.append(record)
            continue
        earned[category_id] += float(record["credits"])
    return dict(earned), unmatched


def compute_group_totals(earned: dict[str, float]) -> dict[str, float]:
    result = dict(earned)
    result["subtotal.general"] = sum(v for k, v in earned.items() if k.startswith("general."))
    result["subtotal.practice"] = sum(v for k, v in earned.items() if k.startswith("practice."))
    result["subtotal.specialized"] = sum(v for k, v in earned.items() if k.startswith("specialized."))
    result["total.graduation"] = sum(earned.values())
    return result


def category_audit(requirements: dict[str, dict[str, Any]], earned: dict[str, float]) -> list[dict[str, Any]]:
    earned_with_totals = compute_group_totals(earned)
    common_requirement = requirements.get("common.extra", {}).get("required_credits", 0.0)
    if common_requirement:
        surplus = 0.0
        for category_id, credits in earned.items():
            required = requirements.get(category_id, {}).get("required_credits", 0.0)
            if category_id not in SUBTOTAL_IDS and category_id != "common.extra":
                surplus += max(credits - required, 0.0)
        earned_with_totals["common.extra"] = earned_with_totals.get("common.extra", 0.0) + surplus
    rows = []
    for category_id, req in requirements.items():
        required = req["required_credits"]
        got = earned_with_totals.get(category_id, 0.0)
        rows.append({
            "category_id": category_id,
            "label": req["label"],
            "required_credits": required,
            "earned_credits": got,
            "shortage_credits": max(required - got, 0.0),
            "satisfied": got >= required,
            "source_url": req["source_url"],
            "source_page": req["source_page"],
        })
    rows.sort(key=lambda r: r["category_id"])
    return rows


def subject_match_audit(
    passed_records: list[dict[str, Any]],
    subjects: list[dict[str, Any]],
    subject_aliases: dict[str, str],
) -> dict[str, Any]:
    subject_index = {normalize_subject_name(s["subject"], subject_aliases): s for s in subjects}
    matched = []
    unmatched = []
    for record in passed_records:
        key = normalize_subject_name(record["subject"], subject_aliases)
        if key in subject_index:
            matched.append({"csv_subject": record["subject"], "youran_subject": subject_index[key]["subject"]})
        else:
            unmatched.append({
                "subject": record["subject"],
                "category_path": record["category_path"],
                "credits": record["credits"],
            })
    return {
        "matched_count": len(matched),
        "unmatched_count": len(unmatched),
        "unmatched_subjects": unmatched,
    }


def missing_required_subjects(
    passed_records: list[dict[str, Any]],
    subjects: list[dict[str, Any]],
    subject_aliases: dict[str, str],
) -> list[dict[str, Any]]:
    passed = {normalize_subject_name(r["subject"], subject_aliases) for r in passed_records}
    missing = []
    for subject in subjects:
        if subject.get("requirement_type") != "必修":
            continue
        if normalize_subject_name(subject["subject"], subject_aliases) not in passed:
            missing.append({
                "subject": subject["subject"],
                "credits": subject["credits"],
                "category_path": subject["category_path"],
                "eligible_years": subject["eligible_years"],
                "source_url": subject["source_url"],
                "source_page": subject["source_page"],
            })
    return missing


def status_from_rows(rows: list[dict[str, Any]], exclude_optional: bool = False) -> str:
    relevant = [
        row for row in rows
        if not (exclude_optional and row["category_id"] in OPTIONAL_BUCKET_IDS)
    ]
    return "satisfied" if all(row["satisfied"] for row in relevant) else "not_satisfied"


def evaluate(csv_path: Path, out_dir: Path = REPORT_DIR) -> dict[str, Any]:
    parsed = parse_kakutei_seiseki(csv_path)
    student = parsed["student"]
    year = int(student["admission_year"])
    course = student["course"]
    if course is None:
        raise ValueError(f"Could not infer course from affiliation: {student['affiliation']}")

    requirements, subjects = load_course_dataset(course, year)
    aliases = load_json(YOURAN_DIR / "category_aliases.json")
    category_aliases = aliases["aliases"]
    category_labels = aliases["category_labels"]
    subject_aliases = load_json(YOURAN_DIR / "subject_aliases.json")["aliases"]

    normalized_requirements, unmatched_requirement_categories = build_requirements(
        requirements, category_aliases, category_labels
    )
    earned, unmatched_csv_categories = bucket_earned(parsed["passed_records"], category_aliases)
    rows = category_audit(normalized_requirements, earned)
    subject_audit = subject_match_audit(parsed["passed_records"], subjects, subject_aliases)
    missing_required = missing_required_subjects(parsed["passed_records"], subjects, subject_aliases)

    graduation_rows = rows
    total_required = normalized_requirements.get("total.graduation", {}).get("required_credits")
    total_row = next((row for row in rows if row["category_id"] == "total.graduation"), None)
    graduation_status = "satisfied" if total_row and total_row["satisfied"] and not missing_required else "not_satisfied"

    report = {
        "student": student,
        "source_csv": parsed["source_csv"],
        "dataset": {
            "requirements_path": str(course_dataset_dir(course, year) / "requirements.json"),
            "subjects_path": str(course_dataset_dir(course, year) / "subjects.json"),
            "source_url": requirements["source_url"],
        },
        "summary": {
            "record_count": parsed["record_count"],
            "passed_count": parsed["passed_count"],
            "passed_credits": parsed["passed_credits"],
            "graduation_required_credits": total_required,
            "simple_total_shortage": max((total_required or 0) - parsed["passed_credits"], 0),
            "graduation_status": graduation_status,
            "third_year_promotion_status": "unknown",
            "fourth_year_promotion_status": "unknown",
        },
        "category_audit": graduation_rows,
        "missing_required_subjects": missing_required,
        "subject_match_audit": subject_audit,
        "unmatched": {
            "csv_categories": unmatched_csv_categories,
            "requirement_categories": unmatched_requirement_categories,
        },
        "promotion_audit": {
            "third_year_promotion": {
                "status": "unknown",
                "reason": "現時点の要覧データでは別表3/本文がraw tableとして保存されているのみで、審査科目リストが正規化されていないため機械判定不能。",
                "source_pages": requirements["third_year_promotion"]["source_pages"],
                "source_url": requirements["source_url"],
            },
            "fourth_year_promotion": {
                "status": "unknown",
                "reason": "卒業研究着手審査は別表4の審査対象科目・要件を原表保存しているが、要件文の科目集合・単位条件をまだ構造化していないため機械判定不能。",
                "source_pages": requirements["fourth_year_promotion"]["source_pages"],
                "source_url": requirements["source_url"],
            },
        },
        "notes": [
            "カテゴリ別不足はCSVの合格済み単位を標準カテゴリIDへ集計して算出している。",
            "共通単位や余剰単位の最適充当は未実装。該当項目は不足として保守的に表示する。",
            "必修未修得科目はsubjects.jsonの必修科目とCSV科目名をalias正規化して照合しているため、未登録aliasにより過大検出される可能性がある。",
        ],
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    student_id = student["student_id"] or "unknown"
    json_path = out_dir / f"{student_id}_degree_audit.json"
    md_path = out_dir / f"{student_id}_degree_audit.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")
    return report


def fmt(value: float | int | None) -> str:
    if value is None:
        return "-"
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.1f}"


def render_markdown(report: dict[str, Any]) -> str:
    student = report["student"]
    summary = report["summary"]
    lines = [
        f"# Degree Audit: {student['student_id']}",
        "",
        f"- 学生所属: {student['affiliation']}",
        f"- 推定入学年度: {student['admission_year']}",
        f"- 推定類・コース: {student['cluster']} / {student['course']}",
        f"- 合格済み: {summary['passed_count']}科目 / {fmt(summary['passed_credits'])}単位",
        f"- 卒業必要単位: {fmt(summary['graduation_required_credits'])}単位",
        f"- 単純不足: {fmt(summary['simple_total_shortage'])}単位",
        f"- 卒業判定: {summary['graduation_status']}",
        f"- 3年進級判定: {summary['third_year_promotion_status']}",
        f"- 4年進級判定: {summary['fourth_year_promotion_status']}",
        "",
        "## カテゴリ別不足",
        "",
        "|カテゴリ|必要|修得|不足|判定|出典|",
        "|---|---:|---:|---:|---|---|",
    ]
    for row in report["category_audit"]:
        lines.append(
            f"|{row['label']}|{fmt(row['required_credits'])}|{fmt(row['earned_credits'])}|"
            f"{fmt(row['shortage_credits'])}|{'OK' if row['satisfied'] else '不足'}|p.{row['source_page']}|"
        )
    lines += [
        "",
        "## 必修未修得候補",
        "",
    ]
    if report["missing_required_subjects"]:
        for row in report["missing_required_subjects"]:
            years = ",".join(map(str, row["eligible_years"])) or "-"
            lines.append(f"- {row['subject']} ({row['credits']}単位, {years}年次, p.{row['source_page']})")
    else:
        lines.append("- なし")
    lines += [
        "",
        "## 未マッチ科目",
        "",
        f"- 科目名一致: {report['subject_match_audit']['matched_count']}件",
        f"- 未マッチ: {report['subject_match_audit']['unmatched_count']}件",
    ]
    for row in report["subject_match_audit"]["unmatched_subjects"]:
        lines.append(f"- {row['subject']} ({row['category_path']}, {fmt(row['credits'])}単位)")
    lines += [
        "",
        "## 判定不能項目",
        "",
        f"- 3年進級: {report['promotion_audit']['third_year_promotion']['reason']}",
        f"- 4年進級: {report['promotion_audit']['fourth_year_promotion']['reason']}",
        "",
        "## 注意",
        "",
    ]
    for note in report["notes"]:
        lines.append(f"- {note}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--out-dir", default=str(REPORT_DIR))
    args = parser.parse_args()
    report = evaluate(Path(args.csv_path), Path(args.out_dir))
    student_id = report["student"]["student_id"] or "unknown"
    print(f"wrote {Path(args.out_dir) / (student_id + '_degree_audit.json')}")
    print(f"wrote {Path(args.out_dir) / (student_id + '_degree_audit.md')}")


if __name__ == "__main__":
    main()
