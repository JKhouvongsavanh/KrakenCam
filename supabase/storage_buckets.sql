-- ── Storage buckets for logos and avatars ────────────────────────────────────

-- Company logos (per org)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,  -- public so logos load without signed URLs
  2097152,  -- 2MB max
  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- User avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  1048576,  -- 1MB max
  ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- RLS: org members can upload/update their org logo
CREATE POLICY "org_logo_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'org-logos'
    AND auth.role() = 'authenticated'
  );
CREATE POLICY "org_logo_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated');
CREATE POLICY "org_logo_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated');
CREATE POLICY "org_logo_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'org-logos');

-- RLS: users can upload/update their own avatar
CREATE POLICY "avatar_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.role() = 'authenticated'
  );
CREATE POLICY "avatar_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');
CREATE POLICY "avatar_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');
CREATE POLICY "avatar_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-avatars');

-- Add URL columns to store public URLs (not base64)
ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;
