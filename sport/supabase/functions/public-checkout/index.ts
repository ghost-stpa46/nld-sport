import Stripe from 'npm:stripe@14';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { prenom, nom, email, titre, montant, description } = await req.json();

    if (!prenom || !nom || !email || !titre || !montant) {
      throw new Error('Champs manquants');
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Récupérer le coach (premier coach de la base)
    const { data: coach } = await sb
      .from('profiles')
      .select('id')
      .eq('role', 'coach')
      .limit(1)
      .single();

    if (!coach) throw new Error('Aucun coach trouvé');

    // Créer le devis
    const { data: devis, error: devisError } = await sb.from('devis').insert({
      coach_id:    coach.id,
      titre,
      description: description || null,
      montant,
      statut:      'envoyé',
      prospect_email: email,
      prospect_prenom: prenom,
      prospect_nom: nom,
    }).select().single();

    if (devisError) throw new Error(devisError.message);

    // Créer la session Stripe
    const origin = req.headers.get('origin') || 'http://localhost';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(montant * 100),
          product_data: { name: titre, description: description || undefined },
        },
        quantity: 1,
      }],
      metadata: { devis_id: devis.id },
      success_url: `${origin}/login.html?paiement=ok&email=${encodeURIComponent(email)}`,
      cancel_url:  `${origin}/index.html`,
    });

    await sb.from('devis').update({ stripe_session_id: session.id }).eq('id', devis.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
