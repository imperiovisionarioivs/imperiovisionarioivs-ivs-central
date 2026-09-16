"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  changePasswordAction,
  revokeOtherSessionsAction,
  type ChangePasswordState,
} from "@/app/actions/auth";
import { Button } from "./ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Salvando..." : "Trocar senha"}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    {}
  );
  const [revoking, startRevoking] = useTransition();
  const [revoked, setRevoked] = useState(false);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <Field label="Senha atual" name="currentPassword" />
        <Field label="Nova senha" name="newPassword" helper="Mínimo de 8 caracteres." />
        <Field label="Confirmar nova senha" name="confirmPassword" />

        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Senha alterada. Suas outras sessões foram encerradas automaticamente.
          </p>
        )}

        <SubmitButton />
      </form>

      <div className="border-t border-ink-100 pt-4">
        <p className="mb-2 text-sm font-medium text-ink-800">Sessões ativas</p>
        <p className="mb-3 text-sm text-ink-500">
          Encerra o acesso em todos os outros dispositivos/navegadores onde você está logado,
          mantendo apenas esta sessão.
        </p>
        <button
          type="button"
          disabled={revoking}
          onClick={() =>
            startRevoking(async () => {
              await revokeOtherSessionsAction();
              setRevoked(true);
            })
          }
          className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50"
        >
          {revoking ? "Encerrando..." : "Encerrar outras sessões"}
        </button>
        {revoked && !revoking && (
          <p className="mt-2 text-sm text-emerald-700">Outras sessões encerradas.</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, name, helper }: { label: string; name: string; helper?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-500">{label}</label>
      <input
        type="password"
        name={name}
        required
        autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
        className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40"
      />
      {helper && <p className="mt-1 text-xs text-ink-400">{helper}</p>}
    </div>
  );
}
