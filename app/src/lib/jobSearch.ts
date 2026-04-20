import { invokeAdminFunction } from '@/lib/functions'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ExternalJobSearchRequest, ExternalJobSearchResult } from '@/types'

const JOB_SEARCH_FUNCTION = 'job-search'
const JOB_SEARCH_NOT_READY_MESSAGE =
  'Connector search is not ready yet. Deploy the Supabase Edge Function "job-search". USAJobs also requires USAJOBS_API_KEY and USAJOBS_USER_AGENT in Supabase secrets.'

function toJobSearchErrorMessage(message?: string): string {
  const text = message?.trim() || 'Job search request failed.'

  if (/Failed to send a request|FunctionsFetchError|404|network/i.test(text)) {
    return JOB_SEARCH_NOT_READY_MESSAGE
  }

  return text
}
export async function searchExternalJobs(
  request: ExternalJobSearchRequest
): Promise<ExternalJobSearchResult[]> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured for connector search.')
  }

  const data = await invokeAdminFunction<{ results: ExternalJobSearchResult[] }>(
    JOB_SEARCH_FUNCTION,
    request,
    {
      notReadyMessage: JOB_SEARCH_NOT_READY_MESSAGE,
      fallbackError: 'Job search returned an unexpected response.',
    }
  ).catch((error) => {
    throw new Error(toJobSearchErrorMessage(error instanceof Error ? error.message : undefined))
  })

  return Array.isArray(data.results) ? data.results : []
}
