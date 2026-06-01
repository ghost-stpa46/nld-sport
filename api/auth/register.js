const { sendEmail, COACH_EMAIL } = require('../_mailer');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
});

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return json(res, 200, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try { body = await parseBody(req); } catch (e) { return json(res, 400, { error: 'Invalid JSON' }); }

  const { token, prenom, nom, email, password } = body || {};
  if (!token)    return json(res, 400, { error: "Lien d'invitation requis." });
  if (!email || !password || !prenom || !nom) return json(res, 400, { error: 'Tous les champs sont requis.' });

  // Valider le token
  const tokenRes = await fetch(`${SUPABASE_URL}/rest/v1/invite_tokens?token=eq.${token}&used=eq.false&select=*`, {
    headers: svcHeaders(),
  });
  const tokens = await tokenRes.json();
  const invite = tokens?.[0];

  if (!invite) return json(res, 400, { error: 'Lien invalide ou déjà utilisé.' });
  if (new Date(invite.expires_at) < new Date()) {
    return json(res, 400, { error: 'Ce lien a expiré. Demande un nouveau lien à ton coach.' });
  }

  const role = invite.role || 'client';

  console.log('[register] signup attempt', { email, role });

  // Créer le compte Supabase Auth
  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ email, password, data: { prenom, nom } }),
  });
  const signupJson = await signupRes.json();

  if (!signupRes.ok || signupJson.error) {
    const message = signupJson?.error_description || signupJson?.error || signupJson?.msg
      || (signupRes.status === 422 ? 'Email déjà utilisé ou mot de passe trop court (min. 6 caractères).' : 'Inscription impossible.');
    console.error('[register] signup failed:', message);
    return json(res, signupRes.status || 400, { error: message });
  }

  const userId = signupJson.user?.id || signupJson.id;

  // Marquer le token comme utilisé
  await fetch(`${SUPABASE_URL}/rest/v1/invite_tokens?token=eq.${token}`, {
    method: 'PATCH',
    headers: svcHeaders(),
    body: JSON.stringify({ used: true }),
  });

  // Créer/mettre à jour le profil avec le bon rôle
  if (userId) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...svcHeaders(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id: userId,
        email,
        prenom,
        nom,
        role,
        coach_id: invite.coach_id || null,
        objectif: invite.objectif || null,
        niveau: invite.niveau || null,
        telephone: invite.telephone || null,
      }),
    });
  }

  // Notifier le coach
  await sendEmail({
    to: COACH_EMAIL,
    subject: `✅ Nouveau compte créé — ${prenom} ${nom}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#c8ff00;font-size:22px;margin-bottom:8px">Nouveau compte créé</h2>
        <p style="color:#888;margin-bottom:24px">Un ${role === 'coach' ? 'coach' : 'client'} vient de s'inscrire sur noLackinDiscipline.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #222">Prénom</td><td style="padding:8px 0;border-bottom:1px solid #222">${prenom}</td></tr>
          <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #222">Nom</td><td style="padding:8px 0;border-bottom:1px solid #222">${nom}</td></tr>
          <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #222">Email</td><td style="padding:8px 0;border-bottom:1px solid #222">${email}</td></tr>
          <tr><td style="color:#888;padding:8px 0">Rôle</td><td style="padding:8px 0;color:#c8ff00;font-weight:bold">${role}</td></tr>
        </table>
        <a href="https://nld-sport.vercel.app/dashboard-coach.html" style="display:inline-block;margin-top:24px;background:#c8ff00;color:#000;font-weight:bold;padding:12px 24px;border-radius:8px;text-decoration:none">Ouvrir le dashboard</a>
      </div>
    `,
  });

  console.log('[register] signup success', { role });
  return json(res, 200, { role, user: signupJson.user || null });
};
