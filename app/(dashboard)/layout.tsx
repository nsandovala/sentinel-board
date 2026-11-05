import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { resolveUserSession } from "@/lib/server/api-auth";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const principal = await resolveUserSession();
  if (!principal) redirect("/sign-in");
  if (!principal.permissions.includes("board:read")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <h1 className="text-xl font-semibold">Acceso denegado</h1>
        <SignOutButton redirectUrl="/sign-in"><button type="button">Cerrar sesión</button></SignOutButton>
      </main>
    );
  }
  return <DashboardClient>{children}</DashboardClient>;
}
