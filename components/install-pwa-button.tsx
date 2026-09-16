"use client";

import { useEffect, useState } from "react";
import { InstallIcon } from "./icons";
import { Button } from "./ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPwaButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) {
    return <p className="text-sm text-ink-500">App já instalado neste dispositivo. ✓</p>;
  }

  if (deferred) {
    return (
      <Button
        size="sm"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
      >
        <InstallIcon className="h-4 w-4" />
        Instalar na tela inicial
      </Button>
    );
  }

  if (isIos) {
    return (
      <p className="text-sm text-ink-500">
        No iPhone: toque em <strong>Compartilhar</strong> na barra do Safari e depois em{" "}
        <strong>Adicionar à Tela de Início</strong>.
      </p>
    );
  }

  return (
    <p className="text-sm text-ink-500">
      No menu do navegador, procure por <strong>Instalar app</strong> ou{" "}
      <strong>Adicionar à tela inicial</strong>.
    </p>
  );
}
