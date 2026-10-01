import { QuotesWorkspace } from "@/modules/quotes/presentation/quotes-workspace";
import { initialQuotes } from "@/modules/quotes";

export default function QuotesPage() {
  return <QuotesWorkspace initialQuotes={initialQuotes} />;
}
