import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function isMissingAdminTable(error: { code?: string; message?: string } | null) {
  return error?.code === '42P01' || /admin_users|relation .* does not exist/i.test(error?.message ?? '')
}

export function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireAdminUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!authHeader || !supabaseUrl || !supabaseAnonKey) {
    return { user: null, reason: 'missing-auth' as const, token: null as string | null }
  }

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return { user: null, reason: 'invalid-user' as const, token: null as string | null }
  }

  const email = data.user.email?.trim().toLowerCase()
  if (!email) {
    return { user: null, reason: 'missing-email' as const, token: null as string | null }
  }

  const rlsClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data: adminRow, error: adminError } = await rlsClient
    .from('admin_users')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (isMissingAdminTable(adminError)) {
    return { user: null, reason: 'admin-table-missing' as const, token: null as string | null }
  }

  if (adminError || !adminRow) {
    return { user: null, reason: 'not-admin' as const, token: null as string | null }
  }

  return { user: data.user, reason: null as const, token }
}

export function isSchedulerRequest(req: Request) {
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected) return false
  return req.headers.get('x-cron-secret') === expected
}

export async function requireAdminOrScheduler(req: Request) {
  if (isSchedulerRequest(req)) {
    return { kind: 'scheduler' as const, user: null, token: null as string | null, reason: null as const }
  }

  const auth = await requireAdminUser(req)
  if (!auth.user) {
    return { kind: 'unauthorized' as const, user: null, token: null as string | null, reason: auth.reason }
  }

  return { kind: 'admin' as const, user: auth.user, token: auth.token, reason: null as const }
}
