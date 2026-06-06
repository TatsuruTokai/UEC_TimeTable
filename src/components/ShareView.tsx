import { Copy, Download, Link2, Share2, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { DAYS } from "../data/defaultData";
import type { AppState, FriendSchedule } from "../types";
import { buildSharePayload, buildShareUrl, compareSchedules, decodeSharePayload, payloadToFriendSchedule } from "../utils/sharing";
import { courseTimeLabel } from "../utils/timetable";
import { Button, EmptyState, Field, inputClass } from "./ui";

const dayLabel = (dayId: string) => DAYS.find((day) => day.id === dayId)?.shortLabel ?? dayId;

const parseShareInput = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const hashMatch = trimmed.match(/[#&?]share=([^&\s]+)/);
  return decodeSharePayload(hashMatch?.[1] ?? trimmed);
};

export const ShareView = ({
  state,
  onImportFriendSchedule,
  onDeleteFriendSchedule,
}: {
  state: AppState;
  onImportFriendSchedule: (schedule: FriendSchedule) => void;
  onDeleteFriendSchedule: (scheduleId: string) => void;
}) => {
  const [ownerName, setOwnerName] = useState(state.gradeImport?.student.name || "自分");
  const [message, setMessage] = useState("");
  const [importText, setImportText] = useState("");
  const [activeFriendId, setActiveFriendId] = useState(state.friendSchedules?.[0]?.id ?? "");
  const payload = useMemo(() => buildSharePayload(state, ownerName), [ownerName, state]);
  const shareUrl = useMemo(() => buildShareUrl(payload), [payload]);
  const friends = state.friendSchedules ?? [];
  const activeFriend = friends.find((friend) => friend.id === activeFriendId) ?? friends[0];
  const comparison = activeFriend ? compareSchedules(state.courses, activeFriend) : undefined;

  const copyShareUrl = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setMessage("共有リンクをコピーしました。");
  };

  const shareNative = async () => {
    try {
      if (!navigator.share) {
        await copyShareUrl();
        return;
      }
      await navigator.share({ title: "UEC TimeTable", text: `${ownerName}の時間割`, url: shareUrl });
    } catch {
      setMessage("共有をキャンセルしました。");
    }
  };

  const importSchedule = () => {
    const decoded = parseShareInput(importText);
    if (!decoded) {
      setMessage("共有リンクを読み込めませんでした。");
      return;
    }
    const schedule = payloadToFriendSchedule(decoded);
    onImportFriendSchedule(schedule);
    setActiveFriendId(schedule.id);
    setImportText("");
    setMessage(`${schedule.ownerName}の時間割を取り込みました。`);
  };

  const downloadPayload = () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "uec-timetable-share.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <section className="grid gap-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">空きコマ比較・共有</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">時間割だけを共有して、共通の空きコマと同じ授業を確認します。</p>
            </div>
            <Button variant="primary" onClick={shareNative}>
              <Share2 className="h-4 w-4" />
              共有
            </Button>
          </div>
          <div className="mt-5 grid gap-4">
            <Field label="表示名">
              <input className={inputClass} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
            </Field>
            <Field label="共有リンク">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input className={inputClass} readOnly value={shareUrl} />
                <Button onClick={copyShareUrl}>
                  <Copy className="h-4 w-4" />
                  コピー
                </Button>
                <Button onClick={downloadPayload}>
                  <Download className="h-4 w-4" />
                  JSON
                </Button>
              </div>
            </Field>
            {message ? <div className="rounded-md bg-uec-50 p-3 text-sm font-semibold text-uec-800 ring-1 ring-uec-100 dark:bg-uec-950 dark:text-uec-100 dark:ring-uec-900">{message}</div> : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">比較結果</h2>
            {activeFriend ? <span className="text-sm text-slate-500 dark:text-slate-400">{activeFriend.ownerName} / {activeFriend.courses.length}コマ</span> : null}
          </div>
          {comparison && activeFriend ? (
            <div className="grid gap-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">共通の空きコマ</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {comparison.commonFreePeriods.length ? (
                    comparison.commonFreePeriods.map((slot) => (
                      <span key={`${slot.day}-${slot.period}`} className="rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900">
                        {dayLabel(slot.day)}{slot.period}限
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">共通の空きコマはありません。</span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">同じ授業</h3>
                  <div className="mt-3 grid gap-2">
                    {comparison.sameCourses.length ? (
                      comparison.sameCourses.map((item) => (
                        <div key={`${item.mine.id}-${item.friend.id}`} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
                          <div className="font-semibold">{item.mine.name}</div>
                          <div className="mt-1 text-slate-500 dark:text-slate-400">
                            自分: {dayLabel(item.mine.dayOfWeek)} {courseTimeLabel(item.mine)} / 友達: {dayLabel(item.friend.dayOfWeek)} {item.friend.period}限
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState title="同じ授業はありません" />
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">友達の授業</h3>
                  <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto">
                    {activeFriend.courses.map((course) => (
                      <div key={`${course.id}-${course.name}`} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
                        <div className="font-semibold">{course.name}</div>
                        <div className="mt-1 text-slate-500 dark:text-slate-400">
                          {dayLabel(course.dayOfWeek)} {course.period}{course.periodEnd && course.periodEnd !== course.period ? `-${course.periodEnd}` : ""}限 {course.buildingName ?? ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <EmptyState title="比較する時間割がありません" body="友達から受け取った共有リンクを右側で取り込んでください。" />
          )}
        </section>
      </section>

      <aside className="grid gap-5 xl:sticky xl:top-32 xl:self-start">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-uec-600" />
            <h2 className="text-lg font-semibold">リンク取込</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <textarea className={`${inputClass} min-h-28 resize-y`} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="共有リンクまたは share=... の文字列" />
            <Button onClick={importSchedule} disabled={!importText.trim()}>
              <Link2 className="h-4 w-4" />
              取り込む
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-lg font-semibold">保存済み</h2>
          <div className="mt-4 grid gap-2">
            {friends.length ? (
              friends.map((friend) => (
                <div key={friend.id} className={`grid gap-2 rounded-md border p-3 ${activeFriend?.id === friend.id ? "border-uec-300 bg-uec-50 dark:border-uec-800 dark:bg-uec-950/30" : "border-slate-200 dark:border-slate-800"}`}>
                  <button type="button" onClick={() => setActiveFriendId(friend.id)} className="text-left">
                    <div className="font-semibold">{friend.ownerName}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(friend.exportedAt).toLocaleString("ja-JP")} / {friend.courses.length}コマ</div>
                  </button>
                  <Button variant="ghost" onClick={() => onDeleteFriendSchedule(friend.id)}>
                    <Trash2 className="h-4 w-4" />
                    削除
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState title="保存済み時間割はありません" />
            )}
          </div>
        </section>
      </aside>
    </div>
  );
};
