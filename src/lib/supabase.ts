import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable. Please check your .env file.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. Please check your .env file.')
}

// Add debugging logs to see what values are being used
console.log("Attempting to connect with URL:", supabaseUrl);
console.log("Attempting to connect with Anon Key:", supabaseAnonKey);

// Create the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)