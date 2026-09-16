"use client";

import { logoutAction } from "@/app/actions/auth";
import { LogoutIcon } from "./icons";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        aria-label="Sair"
        className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-white/10 hover:text-white lg:text-ink-300"
      >
        <LogoutIcon className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}

export function LogoutButtonFull() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        <LogoutIcon className="h-4 w-4" />
        Sair da conta
      </button>
    </form>
  );
}
