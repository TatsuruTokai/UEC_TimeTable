import { AlertTriangle, CheckCircle2, ExternalLink, GraduationCap, ListChecks, Target } from "lucide-react";
import { useState } from "react";
import type { CreditAudit, CreditAuditRow, CreditCandidateGroup, RequirementProfile } from "../utils/credits";
import { EmptyState, Metric, ProgressBar } from "./ui";

const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const profileHelp: Record<RequirementProfile["id"], string> = {
  "third-year": "2年次終了時審査の総単位・区分・対象科目を構造化データで確認します。",
  "fourth-year": "卒業研究着手審査の総単位・区分・プログラム指定条件を確認します。",
  graduation: "卒業所要単位を区分別に確認します。不足区分から履修候補を出します。",
};

const CategoryProgressTable = ({ rows }: { rows: CreditAuditRow[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[760px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
          <th className="py-2 pr-3">区分</th>
          <th className="py-2 pr-3 text-right">必要</th>
          <th className="py-2 pr-3 text-right">取得済み</th>
          <th className="py-2 pr-3 text-right">履修中</th>
          <th className="py-2 pr-3 text-right">不足</th>
          <th className="py-2 pr-3">進捗</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const percent = row.required ? Math.min(100, (row.earned / row.required) * 100) : 0;
          return (
            <tr key={row.categoryId} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-3 pr-3 font-semibold text-slate-900 dark:text-white">
                <div>{row.label}</div>
                {row.sourcePage ? <div className="mt-0.5 text-xs font-normal text-slate-500">p.{row.sourcePage}</div> : null}
              </td>
              <td className="py-3 pr-3 text-right">{fmt(row.required)}</td>
              <td className="py-3 pr-3 text-right">{fmt(row.earned)}</td>
              <td className="py-3 pr-3 text-right">{fmt(row.planned)}</td>
              <td className={`py-3 pr-3 text-right font-semibold ${row.shortage ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}`}>{fmt(row.shortage)}</td>
              <td className="min-w-36 py-3 pr-3">
                <ProgressBar value={percent} tone={row.shortage ? "blue" : "green"} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const RequirementDetail = ({ profile }: { profile: RequirementProfile }) => {
  const shortageValue = profile.shortageCredits ? `${fmt(profile.shortageCredits)}単位` : profile.satisfied ? "0単位" : "未達条件あり";
  const forecastShortageText = profile.forecastSatisfied
    ? "履修中込みで達成見込み"
    : profile.forecastShortageCredits
      ? `履修中込み不足 ${fmt(profile.forecastShortageCredits)}単位`
      : "履修中込みでも未達条件あり";

  return (
  <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-uec-600" />
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{profile.label}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{profileHelp[profile.id]}</p>
      </div>
      <div
        className={`rounded-md px-2.5 py-1 text-sm font-semibold ${
          profile.satisfied
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900"
            : "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900"
        }`}
      >
        {profile.satisfied ? "達成済み" : "未達"} {Math.round(profile.progress)}%
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="必要単位" value={`${fmt(profile.requiredCredits)}単位`} />
      <Metric label="取得済み" value={`${fmt(profile.earnedCredits)}単位`} />
      <Metric label="不足" value={shortageValue} sub={forecastShortageText} />
      <Metric label="履修中込み" value={`${fmt(profile.forecastCredits)}単位`} sub={`見込み進捗 ${Math.round(profile.forecastProgress)}%`} />
    </div>

    <div className="grid gap-2">
      <ProgressBar value={profile.progress} tone={profile.satisfied ? "green" : "blue"} />
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{fmt(profile.earnedCredits)} / {fmt(profile.requiredCredits)}単位</span>
        <span>{profile.satisfied ? "条件を満たしています" : profile.shortageCredits ? `残り ${fmt(profile.shortageCredits)}単位` : "必修・指定条件が未達です"}</span>
      </div>
    </div>

    {profile.detailRows.length ? <CategoryProgressTable rows={profile.detailRows} /> : null}

    {profile.missingRequiredSubjects.length || profile.unsatisfiedGroups.length ? (
      <div className="grid gap-3 md:grid-cols-2">
        {profile.unsatisfiedGroups.length ? (
          <div className="rounded-md border border-rose-100 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/30">
            <div className="font-semibold text-rose-900 dark:text-rose-100">未充足の区分・グループ</div>
            <ul className="mt-2 grid gap-1 text-rose-800 dark:text-rose-200">
              {profile.unsatisfiedGroups.slice(0, 12).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        {profile.missingRequiredSubjects.length ? (
          <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            <div className="font-semibold text-amber-950 dark:text-amber-100">未取得必修・指定科目</div>
            <ul className="mt-2 grid gap-1 text-amber-900 dark:text-amber-100">
              {profile.missingRequiredSubjects.slice(0, 12).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    ) : null}

    <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
      {profile.confidence ? <div>データ確度: {profile.confidence}</div> : null}
      {profile.sourceUrl ? (
        <a href={profile.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-uec-700 hover:underline dark:text-uec-300">
          ソース: 学修要覧 {profile.sourcePages?.length ? `p.${profile.sourcePages.join(", ")}` : ""}
        </a>
      ) : null}
      {profile.notes.map((note) => (
        <div key={note}>{note}</div>
      ))}
    </div>
  </section>
  );
};

const CandidateGroup = ({ group }: { group: CreditCandidateGroup }) => (
  <section className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-semibold text-slate-950 dark:text-white">{group.label}</h3>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{group.categoryId}</div>
      </div>
      <span className="rounded-md bg-rose-50 px-2.5 py-1 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
        不足 {fmt(group.shortage)}単位
      </span>
    </div>
    {group.candidates.length ? (
      <div className="grid gap-2">
        {group.candidates.map((subject) => (
          <a
            key={`${group.categoryId}-${subject.subjectCode}-${subject.subject}`}
            href={subject.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm transition hover:bg-uec-50 dark:bg-slate-950 dark:hover:bg-uec-900/20 sm:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate font-semibold text-slate-950 dark:text-white">{subject.subject}</div>
                {subject.sourceUrl ? <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" /> : null}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subject.categoryPath}</div>
            </div>
            <div className="flex flex-wrap gap-1.5 self-start sm:justify-end">
              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">{fmt(subject.credits)}単位</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">{subject.requirementType}</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                {subject.termLabels.length ? subject.termLabels.join(" / ") : "開講学期不明"}
              </span>
              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                {subject.eligibleYears.length ? `${subject.eligibleYears.join(",")}年配当` : "配当年次不明"}
              </span>
            </div>
          </a>
        ))}
      </div>
    ) : (
      <EmptyState title="候補がありません" body="この区分に一致し、現在の学年で履修できる未取得科目がデータセット内に見つかりません。" />
    )}
  </section>
);

export const CreditsView = ({ audit }: { audit: CreditAudit }) => {
  const [activeProfileId, setActiveProfileId] = useState<RequirementProfile["id"]>("graduation");
  const activeProfile = audit.requirementProfiles.find((profile) => profile.id === activeProfileId) ?? audit.requirementProfiles[0];

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-uec-600" />
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">単位管理</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">進級目安、卒業要件、不足区分に合う履修候補を確認します。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="総取得単位数" value={`${fmt(audit.earnedTotal)}単位`} />
          <Metric label="卒業必要単位" value={`${fmt(audit.totalRequired)}単位`} />
          <Metric label="残り単位数" value={`${fmt(audit.shortageTotal)}単位`} />
          <Metric label="今学期後の予測" value={`${fmt(audit.forecastTotal)}単位`} sub={`履修中・予定 ${fmt(audit.takingTotal)}単位`} />
        </div>
      </section>

      <section className="rounded-md bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            卒業要件・進級要件は年度・所属・類・プログラムによって異なります。最終的な判定は公式の学修要覧・教務課資料を確認してください。
          </div>
        </div>
      </section>

      {activeProfile ? (
        <div className="grid gap-4">
          <div className="flex gap-2 overflow-x-auto">
            {audit.requirementProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setActiveProfileId(profile.id)}
                className={`min-h-10 shrink-0 rounded-md px-3 text-sm font-semibold transition ${
                  activeProfileId === profile.id
                    ? "bg-uec-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
                }`}
              >
                {profile.label}
              </button>
            ))}
          </div>
          <RequirementDetail profile={activeProfile} />
        </div>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-uec-600" />
            <h2 className="text-lg font-semibold">不足区分に合う取得候補</h2>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">取得済み・履修中・現在の学年で履修不可の科目は除外済み</div>
        </div>
        {audit.candidateGroups.length ? (
          <div className="grid gap-3">
            {audit.candidateGroups.map((group) => (
              <CandidateGroup key={group.categoryId} group={group} />
            ))}
          </div>
        ) : (
          <EmptyState title="不足区分に対応する候補はありません" body="不足がないか、現在の学年で履修可能な未取得科目がデータセット内にありません。" />
        )}
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">区分ごとの進捗</h2>
          <div className="text-sm text-slate-500 dark:text-slate-400">履修中を含めた予測も表示</div>
        </div>
        {audit.rows.length ? (
          <CategoryProgressTable rows={audit.rows} />
        ) : (
          <EmptyState title="要件データがありません" body="設定画面で入学年度・類・プログラムを確認するか、手入力要件を設定してください。" />
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">必修未取得一覧</h2>
            <span className="text-sm text-slate-500">{audit.missingRequired.length}件</span>
          </div>
          {audit.missingRequired.length ? (
            <div className="grid max-h-96 gap-2 overflow-y-auto">
              {audit.missingRequired.slice(0, 60).map((subject) => (
                <a key={`${subject.subject_code}-${subject.subject}`} href={subject.source_url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-200 p-3 text-sm transition hover:border-uec-300 hover:bg-uec-50 dark:border-slate-800 dark:hover:border-uec-700 dark:hover:bg-uec-900/20">
                  <div className="font-semibold text-slate-950 dark:text-white">{subject.subject}</div>
                  <div className="mt-1 text-slate-500">{subject.credits}単位 / {subject.category_path}</div>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                必修未取得候補はありません
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">落単・再履修予定</h2>
            <span className="text-sm text-slate-500">{audit.failedOrRetake.length}件</span>
          </div>
          {audit.failedOrRetake.length ? (
            <div className="grid gap-2">
              {audit.failedOrRetake.map((row, index) => (
                <div key={`${row.source}-${row.subject}-${index}`} className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                  <div className="font-semibold">{row.subject}</div>
                  <div className="mt-1">{fmt(row.credits)}単位 / {row.source === "csv" ? "確定成績CSV" : "時間割"}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="対象科目はありません" />
          )}
        </section>
      </div>
    </div>
  );
};
