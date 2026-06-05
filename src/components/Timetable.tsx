import { AlertTriangle, ExternalLink, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_COLORS, DAYS, PERIODS, PERIOD_TIMES, STATUS_LABELS } from "../data/defaultData";
import type { CatalogData } from "../data/catalog";
import type { AppState, CatalogSubject, Course } from "../types";
import { currentPeriod, todayDayId } from "../utils/time";
import { Button, EmptyState, inputClass } from "./ui";

const useCollisionMap = (courses: Course[]) =>
  useMemo(() => {
    const map = new Map<string, Course[]>();
    courses.forEach((course) => {
      const key = `${course.dayOfWeek}-${course.period}`;
      map.set(key, [...(map.get(key) ?? []), course]);
    });
    return map;
  }, [courses]);

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
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{course.credits}単位</span>
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{course.category}</span>
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{STATUS_LABELS[course.status]}</span>
    </div>
  </button>
);

export const Timetable = ({
  state,
  catalog,
  onAddCourse,
  onOpenCourse,
  onCreateFromSubject,
}: {
  state: AppState;
  catalog: CatalogData;
  onAddCourse: (day?: Course["dayOfWeek"], period?: number) => void;
  onOpenCourse: (courseId: string) => void;
  onCreateFromSubject: (subject: CatalogSubject) => void;
}) => {
  const collisionMap = useCollisionMap(state.courses);
  const today = todayDayId();
  const nowPeriod = currentPeriod();
  const [search, setSearch] = useState("");
  const [creditFilter, setCreditFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const earnedNames = new Set((state.gradeImport?.records ?? []).filter((record) => record.passed).map((record) => record.subject));
  const subjects = [...catalog.subjects, ...(state.customSubjects ?? [])]
    .filter(
      (subject) =>
        subject.admission_year === state.settings.admissionYear &&
        subject.cluster === state.settings.cluster &&
        subject.course === state.settings.program &&
        !earnedNames.has(subject.subject),
    )
    .filter((subject) => !search || `${subject.subject} ${subject.subject_code ?? ""} ${subject.category_path}`.toLowerCase().includes(search.toLowerCase()))
    .filter((subject) => !creditFilter || Number(subject.credits) === Number(creditFilter))
    .filter((subject) => !categoryFilter || subject.requirement_type === categoryFilter || subject.category_path.includes(categoryFilter))
    .slice(0, 30);
  const collisions = Array.from(collisionMap.values()).filter((items) => items.length > 1);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_21rem]">
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">週間時間割</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">月曜から土曜、1限から5限まで管理します。</p>
          </div>
          <Button variant="primary" onClick={() => onAddCourse()}>
            <Plus className="h-4 w-4" />
            授業追加
          </Button>
        </div>

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
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-24 border-b border-r border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold text-slate-500 shadow-[6px_0_10px_-10px_rgba(15,23,42,0.65)] dark:border-slate-800 dark:bg-slate-900">時限</th>
                {DAYS.map((day) => (
                  <th
                    key={day.id}
                    className={`border-b border-r border-slate-200 p-3 text-left text-sm font-semibold dark:border-slate-800 ${
                      today === day.id ? "bg-uec-50 text-uec-800 dark:bg-uec-950 dark:text-uec-100" : "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => (
                <tr key={period}>
                  <th className="sticky left-0 z-10 border-r border-t border-slate-200 bg-slate-50 p-3 text-left align-top shadow-[6px_0_10px_-10px_rgba(15,23,42,0.65)] dark:border-slate-800 dark:bg-slate-900">
                    <div className="font-semibold">{period}限</div>
                    <div className="mt-1 whitespace-nowrap text-xs font-normal text-slate-500">
                      {PERIOD_TIMES[period]?.start}-{PERIOD_TIMES[period]?.end}
                    </div>
                  </th>
                  {DAYS.map((day) => {
                    const items = collisionMap.get(`${day.id}-${period}`) ?? [];
                    const isActive = today === day.id && nowPeriod === period;
                    return (
                      <td
                        key={day.id}
                        className={`h-32 border-r border-t border-slate-200 p-2 align-top dark:border-slate-800 ${
                          isActive ? "bg-uec-50/80 dark:bg-uec-950/50" : "bg-white dark:bg-slate-950"
                        }`}
                      >
                        {items.length ? (
                          <div className="grid gap-2">
                            {items.map((course) => (
                              <CourseCard
                                key={course.id}
                                course={course}
                                active={isActive}
                                collision={items.length > 1}
                                classroomName={state.classrooms.find((room) => room.id === course.classroomId)?.name}
                                onOpen={() => onOpenCourse(course.id)}
                              />
                            ))}
                          </div>
                        ) : (
                          <button
                            onClick={() => onAddCourse(day.id, period)}
                            className="grid h-full w-full place-items-center rounded-md border border-dashed border-slate-200 text-xs font-semibold text-slate-400 transition hover:border-uec-300 hover:text-uec-600 dark:border-slate-800 dark:hover:border-uec-700"
                          >
                            空きコマ
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </section>

      <aside className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-32 xl:self-start">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-5 w-5 text-uec-600" />
          <h2 className="text-lg font-semibold">科目検索</h2>
        </div>
        <div className="grid gap-3">
          <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="科目名・教員名・コード" />
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
                {subjects.map((subject) => (
                  <button key={`${subject.subject_code}-${subject.subject}`} onClick={() => onCreateFromSubject(subject)} className="rounded-md border border-slate-200 p-3 text-left transition hover:border-uec-300 hover:bg-uec-50 dark:border-slate-800 dark:hover:border-uec-700 dark:hover:bg-uec-900/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-slate-950 dark:text-white">{subject.subject}</div>
                      <ExternalLink className="mt-0.5 h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {subject.subject_code} / {subject.credits}単位 / {subject.requirement_type || "未判定"}
                    </div>
                  </button>
                ))}
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
