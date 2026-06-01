const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const svcHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
});

const parseBody = async (req) => {
  if (req.body) return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
};

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return json(res, 200, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const callerToken = (req.headers.authorization || '').replace('Bearer ', '');
  if (!callerToken) return json(res, 401, { error: 'Non autorisé.' });

  // Vérifier le JWT du coach
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${callerToken}` },
  });
  if (!userRes.ok) return json(res, 401, { error: 'Session invalide.' });
  const user = await userRes.json();

  // Vérifier le rôle coach
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role,id`, {
    headers: svcHeaders(),
  });
  const profiles = await profileRes.json();
  if (!profiles?.[0] || profiles[0].role !== 'coach') return json(res, 403, { error: 'Réservé aux coachs.' });

  const body = await parseBody(req);
  const { role = 'client', email, prenom, nom, objectif, niveau, telephone } = body;

  const tokenRes = await fetch(`${SUPABASE_URL}/rest/v1/invite_tokens`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({
      role,
      email: email || null,
      prenom: prenom || null,
      nom: nom || null,
      coach_id: user.id,
      objectif: objectif || null,
      niveau: niveau || null,
      telephone: telephone || null,
    }),
  });

  const tokens = await tokenRes.json();
  const token = tokens?.[0]?.token;
  if (!token) return json(res, 500, { error: 'Erreur création du lien.' });

  const origin = req.headers.origin || `https://${req.headers.host}`;
  return json(res, 200, { token, link: `${origin}/register.html?token=${token}` });
};
