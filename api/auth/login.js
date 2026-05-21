const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wzaoqjlkbtemkudgoyxn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YW9xamxrYnRlbWt1ZGdveXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTA2MDQsImV4cCI6MjA5MDgyNjYwNH0.RvWNdjauVLsEVNu-4AnK7Oflq8U97Y44YEz8SO1ccL0';

function getAuthKey() {
  if (SUPABASE_SERVICE_ROLE_KEY) return SUPABASE_SERVICE_ROLE_KEY;
  if (SUPABASE_ANON_KEY) return SUPABASE_ANON_KEY;
  return '';
}

function determineRole(user) {
  if (!user) return 'client';
  const role = user?.app_metadata?.role || user?.user_metadata?.role || user?.user_metadata?.accountType;
  return role === 'coach' ? 'coach' : 'client';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const body = req.body && Object.keys(req.body).length ? req.body : undefined;
  const payload = body || (await parseJsonBody(req));
  const email = payload?.email?.toString().trim();
  const password = payload?.password?.toString();

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const authKey = getAuthKey();
  if (!SUPABASE_URL || !authKey) {
    return res.status(500).json({ error: 'Configuration Supabase manquante.' });
  }

  const tokenUrl = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: authKey,
        Authorization: `Bearer ${authKey}`,
      },
      body: new URLSearchParams({ email, password, grant_type: 'password' }).toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      const errorMessage = data?.error_description || data?.error || 'Email ou mot de passe incorrect.';
      return res.status(response.status).json({ error: errorMessage });
    }

    const role = determineRole(data.user);
    return res.status(200).json({
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        token_type: data.token_type,
      },
      user: data.user,
      role,
    });
  } catch (error) {
    console.error('Supabase login proxy error:', error);
    return res.status(500).json({ error: 'Erreur interne. Réessaie plus tard.' });
  }
}

async function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}
