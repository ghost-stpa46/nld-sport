const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Environment variables SUPABASE_URL and SUPABASE_ANON_KEY are required');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing SUPABASE_SERVICE_ROLE_KEY; profile fetch may fail');
}

const buildAnonHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
});

const buildServiceHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
});

const parseBody = async (req) => {
  if (req.body) return req.body;
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
};

const jsonResponse = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    return jsonResponse(res, 400, { error: 'Impossible de lire la requête JSON.' });
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return jsonResponse(res, 400, { error: 'Email et mot de passe requis.' });
  }

  try {
    console.log('Auth login proxy config', {
      supabaseUrl: SUPABASE_URL,
      hasAnonKey: Boolean(SUPABASE_ANON_KEY),
      hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    });

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: buildAnonHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const authJson = await authRes.json();
    if (!authRes.ok || authJson.error) {
      const errorMessage = authJson.error_description || authJson.error || authJson.message || 'Email ou mot de passe incorrect.';
      return jsonResponse(res, 401, { error: errorMessage });
    }

    const userId = authJson.user?.id;
    if (!userId) {
      return jsonResponse(res, 500, { error: 'Impossible de récupérer l’utilisateur.' });
    }

    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}`, {
      headers: buildServiceHeaders(),
    });
    if (!profileRes.ok) {
      const profileText = await profileRes.text();
      console.error('Supabase profile fetch failed', profileRes.status, profileText);
      return jsonResponse(res, 500, { error: 'Impossible de lire le profil utilisateur.' });
    }
    const profileJson = await profileRes.json();
    const profile = Array.isArray(profileJson) ? profileJson[0] : profileJson;
    if (!profile || !profile.role) {
      return jsonResponse(res, 404, { error: 'Profil introuvable. Contacte ton coach.' });
    }

    return jsonResponse(res, 200, {
      role: profile.role,
      session: authJson,
      user: { id: userId, email },
    });
  } catch (error) {
    console.error('Auth login proxy error:', error);
    return jsonResponse(res, 500, { error: 'Erreur serveur. Réessaie plus tard.' });
  }
}

module.exports = handler;
