import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listUsers } from "@/lib/repo/users";
import { Card } from "@/components/ui";
import { InstallPwaButton } from "@/components/install-pwa-button";
import { LogoutButtonFull } from "@/components/logout-button";
import { ChangePasswordForm } from "@/components/change-password-form";
import { BackupRestoreForm } from "@/components/backup-restore-form";
import { TeamPanel } from "@/components/team-panel";

export default async function ConfiguracoesPage() {
  const user = await getCurrentUser();
  const canExport = user ? can(user.role, "client.export") : false;
  const canManageUsers = user ? can(user.role, "user.manage") : false;
  const teamUsers = canManageUsers ? await listUsers() : [];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">
          Configurações
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">Sua conta</h1>
      </div>

      <Card>
        <p className="text-xs font-medium text-ink-400">Nome</p>
        <p className="mb-3 text-sm text-ink-800">{user?.name}</p>
        <p className="text-xs font-medium text-ink-400">E-mail</p>
        <p className="mb-3 text-sm text-ink-800">{user?.email}</p>
        <p className="text-xs font-medium text-ink-400">Perfil</p>
        <p className="text-sm text-ink-800 capitalize">{user?.role}</p>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold text-ink-900">Aplicativo no celular</p>
        <p className="mb-3 text-sm text-ink-500">
          Instale o IVS Central na tela inicial para acesso rápido, como um app nativo.
        </p>
        <InstallPwaButton />
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold text-ink-900">Segurança</p>
        <ChangePasswordForm />
      </Card>

      {canManageUsers && user && (
        <Card>
          <p className="mb-1 text-sm font-semibold text-ink-900">Equipe</p>
          <p className="mb-3 text-sm text-ink-500">
            Crie o acesso de cada integrante com o papel certo (Comercial, Produção ou Visitante
            somente-leitura). Nenhum convite é enviado automaticamente — a senha temporária aparece
            uma única vez para você repassar.
          </p>
          <TeamPanel users={teamUsers} currentUserId={user.id} />
        </Card>
      )}

      {canExport && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-ink-900">Backup completo</p>
          <p className="mb-3 text-sm text-ink-500">
            Backup completo em JSON, com todas as colunas e relacionamentos (clientes, histórico e
            propostas) — use para restaurar o sistema após uma perda de dados. A exportação CSV
            abaixo é apenas uma planilha de leitura rápida, não um backup completo.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/backup/export"
              className="inline-flex rounded-xl bg-ink-950 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
            >
              Baixar backup completo (JSON)
            </a>
            <a
              href="/api/export/clients.csv"
              className="inline-flex rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              Baixar planilha (CSV)
            </a>
          </div>

          <div className="mt-4 border-t border-ink-100 pt-4">
            <p className="mb-2 text-sm font-medium text-ink-800">Restaurar de um backup</p>
            <BackupRestoreForm />
          </div>
        </Card>
      )}

      <div className="pt-2">
        <LogoutButtonFull />
      </div>
    </div>
  );
}
