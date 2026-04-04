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
    const { subscription_id } = await req.json();

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: sub, error } = await sb
      .from('subscriptions')
      .select('*, profiles!subscriptions_client_id_fkey(email, prenom, nom)')
      .eq('id', subscription_id)
      .single();

    if (error || !sub) throw new Error('Abonnement introuvable');

    const clientEmail = sub.profiles?.email;
    if (!clientEmail) throw new Error('Email client introuvable');

    // Créer ou récupérer le customer Stripe
    let customerId = sub.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: clientEmail,
        name: `${sub.profiles?.prenom || ''} ${sub.profiles?.nom || ''}`.trim(),
        metadata: { client_id: sub.client_id },
      });
      customerId = customer.id;
      await sb.from('subscriptions').update({ stripe_customer_id: customerId }).eq('id', subscription_id);
    }

    // Créer le prix récurrent dynamiquement
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: Math.round(sub.montant * 100),
      recurring: { interval: 'month' },
      product_data: { name: `Coaching NLD — ${sub.montant}€/mois` },
    });

    // Créer la session de paiement
    const origin = req.headers.get('origin') || 'http://localhost';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { subscription_id },
      success_url: `${origin}/dashboard-client.html?abo=ok`,
      cancel_url:  `${origin}/dashboard-client.html`,
    });

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
