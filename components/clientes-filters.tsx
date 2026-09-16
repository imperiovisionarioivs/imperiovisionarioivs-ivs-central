"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { SearchIcon } from "./icons";

export function ClientesFilters({ niches }: { niches: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => updateParam("q", e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40"
        />
      </div>
      <select
        defaultValue={searchParams.get("niche") ?? ""}
        onChange={(e) => updateParam("niche", e.target.value)}
        className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-400"
      >
        <option value="">Todos os nichos</option>
        {niches.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
