const RESEND_API_KEY = process.env.RESEND_API_KEY;
const COACH_EMAIL = 'nolackindiscipline@gmail.com';
const FROM = 'NLD Sport <onboarding@resend.dev>';

async function sendEmail({ to = COACH_EMAIL, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('[mailer] RESEND_API_KEY manquant — email non envoyé');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[mailer] Erreur Resend:', err);
  }
}

module.exports = { sendEmail, COACH_EMAIL };
