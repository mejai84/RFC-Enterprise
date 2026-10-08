import { ApuWorkspace } from "@/modules/apu/presentation/apu-workspace";

export const metadata = { title: "APU | RFC Enterprise" };

export default async function ApuPage({
  searchParams,
}: {
  searchParams: Promise<{ quoteId?: string; quoteCode?: string; quoteTitle?: string; quoteStatus?: string; laborRateTableId?: string }>;
}) {
  const quoteContext = await searchParams;
  return <ApuWorkspace quoteContext={quoteContext.quoteId ? quoteContext : undefined} />;
}
