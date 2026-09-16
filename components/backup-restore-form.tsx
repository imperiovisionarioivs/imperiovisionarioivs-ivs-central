"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "./ui";

type Summary = {
  clients: { insert: number; update: number };
  activities: { insert: number; update: number };
  proposals: { insert: number; update: number };
  backupExportedAt: string;
};

const RESTORE_CONFIRMATION = "RESTAURAR-SUBSTITUIR-DADOS-ATUAIS";

export function BackupRestoreForm() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [backupText, setBackupText] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function runDryRun() {
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo de backup (.json).");
      return;
    }
    setError(null);
    setDone(false);
    startTransition(async () => {
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        const res = await fetch("/api/backup/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun: true, backup }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ? JSON.stringify(json.error) : "Falha na simulação");
        setBackupText(text);
        setSummary(json.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Arquivo inválido");
      }
    });
  }

  function runRealRestore() {
    if (!backupText) return;
    setError(null);
    startTransition(async () => {
      try {
        const backup = JSON.parse(backupText);
        const res = await fetch("/api/backup/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun: false, confirm: RESTORE_CONFIRMATION, backup }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ? JSON.stringify(json.error) : "Falha na restauração");
        setDone(true);
        setSummary(json.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível restaurar");
      }
    });
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm file:font-medium"
        onChange={() => {
          setSummary(null);
          setDone(false);
          setError(null);
        }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}

      {!summary && (
        <Button size="sm" variant="secondary" disabled={isPending} onClick={runDryRun}>
          {isPending ? "Analisando..." : "Simular restauração (não grava nada)"}
        </Button>
      )}

      {summary && !done && (
        <div className="space-y-2 rounded-xl border border-gold-300 bg-gold-50 p-3 text-sm text-ink-800">
          <p className="font-medium">Backup exportado em {new Date(summary.backupExportedAt).toLocaleString("pt-BR")}</p>
          <ul className="text-xs text-ink-600">
            <li>Clientes: {summary.clients.insert} novo(s), {summary.clients.update} atualizado(s)</li>
            <li>Atividades: {summary.activities.insert} nova(s), {summary.activities.update} atualizada(s)</li>
            <li>Propostas: {summary.proposals.insert} nova(s), {summary.proposals.update} atualizada(s)</li>
          </ul>
          <p className="text-xs text-red-700">
            Restaurar de verdade SOBRESCREVE os registros existentes com o conteúdo do backup. Essa ação não
            pode ser desfeita.
          </p>
          <Button size="sm" variant="danger" disabled={isPending} onClick={runRealRestore}>
            {isPending ? "Restaurando..." : "Confirmar e restaurar"}
          </Button>
        </div>
      )}

      {done && <p className="text-sm text-emerald-700">Restauração concluída com sucesso.</p>}
    </div>
  );
}
