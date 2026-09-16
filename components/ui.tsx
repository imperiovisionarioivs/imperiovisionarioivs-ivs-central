import { clsx } from "@/lib/clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  dark,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl p-5 shadow-card",
        dark ? "border border-ink-950 bg-ink-950" : "border border-ink-100 bg-white",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "green" | "red" | "blue";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-100 text-ink-600",
    gold: "bg-gold-100 text-gold-800",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const variants: Record<string, string> = {
    primary: "bg-ink-950 text-white hover:bg-ink-800 active:bg-ink-900",
    secondary: "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50",
    ghost: "text-ink-600 hover:bg-ink-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-sm rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  dark,
}: {
  label: string;
  value: string;
  sub?: string;
  dark?: boolean;
}) {
  return (
    <Card dark={dark}>
      <div className="mb-3 h-1 w-8 rounded-full bg-gold-400" />
      <p className={clsx("text-sm", dark ? "text-ink-300" : "text-ink-500")}>{label}</p>
      <p className={clsx("mt-1 text-2xl font-semibold tracking-tight", dark ? "text-white" : "text-ink-950")}>
        {value}
      </p>
      {sub && <p className={clsx("mt-1 text-xs", dark ? "text-ink-400" : "text-ink-400")}>{sub}</p>}
    </Card>
  );
}
