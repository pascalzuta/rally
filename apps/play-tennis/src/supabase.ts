import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gxiflulfgqahlvdirecz.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aWZsdWxmZ3FhaGx2ZGlyZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE2NjksImV4cCI6MjA4ODkyNzY2OX0.URWQ_FVCB3DqXGKvb-G6eAKUPBmcso6FHl1gxIWLK-I'

let client: SupabaseClient | null = null

export function initSupabase(): SupabaseClient | null {
  if (client) return client

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

export function getClient(): SupabaseClient | null {
  return client
}
