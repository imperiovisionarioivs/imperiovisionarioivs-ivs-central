"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink-300">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-ink-500 outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/40"
          placeholder="voce@imperiovisionario.com.br"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-ink-300">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-ink-500 outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/40"
          placeholder="••••••••"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
