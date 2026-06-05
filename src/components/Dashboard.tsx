import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, DoorOpen, MapPin } from "lucide-react";
import { PERIOD_TIMES } from "../data/defaultData";
import type { AppState, Classroom } from "../types";
import type { CreditAudit } from "../utils/credits";
import { dayLabel, formatRelativeTime, getFreePeriods, getNextCourse, getTodaysCourses } from "../utils/time";
import { EmptyState, Metric, ProgressBar } from "./ui";

const classroomName = (classrooms: Classroom[], id?: string) => classrooms.find((room) => room.id === id)?.name;

export const Dashboard = ({
  state,
  audit,
  onOpenCourse,
}: {
  state: AppState;
  audit: CreditAudit;
  onOpenCourse: (courseId: string) => void;
}) => {
  const todayCourses = getTodaysCourses(state.courses);
  const next = getNextCourse(state.courses);
  const freePeriods = getFreePeriods(state.courses);
  const soonAssignments = state.assignments
    .filter((assignment) => !assignment.completed && assignment.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
    .slice(0, 4);
  const nextClassroom = next?.course.classroomId ? classroomName(state.classrooms, next.course.classroomId) : undefined;
  const current = todayCourses.find((course) => course.period <= (next?.course.period ?? 0));
  const moving = current && next?.course && current.buildingName && next.course.buildingName && current.buildingName !== next.course.buildingName;

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">今日の状態</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">授業・教室移動・単位見込みをまとめて確認します。</p>
          </div>
          <div className="rounded-md bg-uec-50 px-3 py-2 text-sm font-semibold text-uec-700 dark:bg-uec-900/50 dark:text-uec-100">
            {new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="次の授業" value={next ? next.course.name : "なし"} sub={next ? `${dayLabel(next.course.dayOfWeek)} ${next.course.period}限・${formatRelativeTime(next.start)}` : "登録済み授業がありません"} />
          <Metric label="次の教室" value={nextClassroom ?? next?.course.buildingName ?? "-"} sub={next?.course.buildingName ?? "教室未設定"} />
          <Metric label="今学期の履修単位" value={`${audit.takingTotal}単位`} sub={`取得済み ${audit.earnedTotal}単位`} />
          <Metric label="卒業進捗" value={`${Math.round(audit.graduationProgress)}%`} sub={`残り ${audit.shortageTotal}単位`} />
        </div>
        <div className="grid gap-2">
          <ProgressBar value={audit.graduationProgress} />
          <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
            <div>3年進級目安: {Math.round(audit.thirdYearProgress)}%</div>
            <div>4年進級目安: {Math.round(audit.fourthYearProgress)}%</div>
            <div>履修中込み見込み: {audit.forecastTotal}単位</div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-uec-600" />
            <h2 className="text-lg font-semibold">今日の授業</h2>
          </div>
          {todayCourses.length ? (
            <div className="grid gap-3">
              {todayCourses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => onOpenCourse(course.id)}
                  className="grid gap-3 rounded-md border border-slate-200 p-3 text-left transition hover:border-uec-300 hover:bg-uec-50/60 dark:border-slate-800 dark:hover:border-uec-700 dark:hover:bg-uec-900/20 sm:grid-cols-[5rem_1fr_auto]"
                >
                  <div className="font-semibold text-uec-700 dark:text-uec-100">{course.period}限</div>
                  <div>
                    <div className="font-semibold text-slate-950 dark:text-white">{course.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span>{PERIOD_TIMES[course.period]?.start}-{PERIOD_TIMES[course.period]?.end}</span>
                      <span>{classroomName(state.classrooms, course.classroomId) ?? course.buildingName ?? "教室未設定"}</span>
                      <span>{course.credits}単位</span>
                    </div>
                  </div>
                  <ArrowRight className="hidden h-5 w-5 self-center text-slate-400 sm:block" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="今日の授業はありません" body="時間割画面から履修予定を追加できます。" />
          )}
        </section>

        <section className="grid gap-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-uec-600" />
              <h2 className="text-lg font-semibold">教室移動</h2>
            </div>
            {moving ? (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  建物が変わります
                </div>
                <div className="mt-2">
                  {current.buildingName} から {next.course.buildingName} へ移動
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-900">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  大きな移動はありません
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-uec-600" />
              <h2 className="text-lg font-semibold">空きコマ</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {freePeriods.map((period) => (
                <span key={period} className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {period}限
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">締切が近い課題</h2>
          <span className="text-sm text-slate-500">{soonAssignments.length}件</span>
        </div>
        {soonAssignments.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {soonAssignments.map((assignment) => {
              const course = state.courses.find((item) => item.id === assignment.courseId);
              return (
                <div key={assignment.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <div className="font-semibold text-slate-950 dark:text-white">{assignment.title}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{course?.name ?? "授業未設定"}</div>
                  <div className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300">{assignment.dueDate}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="近い締切はありません" />
        )}
      </section>
    </div>
  );
};
