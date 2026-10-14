import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

export type CommercialFollowUp = { id: string; quoteId: string; kind: "call" | "email" | "whatsapp" | "meeting" | "note"; plannedFor?: string; completedAt?: string; responsibleName: string; summary: string; outcome?: string; nextAction?: string; createdAt: string; };
function client() { if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null; return createBrowserClient(supabaseUrl, supabasePublishableKey); }
export async function loadCommercialFollowUps(quoteId: string): Promise<CommercialFollowUp[]> {
  const supabase = client(); if (!supabase) return [];
  const { data, error } = await supabase.from("quote_follow_ups").select("id,quote_id,kind,planned_for,completed_at,responsible_name,summary,outcome,next_action,created_at").eq("quote_id", quoteId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, quoteId: row.quote_id, kind: row.kind, plannedFor: row.planned_for ?? undefined, completedAt: row.completed_at ?? undefined, responsibleName: row.responsible_name, summary: row.summary, outcome: row.outcome ?? undefined, nextAction: row.next_action ?? undefined, createdAt: row.created_at }));
}
export async function recordCommercialFollowUp(input: Omit<CommercialFollowUp, "id" | "responsibleName" | "createdAt">) {
  const supabase = client(); if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("record_quote_follow_up", { target_quote: input.quoteId, follow_up_kind: input.kind, follow_up_summary: input.summary, follow_up_planned_for: input.plannedFor ?? null, follow_up_completed_at: input.completedAt ?? null, follow_up_outcome: input.outcome ?? null, follow_up_next_action: input.nextAction ?? null });
  if (error) throw error; return data as string;
}