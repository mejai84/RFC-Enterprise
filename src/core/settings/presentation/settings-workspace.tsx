"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { LaborCostParametersPanel } from "./labor-cost-parameters-panel";
import { LaborRateSettingsPanel } from "./labor-rate-settings-panel";
import { LaborDotacionMatrixPanel } from "./labor-dotacion-matrix-panel";
import {
  BRANDING_BUCKET,
  brandingPath,
  brandingUrl,
  saveCompanyProfile,
  saveCompanySettings,
  useCompanyConfig,
  type CompanyBranding,
  type ProposalDefaults,
} from "../use-company-config";

type MainCategory = "company" | "branding" | "proposal" | "labor" | "security";
type LaborSubTab = "labor_rates" | "labor_dotacion" | "labor_costs";

const categories: Array<{ id: MainCategory; label: string; description: string }> = [
  { id: "company", label: "Empresa y sedes", description: "Razón social, NIT, dirección y parámetros de nómina/impresión." },
  { id: "branding", label: "Identidad corporativa", description: "Firma autorizada, membretes y documentos institucionales." },
  { id: "proposal", label: "Parámetros comerciales", description: "Valores predeterminados para nuevas propuestas y cotizaciones." },
  { id: "labor", label: "Costos laborales", description: "Tablas salariales por cliente, dotación EPP y porcentajes de ley." },
  { id: "security", label: "Seguridad y auditoría", description: "Políticas de acceso, directivas de sesión y trazabilidad." },
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
  const [activeCategory, setActiveCategory] = useState<MainCategory>(() => {
    if (typeof window === "undefined") return "company";
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "branding") return "branding";
    if (requested === "proposal") return "proposal";
    if (requested === "labor_rates" || requested === "labor_dotacion" || requested === "labor_costs") return "labor";
    if (requested === "security") return "security";
    return "company";
  });
  const [laborSubTab, setLaborSubTab] = useState<LaborSubTab>(() => {
    if (typeof window === "undefined") return "labor_rates";
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "labor_dotacion") return "labor_dotacion";
    if (requested === "labor_costs") return "labor_costs";
    return "labor_rates";
  });

  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [proposal, setProposal] = useState<ProposalDefaults | null>(null);
  const [company, setCompany] = useState({
    legalName: "",
    taxId: "",
    address: "",
    payrollPeriod: "Quincenal",
    standardHours: "48",
    paper: "Carta",
    copies: "1",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const signatureInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!config) return;
    queueMicrotask(() => {
      setBranding(config.branding);
      setProposal(config.proposalDefaults);
      setCompany((current) => ({
        ...current,
        legalName: config.companyName,
        taxId: config.taxId,
        address: config.identity.address,
      }));
    });
  }, [config]);

  const signaturePreview = useMemo(() => brandingUrl(branding?.signaturePath ?? ""), [branding]);

  async function uploadSignature(file: File) {
    if (!config?.companyId || !isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return;
    setIsUploading(true);
    setSaveError("");
    try {
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      const path = brandingPath(config.companyId, file.name);
      const { error: uploadError } = await supabase.storage
        .from(BRANDING_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      await saveCompanySettings(config.companyId, [
        { key: "branding", value: { ...branding, signaturePath: path } },
      ]);
      setBranding((current) => (current ? { ...current, signaturePath: path } : current));
      await refresh();
      setNotice("Firma institucional actualizada y lista para los documentos que la utilizan.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No fue posible subir la firma institucional.");
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
      setNotice("Identidad corporativa, firma y membrete guardados exitosamente.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No fue posible guardar los cambios.");
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
      setNotice("Valores por defecto guardados. Las nuevas cotizaciones adoptarán estos términos.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No fue posible guardar la configuración comercial.");
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
      await saveCompanyProfile(
        config.companyId,
        { name: company.legalName, taxId: company.taxId },
        [
          { key: "identity", value: { ...config.identity, address: company.address } },
          { key: "payroll", value: { period: company.payrollPeriod, hours: company.standardHours } },
          { key: "printing", value: { paper: company.paper, copies: company.copies } },
        ],
      );
      await refresh();
      setNotice("Datos de empresa, nómina y preferencias guardados exitosamente.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "No fue posible guardar los datos de la empresa.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="dashboard-content settings-page" id="main-content">
        <p className="panel-intro">Cargando centro de configuración…</p>
      </main>
    );
  }

  return (
    <main className="dashboard-content settings-page" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Administración · RFC Enterprise</p>
          <h1>Centro de configuración</h1>
          <small>Parámetros corporativos, comerciales y costos aplicables a la empresa.</small>
        </div>
      </section>

      {error ? <p className="settings-notice is-error" role="alert">{error}</p> : null}
      {saveError ? <p className="settings-notice is-error" role="alert">{saveError}</p> : null}
      {notice ? <p className="settings-notice" role="status">{notice}</p> : null}

      <div className="settings-workspace-grid">
        {/* Navegación lateral de categorías */}
        <aside
          className="dashboard-panel settings-category-nav"
          aria-label="Categorías de configuración"
        >
          <div className="settings-category-nav-title">
            <span>
              Categorías
            </span>
          </div>

          {categories.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setNotice("");
                  setSaveError("");
                }}
                className={`settings-category-button${isSelected ? " is-selected" : ""}`}
              >
                <div>
                  <div className="settings-category-label">{cat.label}</div>
                  <div className="settings-category-description">
                    {cat.description}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Panel principal de contenido según categoría */}
        <div className="settings-content">
          {/* Categoría: Empresa y sedes */}
          {activeCategory === "company" && (
            <form className="dashboard-panel settings-card" onSubmit={saveCompany}>
              <h2>Empresa, nómina e impresión</h2>
              <p className="panel-intro">Identificación legal y parámetros operativos de la entidad.</p>
              
              <div className="settings-columns">
                <label>
                  Razón social
                  <input
                    onChange={(e) => setCompany({ ...company, legalName: e.target.value })}
                    value={company.legalName}
                    required
                  />
                </label>
                <label>
                  NIT
                  <input
                    onChange={(e) => setCompany({ ...company, taxId: e.target.value })}
                    value={company.taxId}
                    placeholder="900.000.000-1"
                  />
                </label>
                <label>
                  Dirección fiscal
                  <input
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    value={company.address}
                  />
                </label>
                <label>
                  Período de nómina
                  <select
                    onChange={(e) => setCompany({ ...company, payrollPeriod: e.target.value })}
                    value={company.payrollPeriod}
                  >
                    <option value="Quincenal">Quincenal</option>
                    <option value="Mensual">Mensual</option>
                    <option value="Semanal">Semanal</option>
                  </select>
                </label>
                <label>
                  Horas estándar semanales
                  <input
                    onChange={(e) => setCompany({ ...company, standardHours: e.target.value })}
                    type="number"
                    value={company.standardHours}
                    min="1"
                    max="60"
                  />
                </label>
                <label>
                  Tamaño de papel por defecto
                  <select
                    onChange={(e) => setCompany({ ...company, paper: e.target.value })}
                    value={company.paper}
                  >
                    <option value="Carta">Carta (Letter)</option>
                    <option value="Oficio">Oficio (Legal)</option>
                    <option value="A4">A4</option>
                  </select>
                </label>
                <label>
                  Copias sugeridas
                  <input
                    onChange={(e) => setCompany({ ...company, copies: e.target.value })}
                    type="number"
                    value={company.copies}
                    min="1"
                    max="5"
                  />
                </label>
              </div>

              <div style={{ marginTop: "16px", borderTop: "1px solid var(--color-border, #e2e8f0)", paddingTop: "16px" }}>
                <button className="inventory-action" disabled={isSaving} type="submit">
                  {isSaving ? "Guardando…" : "Guardar datos de empresa"}
                </button>
              </div>
            </form>
          )}

          {/* Categoría: Identidad corporativa */}
          {activeCategory === "branding" && branding && (
            <form className="dashboard-panel settings-card" onSubmit={saveBranding}>
              <h2>Firma autorizada y membrete institucional</h2>
              <p className="panel-intro">Configura la persona autorizada que firma en representación de RFC en los documentos emitidos.</p>

              <div className="settings-columns">
                <label>
                  Nombre del representante legal
                  <input
                    onChange={(e) => setBranding({ ...branding, legalRepresentative: e.target.value })}
                    value={branding.legalRepresentative}
                    required
                  />
                </label>
                <label>
                  Cargo que acompaña a la firma
                  <input
                    onChange={(e) => setBranding({ ...branding, legalRepresentativeTitle: e.target.value })}
                    value={branding.legalRepresentativeTitle}
                    required
                  />
                </label>
              </div>

              <h3 className="settings-subheading" style={{ marginTop: "16px" }}>Imagen de la firma</h3>
              <div className="settings-signature-row">
                <div className="settings-signature-preview">
                  {signaturePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="Firma institucional vigente" src={signaturePreview} />
                  ) : (
                    <p className="panel-intro">No se ha subido una firma personalizada. Se utiliza la firma estándar del sistema.</p>
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
                    {isUploading ? "Subiendo firma…" : "Archivo PNG o JPG con fondo transparente. Ancho recomendado: 400 px."}
                  </p>
                </div>
              </div>

              <h3 className="settings-subheading" style={{ marginTop: "16px" }}>Documentos donde se incluye la firma</h3>
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

              <p className="panel-intro" style={{ marginTop: "12px" }}>
                Nota: Esta firma institucional no sustituye las firmas manuscritas de entrega, recepción ni del cliente, que se capturan por separado en cada proceso.
              </p>

              <div style={{ marginTop: "16px", borderTop: "1px solid var(--color-border, #e2e8f0)", paddingTop: "16px" }}>
                <button className="inventory-action" disabled={isSaving || isUploading} type="submit">
                  {isSaving ? "Guardando…" : "Guardar firma y membrete"}
                </button>
              </div>
            </form>
          )}

          {/* Categoría: Parámetros comerciales */}
          {activeCategory === "proposal" && proposal && (
            <form className="dashboard-panel settings-card" onSubmit={saveProposal}>
              <h2>Parámetros comerciales de propuestas</h2>
              <p className="panel-intro">Valores iniciales aplicados al generar una cotización. Cada cotización puede sobreescribirlos según la negociación.</p>

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
                  Anticipo requerido (%)
                  <input
                    max="100"
                    min="0"
                    onChange={(e) => setProposal({ ...proposal, advancePercent: Number(e.target.value) })}
                    type="number"
                    value={proposal.advancePercent}
                  />
                </label>
                <label>
                  Descuento máximo autorizado (%)
                  <input
                    max="100"
                    min="0"
                    onChange={(e) => setProposal({ ...proposal, maxDiscountPercent: Number(e.target.value) })}
                    type="number"
                    value={proposal.maxDiscountPercent}
                  />
                </label>
                <label>
                  Retención en la fuente estimada (%)
                  <input
                    max="100"
                    min="0"
                    onChange={(e) => setProposal({ ...proposal, retentionRate: Number(e.target.value) })}
                    type="number"
                    value={proposal.retentionRate}
                  />
                </label>
                <label>
                  Plazo de entrega predeterminado (días)
                  <input
                    min="0"
                    onChange={(e) => setProposal({ ...proposal, deliveryDays: Number(e.target.value) })}
                    type="number"
                    value={proposal.deliveryDays}
                  />
                </label>
                <label>
                  Vigencia de la oferta comercial (días)
                  <input
                    min="0"
                    onChange={(e) => setProposal({ ...proposal, validityDays: Number(e.target.value) })}
                    type="number"
                    value={proposal.validityDays}
                  />
                </label>
              </div>

              <label style={{ marginTop: "12px", display: "block" }}>
                Condiciones de pago estándar
                <input
                  onChange={(e) => setProposal({ ...proposal, paymentTerms: e.target.value })}
                  value={proposal.paymentTerms}
                />
              </label>

              <label style={{ marginTop: "12px", display: "block" }}>
                Datos bancarios institucionales para consignaciones
                <textarea
                  onChange={(e) => setProposal({ ...proposal, bankDetails: e.target.value })}
                  placeholder="Ej. Bancolombia Cuenta Corriente Nº 000-000000-00 a nombre de Representaciones Figueroa S.A.S."
                  rows={2}
                  value={proposal.bankDetails}
                />
              </label>

              <label className="settings-toggle" style={{ marginTop: "12px" }}>
                <input
                  checked={proposal.printAmountInWords}
                  onChange={(e) => setProposal({ ...proposal, printAmountInWords: e.target.checked })}
                  type="checkbox"
                />
                <span>Imprimir el valor total en letras en la propuesta PDF</span>
              </label>

              {proposal.printAmountInWords && (
                <label style={{ marginTop: "8px", display: "block" }}>
                  Leyenda monetaria
                  <input
                    onChange={(e) => setProposal({ ...proposal, amountInWordsLegend: e.target.value })}
                    value={proposal.amountInWordsLegend}
                  />
                </label>
              )}

              <div style={{ marginTop: "16px", borderTop: "1px solid var(--color-border, #e2e8f0)", paddingTop: "16px" }}>
                <button className="inventory-action" disabled={isSaving} type="submit">
                  {isSaving ? "Guardando…" : "Guardar parámetros comerciales"}
                </button>
              </div>
            </form>
          )}

          {/* Categoría: Costos laborales (con subpestañas organizadas) */}
          {activeCategory === "labor" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="dashboard-panel settings-labor-tabs">
                <span className="settings-labor-tabs-label">
                  Sección laboral:
                </span>
                <button
                  type="button"
                  onClick={() => setLaborSubTab("labor_rates")}
                  className={`settings-labor-tab${laborSubTab === "labor_rates" ? " is-selected" : ""}`}
                >
                  Tablas salariales por cliente
                </button>
                <button
                  type="button"
                  onClick={() => setLaborSubTab("labor_dotacion")}
                  className={`settings-labor-tab${laborSubTab === "labor_dotacion" ? " is-selected" : ""}`}
                >
                  Dotación y EPP por cargo
                </button>
                <button
                  type="button"
                  onClick={() => setLaborSubTab("labor_costs")}
                  className={`settings-labor-tab${laborSubTab === "labor_costs" ? " is-selected" : ""}`}
                >
                  Parámetros legales nacionales
                </button>
              </div>

              {laborSubTab === "labor_rates" && config?.companyId && (
                <LaborRateSettingsPanel companyId={config.companyId} />
              )}
              {laborSubTab === "labor_dotacion" && config?.companyId && (
                <LaborDotacionMatrixPanel companyId={config.companyId} />
              )}
              {laborSubTab === "labor_costs" && (
                <LaborCostParametersPanel />
              )}
            </div>
          )}

          {/* Categoría: Seguridad y auditoría */}
          {activeCategory === "security" && (
            <div className="dashboard-panel settings-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2>Seguridad y auditoría del sistema</h2>
              <p className="panel-intro">Control de directivas de autenticación, trazabilidad y estado de aislamiento corporativo.</p>

              <div style={{ background: "var(--color-bg-subtle, #f8fafc)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "0.9375rem" }}>Directivas de autenticación y contraseñas</h3>
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.8125rem", color: "var(--color-text, #334155)", lineHeight: "1.6" }}>
                  <li>Longitud mínima de contraseña: 10 caracteres alfanuméricos con caracteres especiales.</li>
                  <li>Sincronización atómica entre identidad de acceso Auth y ficha de personal.</li>
                  <li>Protección de administrador: No es posible revocar o desactivar al único administrador activo de la empresa.</li>
                  <li>Revocación inmediata de permisos operativos al desactivar una ficha laboral.</li>
                </ul>
              </div>

              <div style={{ background: "var(--color-bg-subtle, #f8fafc)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "0.9375rem" }}>Trazabilidad y auditoría de eventos</h3>
                <p style={{ margin: "0 0 10px 0", fontSize: "0.8125rem", color: "var(--color-text-muted, #64748b)" }}>
                  Cada cambio en cotizaciones, altas de personal, transferencias de inventario y ajustes de configuración queda registrado con sello de tiempo UTC y actor en la tabla audit_logs de Supabase.
                </p>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "4px 8px", background: "#dcfce7", color: "#166534", borderRadius: "4px" }}>
                  ✓ Auditoría de base de datos activa
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}