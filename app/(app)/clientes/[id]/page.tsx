import { getClient, getClientActivities } from "@/lib/repo/clients";
import { getLatestProposalForClient, getProposalRevisions } from "@/lib/repo/proposals";
import { getContractsForClient } from "@/lib/repo/contracts";
import { getSubscriptionsForClient, getChargesForClient, getPaymentsForCharges } from "@/lib/repo/finance";
import { getAssetsForClient } from "@/lib/repo/assets";
import { CHECKLIST_STEPS } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { ClientInfoCard } from "@/components/client-info-card";
import { ChecklistWidget } from "@/components/checklist-widget";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ProposalPanel } from "@/components/proposal-panel";
import { ContractPanel } from "@/components/contract-panel";
import { FinancePanel } from "@/components/finance-panel";
import { AssetPanel } from "@/components/asset-panel";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();

  const [client, activities] = await Promise.all([
    getClient(clientId),
    getClientActivities(clientId),
  ]);
  if (!client) notFound();

  const [currentProposal, contracts, subscriptions, charges, clientAssets, user] = await Promise.all([
    getLatestProposalForClient(clientId),
    getContractsForClient(clientId),
    getSubscriptionsForClient(clientId),
    getChargesForClient(clientId),
    getAssetsForClient(clientId),
    getCurrentUser(),
  ]);
  const proposalRevisions = currentProposal ? await getProposalRevisions(currentProposal.rootId) : [];
  const paymentsByChargeEntries = await getPaymentsForCharges(charges.map((c) => c.id));
  const paymentsByCharge: Record<number, (typeof paymentsByChargeEntries)> = {};
  for (const p of paymentsByChargeEntries) {
    (paymentsByCharge[p.chargeId] ??= []).push(p);
  }
  const canManageProposals = user ? can(user.role, "proposal.manage") : false;
  const canManageContracts = user ? can(user.role, "contract.manage") : false;
  const canManageFinance = user ? can(user.role, "finance.manage") : false;
  const canReconcileFinance = user ? can(user.role, "finance.reconcile") : false;
  const canManageAssets = user ? can(user.role, "asset.manage") : false;
  const acceptedProposalId = currentProposal?.status === "aceita" ? currentProposal.id : undefined;
  // Uma assinatura de manutenção nasce, tipicamente, de um contrato já
  // assinado ("contratou um site e a manutenção dele") — oferecemos os
  // contratos assinados/encerrados deste cliente para vincular a nova
  // assinatura a esse acordo, sem tornar isso obrigatório.
  const signedContracts = contracts.filter((c) => c.status === "assinado" || c.status === "encerrado");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Todos os clientes
      </Link>

      <ClientInfoCard client={client} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ChecklistWidget
            clientId={client.id}
            steps={CHECKLIST_STEPS}
            initial={client.checklist ?? {}}
          />
        </Card>
        <Card>
          <ActivityTimeline clientId={client.id} activities={activities} />
        </Card>
      </div>

      <Card>
        <p className="mb-3 text-sm font-semibold text-ink-900">Proposta</p>
        <ProposalPanel
          clientId={client.id}
          current={currentProposal}
          revisions={proposalRevisions}
          canManage={canManageProposals}
        />
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-ink-900">Contratos</p>
        <ContractPanel
          clientId={client.id}
          contracts={contracts}
          proposalId={acceptedProposalId}
          canManage={canManageContracts}
        />
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-ink-900">Financeiro</p>
        <FinancePanel
          clientId={client.id}
          subscriptions={subscriptions}
          charges={charges}
          contracts={signedContracts}
          paymentsByCharge={paymentsByCharge}
          canManage={canManageFinance}
          canReconcile={canReconcileFinance}
        />
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-ink-900">Ativos e progresso de entrega</p>
        <AssetPanel clientId={client.id} assets={clientAssets} canManage={canManageAssets} />
      </Card>
    </div>
  );
}
