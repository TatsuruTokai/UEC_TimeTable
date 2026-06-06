import type {
  CatalogSubject,
  CategoryAliases,
  PromotionRequirement,
  PromotionRequirementCondition,
  PromotionRequirementDataset,
  RequirementSourceRow,
  SubjectAliases,
  TimetableEntry,
  TimetableEntryDataset,
} from "../types";

export type CatalogData = {
  subjects: CatalogSubject[];
  requirements: RequirementSourceRow[];
  promotionRequirements: PromotionRequirement[];
  categoryAliases: CategoryAliases;
  subjectAliases: SubjectAliases;
  timetableEntries: TimetableEntry[];
};

const json = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}を読み込めませんでした`);
  return response.json() as Promise<T>;
};

const publicPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const TECHNICAL_ENGLISH_SUBJECTS = [
  {
    subject: "Technical English - Basic English for Science",
    subject_code: "TEN501z",
    semester_hours: [{ year: 3, semester: 5, hours: "2" }],
  },
  {
    subject: "Technical English - Intermediate English for Science",
    subject_code: "TEN601z",
    semester_hours: [{ year: 3, semester: 6, hours: "2" }],
  },
] satisfies Pick<CatalogSubject, "subject" | "subject_code" | "semester_hours">[];

const TECHNICAL_ENGLISH_CATEGORY_ID = "practice.technical_english";

const scopeKey = (admissionYear: number, cluster: string, program: string) => `${admissionYear}::${cluster}::${program}`;

const normalizeSubjectKey = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[‐‑‒–—―−－]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();

const isTechnicalEnglishRequirement = (row: RequirementSourceRow) => row.category.replace(/\s+/g, "").includes("技術英語科目");

const technicalEnglishRequirementByScope = (requirements: RequirementSourceRow[]) => {
  const rows = new Map<string, RequirementSourceRow>();
  requirements.filter(isTechnicalEnglishRequirement).forEach((row) => {
    const key = scopeKey(row.admission_year, row.cluster, row.course);
    if (!rows.has(key)) rows.set(key, row);
  });
  return rows;
};

const withTechnicalEnglishSubjects = (subjects: CatalogSubject[], requirements: RequirementSourceRow[]) => {
  const existing = new Set(
    subjects.map((subject) => `${scopeKey(subject.admission_year, subject.cluster, subject.course)}::${normalizeSubjectKey(subject.subject)}`),
  );
  const additions: CatalogSubject[] = [];
  technicalEnglishRequirementByScope(requirements).forEach((row, key) => {
    TECHNICAL_ENGLISH_SUBJECTS.forEach((template) => {
      const subjectKey = `${key}::${normalizeSubjectKey(template.subject)}`;
      if (existing.has(subjectKey)) return;
      existing.add(subjectKey);
      additions.push({
        admission_year: row.admission_year,
        cluster: row.cluster,
        course: row.course,
        subject: template.subject,
        subject_code: template.subject_code,
        credits: "2",
        requirement_type: "必修",
        category_path: row.category,
        eligible_years: [3, 4],
        semester_hours: template.semester_hours,
        remarks: "卒業要件の技術英語科目4単位から補完",
        source_url: row.source_url,
        source_page: row.source_page,
      });
    });
  });
  return additions.length ? [...subjects, ...additions] : subjects;
};

const numberValue = (value: string | number | undefined) => Number.parseFloat(String(value ?? "0").replace(/[^\d.]/g, "")) || 0;

const technicalEnglishCondition = (row: RequirementSourceRow): PromotionRequirementCondition => ({
  id: TECHNICAL_ENGLISH_CATEGORY_ID,
  label: "技術英語科目",
  categoryIds: [TECHNICAL_ENGLISH_CATEGORY_ID],
  requiredCredits: numberValue(row.credits) || 4,
  requiredSubjects: TECHNICAL_ENGLISH_SUBJECTS.map((subject) => subject.subject),
  confidence: "medium",
  note: "卒業研究着手要件で必要な技術英語科目を卒業所要単位表から反映しています。",
});

const withTechnicalEnglishPromotionRequirements = (
  promotionRequirements: PromotionRequirement[],
  requirements: RequirementSourceRow[],
) => {
  const technicalEnglishRows = technicalEnglishRequirementByScope(requirements);
  return promotionRequirements.map((requirement) => {
    if (requirement.type !== "fourth-year-promotion") return requirement;
    if (requirement.categoryRequirements.some((condition) => condition.categoryIds.includes(TECHNICAL_ENGLISH_CATEGORY_ID))) return requirement;
    const sourceRow = technicalEnglishRows.get(scopeKey(requirement.admissionYear, requirement.cluster, requirement.program));
    if (!sourceRow) return requirement;
    return {
      ...requirement,
      categoryRequirements: [...requirement.categoryRequirements, technicalEnglishCondition(sourceRow)],
      notes: [
        ...requirement.notes,
        "卒業研究着手判定で技術英語科目4単位が未取得の場合は未達として扱います。",
      ],
    };
  });
};

export const emptyCatalog: CatalogData = {
  subjects: [],
  requirements: [],
  promotionRequirements: [],
  categoryAliases: { aliases: {}, category_labels: {} },
  subjectAliases: { aliases: {} },
  timetableEntries: [],
};

export const loadCatalogData = async (): Promise<CatalogData> => {
  const [subjects, requirements, promotionDataset, categoryAliases, subjectAliases, timetableDataset] = await Promise.all([
    json<CatalogSubject[]>(publicPath("data/all_subjects.json")),
    json<RequirementSourceRow[]>(publicPath("data/graduation_requirements.json")),
    json<PromotionRequirementDataset>(publicPath("data/promotion_requirements.json")),
    json<CategoryAliases>(publicPath("data/category_aliases.json")),
    json<SubjectAliases>(publicPath("data/subject_aliases.json")),
    json<TimetableEntryDataset>(publicPath("data/uec_timetable_entries_2026.json")),
  ]);
  return {
    subjects: withTechnicalEnglishSubjects(subjects, requirements),
    requirements,
    promotionRequirements: withTechnicalEnglishPromotionRequirements(promotionDataset.requirements, requirements),
    categoryAliases,
    subjectAliases,
    timetableEntries: timetableDataset.entries,
  };
};
