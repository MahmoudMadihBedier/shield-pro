import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Never throw at module-load time: doing so happens before React even
// mounts (no error boundary can catch it), which is exactly what produces a
// blank white screen in production with zero clue why. Missing config is
// instead surfaced by main.tsx as a readable on-screen message.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key'
)
