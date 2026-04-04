import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'NLD', email: 'nolackindiscipline@gmail.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { prenom, nom, email, tel, objectif, niveau, montant, reference } = await req.json();

    if (!prenom || !nom || !email || !reference) {
      throw new Error('Champs manquants');
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Récupérer le coach par email
    const { data: coach, error: coachError } = await sb
      .from('profiles')
      .select('id')
      .eq('email', 'nolackindiscipline@gmail.com')
      .single();

    if (!coach) throw new Error('Aucun coach trouvé');

    // Créer le devis
    const { error: devisError } = await sb.from('devis').insert({
      coach_id:        coach.id,
      titre:           'Forfait mensuel NLD',
      description:     `Objectif : ${objectif || 'Non précisé'} · Niveau : ${niveau || 'Non précisé'}`,
      montant:         montant || 120,
      statut:          'virement_en_attente',
      prospect_email:  email,
      prospect_prenom: prenom,
      prospect_nom:    nom,
    });

    if (devisError) throw new Error('Erreur création devis : ' + devisError.message);

    // Envoyer les emails
    const brevoKey = Deno.env.get('BREVO_API_KEY');
    const siteOrigin = Deno.env.get('SITE_URL') || 'https://nld-sport.vercel.app';
    const registerUrl = `${siteOrigin}/login.html?paiement=ok&email=${encodeURIComponent(email)}`;

    if (brevoKey) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      const validite = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

      await sendEmail(brevoKey, 'nolackindiscipline@gmail.com',
        `Nouveau devis — ${prenom} ${nom}`,
        `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;color:#111;padding:40px 32px;border:1px solid #e0e0e0;border-radius:8px;">

          <!-- En-tête -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c8ff00;padding-bottom:20px;margin-bottom:28px">
            <div>
              <div style="font-size:28px;font-weight:900;color:#111;letter-spacing:-1px">NLD</div>
              <div style="font-size:12px;color:#666;margin-top:2px">noLackinDiscipline · Coaching sportif personnel</div>
            </div>
            <div style="text-align:right">
              <div style="background:#c8ff00;color:#000;font-weight:700;font-size:13px;padding:4px 14px;border-radius:4px;display:inline-block">DEVIS</div>
              <div style="font-size:13px;color:#666;margin-top:6px">${reference}</div>
            </div>
          </div>

          <!-- Parties -->
          <div style="display:flex;gap:32px;margin-bottom:28px">
            <div style="flex:1">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:6px">Prestataire</div>
              <div style="font-weight:700">noLackinDiscipline</div>
              <div style="font-size:13px;color:#555">Coach sportif personnel<br>nolackindiscipline@gmail.com</div>
            </div>
            <div style="flex:1">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:6px">Client</div>
              <div style="font-weight:700">${prenom} ${nom}</div>
              <div style="font-size:13px;color:#555">${email}${tel ? '<br>' + tel : ''}</div>
            </div>
            <div style="flex:1">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:6px">Dates</div>
              <div style="font-size:13px;color:#555">Émis le ${dateStr}<br>Valable jusqu'au ${validite}</div>
            </div>
          </div>

          <!-- Prestation -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="text-align:left;padding:10px 12px;font-size:12px;color:#888;font-weight:700;text-transform:uppercase">Prestation</th>
                <th style="text-align:center;padding:10px 12px;font-size:12px;color:#888;font-weight:700;text-transform:uppercase;width:60px">Qté</th>
                <th style="text-align:right;padding:10px 12px;font-size:12px;color:#888;font-weight:700;text-transform:uppercase;width:100px">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:14px 12px">
                  <div style="font-weight:700;margin-bottom:6px">Forfait coaching mensuel NLD</div>
                  <div style="font-size:12px;color:#555;line-height:1.8">
                    · 2 séances d'entraînement personnalisées / semaine<br>
                    · Plan alimentaire adapté à tes objectifs<br>
                    · Accompagnement mental &amp; suivi de progression<br>
                    · Accès direct — réponses rapides<br>
                    <strong>· Objectif : ${objectif || 'Non précisé'} · Niveau : ${niveau || 'Non précisé'}</strong>
                  </div>
                </td>
                <td style="text-align:center;padding:14px 12px">1</td>
                <td style="text-align:right;padding:14px 12px;font-weight:700">${montant || 120} €</td>
              </tr>
            </tbody>
          </table>

          <!-- Total -->
          <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
            <div style="background:#111;color:#fff;padding:16px 24px;border-radius:6px;text-align:right">
              <div style="font-size:12px;color:#aaa;margin-bottom:4px">TOTAL / MOIS</div>
              <div style="font-size:28px;font-weight:900;color:#c8ff00">${montant || 120} €</div>
            </div>
          </div>

          <!-- Virement -->
          <div style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:16px;font-size:13px;color:#555">
            <strong style="color:#111">Référence virement :</strong> ${reference}<br>
            <em>Confirme la réception depuis ton dashboard dès que le virement arrive.</em>
          </div>
        </div>`
      );

      await sendEmail(brevoKey, email,
        `Déclaration de virement reçue — noLackinDiscipline`,
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#ffffff;padding:40px 32px;border-radius:12px;">
          <h1 style="font-size:32px;color:#c8ff00;margin:0 0 8px">NLD</h1>
          <p style="color:#888;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 32px">noLackinDiscipline</p>
          <h2 style="font-size:22px;margin:0 0 16px">Déclaration reçue, ${prenom} !</h2>
          <p style="color:#ccc;line-height:1.6;margin:0 0 12px">
            On a bien reçu ta déclaration de virement pour le <strong style="color:#fff">Forfait mensuel NLD</strong>.
          </p>
          <p style="color:#ccc;line-height:1.6;margin:0 0 8px">
            <strong style="color:#fff">Référence :</strong> ${reference}
          </p>
          <p style="color:#ccc;line-height:1.6;margin:0 0 32px">
            Dès que le coach aura confirmé la réception du virement, tu recevras un email avec un lien pour créer ton compte.
          </p>
          <hr style="border:none;border-top:1px solid #222;margin:40px 0 24px"/>
          <p style="color:#555;font-size:12px;margin:0">
            Ce qui te manque, c'est pas l'envie. C'est la discipline.<br/>
            noLackinDiscipline — nolackindiscipline@gmail.com
          </p>
        </div>`
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ERREUR:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
