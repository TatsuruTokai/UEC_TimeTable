import { DAYS } from "../data/defaultData";
import type { AppState, Assignment, Course, Semester } from "../types";
import { courseEndTime, courseStartTime } from "./timetable";

const dayToNumber = new Map(DAYS.map((day, index) => [day.id, index + 1]));

const pad = (value: number) => String(value).padStart(2, "0");

const toDateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toIcsDate = (date: Date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;

const toIcsDateTime = (date: Date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

const toGoogleDateTime = (date: Date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;

const parseLocalDateTime = (date: string, time = "00:00") => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const escapeText = (value: string | undefined) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

export const currentAcademicYear = (date = new Date()) => {
  const month = date.getMonth() + 1;
  return month <= 3 ? date.getFullYear() - 1 : date.getFullYear();
};

export const termRangeForSemester = (semester: Semester, academicYear = currentAcademicYear()) => {
  if (semester === "second") return { start: `${academicYear}-10-01`, end: `${academicYear + 1}-02-15` };
  if (semester === "full-year") return { start: `${academicYear}-04-01`, end: `${academicYear + 1}-02-15` };
  if (semester === "intensive") return { start: `${academicYear}-08-01`, end: `${academicYear}-09-30` };
  return { start: `${academicYear}-04-01`, end: `${academicYear}-08-05` };
};

const firstClassDate = (course: Course, academicYear: number) => {
  const range = termRangeForSemester(course.semester, academicYear);
  const start = parseLocalDateTime(range.start, courseStartTime(course));
  const targetDay = dayToNumber.get(course.dayOfWeek) ?? 1;
  const startDay = start.getDay() === 0 ? 7 : start.getDay();
  const offset = (targetDay - startDay + 7) % 7;
  return addDays(start, offset);
};

const eventEndDate = (start: Date, time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  const end = new Date(start);
  end.setHours(hour, minute, 0, 0);
  return end;
};

const dtStamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const courseToIcsEvent = (course: Course, academicYear: number) => {
  const start = firstClassDate(course, academicYear);
  const end = eventEndDate(start, courseEndTime(course));
  const termEnd = parseLocalDateTime(termRangeForSemester(course.semester, academicYear).end, "23:59");
  const untilUtc = new Date(termEnd.getTime() - 9 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const location = [course.buildingName, course.classroomId].filter(Boolean).join(" ");
  return [
    "BEGIN:VEVENT",
    `UID:${escapeText(course.id)}@uec-timetable`,
    `DTSTAMP:${dtStamp()}`,
    `SUMMARY:${escapeText(course.name)}`,
    `DTSTART;TZID=Asia/Tokyo:${toIcsDateTime(start)}`,
    `DTEND;TZID=Asia/Tokyo:${toIcsDateTime(end)}`,
    `RRULE:FREQ=WEEKLY;UNTIL=${untilUtc}`,
    location ? `LOCATION:${escapeText(location)}` : "",
    course.syllabusUrl ? `URL:${escapeText(course.syllabusUrl)}` : "",
    `DESCRIPTION:${escapeText([course.instructor, course.memo, course.relatedUrl].filter(Boolean).join("\n"))}`,
    "END:VEVENT",
  ].filter(Boolean);
};

const assignmentToIcsEvent = (assignment: Assignment, course: Course | undefined) => {
  if (!assignment.dueDate) return [];
  const start = parseLocalDateTime(assignment.dueDate);
  const end = addDays(start, 1);
  const courseName = course?.name ? ` / ${course.name}` : "";
  return [
    "BEGIN:VEVENT",
    `UID:${escapeText(assignment.id)}@uec-timetable`,
    `DTSTAMP:${dtStamp()}`,
    `SUMMARY:${escapeText(`${assignment.title}${courseName}`)}`,
    `DTSTART;VALUE=DATE:${toIcsDate(start)}`,
    `DTEND;VALUE=DATE:${toIcsDate(end)}`,
    course?.buildingName ? `LOCATION:${escapeText(course.buildingName)}` : "",
    assignment.url ? `URL:${escapeText(assignment.url)}` : "",
    `DESCRIPTION:${escapeText([course?.name, assignment.memo, assignment.url].filter(Boolean).join("\n"))}`,
    "END:VEVENT",
  ].filter(Boolean);
};

export const createIcsCalendar = (state: AppState, academicYear = currentAcademicYear()) => {
  const activeCourses = state.courses.filter((course) => course.status === "taking" || course.status === "planned" || course.status === "retake");
  const courseById = new Map(state.courses.map((course) => [course.id, course]));
  const events = [
    ...activeCourses.flatMap((course) => courseToIcsEvent(course, academicYear)),
    ...state.assignments.flatMap((assignment) => assignmentToIcsEvent(assignment, courseById.get(assignment.courseId))),
  ];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UEC TimeTable//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:UEC TimeTable",
    "X-WR-TIMEZONE:Asia/Tokyo",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
};

export const downloadIcs = (filename: string, state: AppState, academicYear = currentAcademicYear()) => {
  const blob = new Blob([createIcsCalendar(state, academicYear)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const googleCalendarUrlForAssignment = (assignment: Assignment, course?: Course) => {
  if (!assignment.dueDate) return "";
  const start = parseLocalDateTime(assignment.dueDate);
  const end = addDays(start, 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${assignment.title}${course ? ` / ${course.name}` : ""}`,
    dates: `${toIcsDate(start)}/${toIcsDate(end)}`,
    details: [course?.name, assignment.memo, assignment.url].filter(Boolean).join("\n"),
    location: course?.buildingName ?? "",
    ctz: "Asia/Tokyo",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const googleCalendarUrlForCourse = (course: Course, academicYear = currentAcademicYear()) => {
  const start = firstClassDate(course, academicYear);
  const end = eventEndDate(start, courseEndTime(course));
  const termEnd = parseLocalDateTime(termRangeForSemester(course.semester, academicYear).end, "23:59");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: course.name,
    dates: `${toGoogleDateTime(start)}/${toGoogleDateTime(end)}`,
    recur: `RRULE:FREQ=WEEKLY;UNTIL=${toGoogleDateTime(termEnd)}`,
    details: [course.instructor, course.memo, course.relatedUrl].filter(Boolean).join("\n"),
    location: course.buildingName ?? "",
    ctz: "Asia/Tokyo",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const calendarFileName = (date = new Date()) => `uec-timetable-${toDateInput(date)}.ics`;
