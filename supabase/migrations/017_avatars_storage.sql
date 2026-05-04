-- 014: avatars storage bucket
--
-- Creates a public bucket named `avatars` for profile pictures. Filenames are
-- of the form `<user_id>/avatar.jpg`. The bucket is public-read so that
-- supporter clients can render images via the URL stored in `users.avatar_url`
-- without per-request signing. RLS on `storage.objects` restricts uploads,
-- updates, and deletes to the owning user.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone authenticated can read avatar files (the bucket is public anyway,
-- this policy is for completeness so RLS doesn't block authenticated clients).
create policy "avatars: read all"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A user can insert/update/delete only files inside a folder matching their uid.
-- Filename convention: `<auth.uid()>/avatar.jpg` (or .png).
create policy "avatars: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
