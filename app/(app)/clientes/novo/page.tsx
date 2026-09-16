import { NewClientForm } from "@/components/new-client-form";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeftIcon className="h-4 w-4" />
        Voltar
      </Link>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">Novo</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">
          Cadastrar lead
        </h1>
      </div>
      <NewClientForm />
    </div>
  );
}
