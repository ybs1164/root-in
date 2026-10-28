-- root-in: Storage's upsert (the profile photo is always written with
-- upsert: true) needs SELECT on storage.objects as well as INSERT/UPDATE.
-- The avatars bucket had no SELECT policy, so every photo upload failed and,
-- with it, the whole profile push: other group members saw the person as
-- 익명 with no photo. Reading through the public URL never needed this.
create policy "own avatar read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
