import { BarChart3, Bell, CalendarDays, GraduationCap, MapPinned, Settings, Share2, SunMoon, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import type { ScreenId } from "../types";
import { IconButton } from "./ui";
import { PwaStatus } from "./PwaStatus";

const navItems: { id: ScreenId; label: string; icon: typeof CalendarDays }[] = [
  { id: "dashboard", label: "ダッシュボード", icon: BarChart3 },
  { id: "timetable", label: "時間割", icon: CalendarDays },
  { id: "credits", label: "単位管理", icon: GraduationCap },
  { id: "calendar", label: "課題・予定", icon: Bell },
  { id: "share", label: "共有", icon: Share2 },
  { id: "campus", label: "教室", icon: MapPinned },
  { id: "analysis", label: "成績分析", icon: TrendingUp },
  { id: "settings", label: "設定", icon: Settings },
];

export const Shell = ({
  active,
  onChange,
  children,
  onToggleTheme,
}: {
  active: ScreenId;
  onChange: (screen: ScreenId) => void;
  children: ReactNode;
  onToggleTheme: () => void;
}) => (
  <div className="min-h-svh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white">UEC TimeTable</h1>
            <span className="hidden text-xs font-semibold text-uec-700 dark:text-uec-100 sm:inline">PWA</span>
          </div>
          <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">時間割・教室・単位・課題をブラウザ内に保存</p>
        </div>
        <div className="flex items-center gap-1">
          <PwaStatus />
          <IconButton title="テーマ切り替え" onClick={onToggleTheme}>
            <SunMoon className="h-5 w-5" />
          </IconButton>
        </div>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                selected
                  ? "bg-uec-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">{children}</main>
  </div>
);
