/**
 * src/lib/sketches.js
 *
 * Supabase CRUD helpers for sketches.
 * PNG images are uploaded to the "project-photos" storage bucket.
 * Raw canvas_data (elements, settings) is stored as jsonb for re-editing.
 * All queries are org-scoped via RLS.
 */

import { supabase } from './supabase';

const BUCKET = 'project-photos';

/**
 * Fetch all sketches for a project.
 * @param {string} projectId - projects.id
 */
export async function getSketches(projectId) {
  const { data, error } = await supabase
    .from('sketches')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Upload a sketch PNG to storage and insert a sketches row.
 *
 * Storage path: {orgId}/{projectId}/sketches/{timestamp}.png
 *
 * @param {string}      projectId  - projects.id
 * @param {string}      orgId      - organizations.id
 * @param {string}      title      - Sketch title
 * @param {Object|null} canvasData - Raw canvas state (elements, scale, etc.) for re-editing
 * @param {Blob|null}   imageBlob  - PNG blob for preview/export (may be null if dataUrl only)
 * @returns {Object} The newly inserted sketches row
 */
export async function saveSketch(projectId, orgId, title, canvasData, imageBlob) {
  let storagePath = null;

  if (imageBlob) {
    const timestamp = Date.now();
    storagePath = `${orgId}/${projectId}/sketches/${timestamp}.png`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imageBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/png',
      });

    if (uploadError) throw uploadError;
  }

  const { data: row, error: insertError } = await supabase
    .from('sketches')
    .insert([{
      organization_id: orgId,
      project_id:      projectId,
      title:           title || null,
      storage_path:    storagePath,
      canvas_data:     canvasData || null,
    }])
    .select()
    .single();

  if (insertError) throw insertError;
  return row;
}

/**
 * Update an existing sketch row (title, canvas_data, storage_path).
 * @param {string} id   - sketches.id
 * @param {Object} data - Fields to update
 */
export async function updateSketch(id, data) {
  const { data: row, error } = await supabase
    .from('sketches')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Delete a sketch from both storage and the DB.
 * @param {string} id          - sketches.id
 * @param {string} storagePath - sketches.storage_path (may be null)
 */
export async function deleteSketch(id, storagePath) {
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from('sketches')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get a signed URL for a sketch image.
 * @param {string} storagePath
 * @param {number} [expiresIn=3600]
 */
export async function getSketchUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}
