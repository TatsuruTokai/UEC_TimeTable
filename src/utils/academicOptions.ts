import type { RequirementSourceRow, UserSettings } from "../types";

export const GRADE_OPTIONS = ["1年", "2年", "3年", "4年"] as const;

export const gradeNumber = (gradeYear: string) => Number.parseInt(gradeYear, 10) || 0;

export const requiresProgram = (gradeYear: string) => gradeNumber(gradeYear) >= 3;

export const buildAcademicOptions = (requirements: RequirementSourceRow[]) => {
  const years = Array.from(new Set(requirements.map((row) => row.admission_year))).sort((a, b) => b - a);
  const clusters = Array.from(new Set(requirements.map((row) => row.cluster))).sort((a, b) => a.localeCompare(b, "ja"));
  const programsByCluster = requirements.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.cluster] = acc[row.cluster] ?? [];
    if (!acc[row.cluster].includes(row.course)) acc[row.cluster].push(row.course);
    return acc;
  }, {});
  Object.keys(programsByCluster).forEach((cluster) => programsByCluster[cluster].sort((a, b) => a.localeCompare(b, "ja")));
  const clusterByProgram = Object.entries(programsByCluster).reduce<Record<string, string>>((acc, [cluster, programs]) => {
    programs.forEach((program) => {
      acc[program] = cluster;
    });
    return acc;
  }, {});
  const programs = Array.from(new Set(Object.values(programsByCluster).flat())).sort((a, b) => a.localeCompare(b, "ja"));
  return { years, clusters, programsByCluster, clusterByProgram, programs };
};

export const normalizeAcademicSettings = (
  settings: UserSettings,
  options: ReturnType<typeof buildAcademicOptions>,
  patch: Partial<UserSettings>,
): UserSettings => {
  const next: UserSettings = {
    ...settings,
    faculty: "情報理工学域",
    ...patch,
  };

  if (patch.cluster !== undefined && patch.cluster !== settings.cluster) {
    const allowed = options.programsByCluster[patch.cluster] ?? [];
    if (allowed.length > 0 && next.program && !allowed.includes(next.program)) next.program = "";
  }

  if (patch.program) {
    const cluster = options.clusterByProgram[patch.program];
    if (cluster) next.cluster = cluster;
  }

  if (!requiresProgram(next.gradeYear) && !next.program) {
    return next;
  }

  return next;
};

export const academicSettingsComplete = (settings: UserSettings) =>
  Boolean(settings.admissionYear && settings.gradeYear && settings.cluster && (!requiresProgram(settings.gradeYear) || settings.program));
