"use client";

import { useState, useTransition } from "react";
import {
  createUserAction,
  resetUserPasswordAction,
  updateUserActiveAction,
  updateUserRoleAction,
} from "@/app/actions/users";
import { Badge, Button } from "./ui";
import { KeyIcon, UserPlusIcon } from "./icons";
import type { UserRow } from "@/lib/repo/users";
import type { Role } from "@/lib/permissions";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  comercial: "Comercial",
  producao: "Produção",
  visitante: "Visitante (somente leitura)",
};
const ROLES: Role[] = ["admin", "comercial", "producao", "visitante"];

/** Mostra uma senha temporária gerada UMA vez, com aviso claro de que não
 *  vai aparecer de novo — o mesmo padrão para criação e redefinição. */
function TempPasswordReveal({ email, password, onDismiss }: { email: string; password: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-gold-300 bg-gold-50 p-3">
      <p className="text-xs font-medium text-ink-800">
        Senha temporária para <span className="font-semibold">{email}</span>
      </p>
      <p className="mt-1 text-[11px] text-ink-500">
        Repasse por um canal seguro (nunca por e-mail sem criptografia ou grupo público) — ela só
        aparece aqui, agora. A pessoa deve trocá-la em Configurações após o primeiro acesso.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-white px-2.5 py-1.5 text-sm font-mono text-ink-900 ring-1 ring-inset ring-ink-200">
          {password}
        </code>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copiado!" : "Copiar"}
        </Button>
      </div>
      <button type="button" onClick={onDismiss} className="mt-2 text-xs font-medium text-ink-500 hover:underline">
        Já repassei, esconder
      </button>
    </div>
  );
}

function CreateUserForm({ onDone, onCreated }: { onDone: () => void; onCreated: (email: string, password: string) => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const email = String(formData.get("email") ?? "").trim().toLowerCase();
        const result = await createUserAction({
          name: formData.get("name"),
          email,
          role: formData.get("role"),
        });
        onCreated(email, result.tempPassword);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível criar o usuário.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2.5 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
      <input
        name="name"
        required
        placeholder="Nome completo"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="E-mail de acesso"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      <select
        name="role"
        defaultValue="comercial"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Criando..." : "Criar acesso"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function TeamPanel({ users, currentUserId }: { users: UserRow[]; currentUserId: number }) {
  const [mode, setMode] = useState<"idle" | "create">("idle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);

  function changeRole(userId: number, role: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserRoleAction({ userId, role });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar o papel.");
      }
    });
  }

  function setActive(userId: number, active: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserActiveAction({ userId, active });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar o status.");
      }
    });
  }

  function resetPassword(userId: number, email: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await resetUserPasswordAction({ userId });
        setReveal({ email, password: result.tempPassword });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {reveal && (
        <TempPasswordReveal email={reveal.email} password={reveal.password} onDismiss={() => setReveal(null)} />
      )}

      <div className="space-y-2">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <div key={u.id} className="rounded-xl border border-ink-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {u.name} {isSelf && <span className="text-xs font-normal text-ink-400">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-ink-500">{u.email}</p>
                </div>
                <Badge tone={u.active ? "green" : "neutral"}>{u.active ? "Ativo" : "Desativado"}</Badge>
              </div>

              {isSelf ? (
                <p className="mt-2 text-xs text-ink-400">
                  Sua própria conta — papel e senha se alteram na aba Segurança, acima.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={u.role}
                    disabled={isPending}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-gold-400"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => resetPassword(u.id, u.email)}
                  >
                    <KeyIcon className="h-3.5 w-3.5" />
                    Redefinir senha
                  </Button>
                  <Button
                    size="sm"
                    variant={u.active ? "ghost" : "secondary"}
                    disabled={isPending}
                    onClick={() => setActive(u.id, !u.active)}
                  >
                    {u.active ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {mode === "create" ? (
        <CreateUserForm
          onDone={() => setMode("idle")}
          onCreated={(email, password) => setReveal({ email, password })}
        />
      ) : (
        <Button size="sm" onClick={() => setMode("create")}>
          <UserPlusIcon className="h-4 w-4" />
          Adicionar integrante
        </Button>
      )}
    </div>
  );
}
