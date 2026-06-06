import type { AppState, Assignment, Classroom, Course, CourseCategory, DayOfWeek, NotificationSettings, Semester } from "../types";

export const DAYS: { id: DayOfWeek; label: string; shortLabel: string }[] = [
  { id: "mon", label: "月曜日", shortLabel: "月" },
  { id: "tue", label: "火曜日", shortLabel: "火" },
  { id: "wed", label: "水曜日", shortLabel: "水" },
  { id: "thu", label: "木曜日", shortLabel: "木" },
  { id: "fri", label: "金曜日", shortLabel: "金" },
  { id: "sat", label: "土曜日", shortLabel: "土" },
];

export const PERIODS = [1, 2, 3, 4, 5];

export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "09:00", end: "10:30" },
  2: { start: "10:40", end: "12:10" },
  3: { start: "13:00", end: "14:30" },
  4: { start: "14:40", end: "16:10" },
  5: { start: "16:15", end: "17:45" },
};

export const COURSE_CATEGORIES: CourseCategory[] = [
  "必修",
  "選択必修",
  "選択",
  "自由科目",
  "教養科目",
  "専門科目",
  "実験・演習",
  "英語・第二外国語",
  "技術英語科目",
];

export const SEMESTERS: { id: Semester; label: string }[] = [
  { id: "first", label: "前学期" },
  { id: "second", label: "後学期" },
  { id: "intensive", label: "集中" },
  { id: "full-year", label: "通年" },
];

export const STATUS_LABELS: Record<Course["status"], string> = {
  planned: "履修予定",
  taking: "履修中",
  earned: "単位取得済み",
  failed: "落単",
  retake: "再履修予定",
};

export const CATEGORY_COLORS: Record<string, string> = {
  必修: "#0b63ce",
  選択必修: "#008c95",
  選択: "#4f46e5",
  自由科目: "#64748b",
  教養科目: "#16803c",
  専門科目: "#b45309",
  "実験・演習": "#be123c",
  "英語・第二外国語": "#7c3aed",
  技術英語科目: "#0f766e",
};

export const defaultClassrooms: Classroom[] = [
  {
    id: "room-east-b-201",
    name: "B201",
    buildingName: "東B棟",
    buildingNumber: "東B",
    area: "east",
    floor: "2F",
    memo: "情報理工学域の講義でよく使う教室",
    favorite: true,
  },
  {
    id: "room-east-c-301",
    name: "C301",
    buildingName: "東C棟",
    buildingNumber: "東C",
    area: "east",
    floor: "3F",
    favorite: true,
  },
  {
    id: "room-east-6-337",
    name: "337教室",
    buildingName: "東6号館",
    buildingNumber: "東6",
    area: "east",
    floor: "3F",
  },
  {
    id: "room-west-2-101",
    name: "101教室",
    buildingName: "西2号館",
    buildingNumber: "西2",
    area: "west",
    floor: "1F",
  },
  {
    id: "room-library",
    name: "図書館",
    buildingName: "東3号館",
    buildingNumber: "東3",
    area: "east",
    memo: "自習・空きコマ用",
  },
];

export const defaultCourses: Course[] = [
  {
    id: "course-sample-analysis",
    name: "解析学",
    instructor: "サンプル教員",
    dayOfWeek: "mon",
    period: 2,
    semester: "first",
    credits: 2,
    category: "必修",
    classroomId: "room-east-b-201",
    buildingName: "東B棟",
    syllabusUrl: "https://kyoumu.office.uec.ac.jp/syllabus/",
    relatedUrl: "",
    memo: "中間試験の範囲を確認する",
    color: CATEGORY_COLORS["必修"],
    status: "taking",
  },
  {
    id: "course-sample-programming",
    name: "基礎プログラミングおよび演習",
    instructor: "サンプル教員",
    dayOfWeek: "tue",
    period: 3,
    semester: "first",
    credits: 2,
    category: "実験・演習",
    classroomId: "room-east-c-301",
    buildingName: "東C棟",
    syllabusUrl: "https://kyoumu.office.uec.ac.jp/syllabus/",
    memo: "演習ファイルを前日までに確認",
    color: CATEGORY_COLORS["実験・演習"],
    status: "taking",
  },
  {
    id: "course-sample-english",
    name: "Academic Written English Ⅱ",
    instructor: "サンプル教員",
    dayOfWeek: "wed",
    period: 1,
    semester: "first",
    credits: 1,
    category: "英語・第二外国語",
    classroomId: "room-west-2-101",
    buildingName: "西2号館",
    relatedUrl: "https://classroom.google.com/",
    color: CATEGORY_COLORS["英語・第二外国語"],
    status: "taking",
  },
  {
    id: "course-sample-chem",
    name: "化学生命工学実験",
    instructor: "サンプル教員",
    dayOfWeek: "thu",
    period: 4,
    semester: "first",
    credits: 2,
    category: "専門科目",
    classroomId: "room-east-6-337",
    buildingName: "東6号館",
    memo: "白衣・保護メガネ",
    color: CATEGORY_COLORS["専門科目"],
    status: "planned",
  },
  {
    id: "course-sample-seminar",
    name: "キャリア教育基礎",
    instructor: "サンプル教員",
    dayOfWeek: "fri",
    period: 5,
    semester: "first",
    credits: 2,
    category: "教養科目",
    classroomId: "room-east-b-201",
    buildingName: "東B棟",
    color: CATEGORY_COLORS["教養科目"],
    status: "planned",
  },
];

export const defaultAssignments: Assignment[] = [
  {
    id: "assignment-sample-1",
    courseId: "course-sample-programming",
    title: "第3回 演習課題",
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
    type: "report",
    url: "https://classroom.google.com/",
    memo: "提出前に動作確認",
    completed: false,
  },
  {
    id: "assignment-sample-2",
    courseId: "course-sample-analysis",
    title: "小テスト範囲確認",
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString().slice(0, 10),
    type: "quiz",
    completed: false,
  },
];

export const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  defaultReminderDays: 1,
  defaultReminderTime: "09:00",
  courseReminderMinutes: 15,
};

export const createDefaultState = (): AppState => ({
  version: 2,
  settings: {
    admissionYear: 0,
    faculty: "情報理工学域",
    cluster: "",
    program: "",
    gradeYear: "",
    theme: "system",
    initialSetupCompleted: false,
  },
  courses: [],
  classrooms: defaultClassrooms,
  assignments: [],
  friendSchedules: [],
  notificationSettings: defaultNotificationSettings,
});
