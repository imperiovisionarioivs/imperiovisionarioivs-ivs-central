"use client";

import { useTransition } from "react";
import { updateStageAction } from "@/app/actions/clients";
import { STAGES } from "@/lib/db/schema";

export function StageSelect({
  clientId,
  currentStage,
}: {
  clientId: number;
  currentStage: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={currentStage}
      disabled={isPending}
      onChange={(e) => {
        const stage = e.target.value as (typeof STAGES)[number]["key"];
        startTransition(() => {
          updateStageAction({ clientId, stage });
        });
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs font-medium text-ink-700 outline-none focus:border-gold-400 disabled:opacity-50"
    >
      {STAGES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
