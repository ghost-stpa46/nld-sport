const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COACH_CODE = process.env.COACH_CODE;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const buildAnonHeaders = () => ({
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
      try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); }
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
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

  let body;
  try { body = await parseBody(req); } catch (e) {
    return jsonResponse(res, 400, { error: 'Invalid JSON' });
  }

  const { prenom, nom, email, password, coachCode } = body || {};
  if (!email || !password) return jsonResponse(res, 400, { error: 'Email et mot de passe requis.' });

  // Validation du code coach côté serveur
  const isCoach = coachCode && COACH_CODE && coachCode === COACH_CODE;
  if (coachCode && !isCoach) {
    return jsonResponse(res, 400, { error: 'Code coach invalide.' });
  }

  const role = isCoach ? 'coach' : 'client';

  try {
    console.log('[register] signup attempt', { email, role, supabaseUrl: SUPABASE_URL?.substring(0, 30) });

    const resp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: buildAnonHeaders(),
      body: JSON.stringify({
        email,
        password,
        data: { prenom: prenom || '', nom: nom || '', coach_code: isCoach ? coachCode : '' },
      }),
    });

    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }

    console.log('[register] supabase response', { status: resp.status, body: json });

    if (!resp.ok || json.error) {
      const message = json?.error_description || json?.error || json?.msg || json?.message
        || (resp.status === 422 ? 'Email déjà utilisé ou mot de passe trop court.' : 'Inscription impossible.');
      console.error('[register] signup failed:', message);
      return jsonResponse(res, resp.status || 400, { error: message });
    }

    console.log('[register] signup success', { role });
    return jsonResponse(res, 200, { role, session: json, user: json.user || null });
  } catch (error) {
    console.error('[register] proxy error:', error.message, error.stack);
    return jsonResponse(res, 500, { error: 'Erreur serveur' });
  }
}

module.exports = handler;
