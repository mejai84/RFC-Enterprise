-- Evidencia fotográfica de las bajas de inventario (INV-008).
-- El bucket es privado: las fotos se sirven con URL firmada de corta duración.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'writeoff-evidence',
  'writeoff-evidence',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "Autenticado puede subir evidencia de bajas" on storage.objects;
create policy "Autenticado puede subir evidencia de bajas"
  on storage.objects for insert
  with check (bucket_id = 'writeoff-evidence' and auth.role() = 'authenticated');

drop policy if exists "Autenticado puede leer evidencia de bajas" on storage.objects;
create policy "Autenticado puede leer evidencia de bajas"
  on storage.objects for select
  using (bucket_id = 'writeoff-evidence' and auth.role() = 'authenticated');

drop policy if exists "Autenticado puede eliminar evidencia de bajas" on storage.objects;
create policy "Autenticado puede eliminar evidencia de bajas"
  on storage.objects for delete
  using (bucket_id = 'writeoff-evidence' and auth.role() = 'authenticated');
