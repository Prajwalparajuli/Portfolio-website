import { FunctionsHttpError } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type FunctionEnvelope<T> = {
  data: T
}

async function getFreshFunctionHeaders(): Promise<Record<string, string>> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  const currentSession = sessionData.session
  if (!currentSession?.access_token) {
    throw new Error('You must be signed in to use admin actions.')
  }

  return { Authorization: `Bearer ${currentSession.access_token}` }
}

async function readFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const payload = await error.context.clone().json() as { error?: string; message?: string }
      return (payload.error || payload.message || error.message || fallback).trim()
    } catch {
      try {
        const text = await error.context.clone().text()
        return (text || error.message || fallback).trim()
      } catch {
        return (error.message || fallback).trim()
      }
    }
  }

  if (error instanceof Error) {
    return (error.message || fallback).trim()
  }

  return fallback
}

export async function invokeAdminFunction<T>(
  functionName: string,
  body: object,
  options?: { notReadyMessage?: string; fallbackError?: string }
): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured for admin functions.')
  }

  const headers = await getFreshFunctionHeaders()
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers,
  })

  if (error) {
    const message = await readFunctionErrorMessage(error, options?.fallbackError || 'Function request failed.')
    if (/Failed to send a request|FunctionsFetchError|404|network/i.test(message) && options?.notReadyMessage) {
      throw new Error(options.notReadyMessage)
    }
    throw new Error(message)
  }

  if (!data || typeof data !== 'object' || !('data' in data)) {
    throw new Error(options?.fallbackError || 'Function returned an unexpected response.')
  }

  return (data as FunctionEnvelope<T>).data
}
