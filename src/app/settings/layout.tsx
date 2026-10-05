import { requireAuthenticatedUser } from "@/core/auth/server";
export default async function SettingsLayout({ children }: { children: React.ReactNode }) { await requireAuthenticatedUser(); return children; }
