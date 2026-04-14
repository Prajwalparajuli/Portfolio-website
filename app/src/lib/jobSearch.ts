import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ExternalJobSearchRequest, ExternalJobSearchResult } from '@/types'

const JOB_SEARCH_FUNCTION = 'job-search'
const JOB_SEARCH_NOT_READY_MESSAGE =
  'Connector search is not ready yet. Deploy the Supabase Edge Function "job-search". USAJobs also requires USAJOBS_API_KEY and USAJOBS_USER_AGENT in Supabase secrets.'

type JobSearchResponse<T> = {
  data: T
}

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

  const { data, error } = await supabase.functions.invoke(JOB_SEARCH_FUNCTION, {
    body: request,
  })

  if (error) {
    throw new Error(toJobSearchErrorMessage(error.message))
  }

  if (!data || typeof data !== 'object' || !('data' in data)) {
    throw new Error('Job search returned an unexpected response.')
  }

  return (data as JobSearchResponse<{ results: ExternalJobSearchResult[] }>).data.results
}
