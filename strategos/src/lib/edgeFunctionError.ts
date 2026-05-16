import { FunctionsHttpError } from '@supabase/supabase-js'

export async function extractEdgeFunctionError(error: unknown): Promise<string | null> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await (error.context as Response).json() as { error?: string }
      if (body?.error && typeof body.error === 'string') {
        return body.error
      }
    } catch {
      // body wasn't JSON or couldn't be parsed
    }
  }
  return null
}
