"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientAction } from "@/app/actions/clients";
import { Button } from "./ui";

export function NewClientForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createClientAction({
          name: formData.get("name"),
          niche: formData.get("niche"),
          category: formData.get("category"),
          phone: formData.get("phone"),
          address: formData.get("address"),
          priority: formData.get("priority"),
        });
        if (res.ok && res.id) router.push(`/clientes/${res.id}`);
      } catch {
        setError("Não foi possível salvar. Verifique os dados e tente novamente.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <Field label="Nome do estabelecimento" name="name" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nicho" name="niche" />
        <Field label="Categoria" name="category" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone" name="phone" placeholder="(83) 90000-0000" />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-500">Prioridade</label>
          <select
            name="priority"
            defaultValue="media"
            className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-gold-400"
          >
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="confirmar">Confirmar</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>
      <Field label="Endereço" name="address" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Salvando..." : "Salvar lead"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-500">{label}</label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40"
      />
    </div>
  );
}
