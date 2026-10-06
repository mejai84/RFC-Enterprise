-- Bucket de evidencia de visitas técnicas (fotos y firmas).
insert into storage.buckets (id, name, public)
values ('visit-evidence', 'visit-evidence', true)
on conflict (id) do nothing;

drop policy if exists "visit-evidence public read" on storage.objects;
create policy "visit-evidence public read"
  on storage.objects for select
  using (bucket_id = 'visit-evidence');

drop policy if exists "visit-evidence authenticated upload" on storage.objects;
create policy "visit-evidence authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'visit-evidence');
