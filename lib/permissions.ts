import "server-only";

/**
 * Permission matrix — the single source of truth for what each role may
 * do. Server actions and route handlers call requirePermission(...)
 * instead of only checking "is there a logged-in user" — being
 * authenticated is necessary but not sufficient.
 *
 * | Permissão                  | admin | comercial | producao | visitante |
 * |-----------------------------|:-----:|:---------:|:--------:|:---------:|
 * | client.create               |  ✔   |    ✔     |          |           |
 * | client.update                |  ✔   |    ✔     |          |           |
 * | client.stage.update          |  ✔   |    ✔     |          |           |
 * | client.checklist.toggle      |  ✔   |    ✔     |    ✔    |           |
 * | activity.create              |  ✔   |    ✔     |    ✔    |           |
 * | client.archive               |  ✔   |          |          |           |
 * | client.export                |  ✔   |          |          |           |
 * | import.run                   |  ✔   |          |          |           |
 * | backup.export                |  ✔   |          |          |           |
 * | backup.restore               |  ✔   |          |          |           |
 * | proposal.manage              |  ✔   |    ✔     |          |           |
 * | contract.manage              |  ✔   |    ✔     |          |           |
 * | finance.manage                |  ✔   |    ✔     |          |           |
 * | finance.reconcile             |  ✔   |          |          |           |
 * ("finance.reconcile" cobre marcar atraso/cancelar cobrança, registrar um
 * recebimento real contra uma cobrança — o único jeito de ela virar "pago"
 * ou "parcial" — e lançar/cancelar gastos da agência. É deliberadamente
 * mais restrito que "finance.manage" porque envolve dinheiro de verdade
 * entrando/saindo e a margem de lucro da agência, não só vender/lançar.)
 * | asset.manage                  |  ✔   |    ✔     |    ✔    |           |
 * | user.manage                  |  ✔   |          |          |           |
 * | session.revoke.others        |  ✔   |          |          |           |
 * | account.password.change      |  ✔   |    ✔     |    ✔    |    ✔     |
 * | account.sessions.revoke.own  |  ✔   |    ✔     |    ✔    |    ✔     |
 *
 * Read access (dashboard, CRM board, client list/detail, activity
 * history) is granted to every authenticated role, including visitante —
 * it is enforced simply by requiring a session (via getCurrentUser in
 * each page), not by a permission below. visitante is deliberately absent
 * from every mutating permission: it is a read-only role by design.
 */
export const ROLES = ["admin", "comercial", "producao", "visitante"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  "client.create": ["admin", "comercial"],
  "client.update": ["admin", "comercial"],
  "client.stage.update": ["admin", "comercial"],
  "client.checklist.toggle": ["admin", "comercial", "producao"],
  "activity.create": ["admin", "comercial", "producao"],
  "client.archive": ["admin"],
  "client.export": ["admin"],
  "import.run": ["admin"],
  "backup.export": ["admin"],
  "backup.restore": ["admin"],
  "proposal.manage": ["admin", "comercial"],
  "contract.manage": ["admin", "comercial"],
  "finance.manage": ["admin", "comercial"],
  "finance.reconcile": ["admin"],
  // Mesmo conjunto de papéis que já mexe no checklist de produção
  // (client.checklist.toggle) — ativos são itens de entrega técnica
  // (site, instagram, domínio...), então quem está executando o trabalho
  // (produção) também deve poder atualizar o status, não só admin/comercial.
  "asset.manage": ["admin", "comercial", "producao"],
  "user.manage": ["admin"],
  "session.revoke.others": ["admin"],
  "account.password.change": ["admin", "comercial", "producao", "visitante"],
  "account.sessions.revoke.own": ["admin", "comercial", "producao", "visitante"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Sem permissão para: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Não autenticado");
    this.name = "UnauthenticatedError";
  }
}
