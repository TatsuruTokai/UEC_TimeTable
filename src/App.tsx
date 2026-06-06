import { useEffect, useMemo, useState } from "react";
import { CATEGORY_COLORS, defaultNotificationSettings } from "./data/defaultData";
import { emptyCatalog, loadCatalogData, type CatalogData } from "./data/catalog";
import { repository } from "./storage/repository";
import type {
  AppState,
  Assignment,
  CatalogSubject,
  Classroom,
  Course,
  CourseCategory,
  DayOfWeek,
  FriendSchedule,
  GradeCsvImport,
  NotificationSettings,
  ScreenId,
  TimetableEntry,
  UserSettings,
} from "./types";
import { evaluateCredits } from "./utils/credits";
import { decodeSharePayload, payloadToFriendSchedule } from "./utils/sharing";
import { normalizeSubjectForTimetable, timetableEntryTimeLabel } from "./utils/timetable";
import { AnalysisView } from "./components/AnalysisView";
import { CalendarView } from "./components/CalendarView";
import { CampusView } from "./components/CampusView";
import { CourseModal } from "./components/CourseModal";
import { CreditsView } from "./components/CreditsView";
import { Dashboard } from "./components/Dashboard";
import { ShareView } from "./components/ShareView";
import { SettingsView } from "./components/SettingsView";
import { Shell } from "./components/Shell";
import { Timetable } from "./components/Timetable";
import { InitialSetup } from "./components/InitialSetup";

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const inferCategory = (subject: CatalogSubject): CourseCategory => {
  if (subject.requirement_type === "必修") return "必修";
  if (subject.requirement_type === "選択必修") return "選択必修";
  if (subject.category_path.includes("言語文化")) return "英語・第二外国語";
  if (subject.category_path.includes("総")) return "教養科目";
  if (subject.category_path.includes("実験") || subject.category_path.includes("演習")) return "実験・演習";
  if (subject.category_path.includes("専門")) return "専門科目";
  return "選択";
};

const createCourseDraft = (day?: DayOfWeek, period?: number, subject?: CatalogSubject, timetableEntry?: TimetableEntry): Course => {
  const category = subject ? inferCategory(subject) : "選択";
  const sourceMemo = timetableEntry
    ? `2026年度時間割: ${timetableEntry.dayLabel}${timetableEntryTimeLabel(timetableEntry)} / ${timetableEntry.sourcePdf}`
    : "";
  return {
    id: createId("course"),
    name: subject?.subject ?? timetableEntry?.subject ?? "",
    instructor: timetableEntry?.instructor ?? "",
    dayOfWeek: timetableEntry?.dayOfWeek ?? day ?? "mon",
    period: timetableEntry?.period ?? period ?? 1,
    periodEnd: timetableEntry?.periodEnd ?? timetableEntry?.period ?? period ?? 1,
    startTime: timetableEntry?.startTime ?? "",
    endTime: timetableEntry?.endTime ?? "",
    semester: timetableEntry?.semester ?? "first",
    credits: subject ? Number(subject.credits) || 2 : 2,
    category,
    classroomId: "",
    buildingName: timetableEntry?.classroom ?? "",
    syllabusUrl: subject?.source_url ?? timetableEntry?.sourceUrl ?? "",
    relatedUrl: "",
    memo: [subject?.remarks, sourceMemo].filter(Boolean).join("\n"),
    color: CATEGORY_COLORS[category],
    status: "planned",
    sourceTimetableEntryId: timetableEntry?.id,
    sourceTimetablePdf: timetableEntry?.sourcePdf,
  };
};

export default function App() {
  const [state, setState] = useState<AppState>(() => repository.load());
  const [catalog, setCatalog] = useState<CatalogData>(emptyCatalog);
  const [catalogError, setCatalogError] = useState("");
  const [screen, setScreen] = useState<ScreenId>("dashboard");
  const [editor, setEditor] = useState<{ course: Course; isNew: boolean } | undefined>();
  const updateState = (updater: (current: AppState) => AppState) => setState((current) => updater(current));

  useEffect(() => {
    loadCatalogData().then(setCatalog).catch((error: Error) => setCatalogError(error.message));
  }, []);

  useEffect(() => {
    if (!window.location.hash.startsWith("#share=")) return;
    const payload = decodeSharePayload(window.location.hash.replace(/^#share=/, ""));
    if (!payload) return;
    const schedule = payloadToFriendSchedule(payload);
    setState((current) => {
      const existing = current.friendSchedules ?? [];
      return {
        ...current,
        friendSchedules: existing.some((item) => item.id === schedule.id) ? existing : [schedule, ...existing],
      };
    });
    setScreen("share");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    repository.save(state);
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", state.settings.theme === "dark" || (state.settings.theme === "system" && prefersDark));
  }, [state.settings.theme]);

  const audit = useMemo(
    () => evaluateCredits(state, catalog.requirements, catalog.promotionRequirements, catalog.subjects, catalog.categoryAliases, catalog.subjectAliases),
    [catalog.categoryAliases, catalog.promotionRequirements, catalog.requirements, catalog.subjectAliases, catalog.subjects, state],
  );

  const findCatalogSubject = (subjectName: string) => {
    const scoped = [...catalog.subjects, ...(state.customSubjects ?? [])].filter(
      (subject) =>
        subject.admission_year === state.settings.admissionYear &&
        subject.cluster === state.settings.cluster &&
        subject.course === state.settings.program,
    );
    const normalizedName = normalizeSubjectForTimetable(subjectName);
    return (
      scoped.find((subject) => normalizeSubjectForTimetable(subject.subject) === normalizedName) ??
      scoped.find((subject) => subject.subject.includes(subjectName) || subjectName.includes(subject.subject))
    );
  };

  const saveCourse = (course: Course) => {
    updateState((current) => {
      const exists = current.courses.some((item) => item.id === course.id);
      return {
        ...current,
        courses: exists ? current.courses.map((item) => (item.id === course.id ? course : item)) : [...current.courses, course],
      };
    });
  };

  const deleteCourse = (courseId: string) => {
    updateState((current) => ({
      ...current,
      courses: current.courses.filter((course) => course.id !== courseId),
      assignments: current.assignments.filter((assignment) => assignment.courseId !== courseId),
    }));
    setEditor(undefined);
  };

  const saveAssignment = (assignment: Assignment) => {
    updateState((current) => {
      const exists = current.assignments.some((item) => item.id === assignment.id);
      return {
        ...current,
        assignments: exists ? current.assignments.map((item) => (item.id === assignment.id ? assignment : item)) : [...current.assignments, assignment],
      };
    });
  };

  const deleteAssignment = (assignmentId: string) => {
    updateState((current) => ({ ...current, assignments: current.assignments.filter((item) => item.id !== assignmentId) }));
  };

  const saveClassroom = (classroom: Classroom) => {
    updateState((current) => {
      const exists = current.classrooms.some((item) => item.id === classroom.id);
      return {
        ...current,
        classrooms: exists ? current.classrooms.map((item) => (item.id === classroom.id ? classroom : item)) : [...current.classrooms, classroom],
      };
    });
  };

  const deleteClassroom = (classroomId: string) => {
    updateState((current) => ({
      ...current,
      classrooms: current.classrooms.filter((room) => room.id !== classroomId),
      courses: current.courses.map((course) => (course.classroomId === classroomId ? { ...course, classroomId: "" } : course)),
    }));
  };

  const importFriendSchedule = (schedule: FriendSchedule) => {
    updateState((current) => {
      const existing = current.friendSchedules ?? [];
      return {
        ...current,
        friendSchedules: [schedule, ...existing.filter((item) => item.id !== schedule.id)],
      };
    });
  };

  const deleteFriendSchedule = (scheduleId: string) => {
    updateState((current) => ({ ...current, friendSchedules: (current.friendSchedules ?? []).filter((item) => item.id !== scheduleId) }));
  };

  const updateNotificationSettings = (notificationSettings: NotificationSettings) => {
    updateState((current) => ({ ...current, notificationSettings }));
  };

  const toggleTheme = () => {
    const next = state.settings.theme === "dark" ? "light" : "dark";
    setState((current) => ({ ...current, settings: { ...current.settings, theme: next } }));
  };

  const importBackup = (backup: AppState) => {
    const defaults = repository.load();
    const notificationDefaults = defaults.notificationSettings ?? defaultNotificationSettings;
    setState({
      ...defaults,
      ...backup,
      version: 2,
      courses: backup.courses ?? [],
      classrooms: backup.classrooms ?? [],
      assignments: backup.assignments ?? [],
      friendSchedules: backup.friendSchedules ?? [],
      notificationSettings: { ...notificationDefaults, ...(backup.notificationSettings ?? {}) },
    });
  };

  if (!state.settings.initialSetupCompleted) {
    return (
      <InitialSetup
        catalog={catalog}
        settings={state.settings}
        onComplete={(settings: UserSettings, gradeImport: GradeCsvImport) => updateState((current) => ({ ...current, settings, gradeImport }))}
      />
    );
  }

  return (
    <Shell active={screen} onChange={setScreen} onToggleTheme={toggleTheme}>
      {catalogError ? (
        <div className="mb-5 rounded-md bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900">
          {catalogError}
        </div>
      ) : null}

      {screen === "dashboard" ? (
        <Dashboard
          state={state}
          audit={audit}
          onOpenCourse={(courseId) => {
            const course = state.courses.find((item) => item.id === courseId);
            if (course) setEditor({ course, isNew: false });
          }}
        />
      ) : null}

      {screen === "timetable" ? (
        <Timetable
          state={state}
          catalog={catalog}
          onAddCourse={(day, period) => setEditor({ course: createCourseDraft(day, period), isNew: true })}
          onOpenCourse={(courseId) => {
            const course = state.courses.find((item) => item.id === courseId);
            if (course) setEditor({ course, isNew: false });
          }}
          onCreateFromSubject={(subject, timetableEntry) => setEditor({ course: createCourseDraft(undefined, undefined, subject, timetableEntry), isNew: true })}
          onCreateFromTimetableEntry={(timetableEntry) => setEditor({ course: createCourseDraft(undefined, undefined, findCatalogSubject(timetableEntry.subject), timetableEntry), isNew: true })}
          audit={audit}
        />
      ) : null}

      {screen === "credits" ? <CreditsView audit={audit} /> : null}

      {screen === "calendar" ? (
        <CalendarView
          state={state}
          onSaveAssignment={saveAssignment}
          onDeleteAssignment={deleteAssignment}
          onUpdateNotificationSettings={updateNotificationSettings}
        />
      ) : null}

      {screen === "share" ? (
        <ShareView
          state={state}
          onImportFriendSchedule={importFriendSchedule}
          onDeleteFriendSchedule={deleteFriendSchedule}
        />
      ) : null}

      {screen === "campus" ? (
        <CampusView
          state={state}
          onSaveClassroom={saveClassroom}
          onDeleteClassroom={deleteClassroom}
          onOpenCourse={(courseId) => {
            const course = state.courses.find((item) => item.id === courseId);
            if (course) setEditor({ course, isNew: false });
          }}
        />
      ) : null}

      {screen === "analysis" ? <AnalysisView state={state} audit={audit} /> : null}

      {screen === "settings" ? (
        <SettingsView
          state={state}
          catalog={catalog}
          audit={audit}
          onUpdateSettings={(settings: UserSettings) => updateState((current) => ({ ...current, settings }))}
          onImportGrades={(gradeImport) => updateState((current) => ({ ...current, gradeImport }))}
          onImportBackup={importBackup}
          onImportSubjects={(subjects) => updateState((current) => ({ ...current, customSubjects: [...(current.customSubjects ?? []), ...subjects] }))}
          onSetManualRequirement={(manualRequirement) => updateState((current) => ({ ...current, manualRequirement }))}
          onReset={() => setState(repository.reset())}
        />
      ) : null}

      {editor ? (
        <CourseModal
          course={editor.course}
          isNew={editor.isNew}
          catalog={catalog}
          state={{
            settings: state.settings,
            classrooms: state.classrooms,
            gradeRecords: state.gradeImport?.records ?? [],
            customSubjects: state.customSubjects,
          }}
          assignments={state.assignments.filter((assignment) => assignment.courseId === editor.course.id)}
          onClose={() => setEditor(undefined)}
          onSave={saveCourse}
          onDelete={deleteCourse}
          onSaveAssignment={saveAssignment}
          onDeleteAssignment={deleteAssignment}
        />
      ) : null}
    </Shell>
  );
}
