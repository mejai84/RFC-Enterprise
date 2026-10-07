"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

/**
 * Configuración de empresa leída de la base de datos.
 *
 * Antes estos valores vivían dentro del código: la firma era `/rfc-signature.png`
 * y el nombre del representante legal estaba escrito como texto en cada documento.
 * Ahora salen de `company_settings`, así que cambiarlos es guardar un formulario y
 * no volver a compilar. Los valores por defecto de este archivo solo se usan si la
 * empresa aún no ha guardado el suyo; nunca pisan lo guardado.
 */

export type ProposalDefaults = {
  ivaRate: number;
  advancePercent: number;
  maxDiscountPercent: number;
  retentionRate: number;
  paymentTerms: string;
  deliveryDays: number;
  validityDays: number;
  printAmountInWords: boolean;
  amountInWordsLegend: string;
  bankDetails: string;
};

export type CompanyIdentity = {
  address: string;
  phone: string;
  email: string;
  city: string;
  contactName: string;
};

export type CompanyBranding = {
  signaturePath: string;
  logoPath: string;
  legalRepresentative: string;
  legalRepresentativeTitle: string;
  showSignatureOnProposal: boolean;
  showSignatureOnApuPrint: boolean;
  showSignatureOnApuXlsx: boolean;
  showSignatureOnDispatchVoucher: boolean;
  showSignatureOnRentalInvoice: boolean;
};

export type CompanyConfig = {
  companyName: string;
  taxId: string;
  identity: CompanyIdentity;
  branding: CompanyBranding;
  proposalDefaults: ProposalDefaults;
  companyId: string | null;
};

export const defaultProposalDefaults: ProposalDefaults = {
  ivaRate: 19,
  advancePercent: 50,
  maxDiscountPercent: 5,
  retentionRate: 0,
  paymentTerms: "50% anticipo, 50% contra entrega",
  deliveryDays: 30,
  validityDays: 30,
  printAmountInWords: true,
  amountInWordsLegend: "PESOS COLOMBIANOS M/L",
  bankDetails: "",
};

const defaultIdentity: CompanyIdentity = { address: "", phone: "", email: "", city: "", contactName: "" };

const defaultBranding: CompanyBranding = {
  signaturePath: "",
  logoPath: "",
  legalRepresentative: "Jorge Figueroa Castro",
  legalRepresentativeTitle: "Representante Legal",
  showSignatureOnProposal: true,
  showSignatureOnApuPrint: true,
  showSignatureOnApuXlsx: true,
  showSignatureOnDispatchVoucher: true,
  showSignatureOnRentalInvoice: true,
};

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export const BRANDING_BUCKET = "company-branding";

/** URL pública de una imagen del bucket, o cadena vacía si no hay. */
export function brandingUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${supabaseUrl}/storage/v1/object/public/${BRANDING_BUCKET}/${path}`;
}

/** Ruta de almacenamiento para un archivo subido. */
export function brandingPath(fileName: string): string {
  return `branding/${Date.now()}_${fileName.replace(/\s+/g, "_").replace(/[^\w.-]/g, "_")}`;
}

export function useCompanyConfig() {
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
      setIsLoading(false);
      return;
    }
    try {
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setError("Inicia sesión para cargar la configuración de la empresa.");
        setIsLoading(false);
        return;
      }
      const { data: membership } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", auth.user.id)
        .limit(1)
        .maybeSingle();
      const companyId = membership?.company_id ?? null;
      if (!companyId) {
        setError("Tu cuenta no tiene una empresa asignada.");
        setIsLoading(false);
        return;
      }

      const [{ data: company }, { data: rows }] = await Promise.all([
        supabase.from("companies").select("name, tax_id").eq("id", companyId).maybeSingle(),
        supabase.from("company_settings").select("key, value").eq("company_id", companyId),
      ]);
      const byKey = new Map(((rows ?? []) as Array<{ key: string; value: Record<string, unknown> }>).map((row) => [row.key, row.value ?? {}]));

      const identity = byKey.get("identity") ?? {};
      const branding = byKey.get("branding") ?? {};
      const proposal = byKey.get("proposal_defaults") ?? {};

      setConfig({
        companyId,
        companyName: company?.name ?? "",
        taxId: company?.tax_id ?? "",
        identity: { ...defaultIdentity, ...(identity as Partial<CompanyIdentity>) },
        branding: { ...defaultBranding, ...(branding as Partial<CompanyBranding>) },
        proposalDefaults: {
          ...defaultProposalDefaults,
          ...(proposal as Partial<ProposalDefaults>),
          ivaRate: num(proposal.ivaRate, defaultProposalDefaults.ivaRate),
          advancePercent: num(proposal.advancePercent, defaultProposalDefaults.advancePercent),
          maxDiscountPercent: num(proposal.maxDiscountPercent, defaultProposalDefaults.maxDiscountPercent),
          retentionRate: num(proposal.retentionRate, defaultProposalDefaults.retentionRate),
          deliveryDays: num(proposal.deliveryDays, defaultProposalDefaults.deliveryDays),
          validityDays: num(proposal.validityDays, defaultProposalDefaults.validityDays),
          printAmountInWords: bool(proposal.printAmountInWords, defaultProposalDefaults.printAmountInWords),
          amountInWordsLegend: text(proposal.amountInWordsLegend, defaultProposalDefaults.amountInWordsLegend),
          paymentTerms: text(proposal.paymentTerms, defaultProposalDefaults.paymentTerms),
          bankDetails: text(proposal.bankDetails),
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar la configuración de la empresa.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { config, isLoading, error, refresh };
}

/** Guarda un grupo de ajustes por clave. */
export async function saveCompanySettings(companyId: string, entries: Array<{ key: string; value: unknown }>) {
  const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
  const { error } = await supabase
    .from("company_settings")
    .upsert(entries.map((entry) => ({ company_id: companyId, key: entry.key, value: entry.value })));
  if (error) throw error;
}