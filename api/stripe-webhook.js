const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });
const { sendEmail, COACH_EMAIL } = require('./_mailer');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const svcHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
});

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];
  if (!webhookSecret || !signature) return res.status(400).json({ error: 'Webhook non configuré.' });

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature invalide:', err.message);
    return res.status(400).json({ error: err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || session.customer_email || '';
    const customerName  = session.customer_details?.name || '';
    const amount        = session.amount_total || 0;

    console.log('[webhook] Paiement reçu:', customerEmail, amount);

    // Sauvegarder en base
    await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
      method: 'POST',
      headers: { ...svcHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        stripe_session_id: session.id,
        customer_email: customerEmail,
        customer_name: customerName,
        amount,
        status: 'pending',
      }),
    });

    // Notifier le coach
    await sendEmail({
      to: COACH_EMAIL,
      subject: `💳 Nouveau paiement — ${customerName || customerEmail}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
          <h2 style="color:#c8ff00;font-size:22px;margin-bottom:8px">Nouveau paiement reçu</h2>
          <p style="color:#888;margin-bottom:24px">Un client a acheté un pack sur noLackinDiscipline.</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #222">Client</td><td style="padding:8px 0;border-bottom:1px solid #222">${customerName || '—'}</td></tr>
            <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #222">Email</td><td style="padding:8px 0;border-bottom:1px solid #222">${customerEmail}</td></tr>
            <tr><td style="color:#888;padding:8px 0">Montant</td><td style="padding:8px 0;color:#c8ff00;font-weight:bold">${(amount / 100).toFixed(2)} €</td></tr>
          </table>
          <p style="margin-top:24px;color:#888;font-size:13px">Connecte-toi à ton dashboard pour valider et envoyer le lien d'inscription au client.</p>
          <a href="https://nld-sport.vercel.app/dashboard-coach.html" style="display:inline-block;margin-top:16px;background:#c8ff00;color:#000;font-weight:bold;padding:12px 24px;border-radius:8px;text-decoration:none">Ouvrir le dashboard</a>
        </div>
      `,
    });
  }

  res.status(200).json({ received: true });
};
