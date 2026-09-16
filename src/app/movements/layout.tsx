import type { ReactNode } from "react";
import { DashboardShell } from "@/app/dashboard-shell";
import { requireAuthenticatedUser } from "@/core/auth/server";

export default async function MovementsLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser();
  return <DashboardShell>{children}</DashboardShell>;
}
