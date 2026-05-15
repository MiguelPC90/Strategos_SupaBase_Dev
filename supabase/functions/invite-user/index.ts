import { createClient } from 'jsr:@supabase/supabase-js@2'

type InvitePermission = {
  programId: string
  planId: string | null
  page: string
  accessLevel: string
}

type InvitePayload = {
  email: string
  role: string
  fullName?: string
  permissions: InvitePermission[]
}

const VALID_ROLES = ['admin', 'program_manager', 'editor', 'sponsor', 'stakeholder']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    // 1. Verify caller is authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No auth header' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !caller) return jsonResponse({ error: 'Invalid token' }, 401)

    const { data: callerProfile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profErr || !callerProfile) return jsonResponse({ error: 'Caller profile not found' }, 403)
    if (callerProfile.role !== 'admin') return jsonResponse({ error: 'Only admins can invite users' }, 403)

    // 2. Parse + validate payload
    const payload: InvitePayload = await req.json()
    if (!payload.email || !payload.role) {
      return jsonResponse({ error: 'Missing email or role' }, 400)
    }
    if (!VALID_ROLES.includes(payload.role)) {
      return jsonResponse({ error: 'Invalid role' }, 400)
    }

    // 3. Create auth user (invite flow sends magic link automatically)
    const { data: inviteResult, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      payload.email,
      {
        data: { full_name: payload.fullName ?? null, role: payload.role },
      },
    )

    if (inviteErr) {
      if (inviteErr.message?.includes('already')) {
        return jsonResponse({ error: 'User with this email already exists' }, 409)
      }
      return jsonResponse({ error: `Failed to invite: ${inviteErr.message}` }, 500)
    }

    const newUserId = inviteResult.user?.id
    if (!newUserId) return jsonResponse({ error: 'No user id from invite' }, 500)

    // 4. Wait for handle_new_user trigger, then update role
    await new Promise(resolve => setTimeout(resolve, 200))

    const { error: roleErr } = await supabaseAdmin
      .from('profiles')
      .update({ role: payload.role, full_name: payload.fullName ?? null })
      .eq('id', newUserId)

    if (roleErr) {
      await supabaseAdmin.from('profiles').upsert({
        id: newUserId,
        email: payload.email,
        full_name: payload.fullName ?? null,
        role: payload.role,
      })
    }

    // 5. Insert user_permissions rows
    if (payload.permissions && payload.permissions.length > 0) {
      const permRows = payload.permissions
        .filter(p => p.programId)
        .map(p => ({
          user_id: newUserId,
          program_id: p.programId,
          plan_id: p.planId,
          page: p.page,
          access_level: p.accessLevel,
        }))

      if (permRows.length > 0) {
        const { error: permErr } = await supabaseAdmin
          .from('user_permissions')
          .insert(permRows)

        if (permErr) {
          return jsonResponse({
            error: `User created but permissions failed: ${permErr.message}`,
            userId: newUserId,
          }, 500)
        }
      }
    }

    return jsonResponse({ success: true, userId: newUserId, email: payload.email }, 200)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
