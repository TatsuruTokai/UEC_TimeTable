import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { CatalogData } from "../data/catalog";
import type { UserSettings } from "../types";
import { academicSettingsComplete, buildAcademicOptions, GRADE_OPTIONS, normalizeAcademicSettings, requiresProgram } from "../utils/academicOptions";

type Option = {
  value: string;
  label: string;
};

export const AccordionSelect = ({
  label,
  value,
  placeholder,
  options,
  onChange,
  required,
  disabled,
  error,
}: {
  label: string;
  value?: string | number;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => String(option.value) === String(value));
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        {required ? <span className="text-xs font-semibold text-rose-600 dark:text-rose-300">必須</span> : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border bg-white px-3 text-left text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950 ${
          error
            ? "border-rose-300 ring-2 ring-rose-100 dark:border-rose-800 dark:ring-rose-950"
            : "border-slate-200 focus:border-uec-500 focus:ring-2 focus:ring-uec-100 dark:border-slate-700 dark:focus:ring-uec-900"
        }`}
      >
        <span className={selected ? "text-slate-950 dark:text-white" : "text-slate-400"}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-950">
          {options.map((option) => {
            const selectedOption = String(option.value) === String(value);
            return (
              <button
                key={option.value}
                type="button"
                data-option-value={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex min-h-9 items-center justify-between gap-2 rounded px-2 text-left text-sm transition ${
                  selectedOption ? "bg-uec-50 font-semibold text-uec-800 dark:bg-uec-950 dark:text-uec-100" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                }`}
              >
                <span>{option.label}</span>
                {selectedOption ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const useAcademicSelectorOptions = (catalog: CatalogData, settings: UserSettings) => {
  const options = useMemo(() => buildAcademicOptions(catalog.requirements), [catalog.requirements]);
  const yearOptions = options.years.map((year) => ({ value: String(year), label: `${year}年度` }));
  const gradeOptions = GRADE_OPTIONS.map((grade) => ({ value: grade, label: grade }));
  const clusterOptions = options.clusters.map((cluster) => ({ value: cluster, label: cluster }));
  const allowedPrograms = settings.cluster ? options.programsByCluster[settings.cluster] ?? [] : options.programs;
  const programOptions = allowedPrograms.map((program) => ({ value: program, label: program }));
  return { options, yearOptions, gradeOptions, clusterOptions, programOptions };
};

export const AcademicProfileFields = ({
  catalog,
  settings,
  onChange,
  showValidation,
}: {
  catalog: CatalogData;
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
  showValidation?: boolean;
}) => {
  const { options, yearOptions, gradeOptions, clusterOptions, programOptions } = useAcademicSelectorOptions(catalog, settings);
  const programRequired = requiresProgram(settings.gradeYear);
  const update = (patch: Partial<UserSettings>) => onChange(normalizeAcademicSettings(settings, options, patch));
  const complete = academicSettingsComplete(settings);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AccordionSelect
        label="入学年度"
        value={settings.admissionYear ? String(settings.admissionYear) : ""}
        placeholder="入学年度を選択"
        options={yearOptions}
        required
        error={showValidation && !settings.admissionYear}
        onChange={(value) => update({ admissionYear: Number(value) })}
      />
      <AccordionSelect
        label="年次"
        value={settings.gradeYear}
        placeholder="年次を選択"
        options={gradeOptions}
        required
        error={showValidation && !settings.gradeYear}
        onChange={(value) => update({ gradeYear: value })}
      />
      <AccordionSelect
        label="類"
        value={settings.cluster}
        placeholder="類を選択"
        options={clusterOptions}
        required
        error={showValidation && !settings.cluster}
        onChange={(value) => update({ cluster: value })}
      />
      <AccordionSelect
        label="プログラム"
        value={settings.program}
        placeholder={programRequired ? "プログラムを選択" : "未定でも可"}
        options={programOptions}
        required={programRequired}
        disabled={!settings.cluster && programOptions.length === 0}
        error={showValidation && programRequired && !settings.program}
        onChange={(value) => update({ program: value })}
      />
      {showValidation && !complete ? (
        <div className="rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900 sm:col-span-2">
          学年・類を選択してください。3年以上の場合はプログラムも必須です。
        </div>
      ) : null}
    </div>
  );
};
