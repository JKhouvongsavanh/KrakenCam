/**
 * src/lib/notifications.js
 * Supabase CRUD for the notifications table.
 * All queries are scoped to the current user via RLS.
 */

import { supabase } from './supabase';

/**
 * Load notifications for the current user.
 * RLS ensures only their own rows are returned.
 */
export async function loadNotifications(orgId, limit = 200) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Save a new notification for one or more recipients.
 * - If recipientUserIds is set, inserts one row per user.
 * - If recipientRoles is set (no specific users), inserts one row with recipient_user_id = null
 *   and recipient_role set (all matching users see it via RLS + app filter).
 */
export async function saveNotification(orgId, notification) {
  const userIds = notification.recipientUserIds || [];
  const roles   = notification.recipientRoles   || [];

  const baseRow = {
    organization_id: orgId,
    type:            notification.type    || 'system',
    title:           notification.title   || null,
    body:            notification.body    || null,
    context:         notification.context || null,
    action:          notification.action  || null,
    author:          notification.author  || null,
    preview:         notification.preview || null,
    read:            false,
    created_at:      notification.timestamp || new Date().toISOString(),
  };

  if (userIds.length > 0) {
    // One row per recipient user
    const rows = userIds.map(uid => ({ ...baseRow, recipient_user_id: uid, recipient_role: null }));
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) throw error;
  } else if (roles.length > 0) {
    // One row per role (no specific user — all members of that role see it)
    const rows = roles.map(role => ({ ...baseRow, recipient_user_id: null, recipient_role: role }));
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) throw error;
  } else {
    // Broadcast to whole org
    const { error } = await supabase.from('notifications').insert([{ ...baseRow, recipient_user_id: null, recipient_role: null }]);
    if (error) throw error;
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Mark all notifications as read for the current user.
 * RLS ensures only their own rows are updated.
 */
export async function markAllNotificationsRead(orgId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('organization_id', orgId)
    .eq('read', false);
  if (error) throw error;
}

/**
 * Delete all notifications for the current user.
 * RLS ensures only their own rows are deleted.
 */
export async function clearNotifications(orgId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('organization_id', orgId);
  if (error) throw error;
}
