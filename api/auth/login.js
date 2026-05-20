const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzaoqjlkbtemkudgoyxn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YW9xamxrYnRlbWt1ZGdveXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTA2MDQsImV4cCI6MjA5MDgyNjYwNH0.RvWNdjauVLsEVNu-4AnK7Oflq8U97Y44YEz8SO1ccL0';

const buildHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: buildHeaders(),
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
      headers: buildHeaders(),
    });
    const profileJson = await profileRes.json();
    if (!profileRes.ok) {
      return jsonResponse(res, 500, { error: 'Impossible de lire le profil utilisateur.' });
    }
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
