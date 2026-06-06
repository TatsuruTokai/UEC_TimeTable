import { PERIOD_TIMES } from "../data/defaultData";
import type { CatalogSubject, Course, Semester, TimetableEntry } from "../types";

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/（仮）/g, "")
    .replace(/実験Bl/g, "実験B1")
    .toLowerCase();

export const normalizeSubjectForTimetable = (value: string) => normalize(value.replace(/※注\d+/g, ""));

export const coursePeriodEnd = (course: Pick<Course, "period" | "periodEnd">) => Math.max(course.period, course.periodEnd ?? course.period);

export const coursePeriodSpan = (course: Pick<Course, "period" | "periodEnd">) => Math.max(1, coursePeriodEnd(course) - course.period + 1);

export const courseStartTime = (course: Pick<Course, "period" | "startTime">) => course.startTime || PERIOD_TIMES[course.period]?.start || "";

export const courseEndTime = (course: Pick<Course, "period" | "periodEnd" | "endTime">) =>
  course.endTime || PERIOD_TIMES[coursePeriodEnd(course)]?.end || PERIOD_TIMES[course.period]?.end || "";

export const courseTimeLabel = (course: Pick<Course, "period" | "periodEnd" | "startTime" | "endTime">) => {
  const periodEnd = coursePeriodEnd(course);
  const periodLabel = periodEnd === course.period ? `${course.period}限` : `${course.period}-${periodEnd}限`;
  const start = courseStartTime(course);
  const end = courseEndTime(course);
  return start && end ? `${periodLabel} ${start}-${end}` : periodLabel;
};

export const courseOccupiesPeriod = (course: Pick<Course, "period" | "periodEnd">, period: number) =>
  period >= course.period && period <= coursePeriodEnd(course);

export const timetableEntryTimeLabel = (entry: Pick<TimetableEntry, "period" | "periodEnd" | "startTime" | "endTime">) =>
  courseTimeLabel({ period: entry.period, periodEnd: entry.periodEnd, startTime: entry.startTime, endTime: entry.endTime });

const timetableSubjectMatchScore = (entrySubject: string, subject: string) => {
  const entryNorm = normalizeSubjectForTimetable(entrySubject);
  const subjectNorm = normalizeSubjectForTimetable(subject);
  if (!entryNorm || !subjectNorm) return 0;
  if (entryNorm === subjectNorm) return 100;
  if (subjectNorm === `${entryNorm}および演習`) return 80;
  if (entryNorm === `${subjectNorm}・b2` || entryNorm === `${subjectNorm}･b2`) return 70;
  if (entryNorm === subjectNorm.replace(/b2$/, "b1・b2") || entryNorm === subjectNorm.replace(/b2$/, "b1･b2")) return 70;
  return 0;
};

export const timetableEntryMatchesSubject = (entry: TimetableEntry, subject: string) => timetableSubjectMatchScore(entry.subject, subject) > 0;

export const findBestTimetableEntryForSubject = (
  entries: TimetableEntry[],
  subject: string,
  grade?: number,
  semester?: Extract<Semester, "first" | "second">,
) =>
  entries
    .map((entry) => ({ entry, score: timetableSubjectMatchScore(entry.subject, subject) }))
    .filter(({ entry, score }) => score > 0 && (!grade || entry.grade === grade) && (!semester || entry.semester === semester))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.dayOfWeek.localeCompare(b.entry.dayOfWeek) ||
        a.entry.period - b.entry.period ||
        a.entry.sourcePdf.localeCompare(b.entry.sourcePdf),
    )[0]?.entry;

export const findTimetableEntriesForSubject = (
  entries: TimetableEntry[],
  subject: string,
  grade?: number,
  semester?: Extract<Semester, "first" | "second">,
) =>
  entries
    .map((entry) => ({ entry, score: timetableSubjectMatchScore(entry.subject, subject) }))
    .filter(({ entry, score }) => score > 0 && (!grade || entry.grade === grade) && (!semester || entry.semester === semester))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.dayOfWeek.localeCompare(b.entry.dayOfWeek) ||
        a.entry.period - b.entry.period ||
        a.entry.sourcePdf.localeCompare(b.entry.sourcePdf),
    )
    .map(({ entry }) => entry);

export const subjectOfferedInSemester = (
  subject: CatalogSubject,
  grade: number,
  semester: Extract<Semester, "first" | "second">,
  entries: TimetableEntry[],
) => {
  if (findTimetableEntriesForSubject(entries, subject.subject, grade, semester).length) return true;
  if (subject.eligible_years?.length && !subject.eligible_years.includes(grade)) return false;
  if (!subject.semester_hours?.length) return true;
  const oddSemester = semester === "first";
  return subject.semester_hours.some((item) => item.year === grade && (item.semester % 2 === 1) === oddSemester);
};
