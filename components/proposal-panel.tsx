"use client";

import { useState, useTransition } from "react";
import {
  createProposalAction,
  reviseProposalAction,
  updateProposalStatusAction,
} from "@/app/actions/proposals";
import { Badge, Button } from "./ui";
import type { ProposalRow } from "@/lib/repo/proposals";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};
const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  rascunho: "neutral",
  enviada: "blue",
  aceita: "green",
  recusada: "red",
};

function centsFromInput(value: FormDataEntryValue | null): number | null {
  const str = String(value ?? "").replace(",", ".").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "Sem valor definido";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProposalForm({
  clientId,
  proposalId,
  initial,
  onDone,
}: {
  clientId: number;
  proposalId?: number;
  initial?: Pick<ProposalRow, "title" | "description" | "valueCents" | "validUntil">;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          clientId,
          title: formData.get("title"),
          description: formData.get("description"),
          valueCents: centsFromInput(formData.get("value")),
          validUntil: formData.get("validUntil"),
        };
        if (proposalId) {
          await reviseProposalAction({ ...payload, proposalId });
        } else {
          await createProposalAction(payload);
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2.5 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
      <input
        name="title"
        required
        defaultValue={initial?.title}
        placeholder="Título da proposta"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      <textarea
        name="description"
        defaultValue={initial?.description}
        placeholder="Escopo, condições, observações..."
        rows={3}
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="value"
          inputMode="decimal"
          defaultValue={initial?.valueCents != null ? (initial.valueCents / 100).toFixed(2) : ""}
          placeholder="Valor (R$)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <input
          type="date"
          name="validUntil"
          defaultValue={initial?.validUntil}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : proposalId ? "Salvar nova revisão" : "Criar proposta"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function ProposalPanel({
  clientId,
  current,
  revisions,
  canManage,
}: {
  clientId: number;
  current: ProposalRow | null;
  revisions: ProposalRow[];
  /** Gates the mutating controls (create/revise/status) in the UI — the
   * server independently enforces "proposal.manage" regardless of this
   * prop, this only avoids showing a control that would just come back
   * with a permission error. */
  canManage: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "create" | "revise">("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);

  const nextStatuses: Record<string, string[]> = {
    rascunho: ["enviada"],
    enviada: ["aceita", "recusada"],
    aceita: [],
    recusada: [],
  };

  function handleStatusChange(status: string) {
    if (!current) return;
    setStatusError(null);
    startTransition(async () => {
      try {
        await updateProposalStatusAction({ proposalId: current.id, status });
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : "Não foi possível atualizar.");
      }
    });
  }

  if (mode === "create") {
    return <ProposalForm clientId={clientId} onDone={() => setMode("idle")} />;
  }
  if (mode === "revise" && current) {
    return <ProposalForm clientId={clientId} proposalId={current.id} initial={current} onDone={() => setMode("idle")} />;
  }

  if (!current) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-500">Nenhuma proposta criada para este cliente ainda.</p>
        {canManage && (
          <Button size="sm" onClick={() => setMode("create")}>
            Criar proposta
          </Button>
        )}
      </div>
    );
  }

  const previousRevisions = revisions.filter((r) => r.id !== current.id);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink-900">{current.title}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            Rev. {current.revisionNumber} · {formatCents(current.valueCents)}
            {current.validUntil ? ` · válida até ${current.validUntil}` : ""}
          </p>
        </div>
        <Badge tone={STATUS_TONE[current.status]}>{STATUS_LABEL[current.status]}</Badge>
      </div>

      {current.description && (
        <p className="whitespace-pre-wrap text-sm text-ink-600">{current.description}</p>
      )}

      {statusError && <p className="text-xs text-red-600">{statusError}</p>}

      <div className="flex flex-wrap gap-2">
        {canManage &&
          (nextStatuses[current.status] ?? []).map((s) => (
            <Button key={s} size="sm" variant="secondary" disabled={isPending} onClick={() => handleStatusChange(s)}>
              Marcar como {STATUS_LABEL[s]}
            </Button>
          ))}
        {canManage && (
          <Button size="sm" variant="ghost" onClick={() => setMode("revise")}>
            Nova revisão
          </Button>
        )}
        {previousRevisions.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Ocultar histórico" : `Ver histórico (${previousRevisions.length})`}
          </Button>
        )}
      </div>

      {showHistory && (
        <div className="space-y-2 border-t border-ink-100 pt-2">
          {previousRevisions
            .slice()
            .reverse()
            .map((r) => (
              <div key={r.id} className="rounded-lg bg-ink-50/70 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-700">Rev. {r.revisionNumber} — {r.title}</span>
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </div>
                <p className="mt-1 text-ink-500">{formatCents(r.valueCents)}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
