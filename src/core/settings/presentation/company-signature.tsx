"use client";

import { brandingUrl, useCompanyConfig, type CompanyBranding } from "../use-company-config";

export type SignatureDocument = "proposal" | "apuPrint" | "apuXlsx" | "dispatchVoucher" | "rentalInvoice";

const toggleByDocument: Record<SignatureDocument, keyof CompanyBranding> = {
  proposal: "showSignatureOnProposal",
  apuPrint: "showSignatureOnApuPrint",
  apuXlsx: "showSignatureOnApuXlsx",
  dispatchVoucher: "showSignatureOnDispatchVoucher",
  rentalInvoice: "showSignatureOnRentalInvoice",
};

/**
 * Firma institucional de la empresa.
 *
 * Antes cada documento tenía escrita a mano la ruta `/rfc-signature.png` y el
 * nombre del representante legal. Este componente lee ambos de la base de datos y
 * respeta el interruptor del documento, de modo que admin puede cambiar la firma
 * una sola vez desde Configuración.
 *
 * Si la empresa todavía no subió firma, se usa la que tiene el sistema: es
 * preferible una imagen genérica a un documento sin firma.
 */
export function CompanySignature({
  document,
  className,
  imageClassName,
  imageAlt,
  showTitle = true,
  fallbackImage = "/rfc-signature.png",
}: {
  document: SignatureDocument;
  className?: string;
  imageClassName?: string;
  imageAlt?: string;
  showTitle?: boolean;
  fallbackImage?: string;
}) {
  const { config } = useCompanyConfig();
  const enabled = config ? Boolean(config.branding[toggleByDocument[document]]) : true;
  if (!enabled) return null;

  const name = config?.branding.legalRepresentative || "Jorge Figueroa Castro";
  const title = config?.branding.legalRepresentativeTitle || "Representante Legal";
  const src = brandingUrl(config?.branding.signaturePath ?? "") || fallbackImage;

  return (
    <div className={`company-signature ${className ?? ""}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={imageAlt ?? `Firma de ${name}`}
        className={imageClassName}
        src={src}
      />
      <strong>{name}</strong>
      {showTitle ? <small>{title}</small> : null}
    </div>
  );
}

/** Datos de firma para documentos que no se renderizan en React (exportación XLSX). */
export async function resolveSignatureForExport(document: SignatureDocument) {
  const fallback = {
    name: "Jorge Figueroa Castro",
    title: "Representante Legal",
    imageUrl: "/rfc-signature.png",
    enabled: true,
  };
  if (!isConfiguredForFetch()) return fallback;
  try {
    const { createBrowserClient } = await import("@supabase/ssr");
    const { supabaseUrl, supabasePublishableKey } = await import("@/lib/supabase/config");
    if (!supabaseUrl || !supabasePublishableKey) return fallback;
    const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return fallback;
    const { data: membership } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();
    if (!membership?.company_id) return fallback;
    const { data } = await supabase
      .from("company_settings")
      .select("value")
      .eq("company_id", membership.company_id)
      .eq("key", "branding")
      .maybeSingle();
    const branding = (data?.value ?? {}) as Partial<CompanyBranding>;
    return {
      name: branding.legalRepresentative || fallback.name,
      title: branding.legalRepresentativeTitle || fallback.title,
      imageUrl: brandingUrl(branding.signaturePath ?? "") || fallback.imageUrl,
      enabled: branding[toggleByDocument[document]] !== false,
    };
  } catch {
    return fallback;
  }
}

function isConfiguredForFetch() {
  return typeof window !== "undefined";
}