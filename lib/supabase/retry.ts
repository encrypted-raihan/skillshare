/**
 * Helpers for transient Supabase/PostgREST failures.
 *
 * PGRST303 ("JWT issued at future") can occur immediately after a fresh
 * Supabase Auth session is issued when the Auth and PostgREST clocks are
 * briefly out of sync. It is safe to retry these requests for a short,
 * bounded period. We deliberately do not retry ordinary database errors.
 */

export function isJwtIssuedAtFutureError(error: unknown) {
  if (!error) return false

  const value = error as { code?: string; message?: string }
  const code = value.code?.toUpperCase()
  const message = value.message?.toLowerCase() ?? ''

  return code === 'PGRST303' || message.includes('jwt issued at future')
}

export function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}
