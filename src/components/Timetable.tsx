import { AlertTriangle, CalendarDays, ExternalLink, ListPlus, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_COLORS, DAYS, PERIODS, PERIOD_TIMES, STATUS_LABELS } from "../data/defaultData";
import type { CatalogData } from "../data/catalog";
import type { AppState, CatalogSubject, Course, Semester, TimetableEntry } from "../types";
import { gradeNumber, GRADE_OPTIONS } from "../utils/academicOptions";
import { inferCurrentAcademicTerm, semesterLabel } from "../utils/academicTerm";
import type { CreditAudit } from "../utils/credits";
import { currentPeriod, todayDayId } from "../utils/time";
import {
  courseOccupiesPeriod,
  coursePeriodSpan,
  courseTimeLabel,
  normalizeSubjectForTimetable,
  subjectOfferedInSemester,
  timetableEntryTimeLabel,
} from "../utils/timetable";
import { Button, EmptyState, inputClass } from "./ui";

const useCollisionMap = (courses: Course[]) =>
  useMemo(() => {
    const map = new Map<string, Course[]>();
    courses.forEach((course) => {
      PERIODS.filter((period) => courseOccupiesPeriod(course, period)).forEach((period) => {
        const key = `${course.dayOfWeek}-${period}`;
        map.set(key, [...(map.get(key) ?? []), course]);
      });
    });
    return map;
  }, [courses]);

const dayOrder = new Map(DAYS.map((day, index) => [day.id, index]));

const CourseCard = ({
  course,
  classroomName,
  active,
  collision,
  onOpen,
}: {
  course: Course;
  classroomName?: string;
  active?: boolean;
  collision?: boolean;
  onOpen: () => void;
}) => (
  <button
    onClick={onOpen}
    className={`group grid w-full gap-2 rounded-md border p-2.5 text-left transition ${
      active
        ? "border-uec-400 bg-uec-50 shadow-sm dark:border-uec-500 dark:bg-uec-900/30"
        : "border-slate-200 bg-white hover:border-uec-300 hover:bg-uec-50/70 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-uec-700 dark:hover:bg-uec-900/20"
    }`}
    style={{ borderLeftColor: course.color ?? CATEGORY_COLORS[course.category] ?? "#0d7edb", borderLeftWidth: 5 }}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{course.name}</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{classroomName ?? course.buildingName ?? "教室未設定"}</div>
      </div>
      {collision ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : null}
    </div>
    <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{courseTimeLabel(course)}</span>
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{course.credits}単位</span>
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{course.category}</span>
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{STATUS_LABELS[course.status]}</span>
    </div>
  </button>
);

export const Timetable = ({
  state,
  catalog,
  audit,
  onAddCourse,
  onOpenCourse,
  onCreateFromSubject,
  onCreateFromTimetableEntry,
}: {
  state: AppState;
  catalog: CatalogData;
  audit: CreditAudit;
  onAddCourse: (day?: Course["dayOfWeek"], period?: number) => void;
  onOpenCourse: (courseId: string) => void;
  onCreateFromSubject: (subject: CatalogSubject, timetableEntry?: TimetableEntry) => void;
  onCreateFromTimetableEntry: (timetableEntry: TimetableEntry) => void;
}) => {
  const collisionMap = useCollisionMap(state.courses);
  const today = todayDayId();
  const nowPeriod = currentPeriod();
  const inferredTerm = useMemo(() => inferCurrentAcademicTerm(), []);
  const settingsGrade = gradeNumber(state.settings.gradeYear) || 1;
  const [targetGrade, setTargetGrade] = useState(settingsGrade);
  const [targetSemester, setTargetSemester] = useState<Extract<Semester, "first" | "second">>(inferredTerm.semester);
  const [search, setSearch] = useState("");
  const [creditFilter, setCreditFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    setTargetGrade(settingsGrade);
  }, [settingsGrade]);

  const earnedNames = useMemo(
    () => new Set((state.gradeImport?.records ?? []).filter((record) => record.passed).map((record) => normalizeSubjectForTimetable(record.subject))),
    [state.gradeImport?.records],
  );
  const registeredNames = useMemo(
    () =>
      new Set(
        state.courses
          .filter((course) => course.status === "taking" || course.status === "planned" || course.status === "retake" || course.status === "earned")
          .map((course) => normalizeSubjectForTimetable(course.name)),
      ),
    [state.courses],
  );
  const timetableEntries = useMemo(
    () =>
      catalog.timetableEntries
        .filter((entry) => entry.grade === targetGrade && entry.semester === targetSemester)
        .sort((a, b) => (dayOrder.get(a.dayOfWeek) ?? 0) - (dayOrder.get(b.dayOfWeek) ?? 0) || a.period - b.period || a.subject.localeCompare(b.subject, "ja")),
    [catalog.timetableEntries, targetGrade, targetSemester],
  );
  const firstEntryBySubject = useMemo(() => {
    const map = new Map<string, TimetableEntry>();
    timetableEntries.forEach((entry) => {
      const key = normalizeSubjectForTimetable(entry.subject);
      if (!map.has(key)) map.set(key, entry);
    });
    return map;
  }, [timetableEntries]);
  const subjects = [...catalog.subjects, ...(state.customSubjects ?? [])]
    .filter(
      (subject) =>
        subject.admission_year === state.settings.admissionYear &&
        subject.cluster === state.settings.cluster &&
        subject.course === state.settings.program &&
        !earnedNames.has(normalizeSubjectForTimetable(subject.subject)) &&
        subjectOfferedInSemester(subject, targetGrade, targetSemester, catalog.timetableEntries),
    )
    .filter((subject) => !search || `${subject.subject} ${subject.subject_code ?? ""} ${subject.category_path}`.toLowerCase().includes(search.toLowerCase()))
    .filter((subject) => !creditFilter || Number(subject.credits) === Number(creditFilter))
    .filter((subject) => !categoryFilter || subject.requirement_type === categoryFilter || subject.category_path.includes(categoryFilter))
    .slice(0, 40);
  const collisions = Array.from(collisionMap.values()).filter((items) => items.length > 1);
  const courseStartGroups = useMemo(() => {
    const groups = new Map<string, Course[]>();
    state.courses.forEach((course) => {
      const key = `${course.dayOfWeek}-${course.period}-${coursePeriodSpan(course)}`;
      groups.set(key, [...(groups.get(key) ?? []), course]);
    });
    return Array.from(groups.entries()).map(([key, courses]) => {
      const [day, period, span] = key.split("-");
      return { day: day as Course["dayOfWeek"], period: Number(period), span: Number(span), courses };
    });
  }, [state.courses]);

  const recommendations = useMemo(() => {
    const rows: {
      subject: string;
      reason: string;
      credits?: number;
      entry: TimetableEntry;
      priority: number;
    }[] = [];
    const push = (subject: string, reason: string, priority: number, credits?: number) => {
      const key = normalizeSubjectForTimetable(subject);
      if (earnedNames.has(key) || registeredNames.has(key)) return;
      const entry = firstEntryBySubject.get(key);
      if (!entry || rows.some((row) => normalizeSubjectForTimetable(row.subject) === key)) return;
      rows.push({ subject, reason, credits, entry, priority });
    };

    audit.missingRequired.forEach((subject) => push(subject.subject, "未取得必修", 0, Number(subject.credits) || undefined));
    audit.failedOrRetake.forEach((row) => push(row.subject, row.source === "csv" ? "落単・再履修候補" : "再履修予定", 1, row.credits));
    audit.candidateGroups.forEach((group) => {
      group.candidates.forEach((subject) => push(subject.subject, `${group.label}の不足対応`, subject.requirementType === "選択必修" ? 2 : 3, subject.credits));
    });

    return rows
      .sort((a, b) => a.priority - b.priority || (a.credits ?? 0) - (b.credits ?? 0) || a.subject.localeCompare(b.subject, "ja"))
      .slice(0, 10);
  }, [audit.candidateGroups, audit.failedOrRetake, audit.missingRequired, earnedNames, firstEntryBySubject, registeredNames]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_21rem]">
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">履修登録シミュレーター</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">次学期の履修案を組みながら、単位不足・必修未履修・時間割衝突を確認します。</p>
          </div>
          <Button variant="primary" onClick={() => onAddCourse()}>
            <Plus className="h-4 w-4" />
            授業追加
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className={`rounded-md p-3 text-sm ring-1 ${audit.shortageTotal ? "bg-rose-50 text-rose-900 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900" : "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900"}`}>
            <div className="font-semibold">単位不足</div>
            <div className="mt-1">取得済み基準 {audit.shortageTotal}単位 / 履修中込み {Math.max(audit.totalRequired - audit.forecastTotal, 0)}単位</div>
          </div>
          <div className={`rounded-md p-3 text-sm ring-1 ${audit.missingRequired.length ? "bg-amber-50 text-amber-900 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900" : "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900"}`}>
            <div className="font-semibold">必修未履修</div>
            <div className="mt-1">{audit.missingRequired.length ? `${audit.missingRequired.length}件` : "なし"}</div>
          </div>
          <div className={`rounded-md p-3 text-sm ring-1 ${collisions.length ? "bg-amber-50 text-amber-900 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900" : "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900"}`}>
            <div className="font-semibold">時間割衝突</div>
            <div className="mt-1">{collisions.length ? `${collisions.length}枠` : "なし"}</div>
          </div>
        </div>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-uec-600" />
              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">対象時間割</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {inferredTerm.inClassTerm ? `現在は${inferredTerm.label}として初期表示しています。` : inferredTerm.note}
                </p>
              </div>
            </div>
            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
              <select className={inputClass} value={targetGrade} onChange={(event) => setTargetGrade(Number(event.target.value))}>
                {GRADE_OPTIONS.map((grade) => (
                  <option key={grade} value={gradeNumber(grade)}>
                    {grade}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={targetSemester} onChange={(event) => setTargetSemester(event.target.value as Extract<Semester, "first" | "second">)}>
                <option value="first">前学期</option>
                <option value="second">後学期</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            今年の時間割候補 {timetableEntries.length}件 / 表示対象 {targetGrade}年 {semesterLabel(targetSemester)}
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-uec-600" />
              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">おすすめ構成</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">必要単位・未取得必修と今年の時間割を照合した候補です。</p>
              </div>
            </div>
            <div className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              最大 {recommendations.reduce((sum, item) => sum + (item.credits ?? 0), 0)}単位
            </div>
          </div>
          {recommendations.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {recommendations.map((item) => (
                <button
                  key={`${item.subject}-${item.entry.id}`}
                  onClick={() => onCreateFromTimetableEntry(item.entry)}
                  className="grid gap-2 rounded-md border border-slate-200 p-3 text-left transition hover:border-uec-300 hover:bg-uec-50 dark:border-slate-800 dark:hover:border-uec-700 dark:hover:bg-uec-900/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-950 dark:text-white">{item.subject}</div>
                    <Plus className="mt-0.5 h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.reason}</span>
                    {item.credits ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.credits}単位</span> : null}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {item.entry.dayLabel}{timetableEntryTimeLabel(item.entry)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="おすすめ候補がありません" body="不足区分に一致し、今年の対象時間割にある未登録科目が見つかりません。" />
          )}
        </section>

        {collisions.length ? (
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              時間割衝突があります
            </div>
            <div className="mt-1">
              {collisions.map((items) => `${DAYS.find((day) => day.id === items[0].dayOfWeek)?.shortLabel}${items[0].period}限: ${items.map((item) => item.name).join(" / ")}`).join("、")}
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div
            className="grid min-w-[920px]"
            style={{
              gridTemplateColumns: "6.5rem repeat(6, minmax(8.5rem, 1fr))",
              gridTemplateRows: "3.5rem repeat(5, 8.5rem)",
            }}
          >
            <div className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold text-slate-500 shadow-[6px_0_10px_-10px_rgba(15,23,42,0.65)] dark:border-slate-800 dark:bg-slate-900">
              時限
            </div>
            {DAYS.map((day, index) => (
              <div
                key={day.id}
                className={`border-b border-r border-slate-200 p-3 text-left text-sm font-semibold dark:border-slate-800 ${
                  today === day.id ? "bg-uec-50 text-uec-800 dark:bg-uec-950 dark:text-uec-100" : "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }`}
                style={{ gridColumn: index + 2, gridRow: 1 }}
              >
                {day.label}
              </div>
            ))}

            {PERIODS.map((period) => (
              <div
                key={`period-${period}`}
                className="sticky left-0 z-20 border-r border-t border-slate-200 bg-slate-50 p-3 text-left shadow-[6px_0_10px_-10px_rgba(15,23,42,0.65)] dark:border-slate-800 dark:bg-slate-900"
                style={{ gridColumn: 1, gridRow: period + 1 }}
              >
                <div className="font-semibold">{period}限</div>
                <div className="mt-1 whitespace-nowrap text-xs font-normal text-slate-500">
                  {PERIOD_TIMES[period]?.start}-{PERIOD_TIMES[period]?.end}
                </div>
              </div>
            ))}

            {PERIODS.flatMap((period) =>
              DAYS.map((day, dayIndex) => {
                const items = collisionMap.get(`${day.id}-${period}`) ?? [];
                const isActive = today === day.id && nowPeriod === period;
                return (
                  <div
                    key={`${day.id}-${period}`}
                    className={`border-r border-t border-slate-200 p-2 dark:border-slate-800 ${
                      isActive ? "bg-uec-50/80 dark:bg-uec-950/50" : "bg-white dark:bg-slate-950"
                    }`}
                    style={{ gridColumn: dayIndex + 2, gridRow: period + 1 }}
                  >
                    {items.length ? null : (
                      <button
                        onClick={() => onAddCourse(day.id, period)}
                        className="grid h-full w-full place-items-center rounded-md border border-dashed border-slate-200 text-xs font-semibold text-slate-400 transition hover:border-uec-300 hover:text-uec-600 dark:border-slate-800 dark:hover:border-uec-700"
                      >
                        空きコマ
                      </button>
                    )}
                  </div>
                );
              }),
            )}

            {courseStartGroups.map((group) => {
              const dayIndex = DAYS.findIndex((day) => day.id === group.day);
              const isActive = today === group.day && group.courses.some((course) => nowPeriod !== undefined && courseOccupiesPeriod(course, nowPeriod));
              return (
                <div
                  key={`${group.day}-${group.period}-${group.span}`}
                  className="z-10 grid min-h-0 gap-2 overflow-y-auto p-2"
                  style={{ gridColumn: dayIndex + 2, gridRow: `${group.period + 1} / span ${group.span}` }}
                >
                  {group.courses.map((course) => {
                    const hasCollision = PERIODS.some((period) => courseOccupiesPeriod(course, period) && (collisionMap.get(`${course.dayOfWeek}-${period}`)?.length ?? 0) > 1);
                    return (
                      <CourseCard
                        key={course.id}
                        course={course}
                        active={isActive}
                        collision={hasCollision}
                        classroomName={state.classrooms.find((room) => room.id === course.classroomId)?.name}
                        onOpen={() => onOpenCourse(course.id)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

      </section>

      <aside className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-32 xl:self-start">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-5 w-5 text-uec-600" />
          <h2 className="text-lg font-semibold">科目検索</h2>
        </div>
        <div className="grid gap-3">
          <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="科目名・コード" />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} type="number" min="0" step="0.5" value={creditFilter} onChange={(event) => setCreditFilter(event.target.value)} placeholder="単位数" />
            <select className={inputClass} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">区分すべて</option>
              <option value="必修">必修</option>
              <option value="選択必修">選択必修</option>
              <option value="総 合 文 化">教養</option>
              <option value="専門">専門</option>
            </select>
          </div>
          <div className="max-h-[34rem] overflow-y-auto">
            {subjects.length ? (
              <div className="grid gap-2">
                {subjects.map((subject) => {
                  const entry = firstEntryBySubject.get(normalizeSubjectForTimetable(subject.subject));
                  return (
                    <button key={`${subject.subject_code}-${subject.subject}`} onClick={() => onCreateFromSubject(subject, entry)} className="rounded-md border border-slate-200 p-3 text-left transition hover:border-uec-300 hover:bg-uec-50 dark:border-slate-800 dark:hover:border-uec-700 dark:hover:bg-uec-900/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-slate-950 dark:text-white">{subject.subject}</div>
                        {entry ? <Plus className="mt-0.5 h-4 w-4 text-slate-400" /> : <ExternalLink className="mt-0.5 h-4 w-4 text-slate-400" />}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{subject.subject_code || "コードなし"}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{subject.credits}単位</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{subject.requirement_type || "未判定"}</span>
                        {entry ? (
                          <span className="rounded bg-uec-50 px-1.5 py-0.5 text-uec-700 dark:bg-uec-950 dark:text-uec-100">
                            {entry.dayLabel}{timetableEntryTimeLabel(entry)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="候補がありません" body="条件を変えるか、設定から科目JSON/CSVをインポートしてください。" />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
