/**
 * src/lib/projectFiles.js
 *
 * Supabase CRUD helpers for project_files.
 * Files are uploaded to the "project-photos" storage bucket.
 * All queries are org-scoped via RLS.
 */

import { supabase } from './supabase';

const BUCKET = 'project-photos';

/**
 * Fetch all files for a project.
 * @param {string} projectId - projects.id
 */
export async function getProjectFiles(projectId) {
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Upload a file to storage and insert a project_files row.
 *
 * Storage path: {orgId}/{projectId}/files/{timestamp}_{filename}
 *
 * @param {string} projectId - projects.id
 * @param {string} orgId     - organizations.id
 * @param {File}   file      - The File object to upload
 * @returns {Object} The newly inserted project_files row
 */
export async function uploadProjectFile(projectId, orgId, file) {
  const timestamp = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${orgId}/${projectId}/files/${timestamp}_${safeFilename}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

  if (uploadError) throw uploadError;

  const { data: row, error: insertError } = await supabase
    .from('project_files')
    .insert([{
      organization_id: orgId,
      project_id:      projectId,
      name:            file.name,
      storage_path:    storagePath,
      file_size:       file.size || null,
      mime_type:       file.type || null,
    }])
    .select()
    .single();

  if (insertError) throw insertError;
  return row;
}

/**
 * Delete a file from both storage and the DB.
 * @param {string} id          - project_files.id
 * @param {string} storagePath - project_files.storage_path
 */
export async function deleteProjectFile(id, storagePath) {
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from('project_files')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get a signed URL for a private project file.
 * @param {string} storagePath
 * @param {number} [expiresIn=3600]
 */
export async function getFileUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}
