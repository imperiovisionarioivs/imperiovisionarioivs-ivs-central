"use client";

import { useRef, useState, useTransition } from "react";
import { addActivityAction } from "@/app/actions/clients";
import { Button } from "./ui";

type Activity = {
  id: number;
  type: string;
  message: string;
  actorName: string;
  createdAt: Date | string;
};

const TYPE_LABEL: Record<string, string> = {
  visita: "Visita",
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  reuniao: "Reunião",
  nota: "Nota",
};

export function ActivityTimeline({
  clientId,
  activities,
}: {
  clientId: number;
  activities: Activity[];
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState("nota");
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;
    startTransition(async () => {
      await addActivityAction({ clientId, type, message });
      formRef.current?.reset();
    });
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink-900">Histórico</p>

      <form ref={formRef} action={handleSubmit} className="mb-4 space-y-2">
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-ink-200 px-2 py-2 text-xs outline-none focus:border-gold-400"
          >
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            name="message"
            placeholder="Registrar contato, objeção, próximo passo..."
            className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
          {isPending ? "Salvando..." : "Adicionar ao histórico"}
        </Button>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-ink-400">Nenhum registro ainda.</p>
      ) : (
        <ol className="space-y-3 border-l border-ink-100 pl-4">
          {activities.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-gold-400" />
              <p className="text-sm text-ink-800">{a.message}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {TYPE_LABEL[a.type] ?? a.type} · {a.actorName} ·{" "}
                {new Date(a.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
