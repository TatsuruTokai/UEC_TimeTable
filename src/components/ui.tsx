import { useState, type InputHTMLAttributes, type ReactNode } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export const Button = ({ className = "", variant = "secondary", ...props }: ButtonProps) => {
  const variants = {
    primary: "bg-uec-600 text-white hover:bg-uec-700 shadow-sm",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
};

export const IconButton = ({ className = "", title, ...props }: ButtonProps & { title: string }) => (
  <button
    aria-label={title}
    title={title}
    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    {...props}
  />
);

export const Field = ({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) => (
  <label className={`grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 ${className}`}>
    <span>{label}</span>
    {children}
    {hint ? <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{hint}</span> : null}
  </label>
);

export const inputClass =
  "min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-uec-500 focus:ring-2 focus:ring-uec-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-uec-900";

export const fileInputClass = `${inputClass} cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-uec-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white file:transition hover:file:bg-uec-700 dark:file:bg-uec-600 dark:file:text-white dark:hover:file:bg-uec-500`;

type FileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> & {
  buttonLabel?: string;
  idleLabel?: string;
  className?: string;
};

export const FileInput = ({ buttonLabel = "ファイルを選択", idleLabel = "選択されていません", className = "", onChange, ...props }: FileInputProps) => {
  const [fileName, setFileName] = useState("");

  return (
    <label
      className={`uec-file-input flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-700 outline-none transition hover:border-uec-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-uec-500 ${className}`}
      style={{ backgroundColor: "#020617", borderColor: "#334155", color: "#cbd5e1" }}
    >
      <span
        className="uec-file-input-button inline-flex min-h-9 shrink-0 items-center justify-center rounded-md bg-uec-600 px-3 text-sm font-semibold text-white transition hover:bg-uec-700 dark:bg-uec-600 dark:hover:bg-uec-500"
        style={{ backgroundColor: "#096abf", color: "#ffffff" }}
      >
        {buttonLabel}
      </span>
      <span className="min-w-0 truncate text-slate-500 dark:text-slate-300">{fileName || idleLabel}</span>
      <input
        {...props}
        type="file"
        className="sr-only"
        onChange={(event) => {
          setFileName(event.currentTarget.files?.[0]?.name ?? "");
          onChange?.(event);
        }}
      />
    </label>
  );
};

export const ProgressBar = ({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "amber" | "rose" }) => {
  const tones = {
    blue: "bg-uec-600",
    green: "bg-emerald-600",
    amber: "bg-amber-500",
    rose: "bg-rose-600",
  };
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
};

export const Metric = ({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) => (
  <div className="min-w-0 border-l border-slate-200 pl-4 dark:border-slate-800">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{value}</div>
    {sub ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div> : null}
  </div>
);

export const EmptyState = ({ title, body }: { title: string; body?: string }) => (
  <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-slate-300 px-4 text-center text-sm dark:border-slate-700">
    <div>
      <div className="font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      {body ? <div className="mt-1 text-slate-500 dark:text-slate-400">{body}</div> : null}
    </div>
  </div>
);

export const ModalFrame = ({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) => (
  <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={onClose}>
    <section
      className="max-h-[96svh] w-full overflow-hidden rounded-t-lg bg-white shadow-2xl dark:bg-slate-950 sm:max-w-3xl sm:rounded-lg"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
      <div className="max-h-[calc(96svh-8rem)] overflow-y-auto px-5 py-4">{children}</div>
      {footer ? <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">{footer}</div> : null}
    </section>
  </div>
);
