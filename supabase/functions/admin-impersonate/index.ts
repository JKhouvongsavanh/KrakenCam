/**
 * admin-impersonate edge function
 * Generates a one-time magic link for a user so a super_admin can log in as them.
 * Requires service role key — only callable by authenticated super_admins.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Auth check — must be a super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller is super_admin
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { data: profile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden — super_admin only' }), { status: 403 })
    }

    // Get target user_id from body
    const { user_id } = await req.json()
    if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 })

    // Generate magic link using service role
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: '', // will be overridden
      options: { redirectTo: `${Deno.env.get('SITE_URL') || 'https://app.krakencam.com'}/` }
    })

    // Supabase doesn't support impersonation directly via magic link to user_id
    // Best approach: get user email, generate magic link for that email
    const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(user_id)
    if (!targetUser?.email) {
      return new Response(JSON.stringify({ error: 'Target user not found or has no email' }), { status: 404 })
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
      options: { redirectTo: `${Deno.env.get('SITE_URL') || 'https://app.krakencam.com'}/` }
    })

    if (linkError || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: linkError?.message || 'Failed to generate link' }), { status: 500 })
    }

    return new Response(
      JSON.stringify({ link: linkData.properties.action_link, email: targetUser.email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
