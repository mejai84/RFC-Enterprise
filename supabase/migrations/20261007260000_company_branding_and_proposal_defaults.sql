-- RFC Enterprise: identidad, membrete y valores por defecto de la propuesta.
--
-- Estas preferencias vivian enterradas en el codigo: la firma institucional era
-- `/rfc-signature.png` y el nombre del representante legal estaba escrito como
-- texto en cinco documentos. Consecuencia: cambiarlos obligaba a tocar y
-- recompilar, y dos copias del nombrePueden quedar distintas.
--
-- Aqui pasan a la base de datos, en `company_settings`, que ya es clave/valor por
-- empresa y solo la escribe administracion.

insert into storage.buckets (id, name, public)
values ('company-branding', 'company-branding', true)
on conflict (id) do update set public = true;

drop policy if exists "Firma institucional se puede subir" on storage.objects;
create policy "Firma institucional se puede subir"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'company-branding');

drop policy if exists "Firma institucional se puede leer" on storage.objects;
create policy "Firma institucional se puede leer"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'company-branding');

drop policy if exists "Firma institucional se puede eliminar" on storage.objects;
create policy "Firma institucional se puede eliminar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'company-branding');

-- Valores por defecto con los que se abre una cotización nueva.
insert into public.company_settings (company_id, key, value)
select c.id, 'proposal_defaults', jsonb_build_object(
  'ivaRate', 19,
  'advancePercent', 50,
  'maxDiscountPercent', 5,
  'retentionRate', 0,
  'paymentTerms', '50% anticipo, 50% contra entrega',
  'deliveryDays', 30,
  'validityDays', 30,
  'printAmountInWords', true,
  'amountInWordsLegend', 'PESOS COLOMBIANOS M/L',
  'bankDetails', ''
)
from public.companies c
on conflict (company_id, key) do nothing;

-- Identidad visible en documentos y membrete.
insert into public.company_settings (company_id, key, value)
select c.id, 'identity', jsonb_build_object(
  'address', '',
  'phone', '',
  'email', '',
  'city', '',
  'contactName', ''
)
from public.companies c
on conflict (company_id, key) do nothing;

insert into public.company_settings (company_id, key, value)
select c.id, 'branding', jsonb_build_object(
  'signaturePath', '',
  'logoPath', '',
  'legalRepresentative', 'Jorge Figueroa Castro',
  'legalRepresentativeTitle', 'Representante Legal',
  'showSignatureOnProposal', true,
  'showSignatureOnApuPrint', true,
  'showSignatureOnApuXlsx', true,
  'showSignatureOnDispatchVoucher', true,
  'showSignatureOnRentalInvoice', true
)
from public.companies c
on conflict (company_id, key) do nothing;

comment on function public.my_effective_permissions() is
  'Permisos efectivos de la persona autenticada: rol laboral, respaldo en membresia antigua y excepciones individuales. Es la unica fuente que consultan el menu, la guarda de ruta y los datos; las tablas conservan sus propias RLS.';