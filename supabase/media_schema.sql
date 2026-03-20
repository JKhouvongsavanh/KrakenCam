-- ============================================================
-- KrakenCam Media Schema
-- Tables: voice_notes, sketches, chat_messages, project_files, video_recordings
-- Run this in the Supabase SQL editor after schema.sql
-- ============================================================

-- Enable uuid extension (safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── voice_notes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voice_notes (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       uuid        REFERENCES projects(id) ON DELETE CASCADE,
  storage_path     text        NOT NULL,
  duration_seconds integer,
  transcript       text,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_notes_org_idx     ON voice_notes (organization_id);
CREATE INDEX IF NOT EXISTS voice_notes_project_idx ON voice_notes (project_id);

ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_notes_select_org" ON voice_notes;
CREATE POLICY "voice_notes_select_org" ON voice_notes
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "voice_notes_insert_org" ON voice_notes;
CREATE POLICY "voice_notes_insert_org" ON voice_notes
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "voice_notes_update_org" ON voice_notes;
CREATE POLICY "voice_notes_update_org" ON voice_notes
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "voice_notes_delete_org" ON voice_notes;
CREATE POLICY "voice_notes_delete_org" ON voice_notes
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── sketches ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sketches (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       uuid        REFERENCES projects(id) ON DELETE CASCADE,
  title            text,
  storage_path     text,
  canvas_data      jsonb,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sketches_org_idx     ON sketches (organization_id);
CREATE INDEX IF NOT EXISTS sketches_project_idx ON sketches (project_id);

ALTER TABLE sketches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sketches_select_org" ON sketches;
CREATE POLICY "sketches_select_org" ON sketches
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sketches_insert_org" ON sketches;
CREATE POLICY "sketches_insert_org" ON sketches
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sketches_update_org" ON sketches;
CREATE POLICY "sketches_update_org" ON sketches
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sketches_delete_org" ON sketches;
CREATE POLICY "sketches_delete_org" ON sketches
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── chat_messages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       uuid        REFERENCES projects(id) ON DELETE CASCADE,
  channel          text        NOT NULL DEFAULT 'general',
  sender_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name      text,
  content          text        NOT NULL,
  message_type     text        DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice')),
  attachment_path  text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_org_idx     ON chat_messages (organization_id);
CREATE INDEX IF NOT EXISTS chat_messages_project_idx ON chat_messages (project_id);
CREATE INDEX IF NOT EXISTS chat_messages_channel_idx ON chat_messages (channel);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_select_org" ON chat_messages;
CREATE POLICY "chat_messages_select_org" ON chat_messages
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert_org" ON chat_messages;
CREATE POLICY "chat_messages_insert_org" ON chat_messages
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_update_org" ON chat_messages;
CREATE POLICY "chat_messages_update_org" ON chat_messages
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_delete_org" ON chat_messages;
CREATE POLICY "chat_messages_delete_org" ON chat_messages
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── project_files ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_files (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       uuid        REFERENCES projects(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  storage_path     text        NOT NULL,
  file_size        integer,
  mime_type        text,
  uploaded_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_files_org_idx     ON project_files (organization_id);
CREATE INDEX IF NOT EXISTS project_files_project_idx ON project_files (project_id);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_files_select_org" ON project_files;
CREATE POLICY "project_files_select_org" ON project_files
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_files_insert_org" ON project_files;
CREATE POLICY "project_files_insert_org" ON project_files
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_files_update_org" ON project_files;
CREATE POLICY "project_files_update_org" ON project_files
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_files_delete_org" ON project_files;
CREATE POLICY "project_files_delete_org" ON project_files
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── video_recordings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS video_recordings (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       uuid        REFERENCES projects(id) ON DELETE CASCADE,
  title            text,
  storage_path     text        NOT NULL,
  duration_seconds integer,
  thumbnail_path   text,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_recordings_org_idx     ON video_recordings (organization_id);
CREATE INDEX IF NOT EXISTS video_recordings_project_idx ON video_recordings (project_id);

ALTER TABLE video_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_recordings_select_org" ON video_recordings;
CREATE POLICY "video_recordings_select_org" ON video_recordings
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "video_recordings_insert_org" ON video_recordings;
CREATE POLICY "video_recordings_insert_org" ON video_recordings
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "video_recordings_update_org" ON video_recordings;
CREATE POLICY "video_recordings_update_org" ON video_recordings
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "video_recordings_delete_org" ON video_recordings;
CREATE POLICY "video_recordings_delete_org" ON video_recordings
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
