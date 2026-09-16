"use client";

import { useState, useTransition } from "react";
import { createExpenseAction, cancelExpenseAction } from "@/app/actions/expenses";
import { Badge, Button } from "./ui";
import type { ExpenseRow } from "@/lib/repo/expenses";

const CATEGORY_LABEL: Record<string, string> = {
  equipe_folha: "Equipe / folha",
  ferramentas_software: "Ferramentas / software",
  midia_paga: "Mídia paga",
  impostos_taxas: "Impostos / taxas",
  escritorio_infra: "Escritório / infraestrutura",
  comissoes: "Comissões",
  outro: "Outro",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function NewExpenseForm({ onDone }: { onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createExpenseAction({
          category: formData.get("category"),
          description: formData.get("description"),
          valueCents: Math.round(Number(String(formData.get("value")).replace(",", ".")) * 100),
          expenseDate: formData.get("expenseDate"),
          recurring: formData.get("recurring") === "on",
          notes: formData.get("notes"),
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2.5 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          name="category"
          defaultValue="outro"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        >
          {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="value"
          required
          inputMode="decimal"
          placeholder="Valor (R$)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      <input
        name="description"
        required
        placeholder="Descrição (ex: assinatura de ferramenta, salário, anúncio)"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          name="expenseDate"
          required
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <label className="flex items-center gap-2 text-xs text-ink-600">
          <input type="checkbox" name="recurring" className="h-3.5 w-3.5 rounded border-ink-300" />
          Gasto recorrente (mensal)
        </label>
      </div>
      <textarea
        name="notes"
        placeholder="Observações (opcional)"
        rows={2}
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Lançar gasto"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function ExpensePanel({ expenses }: { expenses: ExpenseRow[] }) {
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel(expenseId: number) {
    setError(null);
    startTransition(async () => {
      try {
        await cancelExpenseAction({ expenseId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível cancelar.");
      }
    });
  }

  const active = expenses.filter((e) => e.status !== "cancelado");
  const canceled = expenses.filter((e) => e.status === "cancelado");

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {active.length === 0 && <p className="text-sm text-ink-500">Nenhum gasto lançado ainda.</p>}

      <div className="space-y-1.5">
        {active.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-50/60 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-ink-800">
                {e.description} — {formatCents(e.valueCents)}
              </p>
              <p className="truncate text-xs text-ink-500">
                {CATEGORY_LABEL[e.category]} · {e.expenseDate}
                {e.recurring ? " · recorrente" : ""}
              </p>
            </div>
            <button
              className="shrink-0 text-xs font-medium text-ink-400 hover:underline"
              disabled={isPending}
              onClick={() => cancel(e.id)}
            >
              Cancelar
            </button>
          </div>
        ))}
      </div>

      {canceled.length > 0 && (
        <details className="text-xs text-ink-400">
          <summary className="cursor-pointer select-none">{canceled.length} gasto(s) cancelado(s)</summary>
          <ul className="mt-1.5 space-y-1">
            {canceled.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <Badge tone="neutral">Cancelado</Badge>
                <span className="truncate">
                  {e.description} — {formatCents(e.valueCents)} · {e.expenseDate}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {creating && (
        <div className="mt-2">
          <NewExpenseForm onDone={() => setCreating(false)} />
        </div>
      )}
      {!creating && (
        <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
          Lançar gasto
        </Button>
      )}
    </div>
  );
}
