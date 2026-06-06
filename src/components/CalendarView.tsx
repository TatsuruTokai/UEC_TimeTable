import { Bell, CalendarPlus, CheckCircle2, Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { defaultNotificationSettings } from "../data/defaultData";
import type { AppState, Assignment, NotificationSettings } from "../types";
import { calendarFileName, downloadIcs, googleCalendarUrlForAssignment, googleCalendarUrlForCourse } from "../utils/calendar";
import { Button, EmptyState, Field, inputClass } from "./ui";

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const typeLabels: Record<Assignment["type"], string> = {
  report: "レポート",
  exam: "試験",
  quiz: "小テスト",
  other: "その他",
};

const daysUntil = (date?: string) => {
  if (!date) return Number.POSITIVE_INFINITY;
  const due = new Date(`${date}T23:59:59`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - start.getTime()) / 86400000);
};

const dueTone = (assignment: Assignment) => {
  if (assignment.completed) return "text-emerald-700 dark:text-emerald-300";
  const days = daysUntil(assignment.dueDate);
  if (days < 0) return "text-rose-700 dark:text-rose-300";
  if (days <= 1) return "text-amber-700 dark:text-amber-300";
  return "text-slate-600 dark:text-slate-300";
};

const dueLabel = (assignment: Assignment) => {
  if (!assignment.dueDate) return "締切未設定";
  const days = daysUntil(assignment.dueDate);
  if (days < 0) return `${assignment.dueDate} 期限超過`;
  if (days === 0) return `${assignment.dueDate} 今日`;
  if (days === 1) return `${assignment.dueDate} 明日`;
  return `${assignment.dueDate} あと${days}日`;
};

const loadNotifiedKeys = () => {
  try {
    return new Set(JSON.parse(window.localStorage.getItem("uec-timetable-notified-v1") || "[]") as string[]);
  } catch {
    return new Set<string>();
  }
};

const saveNotifiedKeys = (keys: Set<string>) => {
  window.localStorage.setItem("uec-timetable-notified-v1", JSON.stringify(Array.from(keys).slice(-120)));
};

export const CalendarView = ({
  state,
  onSaveAssignment,
  onDeleteAssignment,
  onUpdateNotificationSettings,
}: {
  state: AppState;
  onSaveAssignment: (assignment: Assignment) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onUpdateNotificationSettings: (settings: NotificationSettings) => void;
}) => {
  const settings = state.notificationSettings ?? defaultNotificationSettings;
  const firstCourseId = state.courses[0]?.id ?? "";
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [draft, setDraft] = useState<Omit<Assignment, "id">>({
    courseId: firstCourseId,
    title: "",
    dueDate: "",
    type: "report",
    url: "",
    memo: "",
    reminderDays: settings.defaultReminderDays,
    reminderTime: settings.defaultReminderTime,
    notificationEnabled: true,
    completed: false,
  });

  useEffect(() => {
    if (!draft.courseId && firstCourseId) setDraft((current) => ({ ...current, courseId: firstCourseId }));
  }, [draft.courseId, firstCourseId]);

  const courseById = useMemo(() => new Map(state.courses.map((course) => [course.id, course])), [state.courses]);
  const upcoming = useMemo(
    () =>
      [...state.assignments]
        .sort((a, b) => Number(a.completed) - Number(b.completed) || String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")))
        .slice(0, 80),
    [state.assignments],
  );
  const urgent = upcoming.filter((assignment) => !assignment.completed && daysUntil(assignment.dueDate) <= (assignment.reminderDays ?? settings.defaultReminderDays));

  useEffect(() => {
    if (!settings.enabled || permissionState !== "granted" || typeof Notification === "undefined") return;
    const notified = loadNotifiedKeys();
    let changed = false;
    urgent.forEach((assignment) => {
      if (!assignment.notificationEnabled || !assignment.dueDate) return;
      const key = `${assignment.id}-${assignment.dueDate}`;
      if (notified.has(key)) return;
      const course = courseById.get(assignment.courseId);
      new Notification(assignment.title, {
        body: `${course?.name ?? "授業未設定"} / ${dueLabel(assignment)}`,
        tag: key,
      });
      notified.add(key);
      changed = true;
    });
    if (changed) saveNotifiedKeys(notified);
  }, [courseById, permissionState, settings.enabled, urgent]);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") {
      setPermissionState("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPermissionState(result);
    onUpdateNotificationSettings({ ...settings, enabled: result === "granted" });
  };

  const addAssignment = () => {
    if (!draft.title.trim() || !draft.courseId) return;
    onSaveAssignment({
      ...draft,
      id: createId("assignment"),
      title: draft.title.trim(),
      completed: false,
    });
    setDraft((current) => ({
      ...current,
      title: "",
      dueDate: "",
      url: "",
      memo: "",
      type: "report",
      notificationEnabled: true,
    }));
  };
  const setDraftDueDate = (value: string) => setDraft((current) => ({ ...current, dueDate: value }));

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <section className="grid gap-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">課題・試験</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">授業ごとの締切、試験日、通知、カレンダー同期を管理します。</p>
            </div>
            <Button variant="primary" onClick={() => downloadIcs(calendarFileName(), state)}>
              <Download className="h-4 w-4" />
              iCal出力
            </Button>
          </div>
          <div className="mt-5 grid gap-3 rounded-md bg-slate-50 p-3 dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_9rem]">
            <Field label="授業">
              <select className={inputClass} value={draft.courseId} onChange={(event) => setDraft((current) => ({ ...current, courseId: event.target.value }))}>
                {state.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="締切・試験日">
              <input
                className={inputClass}
                type="date"
                value={draft.dueDate}
                onInput={(event) => setDraftDueDate(event.currentTarget.value)}
                onChange={(event) => setDraftDueDate(event.currentTarget.value)}
              />
            </Field>
            <Field label="種別">
              <select className={inputClass} value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as Assignment["type"] }))}>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="課題名・試験名" className="sm:col-span-2">
              <input className={inputClass} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="例: 第5回レポート / 中間試験" />
            </Field>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:col-span-2 lg:col-span-1">
              <Field label="通知日">
                <input className={inputClass} type="number" min="0" max="30" value={draft.reminderDays ?? 1} onChange={(event) => setDraft((current) => ({ ...current, reminderDays: Number(event.target.value) }))} />
              </Field>
              <Field label="通知時刻">
                <input className={inputClass} type="time" value={draft.reminderTime ?? "09:00"} onChange={(event) => setDraft((current) => ({ ...current, reminderTime: event.target.value }))} />
              </Field>
              <Button className="self-end" onClick={addAssignment} disabled={!draft.title.trim() || !draft.courseId}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
            <Field label="URL" className="sm:col-span-2">
              <input className={inputClass} value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} placeholder="Google Classroom / WebClass / 資料URL" />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">締切リスト</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">未完了 {state.assignments.filter((assignment) => !assignment.completed).length}件</span>
          </div>
          {upcoming.length ? (
            <div className="grid gap-2">
              {upcoming.map((assignment) => {
                const course = courseById.get(assignment.courseId);
                return (
                  <div key={assignment.id} className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[auto_1fr_auto]">
                    <button
                      type="button"
                      onClick={() => onSaveAssignment({ ...assignment, completed: !assignment.completed })}
                      className={`mt-0.5 grid h-9 w-9 place-items-center rounded-md ring-1 ${
                        assignment.completed
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900"
                          : "bg-white text-slate-400 ring-slate-200 dark:bg-slate-950 dark:ring-slate-700"
                      }`}
                      aria-label="完了を切り替え"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-slate-950 dark:text-white">{assignment.title}</div>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{typeLabels[assignment.type]}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{course?.name ?? "授業未設定"}</span>
                        <span className={dueTone(assignment)}>{dueLabel(assignment)}</span>
                        {assignment.notificationEnabled ? <span>通知 {assignment.reminderDays ?? settings.defaultReminderDays}日前</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {assignment.dueDate ? (
                        <a className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800" href={googleCalendarUrlForAssignment(assignment, course)} target="_blank" rel="noreferrer">
                          <CalendarPlus className="h-4 w-4" />
                          Google
                        </a>
                      ) : null}
                      {assignment.url ? (
                        <a className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" href={assignment.url} target="_blank" rel="noreferrer" aria-label="課題URLを開く">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      <Button variant="ghost" onClick={() => onDeleteAssignment(assignment.id)} aria-label="削除">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="課題・試験はありません" body="授業を追加したあと、ここから締切を登録できます。" />
          )}
        </section>
      </section>

      <aside className="grid gap-5 xl:sticky xl:top-32 xl:self-start">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-uec-600" />
            <h2 className="text-lg font-semibold">通知</h2>
          </div>
          <div className="mt-4 grid gap-3 text-sm">
            <label className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-3 dark:bg-slate-950">
              <span className="font-semibold">ブラウザ通知</span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => onUpdateNotificationSettings({ ...settings, enabled: event.target.checked })}
              />
            </label>
            <Field label="標準通知日数">
              <input className={inputClass} type="number" min="0" max="30" value={settings.defaultReminderDays} onChange={(event) => onUpdateNotificationSettings({ ...settings, defaultReminderDays: Number(event.target.value) })} />
            </Field>
            <Field label="標準通知時刻">
              <input className={inputClass} type="time" value={settings.defaultReminderTime} onChange={(event) => onUpdateNotificationSettings({ ...settings, defaultReminderTime: event.target.value })} />
            </Field>
            <Button onClick={requestPermission} disabled={permissionState === "granted" || permissionState === "unsupported"}>
              <Bell className="h-4 w-4" />
              {permissionState === "granted" ? "通知許可済み" : permissionState === "unsupported" ? "通知非対応" : "通知を許可"}
            </Button>
            <div className="rounded-md bg-slate-50 p-3 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              通知対象: {urgent.length}件。ブラウザ通知はアプリを開いている間に送信します。
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-lg font-semibold">授業カレンダー</h2>
          <div className="mt-4 grid gap-2">
            {state.courses
              .filter((course) => course.status === "taking" || course.status === "planned" || course.status === "retake")
              .slice(0, 8)
              .map((course) => (
                <a key={course.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800" href={googleCalendarUrlForCourse(course)} target="_blank" rel="noreferrer">
                  <span className="min-w-0 truncate font-semibold">{course.name}</span>
                  <CalendarPlus className="h-4 w-4 shrink-0 text-slate-400" />
                </a>
              ))}
          </div>
        </section>
      </aside>
    </div>
  );
};
