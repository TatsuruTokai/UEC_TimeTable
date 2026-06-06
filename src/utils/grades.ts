import type { GradeRecord } from "../types";

export type GpaTerm = {
  key: string;
  label: string;
  credits: number;
  gradedCredits: number;
  gpa: number;
  passedCount: number;
  failedCount: number;
};

export type GradeAnalysis = {
  gpa: number;
  gradedCredits: number;
  earnedCredits: number;
  attemptedCredits: number;
  passedCount: number;
  failedCount: number;
  distribution: { grade: string; count: number; credits: number }[];
  terms: GpaTerm[];
  failedRecords: GradeRecord[];
  retakeCandidates: GradeRecord[];
};

const gradePoints: Record<string, number> = {
  S: 4,
  A: 3,
  B: 2,
  C: 1,
  D: 0,
  F: 0,
  秀: 4,
  優: 3,
  良: 2,
  可: 1,
  不可: 0,
  不合格: 0,
};

const normalizeGrade = (grade: string) => grade.normalize("NFKC").trim().toUpperCase();

const gradePoint = (grade: string) => {
  const normalized = normalizeGrade(grade);
  return gradePoints[normalized];
};

const termKey = (record: GradeRecord) => `${record.earnedYear || "年度不明"}-${record.earnedTerm || "学期不明"}`;

const termLabel = (record: GradeRecord) => [record.earnedYear || "年度不明", record.earnedTerm || "学期不明"].join(" ");

const safeGpa = (points: number, credits: number) => (credits ? points / credits : 0);

export const analyzeGrades = (records: GradeRecord[]): GradeAnalysis => {
  let pointTotal = 0;
  let gradedCredits = 0;
  let earnedCredits = 0;
  let attemptedCredits = 0;
  let passedCount = 0;
  let failedCount = 0;
  const distributionMap = new Map<string, { grade: string; count: number; credits: number }>();
  const termMap = new Map<string, { label: string; credits: number; gradedCredits: number; points: number; passedCount: number; failedCount: number }>();

  records.forEach((record) => {
    const credits = Number(record.credits || 0);
    if (credits <= 0) return;
    attemptedCredits += credits;
    if (record.passed) {
      earnedCredits += credits;
      passedCount += 1;
    } else if (record.passFail) {
      failedCount += 1;
    }

    const key = termKey(record);
    const term = termMap.get(key) ?? { label: termLabel(record), credits: 0, gradedCredits: 0, points: 0, passedCount: 0, failedCount: 0 };
    if (record.passed) {
      term.credits += credits;
      term.passedCount += 1;
    } else if (record.passFail) {
      term.failedCount += 1;
    }

    const point = gradePoint(record.grade);
    if (point !== undefined) {
      pointTotal += point * credits;
      gradedCredits += credits;
      term.gradedCredits += credits;
      term.points += point * credits;
      const normalized = normalizeGrade(record.grade);
      const current = distributionMap.get(normalized) ?? { grade: normalized, count: 0, credits: 0 };
      current.count += 1;
      current.credits += credits;
      distributionMap.set(normalized, current);
    }
    termMap.set(key, term);
  });

  const failedRecords = records.filter((record) => !record.passed && Boolean(record.passFail));
  return {
    gpa: safeGpa(pointTotal, gradedCredits),
    gradedCredits,
    earnedCredits,
    attemptedCredits,
    passedCount,
    failedCount,
    distribution: Array.from(distributionMap.values()).sort((a, b) => (gradePoints[b.grade] ?? -1) - (gradePoints[a.grade] ?? -1) || a.grade.localeCompare(b.grade, "ja")),
    terms: Array.from(termMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, "ja"))
      .map(([key, term]) => ({
        key,
        label: term.label,
        credits: term.credits,
        gradedCredits: term.gradedCredits,
        gpa: safeGpa(term.points, term.gradedCredits),
        passedCount: term.passedCount,
        failedCount: term.failedCount,
      })),
    failedRecords,
    retakeCandidates: failedRecords.filter((record) => record.credits > 0),
  };
};
