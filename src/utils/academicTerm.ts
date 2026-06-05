import type { Semester } from "../types";

export type CurrentAcademicTerm = {
  semester: Extract<Semester, "first" | "second">;
  label: string;
  inClassTerm: boolean;
  note?: string;
};

export const inferCurrentAcademicTerm = (date = new Date()): CurrentAcademicTerm => {
  const month = date.getMonth() + 1;
  if (month >= 4 && month <= 8) {
    return { semester: "first", label: "前学期", inClassTerm: true };
  }
  if (month >= 10 || month <= 2) {
    return { semester: "second", label: "後学期", inClassTerm: true };
  }
  if (month === 9) {
    return { semester: "second", label: "後学期", inClassTerm: false, note: "9月は授業期間外のため、後学期候補を表示しています。" };
  }
  return { semester: "first", label: "前学期", inClassTerm: false, note: "3月は授業期間外のため、前学期候補を表示しています。" };
};

export const semesterLabel = (semester: Semester) => {
  if (semester === "first") return "前学期";
  if (semester === "second") return "後学期";
  if (semester === "full-year") return "通年";
  return "集中";
};
