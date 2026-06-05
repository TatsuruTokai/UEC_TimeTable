import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_COLORS, COURSE_CATEGORIES, DAYS, PERIODS, SEMESTERS, STATUS_LABELS } from "../data/defaultData";
import type { CatalogData } from "../data/catalog";
import type { Assignment, Course, CourseCategory, DayOfWeek, GradeRecord, Semester } from "../types";
import { findSubjects } from "../utils/search";
import { Button, Field, inputClass, ModalFrame } from "./ui";

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const emptyCourse = (): Course => ({
  id: createId("course"),
  name: "",
  instructor: "",
  dayOfWeek: "mon",
  period: 1,
  semester: "first",
  credits: 2,
  category: "選択",
  classroomId: "",
  buildingName: "",
  syllabusUrl: "",
  relatedUrl: "",
  memo: "",
  color: CATEGORY_COLORS["選択"],
  status: "planned",
});

const inferCategory = (requirementType: string, categoryPath: string): CourseCategory => {
  if (requirementType === "必修") return "必修";
  if (requirementType === "選択必修") return "選択必修";
  if (categoryPath.includes("言語文化")) return "英語・第二外国語";
  if (categoryPath.includes("総 合 文 化") || categoryPath.includes("総合文化")) return "教養科目";
  if (categoryPath.includes("実験") || categoryPath.includes("演習")) return "実験・演習";
  if (categoryPath.includes("専門")) return "専門科目";
  return "選択";
};

export const CourseModal = ({
  course,
  isNew,
  catalog,
  state,
  assignments,
  onClose,
  onSave,
  onDelete,
  onSaveAssignment,
  onDeleteAssignment,
}: {
  course?: Course;
  isNew?: boolean;
  catalog: CatalogData;
  state: {
    settings: { admissionYear: number; cluster: string; program: string };
    classrooms: { id: string; name: string; buildingName: string }[];
    gradeRecords: GradeRecord[];
    customSubjects?: CatalogData["subjects"];
  };
  assignments: Assignment[];
  onClose: () => void;
  onSave: (course: Course) => void;
  onDelete?: (courseId: string) => void;
  onSaveAssignment: (assignment: Assignment) => void;
  onDeleteAssignment: (assignmentId: string) => void;
}) => {
  const [draft, setDraft] = useState<Course>(course ?? emptyCourse());
  const [assignmentDraft, setAssignmentDraft] = useState<Omit<Assignment, "id" | "courseId">>({
    title: "",
    dueDate: "",
    type: "report",
    url: "",
    memo: "",
    completed: false,
  });
  const allSubjects = useMemo(() => [...catalog.subjects, ...(state.customSubjects ?? [])], [catalog.subjects, state.customSubjects]);
  const suggestions = useMemo(
    () =>
      findSubjects(draft.name, allSubjects, state.gradeRecords, {
        admissionYear: state.settings.admissionYear,
        cluster: state.settings.cluster,
        program: state.settings.program,
      }),
    [allSubjects, draft.name, state.gradeRecords, state.settings.admissionYear, state.settings.cluster, state.settings.program],
  );

  const set = <K extends keyof Course>(key: K, value: Course[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const selectedClassroom = state.classrooms.find((room) => room.id === draft.classroomId);

  const submit = () => {
    const normalized = {
      ...draft,
      name: draft.name.trim(),
      instructor: draft.instructor?.trim(),
      buildingName: selectedClassroom?.buildingName || draft.buildingName?.trim(),
      color: draft.color || CATEGORY_COLORS[draft.category] || "#0d7edb",
    };
    if (!normalized.name) return;
    onSave(normalized);
    onClose();
  };

  const addAssignment = () => {
    if (!assignmentDraft.title.trim()) return;
    onSaveAssignment({
      ...assignmentDraft,
      id: createId("assignment"),
      courseId: draft.id,
      title: assignmentDraft.title.trim(),
      completed: false,
    });
    setAssignmentDraft({ title: "", dueDate: "", type: "report", url: "", memo: "", completed: false });
  };

  return (
    <ModalFrame
      title={isNew || !course ? "授業を追加" : "授業を編集"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          {course && !isNew && onDelete ? (
            <Button variant="danger" onClick={() => onDelete(course.id)}>
              <Trash2 className="h-4 w-4" />
              削除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              キャンセル
            </Button>
            <Button variant="primary" onClick={submit} disabled={!draft.name.trim()}>
              <Save className="h-4 w-4" />
              保存
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6">
        <section className="grid gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">基本情報</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">科目候補は所属・入学年度に一致し、取得済みCSVにないものだけを表示します。</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="授業名" className="sm:col-span-2">
              <input className={inputClass} value={draft.name} onChange={(event) => set("name", event.target.value)} list="course-suggestions" placeholder="例: 微分積分学第一 / bibun / programming" />
              <datalist id="course-suggestions">
                {suggestions.map((subject) => (
                  <option key={`${subject.subject_code}-${subject.subject}`} value={subject.subject} />
                ))}
              </datalist>
            </Field>
            {draft.name && suggestions.length ? (
              <div className="sm:col-span-2 grid max-h-44 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
                {suggestions.slice(0, 8).map((subject) => (
                  <button
                    key={`${subject.subject_code}-${subject.subject}`}
                    className="rounded-md px-3 py-2 text-left text-sm transition hover:bg-uec-50 dark:hover:bg-uec-900/30"
                    onClick={() => {
                      const category = inferCategory(subject.requirement_type, subject.category_path);
                      setDraft((current) => ({
                        ...current,
                        name: subject.subject,
                        credits: Number(subject.credits) || current.credits,
                        category,
                        syllabusUrl: subject.source_url ?? current.syllabusUrl,
                        color: CATEGORY_COLORS[category],
                      }));
                    }}
                  >
                    <div className="font-semibold">{subject.subject}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {subject.subject_code} / {subject.credits}単位 / {subject.requirement_type || subject.category_path}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            <Field label="担当教員">
              <input className={inputClass} value={draft.instructor ?? ""} onChange={(event) => set("instructor", event.target.value)} />
            </Field>
            <Field label="単位数">
              <input className={inputClass} type="number" min="0" step="0.5" value={draft.credits} onChange={(event) => set("credits", Number(event.target.value))} />
            </Field>
            <Field label="曜日">
              <select className={inputClass} value={draft.dayOfWeek} onChange={(event) => set("dayOfWeek", event.target.value as DayOfWeek)}>
                {DAYS.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="時限">
              <select className={inputClass} value={draft.period} onChange={(event) => set("period", Number(event.target.value))}>
                {PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {period}限
                  </option>
                ))}
              </select>
            </Field>
            <Field label="開講学期">
              <select className={inputClass} value={draft.semester} onChange={(event) => set("semester", event.target.value as Semester)}>
                {SEMESTERS.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="履修状態">
              <select className={inputClass} value={draft.status} onChange={(event) => set("status", event.target.value as Course["status"])}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="授業区分">
              <select
                className={inputClass}
                value={draft.category}
                onChange={(event) => {
                  const category = event.target.value;
                  setDraft((current) => ({ ...current, category, color: CATEGORY_COLORS[category] ?? current.color }));
                }}
              >
                {COURSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="色">
              <input className={`${inputClass} h-10 p-1`} type="color" value={draft.color ?? CATEGORY_COLORS[draft.category] ?? "#0d7edb"} onChange={(event) => set("color", event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">場所・リンク・メモ</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="教室">
              <select
                className={inputClass}
                value={draft.classroomId ?? ""}
                onChange={(event) => {
                  const room = state.classrooms.find((item) => item.id === event.target.value);
                  setDraft((current) => ({ ...current, classroomId: event.target.value, buildingName: room?.buildingName ?? current.buildingName }));
                }}
              >
                <option value="">未設定</option>
                {state.classrooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.buildingName} {room.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="建物名">
              <input className={inputClass} value={draft.buildingName ?? ""} onChange={(event) => set("buildingName", event.target.value)} placeholder="例: 東B棟" />
            </Field>
            <Field label="シラバスURL">
              <input className={inputClass} value={draft.syllabusUrl ?? ""} onChange={(event) => set("syllabusUrl", event.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Classroom / WebClass / Zoom URL">
              <input className={inputClass} value={draft.relatedUrl ?? ""} onChange={(event) => set("relatedUrl", event.target.value)} placeholder="https://..." />
            </Field>
            <Field label="メモ" className="sm:col-span-2">
              <textarea className={`${inputClass} min-h-24 resize-y`} value={draft.memo ?? ""} onChange={(event) => set("memo", event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">課題・試験メモ</h3>
          <div className="grid gap-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <div>
                  <div className="font-semibold">{assignment.title}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {assignment.type} {assignment.dueDate ? `/ ${assignment.dueDate}` : ""}
                  </div>
                </div>
                <Button variant="ghost" onClick={() => onDeleteAssignment(assignment.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="grid gap-3 rounded-md bg-slate-50 p-3 dark:bg-slate-900/70 sm:grid-cols-[1fr_10rem_9rem_auto]">
            <input className={inputClass} value={assignmentDraft.title} onChange={(event) => setAssignmentDraft((current) => ({ ...current, title: event.target.value }))} placeholder="課題名・試験名" />
            <input className={inputClass} type="date" value={assignmentDraft.dueDate} onChange={(event) => setAssignmentDraft((current) => ({ ...current, dueDate: event.target.value }))} />
            <select className={inputClass} value={assignmentDraft.type} onChange={(event) => setAssignmentDraft((current) => ({ ...current, type: event.target.value as Assignment["type"] }))}>
              <option value="report">レポート</option>
              <option value="exam">試験</option>
              <option value="quiz">小テスト</option>
              <option value="other">その他</option>
            </select>
            <Button onClick={addAssignment}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </section>
      </div>
    </ModalFrame>
  );
};
