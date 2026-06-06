import { DAYS, PERIODS } from "../data/defaultData";
import type { AppState, Course, DayOfWeek, FriendSchedule, SharedCourse } from "../types";
import { courseOccupiesPeriod, coursePeriodEnd, normalizeSubjectForTimetable } from "./timetable";

export type SharePayload = {
  version: 1;
  id: string;
  ownerName: string;
  exportedAt: string;
  courses: SharedCourse[];
};

export type ScheduleComparison = {
  commonFreePeriods: { day: DayOfWeek; period: number }[];
  sameCourses: { mine: Course; friend: SharedCourse }[];
  friendOnlyCourses: SharedCourse[];
};

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const textToBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const base64UrlToText = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
};

const toSharedCourse = (course: Course): SharedCourse => ({
  id: course.id,
  name: course.name,
  dayOfWeek: course.dayOfWeek,
  period: course.period,
  periodEnd: course.periodEnd,
  semester: course.semester,
  buildingName: course.buildingName,
  status: course.status,
});

export const buildSharePayload = (state: AppState, ownerName = "UECユーザー"): SharePayload => ({
  version: 1,
  id: createId("share"),
  ownerName: ownerName.trim() || "UECユーザー",
  exportedAt: new Date().toISOString(),
  courses: state.courses
    .filter((course) => course.status === "taking" || course.status === "planned" || course.status === "retake")
    .map(toSharedCourse),
});

export const encodeSharePayload = (payload: SharePayload) => textToBase64Url(JSON.stringify(payload));

export const decodeSharePayload = (encoded: string): SharePayload | undefined => {
  try {
    const parsed = JSON.parse(base64UrlToText(encoded)) as Partial<SharePayload>;
    if (parsed.version !== 1 || !Array.isArray(parsed.courses)) return undefined;
    return {
      version: 1,
      id: String(parsed.id || createId("share")),
      ownerName: String(parsed.ownerName || "UECユーザー"),
      exportedAt: String(parsed.exportedAt || new Date().toISOString()),
      courses: parsed.courses.flatMap((course) => {
        if (!course || typeof course !== "object") return [];
        const row = course as Partial<SharedCourse>;
        if (!row.name || !row.dayOfWeek || !row.period || !row.semester || !row.status) return [];
        return [{
          id: String(row.id || createId("friend-course")),
          name: String(row.name),
          dayOfWeek: row.dayOfWeek,
          period: Number(row.period),
          periodEnd: row.periodEnd ? Number(row.periodEnd) : undefined,
          semester: row.semester,
          buildingName: row.buildingName,
          classroomName: row.classroomName,
          status: row.status,
        }];
      }),
    };
  } catch {
    return undefined;
  }
};

export const payloadToFriendSchedule = (payload: SharePayload): FriendSchedule => ({
  id: payload.id,
  ownerName: payload.ownerName,
  exportedAt: payload.exportedAt,
  courses: payload.courses,
});

export const buildShareUrl = (payload: SharePayload) => {
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${base}#share=${encodeSharePayload(payload)}`;
};

const courseOccupiesShared = (course: SharedCourse, period: number) => period >= course.period && period <= coursePeriodEnd(course);

export const compareSchedules = (mine: Course[], friend: FriendSchedule): ScheduleComparison => {
  const activeMine = mine.filter((course) => course.status === "taking" || course.status === "planned" || course.status === "retake");
  const commonFreePeriods = DAYS.flatMap((day) =>
    PERIODS.flatMap((period) => {
      const mineBusy = activeMine.some((course) => course.dayOfWeek === day.id && courseOccupiesPeriod(course, period));
      const friendBusy = friend.courses.some((course) => course.dayOfWeek === day.id && courseOccupiesShared(course, period));
      return mineBusy || friendBusy ? [] : [{ day: day.id, period }];
    }),
  );
  const sameCourses = activeMine.flatMap((mineCourse) => {
    const friendCourse = friend.courses.find((course) => normalizeSubjectForTimetable(course.name) === normalizeSubjectForTimetable(mineCourse.name));
    return friendCourse ? [{ mine: mineCourse, friend: friendCourse }] : [];
  });
  const sameCourseNames = new Set(sameCourses.map((item) => normalizeSubjectForTimetable(item.friend.name)));
  return {
    commonFreePeriods,
    sameCourses,
    friendOnlyCourses: friend.courses.filter((course) => !sameCourseNames.has(normalizeSubjectForTimetable(course.name))),
  };
};
