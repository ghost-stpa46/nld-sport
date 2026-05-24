import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

Deno.serve(async () => {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Séances de demain
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const { data: seances, error } = await sb
    .from('seances')
    .select('*, profiles!seances_client_id_fkey(prenom, nom, email)')
    .eq('date', dateStr)
    .eq('completee', false);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!seances?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  let sent = 0;

  for (const seance of seances) {
    const client = seance.profiles;
    if (!client?.email) continue;

    const dateFormatted = new Date(seance.date).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NLD <noreply@nolackindiscipline.fr>',
        to:   [client.email],
        subject: `Rappel : ta séance demain — ${seance.titre}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:12px;overflow:hidden">
            <div style="background:#c8ff00;padding:24px 32px">
              <h1 style="font-size:32px;font-weight:900;color:#000;margin:0;letter-spacing:0.05em">NLD</h1>
            </div>
            <div style="padding:32px">
              <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Salut ${client.prenom} 👋</h2>
              <p style="color:#aaa;font-size:14px;margin-bottom:24px">Tu as une séance demain. Prépare-toi.</p>
              <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px 24px;margin-bottom:24px">
                <div style="font-size:18px;font-weight:700;color:#c8ff00;margin-bottom:6px">${seance.titre}</div>
                <div style="font-size:14px;color:#aaa">${dateFormatted}</div>
                ${seance.duree_min ? `<div style="font-size:13px;color:#888;margin-top:4px">Durée : ${seance.duree_min} min</div>` : ''}
                ${seance.programme ? `<div style="font-size:13px;color:#888;margin-top:4px">Programme : ${seance.programme}</div>` : ''}
              </div>
              ${seance.notes_coach ? `
              <div style="background:#111;border-left:3px solid #c8ff00;padding:14px 18px;border-radius:4px;margin-bottom:24px">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:6px">Note de ton coach</div>
                <div style="font-size:14px;color:#fff">${seance.notes_coach}</div>
              </div>` : ''}
              <p style="font-size:13px;color:#555;text-align:center;margin-top:32px">noLackinDiscipline · Tu peux te connecter sur ton espace pour voir les détails.</p>
            </div>
          </div>
        `,
      }),
    });

    sent++;
  }

  return new Response(JSON.stringify({ sent }), { status: 200 });
});
