"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "@/lib/clsx";
import {
  DashboardIcon,
  FunnelIcon,
  UsersIcon,
  GearIcon,
  MapPinIcon,
  DocumentIcon,
  CoinsIcon,
  SignatureIcon,
  LayersIcon,
  MoreIcon,
  CloseIcon,
} from "./icons";
import type { ReactNode } from "react";

// shortLabel is used in the mobile bottom tab bar, which has less room per
// item than the desktop sidebar (where each item gets its own row).
// `group` drives the section headers in the desktop sidebar; `primary`
// picks which items get a permanent slot in the mobile tab bar — the rest
// live behind "Mais" so the bar stays legible as the app grows.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Painel", icon: DashboardIcon, group: "Visão geral", primary: true },
  { href: "/prospeccao", label: "Prospecção", shortLabel: "Prospec.", icon: MapPinIcon, group: "Comercial", primary: false },
  { href: "/crm", label: "CRM", shortLabel: "CRM", icon: FunnelIcon, group: "Comercial", primary: true },
  { href: "/propostas", label: "Propostas", shortLabel: "Propostas", icon: DocumentIcon, group: "Comercial", primary: false },
  { href: "/contratos", label: "Contratos", shortLabel: "Contratos", icon: SignatureIcon, group: "Comercial", primary: false },
  { href: "/clientes", label: "Clientes", shortLabel: "Clientes", icon: UsersIcon, group: "Comercial", primary: true },
  { href: "/financeiro", label: "Financeiro", shortLabel: "Financ.", icon: CoinsIcon, group: "Financeiro", primary: true },
  { href: "/ativos", label: "Ativos", shortLabel: "Ativos", icon: LayersIcon, group: "Comercial", primary: false },
  { href: "/configuracoes", label: "Config.", shortLabel: "Config.", icon: GearIcon, group: "Sistema", primary: false },
] as const;

const GROUP_ORDER = ["Visão geral", "Comercial", "Financeiro", "Sistema"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavShell({
  children,
  userName,
  logoutSlot,
}: {
  children: ReactNode;
  userName: string;
  logoutSlot: ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = NAV_ITEMS.filter((i) => i.primary);
  const overflowItems = NAV_ITEMS.filter((i) => !i.primary);
  const overflowActive = overflowItems.some((i) => isActive(pathname, i.href));

  return (
    <div className="min-h-dvh bg-ink-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-ink-950 px-4 py-6 text-ink-100 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/10 ring-1 ring-gold-400/30">
            <span className="font-display text-sm font-bold tracking-wide text-gold-300">
              IVS
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold-400">Central</p>
            <p className="text-sm font-medium text-ink-50">da Agência</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {GROUP_ORDER.map((group) => (
            <div key={group}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                {group}
              </p>
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-white/5 text-gold-300 ring-1 ring-gold-400/30"
                          : "text-ink-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-50">{userName}</p>
            <p className="text-xs text-ink-400">Ambiente privado</p>
          </div>
          {logoutSlot}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950">
            <span className="text-[11px] font-bold text-gold-300">IVS</span>
          </div>
          <p className="text-sm font-semibold text-ink-900">Central da Agência</p>
        </div>
        {logoutSlot}
      </header>

      <main className="flex-1 pb-20 lg:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* Mobile bottom tab bar: primary items + a "Mais" sheet for the rest */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-white/95 backdrop-blur lg:hidden">
        {primaryItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-1 px-0.5 py-2.5 text-[10px] font-medium"
            >
              <Icon className={clsx("h-5 w-5", active ? "text-gold-600" : "text-ink-400")} />
              <span className={clsx("whitespace-nowrap", active ? "text-ink-900" : "text-ink-400")}>
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 px-0.5 py-2.5 text-[10px] font-medium"
        >
          <MoreIcon className={clsx("h-5 w-5", overflowActive ? "text-gold-600" : "text-ink-400")} />
          <span className={clsx("whitespace-nowrap", overflowActive ? "text-ink-900" : "text-ink-400")}>Mais</span>
        </button>
      </nav>

      {/* "Mais" bottom sheet (mobile only) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
          />
          <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-ink-100 bg-white p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-900">Mais opções</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Fechar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 pb-2">
              {overflowItems.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center"
                  >
                    <span
                      className={clsx(
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        active ? "bg-gold-100 text-gold-700" : "bg-ink-50 text-ink-500"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={clsx("text-[11px] font-medium", active ? "text-ink-900" : "text-ink-500")}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
