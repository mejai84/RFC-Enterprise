import { DashboardShell } from "@/app/dashboard-shell";
import { MultiRentalOrderWorkspace } from "@/modules/rentals";

export const metadata = { title: "Alquiler rápido | RFC Enterprise" };

export default function RentalsPage() { return <DashboardShell><MultiRentalOrderWorkspace /></DashboardShell>; }
