import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { devis_id } = await req.json();

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: devis, error } = await sb
      .from('devis')
      .select('*, profiles!devis_client_id_fkey(email, prenom, nom)')
      .eq('id', devis_id)
      .single();

    if (error || !devis) throw new Error('Devis introuvable');
    if (devis.statut === 'payé') throw new Error('Devis déjà payé');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: devis.profiles?.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(devis.montant * 100),
          product_data: {
            name: devis.titre,
            description: devis.description || undefined,
          },
        },
        quantity: 1,
      }],
      metadata: { devis_id },
      success_url: `${req.headers.get('origin') || 'http://localhost'}/dashboard-client.html?paiement=ok`,
      cancel_url:  `${req.headers.get('origin') || 'http://localhost'}/dashboard-client.html?paiement=annule`,
    });

    await sb.from('devis').update({ stripe_session_id: session.id, statut: 'envoyé' }).eq('id', devis_id);

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
