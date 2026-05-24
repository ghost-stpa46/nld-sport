// ============================================================
// Supabase Client — noLackinDiscipline
// Remplace les deux valeurs ci-dessous par celles de ton projet
// Supabase > Settings > API
// ============================================================

const SUPABASE_URL = 'https://wzaoqjlkbtemkudgoyxn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YW9xamxrYnRlbWt1ZGdveXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTA2MDQsImV4cCI6MjA5MDgyNjYwNH0.RvWNdjauVLsEVNu-4AnK7Oflq8U97Y44YEz8SO1ccL0';

// Chargement via CDN UMD — supabase est exposé dans window.supabase
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { sb };
