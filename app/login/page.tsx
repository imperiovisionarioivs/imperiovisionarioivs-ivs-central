import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-400/10 ring-1 ring-gold-400/30">
            <span className="font-display text-lg font-bold tracking-wide text-gold-300">
              IVS
            </span>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-400">Central da Agência</p>
          <h1 className="mt-1 text-xl font-semibold text-white">Império Visionário</h1>
          <p className="mt-1 text-sm text-ink-400">Ambiente privado — acesso restrito à equipe</p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
