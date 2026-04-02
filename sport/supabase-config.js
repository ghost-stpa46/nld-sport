// ============================================================
// Supabase Client — noLackinDiscipline
// Remplace les deux valeurs ci-dessous par celles de ton projet
// Supabase > Settings > API
// ============================================================

const SUPABASE_URL = 'REMPLACE_PAR_TON_URL_SUPABASE';
const SUPABASE_ANON_KEY = 'REMPLACE_PAR_TA_CLE_ANON';

// Chargement via CDN UMD — supabase est exposé dans window.supabase
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { sb };
