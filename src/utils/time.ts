import { DAYS, PERIOD_TIMES } from "../data/defaultData";
import type { Course, DayOfWeek } from "../types";
import { courseEndTime, courseOccupiesPeriod, coursePeriodEnd, courseStartTime } from "./timetable";

const jsDayToAppDay: Record<number, DayOfWeek | undefined> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const todayDayId = (date = new Date()): DayOfWeek | undefined => jsDayToAppDay[date.getDay()];

export const dayLabel = (day: DayOfWeek) => DAYS.find((item) => item.id === day)?.shortLabel ?? day;

const hasSupportedPeriod = (course: Course) => Boolean(PERIOD_TIMES[course.period]);

export const currentPeriod = (date = new Date()): number | undefined => {
  const now = date.getHours() * 60 + date.getMinutes();
  return Object.entries(PERIOD_TIMES).find(([, slot]) => now >= minutes(slot.start) - 10 && now <= minutes(slot.end) + 10)?.[0]
    ? Number(Object.entries(PERIOD_TIMES).find(([, slot]) => now >= minutes(slot.start) - 10 && now <= minutes(slot.end) + 10)?.[0])
    : undefined;
};

export const getCourseStartDate = (course: Course, date = new Date()): Date => {
  const currentDay = todayDayId(date);
  const dayIndex = DAYS.findIndex((item) => item.id === course.dayOfWeek);
  const currentIndex = currentDay ? DAYS.findIndex((item) => item.id === currentDay) : 0;
  const result = new Date(date);
  let offset = dayIndex - currentIndex;
  const startMinutes = minutes(courseStartTime(course) || PERIOD_TIMES[1].start);
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  if (offset < 0 || (offset === 0 && nowMinutes > startMinutes)) offset += 7;
  result.setDate(date.getDate() + offset);
  const [hour, minute] = (courseStartTime(course) || PERIOD_TIMES[1].start).split(":").map(Number);
  result.setHours(hour, minute, 0, 0);
  return result;
};

export const getTodaysCourses = (courses: Course[], date = new Date()) => {
  const today = todayDayId(date);
  return courses
    .filter((course) => course.dayOfWeek === today && hasSupportedPeriod(course) && course.status !== "earned" && course.status !== "failed")
    .sort((a, b) => a.period - b.period);
};

export const getNextCourse = (courses: Course[], date = new Date()) => {
  const activeCourses = courses.filter((course) => hasSupportedPeriod(course) && (course.status === "taking" || course.status === "planned" || course.status === "retake"));
  return activeCourses
    .map((course) => ({ course, start: getCourseStartDate(course, date) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
};

export const formatRelativeTime = (target: Date, base = new Date()) => {
  const diff = target.getTime() - base.getTime();
  if (diff <= 0) return "開始済み";
  const minutesLeft = Math.round(diff / 60000);
  if (minutesLeft < 60) return `${minutesLeft}分後`;
  const hours = Math.floor(minutesLeft / 60);
  const minutesRest = minutesLeft % 60;
  if (hours < 24) return `${hours}時間${minutesRest ? `${minutesRest}分` : ""}後`;
  return `${Math.ceil(hours / 24)}日以内`;
};

export const getFreePeriods = (courses: Course[], date = new Date()) => {
  const todays = getTodaysCourses(courses, date);
  const occupied = new Set(todays.flatMap((course) => Object.keys(PERIOD_TIMES).map(Number).filter((period) => courseOccupiesPeriod(course, period))));
  return Object.keys(PERIOD_TIMES)
    .map(Number)
    .filter((period) => !occupied.has(period));
};

export const getCourseEndDate = (course: Course, date = new Date()): Date => {
  const start = getCourseStartDate(course, date);
  const end = new Date(start);
  const endTime = courseEndTime(course) || PERIOD_TIMES[coursePeriodEnd(course)]?.end || PERIOD_TIMES[course.period]?.end;
  const [hour, minute] = endTime.split(":").map(Number);
  end.setHours(hour, minute, 0, 0);
  return end;
};
