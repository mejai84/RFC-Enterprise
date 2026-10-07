-- ALQ-003 · Bucket de adjuntos del alquiler rapido.
-- La firma de entrega y las fotos se intentaban subir a `rental-attachments`,
-- un bucket que nunca existio: la firma se perdia en cada entrega.

insert into storage.buckets (id, name, public)
values ('rental-attachments', 'rental-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "Autenticado puede subir adjuntos de alquiler" on storage.objects;
create policy "Autenticado puede subir adjuntos de alquiler"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'rental-attachments');

drop policy if exists "Autenticado puede leer adjuntos de alquiler" on storage.objects;
create policy "Autenticado puede leer adjuntos de alquiler"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'rental-attachments');

drop policy if exists "Autenticado puede eliminar adjuntos de alquiler" on storage.objects;
create policy "Autenticado puede eliminar adjuntos de alquiler"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'rental-attachments');