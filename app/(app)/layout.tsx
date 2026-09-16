import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NavShell } from "@/components/nav-shell";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <NavShell userName={user.name} logoutSlot={<LogoutButton />}>
      {children}
    </NavShell>
  );
}
