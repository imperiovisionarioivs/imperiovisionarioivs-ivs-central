"use client";

import { useState, useTransition } from "react";
import { createContractAction, signContractAction, updateContractStatusAction } from "@/app/actions/contracts";
import { Badge, Button } from "./ui";
import type { ContractRow } from "@/lib/repo/contracts";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  assinado: "Assinado",
  encerrado: "Encerrado",
};
const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  rascunho: "neutral",
  enviado: "blue",
  assinado: "green",
  encerrado: "red",
};

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "Sem valor definido";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CreateContractForm({
  clientId,
  proposalId,
  onDone,
}: {
  clientId: number;
  proposalId?: number;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const cents = String(formData.get("value") ?? "").replace(",", ".").trim();
        await createContractAction({
          clientId,
          proposalId: proposalId ?? null,
          title: formData.get("title"),
          valueCents: cents ? Math.round(Number(cents) * 100) : null,
          startDate: formData.get("startDate"),
          endDate: formData.get("endDate"),
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
      <input
        name="title"
        required
        placeholder="Título do contrato"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="value"
          inputMode="decimal"
          placeholder="Valor total (R$)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <label className="flex flex-col gap-1 text-[11px] text-ink-500">
          Início
          <input
            type="date"
            name="startDate"
            className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[11px] text-ink-500">
        Término (opcional — deixe em branco para prazo indeterminado)
        <input
          type="date"
          name="endDate"
          className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </label>
      <textarea
        name="notes"
        placeholder="Observações (opcional)"
        rows={2}
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Criar contrato"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function SignContractForm({ contractId, onDone }: { contractId: number; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await signContractAction({
          contractId,
          signerName: formData.get("signerName"),
          signatureProvider: formData.get("signatureProvider"),
          signatureReference: formData.get("signatureReference"),
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível registrar.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2.5 rounded-xl border border-gold-300 bg-gold-50 p-3">
      <p className="text-xs text-ink-600">
        Registre a evidência de uma assinatura feita fora deste app (Clicksign, DocuSign, presencial...).
      </p>
      <input
        name="signerName"
        required
        placeholder="Nome de quem assinou"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="signatureProvider"
          placeholder="Provedor (ex: Clicksign)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <input
          name="signatureReference"
          placeholder="Link ou protocolo"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Registrar assinatura"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function ContractPanel({
  clientId,
  contracts,
  proposalId,
  canManage,
}: {
  clientId: number;
  contracts: ContractRow[];
  proposalId?: number;
  canManage: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "create" | number>("idle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function sendToSignature(contractId: number) {
    setError(null);
    startTransition(async () => {
      try {
        await updateContractStatusAction({ contractId, status: "enviado" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
      }
    });
  }

  function closeContract(contractId: number) {
    setError(null);
    startTransition(async () => {
      try {
        await updateContractStatusAction({ contractId, status: "encerrado" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
      }
    });
  }

  if (mode === "create") {
    return <CreateContractForm clientId={clientId} proposalId={proposalId} onDone={() => setMode("idle")} />;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {contracts.length === 0 && <p className="text-sm text-ink-500">Nenhum contrato para este cliente ainda.</p>}

      {contracts.map((c) => (
        <div key={c.id} className="rounded-xl border border-ink-100 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink-900">{c.title}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {formatCents(c.valueCents)}
                {c.startDate ? ` · início ${c.startDate}` : ""}
                {c.endDate ? ` · término ${c.endDate}` : ""}
                {c.signedAt ? ` · assinado por ${c.signerName} em ${new Date(c.signedAt).toLocaleDateString("pt-BR")}` : ""}
              </p>
            </div>
            <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
          </div>

          {canManage && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.status === "rascunho" && (
                <Button size="sm" variant="secondary" disabled={isPending} onClick={() => sendToSignature(c.id)}>
                  Enviar para assinatura
                </Button>
              )}
              {(c.status === "rascunho" || c.status === "enviado") && mode !== c.id && (
                <Button size="sm" variant="secondary" onClick={() => setMode(c.id)}>
                  Registrar assinatura
                </Button>
              )}
              {c.status === "assinado" && (
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => closeContract(c.id)}>
                  Encerrar contrato
                </Button>
              )}
            </div>
          )}

          {mode === c.id && <div className="mt-2"><SignContractForm contractId={c.id} onDone={() => setMode("idle")} /></div>}
        </div>
      ))}

      {canManage && mode === "idle" && (
        <Button size="sm" onClick={() => setMode("create")}>
          Criar contrato
        </Button>
      )}
    </div>
  );
}
