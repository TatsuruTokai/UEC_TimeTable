import { AlertTriangle, ExternalLink, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DAYS } from "../data/defaultData";
import type { AppState, CampusArea, Classroom } from "../types";
import { campusMapUrl, classroomLabel, getMovementWarnings } from "../utils/campus";
import { courseTimeLabel } from "../utils/timetable";
import { Button, EmptyState, Field, inputClass } from "./ui";

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const areaLabels: Record<CampusArea, string> = {
  east: "東地区",
  west: "西地区",
  other: "その他",
};

const emptyClassroom = (): Classroom => ({
  id: createId("room"),
  name: "",
  buildingName: "",
  area: "east",
  floor: "",
  mapUrl: "",
  memo: "",
  favorite: false,
});

const dayLabel = (dayId: string) => DAYS.find((day) => day.id === dayId)?.shortLabel ?? dayId;

export const CampusView = ({
  state,
  onSaveClassroom,
  onDeleteClassroom,
  onOpenCourse,
}: {
  state: AppState;
  onSaveClassroom: (classroom: Classroom) => void;
  onDeleteClassroom: (classroomId: string) => void;
  onOpenCourse: (courseId: string) => void;
}) => {
  const [draft, setDraft] = useState<Classroom>(emptyClassroom());
  const [message, setMessage] = useState("");
  const warnings = useMemo(() => getMovementWarnings(state.courses, state.classrooms), [state.classrooms, state.courses]);
  const activeCourses = state.courses.filter((course) => course.status === "taking" || course.status === "planned" || course.status === "retake");

  const save = () => {
    if (!draft.name.trim() || !draft.buildingName.trim()) return;
    onSaveClassroom({
      ...draft,
      name: draft.name.trim(),
      buildingName: draft.buildingName.trim(),
      floor: draft.floor?.trim(),
      mapUrl: draft.mapUrl?.trim(),
      memo: draft.memo?.trim(),
    });
    setMessage(`${draft.buildingName} ${draft.name}を保存しました。`);
    setDraft(emptyClassroom());
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <section className="grid gap-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">教室・移動支援</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">教室メモ、建物リンク、連続授業の移動リスクを確認します。</p>
            </div>
          </div>
          {warnings.length ? (
            <div className="mt-5 grid gap-2">
              {warnings.map((warning) => (
                <div
                  key={`${warning.day}-${warning.from.id}-${warning.to.id}`}
                  className={`rounded-md p-3 text-sm ring-1 ${
                    warning.severity === "critical"
                      ? "bg-rose-50 text-rose-950 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900"
                      : "bg-amber-50 text-amber-950 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    {dayLabel(warning.day)}曜 {warning.from.name}から{warning.to.name}へ移動
                  </div>
                  <div className="mt-1">
                    {warning.fromBuilding} → {warning.toBuilding} / 休み時間 {Math.max(warning.gapMinutes, 0)}分
                  </div>
                  <a className="mt-2 inline-flex items-center gap-1 font-semibold underline" href={warning.mapUrl} target="_blank" rel="noreferrer">
                    マップで確認
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900">
              建物が変わる連続授業はありません。
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">授業ごとの場所</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">{activeCourses.length}件</span>
          </div>
          {activeCourses.length ? (
            <div className="grid gap-2">
              {activeCourses.map((course) => {
                const room = course.classroomId ? state.classrooms.find((item) => item.id === course.classroomId) : undefined;
                return (
                  <button key={course.id} type="button" onClick={() => onOpenCourse(course.id)} className="grid gap-2 rounded-md border border-slate-200 p-3 text-left transition hover:border-uec-300 hover:bg-uec-50 dark:border-slate-800 dark:hover:border-uec-700 dark:hover:bg-uec-900/20 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950 dark:text-white">{course.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{dayLabel(course.dayOfWeek)} {courseTimeLabel(course)}</span>
                        <span>{classroomLabel(course, state.classrooms)}</span>
                        {room?.memo ? <span>{room.memo}</span> : null}
                      </div>
                    </div>
                    <a
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
                      href={campusMapUrl(room?.buildingName ?? course.buildingName, room?.mapUrl)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MapPin className="h-4 w-4" />
                      地図
                    </a>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title="履修中・予定の授業はありません" />
          )}
        </section>
      </section>

      <aside className="grid gap-5 xl:sticky xl:top-32 xl:self-start">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-uec-600" />
            <h2 className="text-lg font-semibold">教室メモ</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <Field label="教室名">
              <input className={inputClass} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="B201 / 337教室" />
            </Field>
            <Field label="建物名">
              <input className={inputClass} value={draft.buildingName} onChange={(event) => setDraft((current) => ({ ...current, buildingName: event.target.value }))} placeholder="東B棟 / 西2号館" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="地区">
                <select className={inputClass} value={draft.area} onChange={(event) => setDraft((current) => ({ ...current, area: event.target.value as CampusArea }))}>
                  {Object.entries(areaLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="階">
                <input className={inputClass} value={draft.floor ?? ""} onChange={(event) => setDraft((current) => ({ ...current, floor: event.target.value }))} />
              </Field>
            </div>
            <Field label="マップURL">
              <input className={inputClass} value={draft.mapUrl ?? ""} onChange={(event) => setDraft((current) => ({ ...current, mapUrl: event.target.value }))} placeholder="空ならGoogle Maps検索" />
            </Field>
            <Field label="メモ">
              <textarea className={`${inputClass} min-h-20 resize-y`} value={draft.memo ?? ""} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} />
            </Field>
            <Button variant="primary" onClick={save} disabled={!draft.name.trim() || !draft.buildingName.trim()}>
              <Save className="h-4 w-4" />
              保存
            </Button>
            {message ? <div className="rounded-md bg-uec-50 p-3 text-sm font-semibold text-uec-800 dark:bg-uec-950 dark:text-uec-100">{message}</div> : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-lg font-semibold">登録教室</h2>
          <div className="mt-4 grid max-h-[32rem] gap-2 overflow-y-auto">
            {state.classrooms.length ? (
              state.classrooms.map((room) => (
                <div key={room.id} className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <button type="button" onClick={() => setDraft(room)} className="text-left">
                    <div className="font-semibold text-slate-950 dark:text-white">{room.buildingName} {room.name}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {areaLabels[room.area]} {room.floor ?? ""} {room.memo ?? ""}
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <a className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800" href={campusMapUrl(room.buildingName, room.mapUrl)} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      地図
                    </a>
                    <Button variant="ghost" onClick={() => onDeleteClassroom(room.id)} aria-label="教室を削除">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="登録教室はありません" />
            )}
          </div>
        </section>
      </aside>
    </div>
  );
};
