import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://qysppoichxcgticleyit.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5c3Bwb2ljaHhjZ3RpY2xleWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzE5MzEsImV4cCI6MjA3NzM0NzkzMX0.7zgGpFuIK3PHczohjPl5HOkFiNB5KoanH8XKSc4wjAQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
