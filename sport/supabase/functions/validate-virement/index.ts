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
    const { devis_id } = await req.json();
    if (!devis_id) throw new Error('devis_id manquant');

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Récupérer les infos du devis
    const { data: devis, error: devisError } = await sb
      .from('devis')
      .select('*')
      .eq('id', devis_id)
      .eq('statut', 'virement_en_attente')
      .single();

    if (devisError || !devis) throw new Error('Devis introuvable ou déjà traité');

    // Marquer le devis comme payé
    await sb.from('devis').update({
      statut: 'payé',
      'payé_le': new Date().toISOString(),
    }).eq('id', devis_id);

    // Ajouter dans pending_clients
    await sb.from('pending_clients').upsert({
      email:    devis.prospect_email,
      prenom:   devis.prospect_prenom,
      nom:      devis.prospect_nom,
      coach_id: devis.coach_id,
    }, { onConflict: 'email' });

    // Envoyer email au client
    const brevoKey = Deno.env.get('BREVO_API_KEY');
    const siteOrigin = Deno.env.get('SITE_URL') || 'https://nld-sport.vercel.app';
    const registerUrl = `${siteOrigin}/login.html?paiement=ok&email=${encodeURIComponent(devis.prospect_email)}`;

    if (brevoKey) {
      await sendEmail(brevoKey, devis.prospect_email,
        `Virement confirmé — Crée ton compte noLackinDiscipline`,
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#ffffff;padding:40px 32px;border-radius:12px;">
          <h1 style="font-size:32px;color:#c8ff00;margin:0 0 8px">NLD</h1>
          <p style="color:#888;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 32px">noLackinDiscipline</p>
          <h2 style="font-size:22px;margin:0 0 16px">Virement confirmé, ${devis.prospect_prenom} !</h2>
          <p style="color:#ccc;line-height:1.6;margin:0 0 12px">
            Ton virement de <strong style="color:#fff">${devis.montant} €</strong> a bien été reçu et vérifié.
          </p>
          <p style="color:#ccc;line-height:1.6;margin:0 0 32px">
            Tu peux maintenant créer ton compte et accéder à ton espace client.
          </p>
          <a href="${registerUrl}" style="display:inline-block;background:#c8ff00;color:#000;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;">
            Créer mon compte →
          </a>
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
