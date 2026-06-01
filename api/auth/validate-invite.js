const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const svcHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
});

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  if (!token) return json(res, 400, { error: 'Token manquant.' });

  const tokenRes = await fetch(`${SUPABASE_URL}/rest/v1/invite_tokens?token=eq.${token}&used=eq.false&select=*`, {
    headers: svcHeaders(),
  });
  const tokens = await tokenRes.json();
  const invite = tokens?.[0];

  if (!invite) return json(res, 400, { error: 'Lien invalide ou déjà utilisé.' });
  if (new Date(invite.expires_at) < new Date()) {
    return json(res, 400, { error: 'Ce lien a expiré. Demande un nouveau lien à ton coach.' });
  }

  return json(res, 200, {
    role: invite.role,
    email: invite.email || null,
    prenom: invite.prenom || null,
    nom: invite.nom || null,
  });
};
