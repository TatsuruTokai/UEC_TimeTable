import { AlertTriangle, BarChart3, GraduationCap, TrendingUp } from "lucide-react";
import type { AppState } from "../types";
import type { CreditAudit } from "../utils/credits";
import { analyzeGrades } from "../utils/grades";
import { EmptyState, Metric, ProgressBar } from "./ui";

const fmt = (value: number, digits = 1) => (Number.isInteger(value) ? String(value) : value.toFixed(digits));

export const AnalysisView = ({ state, audit }: { state: AppState; audit: CreditAudit }) => {
  const records = state.gradeImport?.records ?? [];
  const analysis = analyzeGrades(records);
  const maxCredits = Math.max(...analysis.terms.map((term) => term.credits), 1);
  const maxDistribution = Math.max(...analysis.distribution.map((row) => row.credits), 1);

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-uec-600" />
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">GPA・成績推移</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">確定成績CSVからGPA、取得単位推移、落単・再履修候補を集計します。</p>
          </div>
        </div>
        {records.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="GPA" value={analysis.gpa ? analysis.gpa.toFixed(2) : "-"} sub={`${fmt(analysis.gradedCredits)} GPA対象単位`} />
            <Metric label="取得単位" value={`${fmt(analysis.earnedCredits)}単位`} sub={`卒業見込み ${fmt(audit.forecastTotal)}単位`} />
            <Metric label="履修単位" value={`${fmt(analysis.attemptedCredits)}単位`} sub={`${analysis.passedCount}科目合格`} />
            <Metric label="落単" value={`${analysis.failedCount}科目`} sub={`${analysis.retakeCandidates.length}件を候補化`} />
            <Metric label="卒業進捗" value={`${Math.round(audit.graduationProgress)}%`} sub={`残り ${fmt(audit.shortageTotal)}単位`} />
          </div>
        ) : null}
      </section>

      {!records.length ? (
        <EmptyState title="成績CSVが未取込です" body="初期設定または設定画面から確定成績CSVを取り込むと分析を表示します。" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          <section className="grid gap-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-uec-600" />
                <h2 className="text-lg font-semibold">学期別推移</h2>
              </div>
              <div className="grid gap-3">
                {analysis.terms.map((term) => (
                  <div key={term.key} className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-slate-950 dark:text-white">{term.label}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        GPA {term.gradedCredits ? term.gpa.toFixed(2) : "-"} / {fmt(term.credits)}単位 / 落単 {term.failedCount}
                      </div>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-[5rem_1fr_4rem] sm:items-center">
                      <div className="text-xs font-semibold text-slate-500">GPA</div>
                      <ProgressBar value={(term.gpa / 4) * 100} tone={term.gpa >= 3 ? "green" : term.gpa >= 2 ? "blue" : "amber"} />
                      <div className="text-right text-sm font-semibold">{term.gradedCredits ? term.gpa.toFixed(2) : "-"}</div>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-[5rem_1fr_4rem] sm:items-center">
                      <div className="text-xs font-semibold text-slate-500">単位</div>
                      <ProgressBar value={(term.credits / maxCredits) * 100} tone="green" />
                      <div className="text-right text-sm font-semibold">{fmt(term.credits)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-uec-600" />
                <h2 className="text-lg font-semibold">評語分布</h2>
              </div>
              <div className="grid gap-3">
                {analysis.distribution.length ? (
                  analysis.distribution.map((row) => (
                    <div key={row.grade} className="grid gap-1 sm:grid-cols-[4rem_1fr_6rem] sm:items-center">
                      <div className="font-semibold">{row.grade}</div>
                      <ProgressBar value={(row.credits / maxDistribution) * 100} tone={row.grade === "不可" || row.grade === "F" || row.grade === "D" ? "rose" : "blue"} />
                      <div className="text-right text-sm text-slate-500 dark:text-slate-400">{row.count}科目 / {fmt(row.credits)}単位</div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="GPA対象評語がありません" body="合否のみの科目はGPAから除外しています。" />
                )}
              </div>
            </section>
          </section>

          <aside className="grid gap-5 lg:sticky lg:top-32 lg:self-start">
            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <h2 className="text-lg font-semibold">落単・再履修候補</h2>
              </div>
              <div className="mt-4 grid max-h-[34rem] gap-2 overflow-y-auto">
                {analysis.retakeCandidates.length ? (
                  analysis.retakeCandidates.map((record) => (
                    <div key={record.id} className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                      <div className="font-semibold">{record.subject}</div>
                      <div className="mt-1">
                        {fmt(record.credits)}単位 / {record.grade || record.passFail} / {record.categoryPath || "区分不明"}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="再履修候補はありません" />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <h2 className="text-lg font-semibold">単位不足との接続</h2>
              <div className="mt-4 grid gap-3 text-sm">
                {audit.candidateGroups.slice(0, 5).map((group) => (
                  <div key={group.categoryId} className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                    <div className="font-semibold text-slate-950 dark:text-white">{group.label}</div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">不足 {fmt(group.shortage)}単位 / 候補 {group.candidates.length}件</div>
                  </div>
                ))}
                {!audit.candidateGroups.length ? <EmptyState title="不足候補はありません" /> : null}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};
