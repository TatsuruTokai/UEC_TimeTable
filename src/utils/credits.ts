import type { AppState, CatalogSubject, CategoryAliases, GradeRecord, PromotionRequirement, PromotionRequirementCondition, RequirementSourceRow, SubjectAliases } from "../types";
import { gradeNumber } from "./academicOptions";
import { compact } from "./search";

const SUBTOTAL_IDS = new Set(["subtotal.general", "subtotal.practice", "subtotal.specialized", "total.graduation"]);
const SUBTOTAL_PREFIX: Record<string, string> = {
  "subtotal.general": "general.",
  "subtotal.practice": "practice.",
  "subtotal.specialized": "specialized.",
};
const SHARED_CANDIDATE_PREFIXES = ["general.", "practice."];

const courseCategoryToId: Record<string, string> = {
  必修: "specialized.course.required",
  選択必修: "specialized.course.elective_required",
  選択: "specialized.course.elective",
  自由科目: "common.extra",
  教養科目: "general.advanced",
  専門科目: "specialized.course.elective",
  "実験・演習": "specialized.course.required",
  "英語・第二外国語": "general.language.basic_i",
  技術英語科目: "practice.technical_english",
};

export type CreditAuditRow = {
  categoryId: string;
  label: string;
  required: number;
  earned: number;
  planned: number;
  shortage: number;
  sourceUrl?: string;
  sourcePage?: number;
};

export type RequirementProfile = {
  id: "third-year" | "fourth-year" | "graduation";
  label: string;
  type: "third-year-promotion" | "fourth-year-promotion" | "graduation";
  requiredCredits: number;
  earnedCredits: number;
  plannedCredits: number;
  forecastCredits: number;
  shortageCredits: number;
  forecastShortageCredits: number;
  progress: number;
  forecastProgress: number;
  satisfied: boolean;
  forecastSatisfied: boolean;
  detailRows: CreditAuditRow[];
  missingRequiredSubjects: string[];
  unsatisfiedGroups: string[];
  confidence?: PromotionRequirement["confidence"];
  notes: string[];
  sourceUrl?: string;
  sourcePages?: number[];
};

export type CreditCandidateSubject = {
  subject: string;
  subjectCode?: string;
  credits: number;
  requirementType: string;
  categoryPath: string;
  eligibleYears: number[];
  termLabels: string[];
  sourceUrl?: string;
  sourcePage?: number;
};

export type CreditCandidateGroup = {
  categoryId: string;
  label: string;
  shortage: number;
  candidates: CreditCandidateSubject[];
};

export type CreditAudit = {
  totalRequired: number;
  earnedTotal: number;
  takingTotal: number;
  forecastTotal: number;
  shortageTotal: number;
  rows: CreditAuditRow[];
  missingRequired: CatalogSubject[];
  failedOrRetake: { subject: string; credits: number; source: "csv" | "course" }[];
  requirementProfiles: RequirementProfile[];
  candidateGroups: CreditCandidateGroup[];
  thirdYearProgress: number;
  fourthYearProgress: number;
  graduationProgress: number;
  unmatchedCategories: string[];
};

const numberValue = (value: string | number | undefined) => Number.parseFloat(String(value ?? "0").replace(/[^\d.]/g, "")) || 0;

const normalizeCategoryPath = (path: string, aliases: CategoryAliases): string | undefined => {
  if (aliases.aliases[path]) return aliases.aliases[path];
  const key = compact(path);
  const match = Object.entries(aliases.aliases).find(([source]) => compact(source) === key);
  if (match) return match[1];
  const has = (value: string) => key.includes(compact(value));
  const hasElectiveRequired = has("選択必修") || (key.includes("選") && key.includes("択") && key.includes("必") && key.includes("修"));
  const hasElective = has("選択") || (key.includes("選") && key.includes("択"));
  if (has("人文・社会科学科目")) return "general.human_social";
  if (has("言語文化基礎科目") && (key.includes("ii") || key.includes("2"))) return "general.language.basic_ii";
  if (has("言語文化基礎科目")) return "general.language.basic_i";
  if (has("言語文化応用科目")) return "general.language.applied_i";
  if (has("言語文化演習科目")) return "general.language.seminar";
  if (has("健康・スポーツ科学科目")) return "general.health_sports";
  if (has("理工系教")) return "general.science_liberal";
  if (has("上級科目") || has("特別講義")) return "general.advanced";
  if (has("初年次導入科目")) return "practice.first_year";
  if (has("データサイエンス科目")) return "practice.data_science";
  if (has("倫理・キャリア教育科目")) return "practice.ethics_career";
  if (has("技術英語科目")) return "practice.technical_english";
  if (has("理数基礎科目")) return "specialized.math_science_foundation";
  if (has("類共通基礎科目") && hasElectiveRequired) return "specialized.cluster_foundation.elective_required";
  if (has("類共通基礎科目") && hasElective) return "specialized.cluster_foundation.elective";
  if (has("類共通基礎科目")) return "specialized.cluster_foundation.required";
  if (has("類専門科目") && hasElectiveRequired) return "specialized.course.elective_required";
  if (has("類専門科目") && hasElective) return "specialized.course.elective";
  if (has("類専門科目")) return "specialized.course.required";
  if (has("共通単位")) return "common.extra";
  if (has("合計")) return "total.graduation";
  return undefined;
};

const addCredits = (target: Record<string, number>, id: string | undefined, credits: number) => {
  if (!id) return;
  target[id] = (target[id] ?? 0) + credits;
};

const withTotals = (source: Record<string, number>, requirements?: Record<string, { required: number }>): Record<string, number> => {
  const result: Record<string, number> = {
    ...source,
    "subtotal.general": Object.entries(source).reduce((sum, [key, value]) => (key.startsWith("general.") ? sum + value : sum), 0),
    "subtotal.practice": Object.entries(source).reduce((sum, [key, value]) => (key.startsWith("practice.") ? sum + value : sum), 0),
    "subtotal.specialized": Object.entries(source).reduce((sum, [key, value]) => (key.startsWith("specialized.") ? sum + value : sum), 0),
    "total.graduation": Object.values(source).reduce((sum, value) => sum + value, 0),
  };
  if (requirements?.["common.extra"]?.required) {
    result["common.extra"] =
      (result["common.extra"] ?? 0) +
      Object.entries(source).reduce((sum, [categoryId, credits]) => {
        if (SUBTOTAL_IDS.has(categoryId) || categoryId === "common.extra") return sum;
        return sum + Math.max(credits - (requirements[categoryId]?.required ?? 0), 0);
      }, 0);
  }
  return result;
};

const normalizeSubject = (name: string, aliases: SubjectAliases) => {
  const aliased = aliases.aliases[name] ?? name;
  return compact(aliased.replace(/（[ⅠⅡⅢI]+類）|\([ⅠⅡⅢI]+類\)/g, ""));
};

const semesterLabel = (semester: number) => (semester % 2 === 1 ? "前期" : "後期");

const subjectTermLabels = (subject: CatalogSubject) => {
  const labels = (subject.semester_hours ?? [])
    .map((item) => `${item.year}年${semesterLabel(item.semester)}`)
    .filter(Boolean);
  return Array.from(new Set(labels));
};

const isLanguageSeminarSubject = (subject: CatalogSubject) => {
  const category = compact(subject.category_path);
  if (!category.includes(compact("言語文化科目"))) return false;
  const name = subject.subject.normalize("NFKC").replace(/[ \u3000#＃★☆]/g, "");
  return /^(?:英語|独語|仏語|露語|中国語|韓国朝鮮語|日本語)(?:運用)?演習$/.test(name);
};

const normalizeSubjectCategory = (subject: CatalogSubject, aliases: CategoryAliases) => {
  if (isLanguageSeminarSubject(subject)) return "general.language.seminar";
  return normalizeCategoryPath(subject.category_path, aliases);
};

const subjectMinYear = (subject: CatalogSubject) => Math.min(...(subject.eligible_years?.length ? subject.eligible_years : [99]));

const subjectMinSemester = (subject: CatalogSubject) => Math.min(...(subject.semester_hours?.length ? subject.semester_hours.map((item) => item.semester) : [99]));

const isCreditEarningCategory = (categoryId: string) =>
  categoryId.startsWith("general.") || categoryId.startsWith("practice.") || categoryId.startsWith("specialized.");

const isSharedCandidateCategory = (categoryId: string) =>
  categoryId === "common.extra" || SHARED_CANDIDATE_PREFIXES.some((prefix) => categoryId.startsWith(prefix));

const matchesRequirementCategory = (subjectCategoryId: string | undefined, requirementCategoryId: string) => {
  if (!subjectCategoryId) return false;
  if (requirementCategoryId === "common.extra") return isCreditEarningCategory(subjectCategoryId);
  const subtotalPrefix = SUBTOTAL_PREFIX[requirementCategoryId];
  if (subtotalPrefix) return subjectCategoryId.startsWith(subtotalPrefix);
  return subjectCategoryId === requirementCategoryId;
};

const isExactProgramSubject = (subject: CatalogSubject, state: AppState) =>
  subject.cluster === state.settings.cluster && subject.course === state.settings.program;

const subjectScopeRank = (subject: CatalogSubject, state: AppState) => {
  if (isExactProgramSubject(subject, state)) return 0;
  if (subject.cluster === state.settings.cluster) return 1;
  return 2;
};

const uniqueSubjects = (subjects: CatalogSubject[], state: AppState, subjectAliases: SubjectAliases) => {
  const deduped = new Map<string, CatalogSubject>();
  [...subjects]
    .sort((a, b) => subjectScopeRank(a, state) - subjectScopeRank(b, state) || a.subject.localeCompare(b.subject, "ja"))
    .forEach((subject) => {
      const key = normalizeSubject(subject.subject, subjectAliases);
      if (!deduped.has(key)) deduped.set(key, subject);
    });
  return Array.from(deduped.values());
};

const creditsForCondition = (totals: Record<string, number>, condition: PromotionRequirementCondition) =>
  condition.categoryIds.reduce((sum, categoryId) => sum + (totals[categoryId] ?? 0), 0);

const requiredSubjectsForCondition = (
  condition: PromotionRequirementCondition,
  subjects: CatalogSubject[],
  state: AppState,
) => {
  if (condition.requiredSubjects?.length) return condition.requiredSubjects;
  if (!condition.requiredCourseType) return [];
  const maxEligibleYear = condition.maxEligibleYear;
  return subjects
    .filter(
      (subject) =>
        subject.admission_year === state.settings.admissionYear &&
        subject.cluster === state.settings.cluster &&
        subject.course === state.settings.program &&
        subject.requirement_type === condition.requiredCourseType &&
        (!maxEligibleYear || !subject.eligible_years?.length || subject.eligible_years.some((year) => year <= maxEligibleYear)) &&
        condition.categoryIds.some((categoryId) => matchesRequirementCategory(normalizeSubjectCategory(subject, { aliases: {}, category_labels: {} }), categoryId)),
    )
    .map((subject) => subject.subject);
};

const buildPromotionProfile = (
  id: "third-year" | "fourth-year",
  requirement: PromotionRequirement | undefined,
  earnedWithTotals: Record<string, number>,
  plannedWithTotals: Record<string, number>,
  earnedTotal: number,
  takingTotal: number,
  forecastTotal: number,
  subjects: CatalogSubject[],
  state: AppState,
  passedNames: Set<string>,
  plannedNames: Set<string>,
  subjectAliases: SubjectAliases,
): RequirementProfile => {
  if (!requirement) {
    const fallbackRequired = id === "third-year" ? 60 : 101;
    const shortageCredits = Math.max(fallbackRequired - earnedTotal, 0);
    const forecastShortageCredits = Math.max(fallbackRequired - forecastTotal, 0);
    return {
      id,
      type: id === "third-year" ? "third-year-promotion" : "fourth-year-promotion",
      label: id === "third-year" ? "3年進級要件" : "4年進級要件",
      requiredCredits: fallbackRequired,
      earnedCredits: earnedTotal,
      plannedCredits: takingTotal,
      forecastCredits: forecastTotal,
      shortageCredits,
      forecastShortageCredits,
      progress: Math.min(100, (earnedTotal / fallbackRequired) * 100),
      forecastProgress: Math.min(100, (forecastTotal / fallbackRequired) * 100),
      satisfied: false,
      forecastSatisfied: false,
      detailRows: [],
      missingRequiredSubjects: [],
      unsatisfiedGroups: ["この入学年度・類・プログラムの構造化進級要件が見つかりません。"],
      confidence: "unknown",
      notes: ["最終的な進級・卒業要件は公式の学修要覧・教務課資料を確認してください。"],
    };
  }

  const detailRows = requirement.categoryRequirements.map((condition) => {
    const earned = creditsForCondition(earnedWithTotals, condition);
    const planned = creditsForCondition(plannedWithTotals, condition);
    return {
      categoryId: condition.id,
      label: condition.label,
      required: condition.requiredCredits,
      earned,
      planned,
      shortage: Math.max(condition.requiredCredits - earned, 0),
      sourceUrl: requirement.source.url,
      sourcePage: requirement.source.pages[0],
    };
  });
  const requiredSubjectNames = Array.from(
    new Set(requirement.categoryRequirements.flatMap((condition) => requiredSubjectsForCondition(condition, subjects, state))),
  );
  const missingRequiredSubjects = requiredSubjectNames.filter((subject) => !passedNames.has(normalizeSubject(subject, subjectAliases)));
  const forecastMissingRequiredSubjects = requiredSubjectNames.filter((subject) => {
    const normalized = normalizeSubject(subject, subjectAliases);
    return !passedNames.has(normalized) && !plannedNames.has(normalized);
  });
  const unsatisfiedGroups = requirement.categoryRequirements
    .filter((condition) => creditsForCondition(earnedWithTotals, condition) < condition.requiredCredits)
    .map((condition) => `${condition.label}: ${fmtShortage(condition.requiredCredits - creditsForCondition(earnedWithTotals, condition))}`);
  const notes = [
    ...requirement.notes,
    ...requirement.categoryRequirements.flatMap((condition) => (condition.note ? [`${condition.label}: ${condition.note}`] : [])),
  ];
  const totalShortage = Math.max(requirement.totalRequiredCredits - earnedTotal, 0);
  const forecastTotalShortage = Math.max(requirement.totalRequiredCredits - forecastTotal, 0);
  const categoryShortage = detailRows.reduce((max, row) => Math.max(max, row.shortage), 0);
  const forecastCategoryShortage = requirement.categoryRequirements.reduce((max, condition) => {
    const earned = creditsForCondition(earnedWithTotals, condition);
    const planned = creditsForCondition(plannedWithTotals, condition);
    return Math.max(max, Math.max(condition.requiredCredits - earned - planned, 0));
  }, 0);
  const shortageCredits = Math.max(totalShortage, categoryShortage);
  const forecastShortageCredits = Math.max(forecastTotalShortage, forecastCategoryShortage);
  const satisfied = shortageCredits === 0 && missingRequiredSubjects.length === 0;
  const forecastSatisfied = forecastShortageCredits === 0 && forecastMissingRequiredSubjects.length === 0;
  const progressFromShortage = requirement.totalRequiredCredits
    ? Math.max(0, Math.min(100, ((requirement.totalRequiredCredits - shortageCredits) / requirement.totalRequiredCredits) * 100))
    : 0;
  const forecastProgressFromShortage = requirement.totalRequiredCredits
    ? Math.max(0, Math.min(100, ((requirement.totalRequiredCredits - forecastShortageCredits) / requirement.totalRequiredCredits) * 100))
    : 0;
  return {
    id,
    type: requirement.type,
    label: requirement.label,
    requiredCredits: requirement.totalRequiredCredits,
    earnedCredits: earnedTotal,
    plannedCredits: takingTotal,
    forecastCredits: forecastTotal,
    shortageCredits,
    forecastShortageCredits,
    progress: satisfied ? 100 : Math.min(99, progressFromShortage),
    forecastProgress: forecastSatisfied ? 100 : Math.min(99, forecastProgressFromShortage),
    satisfied,
    forecastSatisfied,
    detailRows,
    missingRequiredSubjects,
    unsatisfiedGroups,
    confidence: requirement.confidence,
    notes,
    sourceUrl: requirement.source.url,
    sourcePages: requirement.source.pages,
  };
};

const fmtShortage = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}単位不足`;

const buildRequirementProfiles = (
  rows: CreditAuditRow[],
  totalRequired: number,
  earnedTotal: number,
  takingTotal: number,
  forecastTotal: number,
  promotions: PromotionRequirement[],
  earnedWithTotals: Record<string, number>,
  plannedWithTotals: Record<string, number>,
  subjects: CatalogSubject[],
  state: AppState,
  passedNames: Set<string>,
  plannedNames: Set<string>,
  graduationMissingRequiredSubjects: string[],
  subjectAliases: SubjectAliases,
): RequirementProfile[] => {
  const third = promotions.find((row) => row.type === "third-year-promotion");
  const fourth = promotions.find((row) => row.type === "fourth-year-promotion");
  const totalShortage = Math.max(totalRequired - earnedTotal, 0);
  const forecastTotalShortage = Math.max(totalRequired - forecastTotal, 0);
  const rowShortage = rows.reduce((max, row) => Math.max(max, row.shortage), 0);
  const forecastRowShortage = rows.reduce((max, row) => Math.max(max, Math.max(row.required - row.earned - row.planned, 0)), 0);
  const shortageCredits = Math.max(totalShortage, rowShortage);
  const forecastShortageCredits = Math.max(forecastTotalShortage, forecastRowShortage);
  const forecastGraduationMissingRequiredSubjects = graduationMissingRequiredSubjects.filter(
    (subject) => !plannedNames.has(normalizeSubject(subject, subjectAliases)),
  );
  const satisfied = shortageCredits === 0 && graduationMissingRequiredSubjects.length === 0;
  const forecastSatisfied = forecastShortageCredits === 0 && forecastGraduationMissingRequiredSubjects.length === 0;
  const progressFromShortage = totalRequired ? Math.max(0, Math.min(100, ((totalRequired - shortageCredits) / totalRequired) * 100)) : 0;
  const forecastProgressFromShortage = totalRequired ? Math.max(0, Math.min(100, ((totalRequired - forecastShortageCredits) / totalRequired) * 100)) : 0;
  return [
    buildPromotionProfile("third-year", third, earnedWithTotals, plannedWithTotals, earnedTotal, takingTotal, forecastTotal, subjects, state, passedNames, plannedNames, subjectAliases),
    buildPromotionProfile("fourth-year", fourth, earnedWithTotals, plannedWithTotals, earnedTotal, takingTotal, forecastTotal, subjects, state, passedNames, plannedNames, subjectAliases),
    {
      id: "graduation",
      type: "graduation",
      label: "卒業要件",
      requiredCredits: totalRequired,
      earnedCredits: earnedTotal,
      plannedCredits: takingTotal,
      forecastCredits: forecastTotal,
      shortageCredits,
      forecastShortageCredits,
      progress: satisfied ? 100 : Math.min(99, progressFromShortage),
      forecastProgress: forecastSatisfied ? 100 : Math.min(99, forecastProgressFromShortage),
      satisfied,
      forecastSatisfied,
      detailRows: rows,
      missingRequiredSubjects: graduationMissingRequiredSubjects,
      unsatisfiedGroups: rows.filter((row) => row.shortage > 0).map((row) => `${row.label}: ${fmtShortage(row.shortage)}`),
      confidence: "high",
      notes: [
        "卒業要件は、作成済みデータセットの区分別必要単位と確定成績CSVの合格済み単位から集計しています。",
        "共通単位や余剰単位の最適充当は保守的に扱うため、最終確認は公式資料で行ってください。",
      ],
    },
  ];
};

const buildCandidateGroups = (
  state: AppState,
  rows: CreditAuditRow[],
  subjects: CatalogSubject[],
  categoryAliases: CategoryAliases,
  subjectAliases: SubjectAliases,
  passedNames: Set<string>,
): CreditCandidateGroup[] => {
  const currentGrade = gradeNumber(state.settings.gradeYear);
  const registeredNames = new Set(
    state.courses
      .filter((course) => course.status === "earned" || course.status === "taking" || course.status === "planned" || course.status === "retake")
      .map((course) => normalizeSubject(course.name, subjectAliases)),
  );
  const shortageRows = rows.filter((row) => row.shortage > 0 && row.categoryId !== "total.graduation");
  const targetRows = shortageRows.filter((row) => {
    const subtotalPrefix = SUBTOTAL_PREFIX[row.categoryId];
    if (!subtotalPrefix) return true;
    return !shortageRows.some((candidate) => candidate.categoryId !== row.categoryId && candidate.categoryId.startsWith(subtotalPrefix));
  });
  const eligibleSubjects = subjects.filter(
    (subject) =>
      subject.admission_year === state.settings.admissionYear &&
      !passedNames.has(normalizeSubject(subject.subject, subjectAliases)) &&
      !registeredNames.has(normalizeSubject(subject.subject, subjectAliases)) &&
      (!currentGrade || !subject.eligible_years?.length || subject.eligible_years.some((year) => year <= currentGrade)),
  );
  const exactEligibleSubjects = eligibleSubjects.filter((subject) => isExactProgramSubject(subject, state));

  const priority = (subject: CatalogSubject, categoryId: string) => {
    if (categoryId === "common.extra") {
      if (subject.requirement_type === "選択") return 0;
      if (subject.requirement_type === "選択必修") return 1;
      if (subject.requirement_type === "必修") return 3;
      return 2;
    }
    if (subject.requirement_type === "必修") return 0;
    if (subject.requirement_type === "選択必修") return 1;
    if (subject.requirement_type === "選択") return 2;
    return 3;
  };

  return targetRows
    .map((row) => {
      const candidates = eligibleSubjects
        .filter((subject) => isSharedCandidateCategory(row.categoryId) || isExactProgramSubject(subject, state))
        .filter((subject) => matchesRequirementCategory(normalizeSubjectCategory(subject, categoryAliases), row.categoryId));
      const scopedCandidates =
        isSharedCandidateCategory(row.categoryId) && !candidates.some((subject) => isExactProgramSubject(subject, state))
          ? candidates
          : candidates.filter((subject) => exactEligibleSubjects.includes(subject));
      const candidateSubjects = uniqueSubjects(scopedCandidates, state, subjectAliases)
        .sort(
          (a, b) =>
            priority(a, row.categoryId) - priority(b, row.categoryId) ||
            subjectScopeRank(a, state) - subjectScopeRank(b, state) ||
            subjectMinYear(a) - subjectMinYear(b) ||
            subjectMinSemester(a) - subjectMinSemester(b) ||
            a.subject.localeCompare(b.subject, "ja"),
        )
        .slice(0, 12)
        .map((subject) => ({
          subject: subject.subject,
          subjectCode: subject.subject_code,
          credits: numberValue(subject.credits),
          requirementType: subject.requirement_type || "未判定",
          categoryPath: subject.category_path,
          eligibleYears: subject.eligible_years ?? [],
          termLabels: subjectTermLabels(subject),
          sourceUrl: subject.source_url,
          sourcePage: subject.source_page,
        }));
      return {
        categoryId: row.categoryId,
        label: row.label,
        shortage: row.shortage,
        candidates: candidateSubjects,
      };
    })
    .filter((group) => group.candidates.length > 0 || group.shortage > 0)
    .slice(0, 12);
};

export const evaluateCredits = (
  state: AppState,
  sourceRows: RequirementSourceRow[],
  promotionRows: PromotionRequirement[],
  subjects: CatalogSubject[],
  categoryAliases: CategoryAliases,
  subjectAliases: SubjectAliases,
): CreditAudit => {
  const requirements: Record<string, { label: string; required: number; sourceUrl?: string; sourcePage?: number }> = {};
  const unmatchedCategories: string[] = [];
  sourceRows
    .filter(
      (row) =>
        row.admission_year === state.settings.admissionYear &&
        row.cluster === state.settings.cluster &&
        row.course === state.settings.program,
    )
    .forEach((row) => {
      const categoryId = normalizeCategoryPath(row.category, categoryAliases);
      if (!categoryId) {
        unmatchedCategories.push(row.category);
        return;
      }
      requirements[categoryId] = {
        label: categoryAliases.category_labels[categoryId] ?? row.category,
        required: numberValue(row.credits),
        sourceUrl: row.source_url,
        sourcePage: row.source_page,
      };
    });

  if (state.manualRequirement) {
    requirements["total.graduation"] = {
      label: "卒業必要単位",
      required: state.manualRequirement.totalRequiredCredits,
    };
    state.manualRequirement.categoryRequirements.forEach((row) => {
      const categoryId = categoryAliases.category_labels[row.category] ? row.category : normalizeCategoryPath(row.category, categoryAliases) ?? row.category;
      requirements[categoryId] = {
        label: categoryAliases.category_labels[categoryId] ?? row.category,
        required: row.requiredCredits,
      };
    });
  }

  const earned: Record<string, number> = {};
  const planned: Record<string, number> = {};
  const gradeRecords = state.gradeImport?.records ?? [];
  gradeRecords
    .filter((record) => record.passed)
    .forEach((record) => addCredits(earned, normalizeCategoryPath(record.categoryPath, categoryAliases), record.credits));
  state.courses.forEach((course) => {
    const id = courseCategoryToId[course.category] ?? normalizeCategoryPath(course.category, categoryAliases);
    if (course.status === "earned") addCredits(earned, id, course.credits);
    if (course.status === "taking" || course.status === "planned" || course.status === "retake") addCredits(planned, id, course.credits);
  });

  const earnedWithTotals = withTotals(earned, requirements);
  const plannedWithTotals = withTotals(planned, requirements);
  const rows = Object.entries(requirements)
    .map(([categoryId, requirement]) => {
      const earnedCredits = earnedWithTotals[categoryId] ?? 0;
      const plannedCredits = plannedWithTotals[categoryId] ?? 0;
      return {
        categoryId,
        label: requirement.label,
        required: requirement.required,
        earned: earnedCredits,
        planned: plannedCredits,
        shortage: Math.max(requirement.required - earnedCredits, 0),
        sourceUrl: requirement.sourceUrl,
        sourcePage: requirement.sourcePage,
      };
    })
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId));

  const passedNames = new Set(gradeRecords.filter((record) => record.passed).map((record) => normalizeSubject(record.subject, subjectAliases)));
  state.courses.filter((course) => course.status === "earned").forEach((course) => passedNames.add(normalizeSubject(course.name, subjectAliases)));
  const plannedNames = new Set(
    state.courses
      .filter((course) => course.status === "taking" || course.status === "planned" || course.status === "retake")
      .map((course) => normalizeSubject(course.name, subjectAliases)),
  );
  const missingRequired = subjects.filter(
    (subject) =>
      subject.admission_year === state.settings.admissionYear &&
      subject.cluster === state.settings.cluster &&
      subject.course === state.settings.program &&
      subject.requirement_type === "必修" &&
      !passedNames.has(normalizeSubject(subject.subject, subjectAliases)),
  );

  const failedOrRetake = [
    ...gradeRecords
      .filter((record) => !record.passed && record.passFail !== "")
      .map((record: GradeRecord) => ({ subject: record.subject, credits: record.credits, source: "csv" as const })),
    ...state.courses
      .filter((course) => course.status === "failed" || course.status === "retake")
      .map((course) => ({ subject: course.name, credits: course.credits, source: "course" as const })),
  ];

  const totalRequired = requirements["total.graduation"]?.required || rows.reduce((sum, row) => (SUBTOTAL_IDS.has(row.categoryId) ? sum : sum + row.required), 0);
  const earnedTotal = earnedWithTotals["total.graduation"] ?? 0;
  const takingTotal = plannedWithTotals["total.graduation"] ?? 0;
  const forecastTotal = earnedTotal + takingTotal;
  const graduationProgress = totalRequired ? Math.min(100, (earnedTotal / totalRequired) * 100) : 0;
  const matchedPromotions = promotionRows.filter(
    (row) =>
      row.admissionYear === state.settings.admissionYear &&
      row.cluster === state.settings.cluster &&
      row.program === state.settings.program,
  );
  const requirementProfiles = buildRequirementProfiles(
    rows,
    totalRequired,
    earnedTotal,
    takingTotal,
    forecastTotal,
    matchedPromotions,
    earnedWithTotals,
    plannedWithTotals,
    subjects,
    state,
    passedNames,
    plannedNames,
    missingRequired.map((subject) => subject.subject),
    subjectAliases,
  );
  const candidateGroups = buildCandidateGroups(state, rows, subjects, categoryAliases, subjectAliases, passedNames);
  const thirdYearProgress = requirementProfiles.find((profile) => profile.id === "third-year")?.progress ?? 0;
  const fourthYearProgress = requirementProfiles.find((profile) => profile.id === "fourth-year")?.progress ?? 0;
  const graduationProfileProgress = requirementProfiles.find((profile) => profile.id === "graduation")?.progress ?? graduationProgress;
  return {
    totalRequired,
    earnedTotal,
    takingTotal,
    forecastTotal,
    shortageTotal: Math.max(totalRequired - earnedTotal, 0),
    rows,
    missingRequired,
    failedOrRetake,
    requirementProfiles,
    candidateGroups,
    thirdYearProgress,
    fourthYearProgress,
    graduationProgress: graduationProfileProgress,
    unmatchedCategories: Array.from(new Set(unmatchedCategories)),
  };
};
