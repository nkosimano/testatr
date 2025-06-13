import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Add debugging logs to see what values are being used
console.log("Attempting to connect with URL:", supabaseUrl);
console.log("Attempting to connect with Anon Key:", supabaseAnonKey);

// Create a simplified client for debugging
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)