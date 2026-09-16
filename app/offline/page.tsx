export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-950 px-6 text-center text-ink-50">
      <p className="text-sm uppercase tracking-[0.2em] text-gold-400">IVS Central</p>
      <h1 className="text-2xl font-semibold">Você está offline</h1>
      <p className="max-w-sm text-sm text-ink-300">
        Não foi possível conectar agora. Verifique sua internet — assim que a conexão voltar, os
        dados são atualizados automaticamente.
      </p>
    </div>
  );
}
