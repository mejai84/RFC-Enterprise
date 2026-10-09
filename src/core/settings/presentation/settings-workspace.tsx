"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { LaborCostParametersPanel } from "./labor-cost-parameters-panel";
import { LaborRateSettingsPanel } from "./labor-rate-settings-panel";
import {
  BRANDING_BUCKET,
  brandingPath,
  brandingUrl,
  saveCompanySettings,
  useCompanyConfig,
  type CompanyBranding,
  type ProposalDefaults,
} from "../use-company-config";

type SettingsTab = "branding" | "proposal" | "company" | "labor_rates" | "labor_costs";

const tabs: Array<{ value: SettingsTab; label: string; hint: string }> = [
  { value: "branding", label: "Firma y membrete", hint: "Quién firma en nombre de RFC y en qué documentos." },
  { value: "proposal", label: "Propuesta", hint: "Valores con los que se abre una cotización nueva." },
  { value: "company", label: "Empresa y nómina", hint: "Datos de la empresa, nómina e impresión." },
  { value: "labor_rates", label: "Costos y tablas salariales", hint: "Tablas de mano de obra por cliente, vigencia y cargo." },
  { value: "labor_costs", label: "Parámetros laborales", hint: "Porcentajes nacionales que calculan el costo de mano de obra." },
];

const signatureToggles: Array<{ key: keyof CompanyBranding; label: string }> = [
  { key: "showSignatureOnProposal", label: "Propuestas comerciales" },
  { key: "showSignatureOnApuPrint", label: "Impresión del APU" },
  { key: "showSignatureOnApuXlsx", label: "Exportación XLSX del APU" },
  { key: "showSignatureOnDispatchVoucher", label: "Vales de salida" },
  { key: "showSignatureOnRentalInvoice", label: "Facturas de alquiler" },
];

export function SettingsWorkspace() {
  const { config, isLoading, error, refresh } = useCompanyConfig();
  const [tab, setTab] = useState<SettingsTab>("branding");
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [proposal, setProposal] = useState<ProposalDefaults | null>(null);
  const [company, setCompany] = useState({ legalName: "", taxId: "", address: "", payrollPeriod: "Quincenal", standardHours: "48", paper: "Carta", copies: "1" });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const signatureInput = useRef<HTMLInputElement>(null);

  // Permite llegar directo a una seccion con /settings?tab=labor_rates, que es
  // lo que usa el buscador de la barra lateral para abrir Tablas salariales
  // sin que la persona tenga que recorrer Configuracion.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "proposal" || requested === "company" || requested === "labor_rates" || requested === "labor_costs" || requested === "branding") {
      setTab(requested);
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    setBranding(config.branding);
    setProposal(config.proposalDefaults);
    setCompany((current) => ({
      ...current,
      legalName: config.companyName,
      taxId: config.taxId,
      address: config.identity.address,
    }));
  }, [config]);

  const signaturePreview = useMemo(() => brandingUrl(branding?.signaturePath ?? ""), [branding]);
  const visibleTabs = tabs;

  async function uploadSignature(file: File) {
    if (!config?.companyId) return;
    setIsUploading(true);
    setSaveError("");
    try {
      const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
      const path = brandingPath(file.name);
      const { error: uploadError } = await supabase.storage
        .from(BRANDING_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      await saveCompanySettings(config.companyId, [
        { key: "branding", value: { ...branding, signaturePath: path } },
      ]);
      setBranding((current) => (current ? { ...current, signaturePath: path } : current));
      await refresh();
      setNotice("Firma institucional actualizada. Ya aparece en los documentos que la usan.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No fue posible subir la firma.");
    } finally {
      setIsUploading(false);
      if (signatureInput.current) signatureInput.current.value = "";
    }
  }

  async function saveBranding(event: FormEvent) {
    event.preventDefault();
    if (!config?.companyId || !branding) return;
    setIsSaving(true);
    setNotice("");
    setSaveError("");
    try {
      await saveCompanySettings(config.companyId, [{ key: "branding", value: branding }]);
      await refresh();
      setNotice("Firma y membrete guardados.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No fue posible guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProposal(event: FormEvent) {
    event.preventDefault();
    if (!config?.companyId || !proposal) return;
    setIsSaving(true);
    setNotice("");
    setSaveError("");
    try {
      await saveCompanySettings(config.companyId, [{ key: "proposal_defaults", value: proposal }]);
      await refresh();
      setNotice("Valores por defecto guardados. Las cotizaciones nuevas los usan al abrirse.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No fue posible guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault();
    if (!config?.companyId) return;
    setIsSaving(true);
    setNotice("");
    setSaveError("");
    try {
      const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
      await saveCompanySettings(config.companyId, [
        { key: "identity", value: { ...config!.identity, address: company.address } },
        { key: "payroll", value: { period: company.payrollPeriod, hours: company.standardHours } },
        { key: "printing", value: { paper: company.paper, copies: company.copies } },
      ]);
      const { error: companyError } = await supabase
        .from("companies")
        .update({ name: company.legalName, tax_id: company.taxId || null })
        .eq("id", config.companyId);
      if (companyError) throw companyError;
      await refresh();
      setNotice("Configuración de la empresa guardada.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No fue posible guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <main className="dashboard-content settings-page" id="main-content"><p className="panel-intro">Cargando configuración…</p></main>;

  return (
    <main className="dashboard-content settings-page" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Administración · RFC Enterprise</p>
          <h1>Configuración</h1>
          <small>Lo que aplica a toda la empresa. Tu ficha personal está en «Mi perfil».</small>
        </div>
      </section>

      {error ? <p className="settings-notice" role="alert">{error}</p> : null}
      {saveError ? <p className="settings-notice" role="alert">{saveError}</p> : null}
      {notice ? <p className="settings-notice" role="status">{notice}</p> : null}

      <div className="settings-tabs" role="tablist" aria-label="Secciones de configuración">
        {visibleTabs.map((item) => (
          <button
            aria-selected={tab === item.value}
            className="settings-tab"
            key={item.value}
            onClick={() => { setTab(item.value); setNotice(""); setSaveError(""); }}
            role="tab"
            type="button"
          >
            <strong>{item.label}</strong>
            <small>{item.hint}</small>
          </button>
        ))}
      </div>

      {tab === "branding" && branding ? (
        <form className="dashboard-panel settings-card" onSubmit={saveBranding}>
          <h2>Quién firma por la empresa</h2>
          <label>
            Nombre del representante legal
            <input
              onChange={(e) => setBranding({ ...branding, legalRepresentative: e.target.value })}
              value={branding.legalRepresentative}
            />
          </label>
          <label>
            Cargo que aparece debajo de la firma
            <input
              onChange={(e) => setBranding({ ...branding, legalRepresentativeTitle: e.target.value })}
              value={branding.legalRepresentativeTitle}
            />
          </label>

          <h3 className="settings-subheading">Imagen de la firma</h3>
          <div className="settings-signature-row">
            <div className="settings-signature-preview">
              {signaturePreview ? (
                <img alt="Firma institucional vigente" src={signaturePreview} />
              ) : (
                <p className="panel-intro">Todavía no has subido la firma. Se usará la que tiene el sistema.</p>
              )}
            </div>
            <div>
              <input
                accept="image/png,image/jpeg"
                className="settings-file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadSignature(file);
                }}
                ref={signatureInput}
                type="file"
              />
              <p className="panel-intro">
                {isUploading ? "Subiendo firma…" : "PNG o JPG de fondo transparente, ancho aproximado 400 px."}
              </p>
            </div>
          </div>

          <h3 className="settings-subheading">En qué documentos aparece</h3>
          <div className="settings-toggles">
            {signatureToggles.map((item) => (
              <label className="settings-toggle" key={String(item.key)}>
                <input
                  checked={Boolean(branding[item.key])}
                  onChange={(event) => setBranding({ ...branding, [item.key]: event.target.checked })}
                  type="checkbox"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          <p className="panel-intro">
            Esta firma es la de la empresa. No reemplaza la firma del cliente, del residente ni del
            receptor, que siguen guardándose aparte como evidencia.
          </p>
          <button className="inventory-action" disabled={isSaving || isUploading} type="submit">
            {isSaving ? "Guardando…" : "Guardar firma y membrete"}
          </button>
        </form>
      ) : null}

      {tab === "proposal" && proposal ? (
        <form className="dashboard-panel settings-card" onSubmit={saveProposal}>
          <h2>Valores por defecto de la propuesta</h2>
          <p className="panel-intro">Se aplican al abrir una cotización nueva. Lo que edites en la cotización manda sobre esto.</p>
          <div className="settings-columns">
            <label>
              IVA aplicado (%)
              <input
                max="100"
                min="0"
                onChange={(e) => setProposal({ ...proposal, ivaRate: Number(e.target.value) })}
                type="number"
                value={proposal.ivaRate}
              />
            </label>
            <label>
              Anticipo (%)
              <input
                max="100"
                min="0"
                onChange={(e) => setProposal({ ...proposal, advancePercent: Number(e.target.value) })}
                type="number"
                value={proposal.advancePercent}
              />
            </label>
            <label>
              Descuento máximo (%)
              <input
                max="100"
                min="0"
                onChange={(e) => setProposal({ ...proposal, maxDiscountPercent: Number(e.target.value) })}
                type="number"
                value={proposal.maxDiscountPercent}
              />
            </label>
            <label>
              Retención (%)
              <input
                max="100"
                min="0"
                onChange={(e) => setProposal({ ...proposal, retentionRate: Number(e.target.value) })}
                type="number"
                value={proposal.retentionRate}
              />
            </label>
            <label>
              Plazo de entrega (días)
              <input
                min="0"
                onChange={(e) => setProposal({ ...proposal, deliveryDays: Number(e.target.value) })}
                type="number"
                value={proposal.deliveryDays}
              />
            </label>
            <label>
              Vigencia de la oferta (días)
              <input
                min="0"
                onChange={(e) => setProposal({ ...proposal, validityDays: Number(e.target.value) })}
                type="number"
                value={proposal.validityDays}
              />
            </label>
          </div>
          <label>
            Condiciones de pago
            <input
              onChange={(e) => setProposal({ ...proposal, paymentTerms: e.target.value })}
              value={proposal.paymentTerms}
            />
          </label>
          <label>
            Datos bancarios para pago
            <textarea
              onChange={(e) => setProposal({ ...proposal, bankDetails: e.target.value })}
              placeholder="Ej. Bancolombia 123-456789, a nombre de RFC S.A.S."
              rows={2}
              value={proposal.bankDetails}
            />
          </label>
          <label className="settings-toggle">
            <input
              checked={proposal.printAmountInWords}
              onChange={(e) => setProposal({ ...proposal, printAmountInWords: e.target.checked })}
              type="checkbox"
            />
            <span>Imprimir el valor total también en letras</span>
          </label>
          {proposal.printAmountInWords ? (
            <label>
              Leyenda de las letras
              <input
                onChange={(e) => setProposal({ ...proposal, amountInWordsLegend: e.target.value })}
                value={proposal.amountInWordsLegend}
              />
            </label>
          ) : null}
          <button className="inventory-action" disabled={isSaving} type="submit">
            {isSaving ? "Guardando…" : "Guardar valores por defecto"}
          </button>
        </form>
      ) : null}

      {tab === "labor_rates" && config?.companyId ? <LaborRateSettingsPanel companyId={config.companyId} /> : null}

      {tab === "labor_costs" ? <LaborCostParametersPanel /> : null}
      {tab === "company" ? (
        <form className="dashboard-panel settings-card" onSubmit={saveCompany}>
          <h2>Empresa, nómina y documentos</h2>
          <div className="settings-columns">
            <label>
              Razón social
              <input onChange={(e) => setCompany({ ...company, legalName: e.target.value })} value={company.legalName} />
            </label>
            <label>
              NIT
              <input onChange={(e) => setCompany({ ...company, taxId: e.target.value })} value={company.taxId} />
            </label>
            <label>
              Dirección
              <input onChange={(e) => setCompany({ ...company, address: e.target.value })} value={company.address} />
            </label>
            <label>
              Período de nómina
              <input onChange={(e) => setCompany({ ...company, payrollPeriod: e.target.value })} value={company.payrollPeriod} />
            </label>
            <label>
              Horas estándar
              <input onChange={(e) => setCompany({ ...company, standardHours: e.target.value })} type="number" value={company.standardHours} />
            </label>
            <label>
              Papel
              <input onChange={(e) => setCompany({ ...company, paper: e.target.value })} value={company.paper} />
            </label>
            <label>
              Copias
              <input onChange={(e) => setCompany({ ...company, copies: e.target.value })} type="number" value={company.copies} />
            </label>
          </div>
          <p className="panel-intro">La impresora física se selecciona al imprimir; aquí quedan las preferencias del documento.</p>
          <button className="inventory-action" disabled={isSaving} type="submit">
            {isSaving ? "Guardando…" : "Guardar configuración de la empresa"}
          </button>
        </form>
      ) : null}
    </main>
  );
}