"use client";

import { useState, useTransition } from "react";
import { logAgendaResultAction } from "@/app/actions/clients";
import { Button } from "./ui";

export function AgendaResultForm({ clientId }: { clientId: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-gold-700 hover:underline"
      >
        Registrar resultado
      </button>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await logAgendaResultAction({
          clientId,
          result: formData.get("result"),
          nextAction: formData.get("nextAction"),
          nextActionDate: formData.get("nextActionDate"),
        });
        setOpen(false);
      } catch {
        setError("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="mt-2 space-y-2 rounded-xl border border-ink-100 bg-ink-50/60 p-2.5"
    >
      <textarea
        name="result"
        required
        placeholder="Resultado do atendimento..."
        rows={2}
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-gold-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="nextAction"
          placeholder="Próxima ação"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-gold-400"
        />
        <input
          type="date"
          name="nextActionDate"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-gold-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
