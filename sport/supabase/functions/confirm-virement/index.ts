import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Récupérer le coach
    const { data: coach } = await sb
      .from('profiles')
      .select('id')
      .eq('role', 'coach')
      .limit(1)
      .single();

    if (!coach) throw new Error('Aucun coach trouvé');

    // Créer le devis avec statut virement_en_attente
    await sb.from('devis').insert({
      coach_id:        coach.id,
      titre:           'Forfait mensuel NLD',
      description:     `Objectif : ${objectif || 'Non précisé'} · Niveau : ${niveau || 'Non précisé'}`,
      montant:         montant || 120,
      statut:          'virement_en_attente',
      prospect_email:  email,
      prospect_prenom: prenom,
      prospect_nom:    nom,
    });


    // Envoyer les emails
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const siteOrigin = Deno.env.get('SITE_URL') || 'https://ghost-stpa46.github.io/nld-sport';
    const registerUrl = `${siteOrigin}/login.html?paiement=ok&email=${encodeURIComponent(email)}`;

    if (resendKey) {
      // Email au coach
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NLD <onboarding@resend.dev>',
          to: 'stanpayikelike@gmail.com',
          subject: `Virement déclaré — ${prenom} ${nom}`,
          html: `
            <h2>Virement bancaire déclaré</h2>
            <p><strong>Client :</strong> ${prenom} ${nom}</p>
            <p><strong>Email :</strong> ${email}</p>
            ${tel ? `<p><strong>Téléphone :</strong> ${tel}</p>` : ''}
            <p><strong>Objectif :</strong> ${objectif || 'Non précisé'}</p>
            <p><strong>Niveau :</strong> ${niveau || 'Non précisé'}</p>
            <p><strong>Montant attendu :</strong> ${montant || 120} €</p>
            <p><strong>Référence virement :</strong> ${reference}</p>
            <hr/>
            <p>Vérifie ton compte bancaire. Dès réception, le client peut créer son compte.</p>
          `,
        }),
      });

      // Email au client
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NLD <onboarding@resend.dev>',
          to: email,
          subject: `Virement reçu — Crée ton compte noLackinDiscipline`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#ffffff;padding:40px 32px;border-radius:12px;">
              <h1 style="font-size:32px;color:#c8ff00;margin:0 0 8px">NLD</h1>
              <p style="color:#888;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 32px">noLackinDiscipline</p>

              <h2 style="font-size:22px;margin:0 0 16px">Virement déclaré, ${prenom} !</h2>
              <p style="color:#ccc;line-height:1.6;margin:0 0 12px">
                On a bien reçu ta déclaration de virement pour le <strong style="color:#fff">Forfait mensuel NLD</strong>.
              </p>
              <p style="color:#ccc;line-height:1.6;margin:0 0 8px">
                <strong style="color:#fff">Référence :</strong> ${reference}
              </p>
              <p style="color:#ccc;line-height:1.6;margin:0 0 32px">
                Tu peux dès maintenant créer ton compte et accéder à ton espace client.
              </p>

              <a href="${registerUrl}" style="display:inline-block;background:#c8ff00;color:#000;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;">
                Créer mon compte →
              </a>

              <hr style="border:none;border-top:1px solid #222;margin:40px 0 24px"/>
              <p style="color:#555;font-size:12px;margin:0">
                Ce qui te manque, c'est pas l'envie. C'est la discipline.<br/>
                noLackinDiscipline — nolackindiscipline@gmail.com
              </p>
            </div>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
