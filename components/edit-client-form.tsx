"use client";

import { useState, useTransition } from "react";
import { updateClientAction } from "@/app/actions/clients";
import { Button } from "./ui";
import type { ClientRow } from "@/lib/repo/clients";

export function EditClientForm({ client, onDone }: { client: ClientRow; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateClientAction({
          id: client.id,
          name: formData.get("name"),
          niche: formData.get("niche"),
          category: formData.get("category"),
          phone: formData.get("phone"),
          contact: formData.get("contact"),
          address: formData.get("address"),
          website: formData.get("website"),
          instagram: formData.get("instagram"),
          diagnosis: formData.get("diagnosis"),
          notes: formData.get("notes"),
          nextAction: formData.get("nextAction"),
          nextActionDate: formData.get("nextActionDate"),
          priority: formData.get("priority"),
        });
        onDone();
      } catch {
        setError("Não foi possível salvar as alterações.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3 rounded-2xl border border-ink-100 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" name="name" defaultValue={client.name} />
        <Field label="Nicho" name="niche" defaultValue={client.niche} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria" name="category" defaultValue={client.category} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-500">Prioridade</label>
          <select
            name="priority"
            defaultValue={client.priority}
            className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
          >
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="confirmar">Confirmar</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone" name="phone" defaultValue={client.phone} />
        <Field label="Contato / responsável" name="contact" defaultValue={client.contact} />
      </div>
      <Field label="Endereço" name="address" defaultValue={client.address} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Site" name="website" defaultValue={client.website} />
        <Field label="Instagram" name="instagram" defaultValue={client.instagram} />
      </div>
      <TextArea label="Diagnóstico" name="diagnosis" defaultValue={client.diagnosis} />
      <TextArea label="Observações internas" name="notes" defaultValue={client.notes} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Próxima ação" name="nextAction" defaultValue={client.nextAction} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-500">Data da próxima ação</label>
          <input
            type="date"
            name="nextActionDate"
            defaultValue={client.nextActionDate || ""}
            className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-500">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40"
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-500">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40"
      />
    </div>
  );
}
