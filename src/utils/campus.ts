import { DAYS, PERIOD_TIMES } from "../data/defaultData";
import type { Classroom, Course, DayOfWeek } from "../types";
import { courseEndTime, coursePeriodEnd } from "./timetable";

export type MovementWarning = {
  day: DayOfWeek;
  from: Course;
  to: Course;
  fromBuilding: string;
  toBuilding: string;
  gapMinutes: number;
  severity: "notice" | "warning" | "critical";
  mapUrl: string;
};

const areaFromBuilding = (buildingName?: string) => {
  if (!buildingName) return "other";
  if (buildingName.includes("西")) return "west";
  if (buildingName.includes("東")) return "east";
  return "other";
};

const minutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

export const campusMapUrl = (buildingName?: string, fallback?: string) => {
  if (fallback) return fallback;
  const query = encodeURIComponent(["電気通信大学", buildingName].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

export const classroomLabel = (course: Course, classrooms: Classroom[]) => {
  const room = course.classroomId ? classrooms.find((item) => item.id === course.classroomId) : undefined;
  return [room?.buildingName ?? course.buildingName, room?.name].filter(Boolean).join(" ") || "教室未設定";
};

export const getMovementWarnings = (courses: Course[], classrooms: Classroom[]): MovementWarning[] => {
  const roomById = new Map(classrooms.map((room) => [room.id, room]));
  return DAYS.flatMap((day) => {
    const items = courses
      .filter((course) => course.dayOfWeek === day.id && (course.status === "taking" || course.status === "planned" || course.status === "retake"))
      .sort((a, b) => a.period - b.period);
    return items.slice(0, -1).flatMap((course, index) => {
      const next = items[index + 1];
      if (!next || next.period - coursePeriodEnd(course) > 1) return [];
      const fromRoom = course.classroomId ? roomById.get(course.classroomId) : undefined;
      const toRoom = next.classroomId ? roomById.get(next.classroomId) : undefined;
      const fromBuilding = fromRoom?.buildingName ?? course.buildingName ?? "";
      const toBuilding = toRoom?.buildingName ?? next.buildingName ?? "";
      if (!fromBuilding || !toBuilding || fromBuilding === toBuilding) return [];
      const endTime = courseEndTime(course) || PERIOD_TIMES[coursePeriodEnd(course)]?.end;
      const nextStart = next.startTime || PERIOD_TIMES[next.period]?.start;
      const gapMinutes = endTime && nextStart ? minutes(nextStart) - minutes(endTime) : 0;
      const crossArea = areaFromBuilding(fromBuilding) !== areaFromBuilding(toBuilding);
      const severity = crossArea && gapMinutes <= 10 ? "critical" : gapMinutes <= 10 ? "warning" : "notice";
      return [{
        day: day.id,
        from: course,
        to: next,
        fromBuilding,
        toBuilding,
        gapMinutes,
        severity,
        mapUrl: campusMapUrl(`${fromBuilding} ${toBuilding}`),
      }];
    });
  });
};
