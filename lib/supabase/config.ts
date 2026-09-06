export function getSupabaseConfigError() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return 'NEXT_PUBLIC_SUPABASE_URL is missing.'
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing.'
  return ''
}
