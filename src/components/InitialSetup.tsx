import { AlertTriangle, CheckCircle2, FileUp, GraduationCap } from "lucide-react";
import { useState } from "react";
import type { CatalogData } from "../data/catalog";
import type { GradeCsvImport, UserSettings } from "../types";
import { academicSettingsComplete, buildAcademicOptions, normalizeAcademicSettings } from "../utils/academicOptions";
import { parseKakuteiSeisekiBuffer } from "../utils/csv";
import { AcademicProfileFields } from "./AcademicSelectors";
import { Button, FileInput } from "./ui";

export const InitialSetup = ({
  catalog,
  settings,
  onComplete,
}: {
  catalog: CatalogData;
  settings: UserSettings;
  onComplete: (settings: UserSettings, gradeImport: GradeCsvImport) => void;
}) => {
  const [draft, setDraft] = useState<UserSettings>({ ...settings, faculty: "情報理工学域" });
  const [showValidation, setShowValidation] = useState(false);
  const [gradeImport, setGradeImport] = useState<GradeCsvImport | undefined>();
  const [csvError, setCsvError] = useState("");

  const importCsv = async (file: File) => {
    setCsvError("");
    try {
      const parsed = parseKakuteiSeisekiBuffer(await file.arrayBuffer());
      setGradeImport(parsed);
      setDraft((current) =>
        normalizeAcademicSettings(current, buildAcademicOptions(catalog.requirements), {
          admissionYear: parsed.student.admissionYear ?? current.admissionYear,
          cluster: parsed.student.cluster ?? current.cluster,
          program: parsed.student.program ?? current.program,
          gradeYear: parsed.student.gradeYear ?? current.gradeYear,
        }),
      );
    } catch (error) {
      setGradeImport(undefined);
      setCsvError(error instanceof Error ? error.message : "CSVを読み込めませんでした。");
    }
  };

  const submit = () => {
    setShowValidation(true);
    if (!academicSettingsComplete(draft) || !gradeImport) return;
    onComplete({
      ...draft,
      faculty: "情報理工学域",
      initialSetupCompleted: true,
    }, gradeImport);
  };

  return (
    <main className="min-h-svh bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-50 sm:px-6">
      <section className="mx-auto grid min-h-[calc(100svh-3rem)] max-w-3xl place-items-center">
        <div className="w-full rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-uec-600 text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">初期設定</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                まず単位修得状況のCSVを添付してください。CSVから取得済み単位を読み込み、必要単位リストに反映します。
              </p>
            </div>
          </div>

          <section className="uec-csv-panel mt-6 grid gap-4 rounded-lg border border-uec-100 bg-uec-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-start gap-3">
              <FileUp className="mt-0.5 h-5 w-5 shrink-0 text-uec-700 dark:text-uec-100" />
              <div>
                <h2 className="font-semibold text-slate-950 dark:text-white">単位修得状況CSV</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  学務情報システムの「過去を含めた全成績」CSVを取り込みます。このCSVは初期設定で必須です。
                </p>
              </div>
            </div>
            <ol className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
              <li>1. 学務情報システムを開いてログインする</li>
              <li>2. スマホは左上の三本線、PCは左側タブから「教務・授業関連」を開く</li>
              <li>3. 「成績」から「単位修得状況照会」を開く</li>
              <li>4. 「過去を含めた全成績」を選び、「ファイルに出力」から「ファイル出力開始」を押す</li>
              <li>5. 出力されたCSVをここに添付する</li>
            </ol>
            <FileInput
              accept=".csv,text/csv"
              onChange={(event) => event.target.files?.[0] && void importCsv(event.target.files[0])}
            />
            {gradeImport ? (
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  CSVを読み込みました
                </div>
                <div className="mt-1">
                  合格済み {gradeImport.records.filter((record) => record.passed).length}科目 / 全{gradeImport.records.length}行
                  {gradeImport.student.affiliation ? ` / ${gradeImport.student.affiliation}` : ""}
                </div>
              </div>
            ) : null}
            {csvError ? (
              <div className="rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900">
                {csvError}
              </div>
            ) : null}
            {showValidation && !gradeImport ? (
              <div className="flex items-start gap-2 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                単位修得状況CSVの添付が必要です。
              </div>
            ) : null}
          </section>

          <div className="mt-6">
            <AcademicProfileFields catalog={catalog} settings={draft} onChange={setDraft} showValidation={showValidation} />
          </div>

          <div className="mt-6 rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            学域は情報理工学域で固定です。プログラムを選ぶと、対応する類も自動で選択されます。
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={submit}>
              始める
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};
