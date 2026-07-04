import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawUrl && rawUrl.trim() !== '' ? rawUrl.trim() : 'https://placeholder-project.supabase.co';
const supabaseAnonKey = rawKey && rawKey.trim() !== '' ? rawKey.trim() : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.key';

console.log("Supabase URL loaded:", Boolean(rawUrl && rawUrl.trim() !== ''));
console.log("Supabase ANON key loaded:", Boolean(rawKey && rawKey.trim() !== ''));

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

