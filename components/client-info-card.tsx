"use client";

import { useState } from "react";
import { EditClientForm } from "./edit-client-form";
import { Badge, Button } from "./ui";
import { PhoneIcon, WhatsAppIcon } from "./icons";
import type { ClientRow } from "@/lib/repo/clients";
import { PRIORITIES, STAGES } from "@/lib/db/schema";

// Derived from the schema's canonical STAGES/PRIORITIES instead of a
// locally re-declared map — keeps this in sync with the full 9-stage /
// 4-priority legacy set by construction, with no risk of drifting from it.
const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label])
);
const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.key, p.label])
);

function toWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

export function ClientInfoCard({ client }: { client: ClientRow }) {
  const [editing, setEditing] = useState(false);
  const waLink = client.phone ? toWhatsAppLink(client.phone) : null;

  if (editing) {
    return <EditClientForm client={client} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="gold">{STAGE_LABEL[client.stage] ?? client.stage}</Badge>
            <Badge tone={client.priority === "alta" ? "gold" : "neutral"}>
              Prioridade {PRIORITY_LABEL[client.priority] ?? client.priority}
            </Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-950">{client.name}</h1>
          <p className="text-sm text-ink-500">
            {client.niche || "Sem nicho"}
            {client.category ? ` · ${client.category}` : ""}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Editar
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-ink-100 pt-3 text-sm sm:grid-cols-2">
        <InfoRow label="Telefone" value={client.phone} />
        <InfoRow label="Contato" value={client.contact} />
        <InfoRow label="Endereço" value={client.address} />
        <InfoRow label="Site" value={client.website} link={client.website || undefined} />
        <InfoRow
          label="Instagram"
          value={client.instagram}
          link={client.instagram ? `https://instagram.com/${client.instagram.replace("@", "")}` : undefined}
        />
        <InfoRow label="Próxima ação" value={client.nextAction} />
      </dl>

      {(client.diagnosis || client.notes) && (
        <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
          {client.diagnosis && (
            <div>
              <p className="text-xs font-medium text-ink-400">Diagnóstico</p>
              <p className="text-sm text-ink-700">{client.diagnosis}</p>
            </div>
          )}
          {client.notes && (
            <div>
              <p className="text-xs font-medium text-ink-400">Observações internas</p>
              <p className="text-sm text-ink-700">{client.notes}</p>
            </div>
          )}
        </div>
      )}

      {client.phone && (
        <div className="mt-4 flex gap-2 border-t border-ink-100 pt-4">
          <a
            href={`tel:${client.phone.replace(/\D/g, "")}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-200 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
          >
            <PhoneIcon className="h-4 w-4" />
            Ligar
          </a>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <WhatsAppIcon className="h-4 w-4" />
              WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  const content = link ? (
    <a
      href={link.startsWith("http") ? link : `https://${link}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gold-700 hover:underline"
    >
      {value}
    </a>
  ) : (
    <span className="text-ink-700">{value}</span>
  );
  return (
    <div>
      <dt className="text-xs font-medium text-ink-400">{label}</dt>
      <dd className="mt-0.5 truncate">{content}</dd>
    </div>
  );
}
