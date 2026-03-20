/**
 * src/lib/chat.js
 *
 * Supabase CRUD helpers for chat_messages.
 * Supports org-wide and project-scoped channels.
 * All queries are org-scoped via RLS.
 *
 * NOTE: The in-app chat uses a rich local state model (chats array with
 * embedded messages, member lists, etc.). This lib stores messages in the
 * chat_messages table for persistence and cross-device sync. The local
 * chats/messages state remains the source of truth for UI rendering.
 */

import { supabase } from './supabase';

/**
 * Fetch recent chat messages for a channel.
 *
 * @param {string}      channel          - Channel name (e.g. "general", chat group id)
 * @param {string|null} [projectId=null] - Filter to project-scoped messages (optional)
 * @param {number}      [limit=100]      - Max messages to return
 */
export async function getChatMessages(channel, projectId = null, limit = 100) {
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('channel', channel)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (projectId) {
    query = query.eq('project_id', projectId);
  } else {
    query = query.is('project_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Insert a new chat message.
 *
 * @param {Object} data
 * @param {string}      data.organizationId  - organizations.id (required)
 * @param {string}      data.channel         - Channel name
 * @param {string|null} [data.projectId]     - Project scope (optional)
 * @param {string|null} [data.senderId]      - auth.users.id of sender
 * @param {string}      [data.senderName]    - Display name of sender
 * @param {string}      data.content         - Message text
 * @param {string}      [data.messageType]   - 'text' | 'image' | 'file' | 'voice'
 * @param {string|null} [data.attachmentPath]- Storage path of attachment (optional)
 * @returns {Object} The newly inserted chat_messages row
 */
export async function sendChatMessage(data) {
  const { data: row, error } = await supabase
    .from('chat_messages')
    .insert([{
      organization_id: data.organizationId,
      project_id:      data.projectId || null,
      channel:         data.channel || 'general',
      sender_id:       data.senderId || null,
      sender_name:     data.senderName || null,
      content:         data.content,
      message_type:    data.messageType || 'text',
      attachment_path: data.attachmentPath || null,
    }])
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Delete a chat message by ID.
 * @param {string} id - chat_messages.id
 */
export async function deleteChatMessage(id) {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
