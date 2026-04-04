import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  } catch {
    return new Response('Webhook signature invalide', { status: 400 });
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // ── Paiement unique (devis) ──
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.metadata?.devis_id) {
      // Récupérer les infos du devis avant la mise à jour
      const { data: devisData } = await sb.from('devis')
        .select('*')
        .eq('id', session.metadata.devis_id)
        .single();

      await sb.from('devis').update({
        statut: 'payé',
        payé_le: new Date().toISOString(),
      }).eq('id', session.metadata.devis_id);

      if (devisData) {
        // Ajouter dans pending_clients APRÈS paiement confirmé
        await sb.from('pending_clients').upsert({
          email:    devisData.prospect_email,
          prenom:   devisData.prospect_prenom,
          nom:      devisData.prospect_nom,
          coach_id: devisData.coach_id,
        }, { onConflict: 'email' });

        // Envoyer les emails
        const resendKey = Deno.env.get('RESEND_API_KEY');
        const siteOrigin = Deno.env.get('SITE_URL') || 'https://ghost-stpa46.github.io/nld-sport';
        const registerUrl = `${siteOrigin}/login.html?paiement=ok&email=${encodeURIComponent(devisData.prospect_email)}`;

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
              to: 'nolackindiscipline@gmail.com',
              subject: `Nouveau client payant — ${devisData.prospect_prenom} ${devisData.prospect_nom}`,
              html: `
                <h2>Nouveau paiement reçu</h2>
                <p><strong>Client :</strong> ${devisData.prospect_prenom} ${devisData.prospect_nom}</p>
                <p><strong>Email :</strong> ${devisData.prospect_email}</p>
                <p><strong>Forfait :</strong> ${devisData.titre}</p>
                <p><strong>Montant :</strong> ${devisData.montant} €</p>
                <p><strong>Devis :</strong> ${session.metadata.devis_id}</p>
                <hr/>
                <p>Le client peut maintenant créer son compte sur le site.</p>
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
              to: devisData.prospect_email,
              subject: `Bienvenue chez noLackinDiscipline — Crée ton compte`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#ffffff;padding:40px 32px;border-radius:12px;">
                  <h1 style="font-size:32px;color:#c8ff00;margin:0 0 8px">NLD</h1>
                  <p style="color:#888;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 32px">noLackinDiscipline</p>

                  <h2 style="font-size:22px;margin:0 0 16px">Paiement confirmé, ${devisData.prospect_prenom} !</h2>
                  <p style="color:#ccc;line-height:1.6;margin:0 0 12px">
                    Ton paiement de <strong style="color:#fff">${devisData.montant} €</strong> pour le <strong style="color:#fff">${devisData.titre}</strong> a bien été reçu.
                  </p>
                  <p style="color:#ccc;line-height:1.6;margin:0 0 32px">
                    Il ne te reste plus qu'à créer ton compte pour accéder à ton espace client.
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
      }
    }

    if (session.metadata?.subscription_id && session.subscription) {
      const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
      await sb.from('subscriptions').update({
        stripe_subscription_id: session.subscription,
        statut: 'actif',
        current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
      }).eq('id', session.metadata.subscription_id);
    }
  }

  // ── Renouvellement mensuel ──
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.subscription) {
      const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      await sb.from('subscriptions')
        .update({
          statut: 'actif',
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        })
        .eq('stripe_subscription_id', invoice.subscription);
    }
  }

  // ── Échec de paiement ──
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.subscription) {
      await sb.from('subscriptions')
        .update({ statut: 'impayé' })
        .eq('stripe_subscription_id', invoice.subscription);
    }
  }

  // ── Annulation ──
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    await sb.from('subscriptions')
      .update({ statut: 'annulé' })
      .eq('stripe_subscription_id', sub.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
