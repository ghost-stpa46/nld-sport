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
  console.debug('Proxy incoming request', { headers: req.headers?.['content-type'] || req.headers, bodyPreview: body ? JSON.stringify(body).slice(0,200) : undefined });
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
    const formBody = new URLSearchParams({ email, password, grant_type: 'password' }).toString();
    console.debug('Supabase token request', { url: tokenUrl, email, formBodyLength: formBody.length });

    let response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: authKey,
        Authorization: `Bearer ${authKey}`,
      },
      body: formBody,
    });

    let data = await response.json();
    if (!response.ok) {
      console.error('Supabase login proxy response error:', { status: response.status, data });
      if (data?.error_code === 'bad_json') {
        try {
          const jsonBody = JSON.stringify({ email, password, grant_type: 'password' });
          console.debug('Retrying Supabase token request with JSON body', { url: tokenUrl, email, jsonBodyLength: jsonBody.length });
          const retryResp = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: authKey,
              Authorization: `Bearer ${authKey}`,
            },
            body: jsonBody,
          });
          const retryData = await retryResp.json();
          console.error('Supabase retry response', { status: retryResp.status, retryData });
          if (retryResp.ok) {
            data = retryData;
            response = retryResp;
          } else {
            return res.status(retryResp.status).json({ error: retryData?.error_description || retryData?.error || retryData?.message || 'Email ou mot de passe incorrect.' });
          }
        } catch (retryErr) {
          console.error('Supabase retry error:', retryErr);
          return res.status(502).json({ error: 'Erreur lors de la communication avec Supabase.' });
        }
      }
      const errorMessage = data?.error_description || data?.error || data?.message || 'Email ou mot de passe incorrect.';
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
      console.debug('parseJsonBody raw body length', body.length, 'preview', body.slice(0,200));
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}
