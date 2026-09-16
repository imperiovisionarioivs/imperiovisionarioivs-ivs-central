"use client";

import { useOptimistic, useTransition } from "react";
import { toggleChecklistAction } from "@/app/actions/clients";
import { CheckIcon } from "./icons";
import { ProgressBar } from "./ui";
import { clsx } from "@/lib/clsx";

type Step = { key: string; label: string };

export function ChecklistWidget({
  clientId,
  steps,
  initial,
}: {
  clientId: number;
  steps: readonly Step[];
  initial: Record<string, boolean>;
}) {
  const [, startTransition] = useTransition();
  const [checklist, setOptimistic] = useOptimistic(
    initial,
    (state, update: { key: string; value: boolean }) => ({
      ...state,
      [update.key]: update.value,
    })
  );

  const done = steps.filter((s) => checklist[s.key]).length;
  const pct = steps.length > 0 ? (done / steps.length) * 100 : 0;

  function toggle(key: string, value: boolean) {
    startTransition(async () => {
      setOptimistic({ key, value });
      await toggleChecklistAction({ clientId, key, value });
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-900">
          Checklist de produção
        </p>
        <span className="text-xs text-ink-400">
          {done}/{steps.length}
        </span>
      </div>
      <div className="mb-4">
        <ProgressBar value={pct} />
      </div>
      <ul className="space-y-1">
        {steps.map((step) => {
          const checked = Boolean(checklist[step.key]);
          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => toggle(step.key, !checked)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink-50"
              >
                <span
                  className={clsx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    checked
                      ? "border-gold-500 bg-gold-500 text-white"
                      : "border-ink-300 text-transparent"
                  )}
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                <span
                  className={clsx(
                    "text-sm",
                    checked ? "text-ink-400 line-through" : "text-ink-700"
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
