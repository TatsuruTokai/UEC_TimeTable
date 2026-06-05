import { Download, FileJson, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { CatalogData } from "../data/catalog";
import type { AppState, CatalogSubject, CreditRequirement, GradeCsvImport, UserSettings } from "../types";
import { buildAcademicOptions, normalizeAcademicSettings } from "../utils/academicOptions";
import type { CreditAudit } from "../utils/credits";
import { downloadJson, parseKakuteiSeisekiBuffer, parseSubjectImport } from "../utils/csv";
import { AcademicProfileFields } from "./AcademicSelectors";
import { Button, Field, FileInput, inputClass } from "./ui";

const toCsv = (rows: Record<string, unknown>[]) => {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
  return [headers.map(escape).join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
};

const downloadText = (filename: string, text: string, type = "text/csv;charset=utf-8") => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const normalizeImportedSubjects = (items: unknown[], settings: UserSettings): CatalogSubject[] =>
  items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const subject = String(row.subject ?? row["科目"] ?? row.name ?? "").trim();
    if (!subject) return [];
    return [
      {
        admission_year: Number(row.admission_year ?? row.admissionYear ?? row["入学年度"] ?? settings.admissionYear),
        cluster: String(row.cluster ?? row["類"] ?? settings.cluster),
        course: String(row.course ?? row.program ?? row["プログラム"] ?? settings.program),
        subject,
        subject_code: String(row.subject_code ?? row.code ?? row["時間割コード"] ?? ""),
        credits: String(row.credits ?? row["単位数"] ?? "0"),
        requirement_type: String(row.requirement_type ?? row.category ?? row["授業区分"] ?? "未判定"),
        category_path: String(row.category_path ?? row["科目区分"] ?? row["科目大区分"] ?? ""),
        remarks: String(row.remarks ?? row.memo ?? ""),
      },
    ];
  });

export const SettingsView = ({
  state,
  catalog,
  audit,
  onUpdateSettings,
  onImportGrades,
  onImportBackup,
  onImportSubjects,
  onSetManualRequirement,
  onReset,
}: {
  state: AppState;
  catalog: CatalogData;
  audit: CreditAudit;
  onUpdateSettings: (settings: UserSettings) => void;
  onImportGrades: (gradeImport: GradeCsvImport) => void;
  onImportBackup: (state: AppState) => void;
  onImportSubjects: (subjects: CatalogSubject[]) => void;
  onSetManualRequirement: (requirement?: CreditRequirement) => void;
  onReset: () => void;
}) => {
  const [message, setMessage] = useState("");
  const [manualRows, setManualRows] = useState<{ category: string; label: string; requiredCredits: number }[]>([]);

  const displayedManualRows = manualRows.length
    ? manualRows
    : audit.rows.filter((row) => !row.categoryId.startsWith("subtotal.")).map((row) => ({ category: row.categoryId, label: row.label, requiredCredits: row.required }));

  const importGrades = async (file: File) => {
    const parsed = parseKakuteiSeisekiBuffer(await file.arrayBuffer());
    onImportGrades(parsed);
    const nextSettings = normalizeAcademicSettings(
      state.settings,
      buildAcademicOptions(catalog.requirements),
      {
        admissionYear: parsed.student.admissionYear ?? state.settings.admissionYear,
        cluster: parsed.student.cluster ?? state.settings.cluster,
        program: parsed.student.program ?? state.settings.program,
        gradeYear: parsed.student.gradeYear ?? state.settings.gradeYear,
      },
    );
    onUpdateSettings(nextSettings);
    setMessage(`確定成績CSVを取り込みました。合格済み ${parsed.records.filter((record) => record.passed).length}科目。`);
  };

  const importBackup = async (file: File) => {
    const parsed = JSON.parse(await file.text()) as AppState;
    onImportBackup(parsed);
    setMessage("バックアップJSONを取り込みました。");
  };

  const importSubjects = async (file: File) => {
    const text = await file.text();
    const rows = parseSubjectImport(text);
    const subjects = normalizeImportedSubjects(Array.isArray(rows) ? rows : [rows], state.settings);
    onImportSubjects(subjects);
    setMessage(`科目候補を${subjects.length}件取り込みました。`);
  };

  const saveManualRequirement = () => {
    onSetManualRequirement({
      id: "manual-current",
      admissionYear: state.settings.admissionYear,
      faculty: state.settings.faculty,
      cluster: state.settings.cluster,
      program: state.settings.program,
      totalRequiredCredits: audit.totalRequired || displayedManualRows.reduce((sum, row) => sum + Number(row.requiredCredits || 0), 0),
      categoryRequirements: displayedManualRows.map((row) => ({ category: row.category, requiredCredits: Number(row.requiredCredits || 0) })),
      requiredCourseNames: audit.missingRequired.map((subject) => subject.subject),
    });
    setMessage("手入力要件を保存しました。");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <section className="grid gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">学生設定</h2>
          <div className="mt-4 grid gap-4">
            <AcademicProfileFields catalog={catalog} settings={state.settings} onChange={onUpdateSettings} />
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              学域は情報理工学域で固定です。類を選ぶとプログラム候補が絞られ、プログラムを選ぶと類も自動で決まります。
            </div>
            <Field label="テーマ">
              <select
                className={inputClass}
                value={state.settings.theme}
                onChange={(event) => onUpdateSettings({ ...state.settings, theme: event.target.value as UserSettings["theme"] })}
              >
                <option value="system">システムに合わせる</option>
                <option value="light">ライト</option>
                <option value="dark">ダーク</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-lg font-semibold">必要単位設定</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">学修要覧データから機械表示した区分名・単位数を、MVPでは手入力で上書きできます。</p>
          <div className="mt-4 grid max-h-[34rem] gap-2 overflow-y-auto">
            {displayedManualRows.map((row, index) => (
              <div key={`${row.category}-${index}`} className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[1fr_8rem]">
                <div>
                  <div className="text-sm font-semibold">{row.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{row.category}</div>
                </div>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.5"
                  value={row.requiredCredits}
                  onChange={(event) =>
                    setManualRows((current) => {
                      const base = current.length ? current : displayedManualRows;
                      return base.map((item, itemIndex) => (itemIndex === index ? { ...item, requiredCredits: Number(event.target.value) } : item));
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={saveManualRequirement}>
              保存
            </Button>
          </div>
        </div>
      </section>

      <aside className="grid gap-5 lg:sticky lg:top-32 lg:self-start">
        {message ? <div className="rounded-md bg-uec-50 p-3 text-sm font-semibold text-uec-800 ring-1 ring-uec-100 dark:bg-uec-950 dark:text-uec-100 dark:ring-uec-900">{message}</div> : null}
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-lg font-semibold">インポート</h2>
          <div className="mt-4 grid gap-3">
            <Field label="確定成績CSV">
              <FileInput accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importGrades(event.target.files[0])} />
            </Field>
            <Field label="バックアップJSON">
              <FileInput accept=".json,application/json" onChange={(event) => event.target.files?.[0] && void importBackup(event.target.files[0])} />
            </Field>
            <Field label="科目候補 CSV / JSON">
              <FileInput accept=".csv,.json,text/csv,application/json" onChange={(event) => event.target.files?.[0] && void importSubjects(event.target.files[0])} />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-lg font-semibold">エクスポート</h2>
          <div className="mt-4 grid gap-2">
            <Button onClick={() => downloadJson("uec-timetable-backup.json", state)}>
              <FileJson className="h-4 w-4" />
              JSONバックアップ
            </Button>
            <Button onClick={() => downloadText("uec-courses.csv", toCsv(state.courses as unknown as Record<string, unknown>[]))}>
              <Download className="h-4 w-4" />
              授業CSV
            </Button>
            <Button onClick={() => downloadText("uec-classrooms.csv", toCsv(state.classrooms as unknown as Record<string, unknown>[]))}>
              <Download className="h-4 w-4" />
              教室CSV
            </Button>
            <Button onClick={() => downloadJson("uec-custom-subjects.json", state.customSubjects ?? [])}>
              <Download className="h-4 w-4" />
              科目候補JSON
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-lg font-semibold">データ</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
            <div>授業: {state.courses.length}件</div>
            <div>教室: {state.classrooms.length}件</div>
            <div>課題: {state.assignments.length}件</div>
            <div>成績CSV: {state.gradeImport ? `${state.gradeImport.records.length}行` : "未取込"}</div>
            <div>追加科目候補: {state.customSubjects?.length ?? 0}件</div>
          </div>
          <div className="mt-4">
            <Button variant="danger" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
              初期化
            </Button>
          </div>
        </section>

        <section className="rounded-md bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900">
          公式シラバスや学修要覧の自動取得はMVPでは行いません。CSV/JSONの手動インポートを優先し、外部サイトへのアクセス負荷や利用規約に配慮します。
        </section>
      </aside>
    </div>
  );
};
