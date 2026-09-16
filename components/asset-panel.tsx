"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  createAssetAction,
  updateAssetFlagAction,
  updateAssetStatusAction,
} from "@/app/actions/assets";
import { Badge, Button, ProgressBar } from "./ui";
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/db/schema";
import type { AssetRow } from "@/lib/repo/assets";

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.map((c) => [c.key, c.label])
);
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_STATUSES.map((s) => [s.key, s.label])
);
const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  a_configurar: "neutral",
  em_configuracao: "gold",
  ativo: "green",
  em_manutencao: "blue",
  pendente_cliente: "gold",
  cancelado: "red",
};
const DONE_STATUS_KEYS = new Set<string>(ASSET_STATUSES.filter((s) => s.done).map((s) => s.key));

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CreateAssetForm({ clientId, onDone }: { clientId: number; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const recurring = String(formData.get("recurringValue") ?? "").replace(",", ".").trim();
        await createAssetAction({
          clientId,
          name: formData.get("name"),
          category: formData.get("category"),
          mainLink: formData.get("mainLink"),
          adminLink: formData.get("adminLink"),
          vaultLink: formData.get("vaultLink"),
          loginEmail: formData.get("loginEmail"),
          domainIdentifier: formData.get("domainIdentifier"),
          platform: formData.get("platform"),
          renewalDate: formData.get("renewalDate"),
          recurringValueCents: recurring ? Math.round(Number(recurring) * 100) : null,
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
        <input
          name="name"
          required
          placeholder="Nome do ativo (ex: Site institucional)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <select
          name="category"
          defaultValue="outro"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        >
          {ASSET_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          name="mainLink"
          placeholder="Link principal (URL)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <input
          name="adminLink"
          placeholder="Link administrativo / painel"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          name="loginEmail"
          placeholder="Login / e-mail de acesso"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <input
          name="vaultLink"
          placeholder="Link do cofre de senha (nunca a senha)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input
          name="domainIdentifier"
          placeholder="Domínio / identificador"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <input
          name="platform"
          placeholder="Plataforma / fornecedor"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <input
          name="recurringValue"
          inputMode="decimal"
          placeholder="Valor recorrente (R$)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      <label className="flex flex-col gap-1 text-[11px] text-ink-500">
        Renovação (opcional)
        <input
          type="date"
          name="renewalDate"
          className="w-40 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
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
          {isPending ? "Salvando..." : "Adicionar ativo"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function AssetPanel({
  clientId,
  assets,
  canManage,
}: {
  clientId: number;
  assets: AssetRow[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Feedback instantâneo ao trocar status ou marcar um checkbox: sem isso, o
  // controle fica "preso" no valor antigo até a Server Action terminar e o
  // Next.js revalidar a rota, o que parece travado numa conexão mais lenta.
  // Mesmo padrão já usado no ChecklistWidget.
  const [optimisticAssets, applyOptimistic] = useOptimistic(
    assets,
    (state, update: { id: number; patch: Partial<AssetRow> }) =>
      state.map((a) => (a.id === update.id ? { ...a, ...update.patch } : a))
  );

  const doneCount = optimisticAssets.filter((a) => DONE_STATUS_KEYS.has(a.status)).length;
  const progress = optimisticAssets.length > 0 ? Math.round((doneCount / optimisticAssets.length) * 100) : 0;

  function setStatus(assetId: number, status: string) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id: assetId, patch: { status: status as AssetRow["status"] } });
      try {
        await updateAssetStatusAction({ assetId, status });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
      }
    });
  }

  function toggleFlag(assetId: number, field: "backupConfirmed" | "clientApproval", value: boolean) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id: assetId, patch: { [field]: value } });
      try {
        await updateAssetFlagAction({ assetId, field, value });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {optimisticAssets.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-ink-500">
            <span>
              Progresso de entrega: {doneCount} de {optimisticAssets.length} prontos
            </span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}

      {optimisticAssets.length === 0 && (
        <p className="text-sm text-ink-500">Nenhum ativo cadastrado para este cliente ainda.</p>
      )}

      <div className="space-y-2">
        {optimisticAssets.map((a) => (
          <div key={a.id} className="rounded-xl border border-ink-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{a.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500">
                  <span>{CATEGORY_LABEL[a.category]}</span>
                  {a.mainLink && (
                    <>
                      <span>·</span>
                      <a
                        href={a.mainLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gold-700 hover:underline"
                      >
                        Abrir link
                      </a>
                    </>
                  )}
                  {a.renewalDate && (
                    <>
                      <span>·</span>
                      <span>renova em {new Date(a.renewalDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                    </>
                  )}
                  {a.recurringValueCents !== null && (
                    <>
                      <span>·</span>
                      <span>{formatCents(a.recurringValueCents)}/mês</span>
                    </>
                  )}
                </p>
              </div>
              <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
            </div>

            {canManage && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <select
                  value={a.status}
                  disabled={isPending}
                  onChange={(e) => setStatus(a.id, e.target.value)}
                  className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-gold-400"
                >
                  {ASSET_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    checked={a.backupConfirmed}
                    disabled={isPending}
                    onChange={(e) => toggleFlag(a.id, "backupConfirmed", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-ink-300"
                  />
                  Backup confirmado
                </label>
                <label className="flex items-center gap-1.5 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    checked={a.clientApproval}
                    disabled={isPending}
                    onChange={(e) => toggleFlag(a.id, "clientApproval", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-ink-300"
                  />
                  Aprovado pelo cliente
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {canManage && creating && <CreateAssetForm clientId={clientId} onDone={() => setCreating(false)} />}
      {canManage && !creating && (
        <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
          Adicionar ativo
        </Button>
      )}
    </div>
  );
}
