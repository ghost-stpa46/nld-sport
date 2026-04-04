// Apparition progressive au scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.offre-card, .manifeste-grid, .prix-card, .contact-form').forEach(el => {
  el.classList.add('fade-up');
  observer.observe(el);
});

// Soumission du formulaire contact
function handleSubmit(e) {
  e.preventDefault();
  e.target.style.opacity = '0.4';
  e.target.style.pointerEvents = 'none';
  setTimeout(() => {
    document.getElementById('formSuccess').classList.add('visible');
  }, 400);
}

// ============================================================
// SYSTÈME DE DEVIS
// ============================================================

let currentForfait = 'mensuel';
let devisNumero = '';
let devisData = {};

function openDevis() {
  document.getElementById('devisOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  goToStepDot(1);
  showStep('step1');
}

function closeDevis() {
  document.getElementById('devisOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeDevisFromOverlay(e) {
  if (e.target === document.getElementById('devisOverlay')) closeDevis();
}

function selectForfait(type) {
  currentForfait = 'mensuel';
}

function showStep(stepId) {
  document.querySelectorAll('.devis-step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
  document.querySelector('.devis-modal').scrollTop = 0;
}

function goToStepDot(n) {
  [1,2,3].forEach(i => {
    const dot = document.getElementById('stepDot' + i);
    dot.classList.remove('active', 'done');
    if (i < n) dot.classList.add('done');
    else if (i === n) dot.classList.add('active');
  });
  [1,2].forEach(i => {
    const line = document.getElementById('stepLine' + i);
    if (line) line.classList.toggle('done', i < n);
  });
}

function goToStep1() {
  goToStepDot(1);
  showStep('step1');
}

function goToStep2() {
  const prenom = document.getElementById('dPrenom').value.trim();
  const nom = document.getElementById('dNom').value.trim();
  const email = document.getElementById('dEmail').value.trim();
  const objectif = document.getElementById('dObjectif').value;
  const errEl = document.getElementById('step1Error');

  if (!prenom || !nom) {
    showError(errEl, 'Merci de renseigner ton prénom et ton nom.');
    return;
  }
  if (!email || !email.includes('@')) {
    showError(errEl, 'Adresse email invalide.');
    return;
  }
  if (!objectif) {
    showError(errEl, 'Choisis un objectif principal.');
    return;
  }
  errEl.classList.remove('visible');

  const niveau = document.querySelector('input[name="niveau"]:checked')?.value || 'Débutant';
  const message = document.getElementById('dMessage').value.trim();
  const tel = document.getElementById('dTel').value.trim();

  devisNumero = 'NLD-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
  devisData = { prenom, nom, email, tel, objectif, niveau, message };

  buildDevisDoc();
  goToStepDot(2);
  showStep('step2');
}

function goToStep3() {
  document.getElementById('paymentDesc').textContent =
    `Devis n° ${devisNumero} · ${devisData.prenom} ${devisData.nom}`;

  document.getElementById('paymentRecap').innerHTML = `
    <p>Forfait mensuel · soit 15€ la séance</p>
    <strong>120€<small style="font-family:var(--font-body);font-size:13px;color:var(--text-muted)">/mois</small></strong>
  `;

  document.getElementById('refVirement').textContent = devisNumero;
  document.getElementById('paymentSuccess').classList.remove('visible');
  document.querySelector('.payment-block').style.display = '';

  goToStepDot(3);
  showStep('step3');
}

async function handleStripeClick() {
  const btn = document.getElementById('stripeBtn');
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';
  btn.textContent = 'Chargement…';

  try {
    const res = await fetch('https://wzaoqjlkbtemkudgoyxn.supabase.co/functions/v1/public-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prenom:      devisData.prenom,
        nom:         devisData.nom,
        email:       devisData.email,
        titre:       `Forfait mensuel NLD — ${devisData.objectif}`,
        montant:     120,
        description: `Coaching personnalisé · Niveau ${devisData.niveau}`,
      }),
    });

    const json = await res.json();
    if (json.error) throw new Error(json.error);
    window.location.href = json.url;
  } catch (err) {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    btn.innerHTML = '⚠️ Erreur — réessaie';
    console.error(err);
  }
  return false;
}

async function confirmVirement() {
  const btn = document.querySelector('.virement-box .btn-outline');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }

  try {
    const res = await fetch('https://wzaoqjlkbtemkudgoyxn.supabase.co/functions/v1/confirm-virement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prenom:    devisData.prenom,
        nom:       devisData.nom,
        email:     devisData.email,
        tel:       devisData.tel || '',
        objectif:  devisData.objectif,
        niveau:    devisData.niveau,
        montant:   120,
        reference: devisNumero,
      }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
  } catch (err) {
    console.error(err);
  }

  showPaymentSuccess(
    'Merci ! Un email de confirmation t\'a été envoyé. Tu peux dès maintenant créer ton compte. Référence : ' + devisNumero
  );
}

function showPaymentSuccess(msg) {
  document.querySelector('.payment-block').style.display = 'none';
  document.getElementById('successMsg').textContent = msg;
  document.getElementById('paymentSuccess').classList.add('visible');
}

function buildDevisDoc() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const validite = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const items = [
    { text: '2 séances d\'entraînement personnalisées / semaine', hl: false },
    { text: 'Plan alimentaire adapté à tes objectifs',            hl: false },
    { text: 'Accompagnement mental & suivi de progression',       hl: false },
    { text: 'Accès direct — réponses rapides',                    hl: false },
    { text: 'Soit 15 € la séance',                                hl: true  },
  ];

  document.getElementById('devisDoc').innerHTML = `
    <div class="doc-inner">

      <!-- ── BANDEAU HEADER ── -->
      <div class="doc-header-band">
        <div class="doc-logo-block">
          <div class="doc-logo">NLD</div>
          <span class="doc-tagline">noLackinDiscipline &nbsp;·&nbsp; Coaching sportif personnel</span>
        </div>
        <div class="doc-header-right">
          <span class="doc-title-badge">Devis</span>
          <span class="doc-ref">${devisNumero}</span>
        </div>
      </div>

      <!-- ── CORPS ── -->
      <div class="doc-body">

        <!-- MÉTA : dates + parties -->
        <div class="doc-meta-row">
          <div class="doc-meta-cell">
            <div class="doc-meta-cell-label">Prestataire</div>
            <div class="doc-meta-cell-value">noLackinDiscipline</div>
            <div class="doc-meta-cell-sub">Coach sportif personnel<br>contact@nolackindiscipline.fr</div>
          </div>
          <div class="doc-meta-cell">
            <div class="doc-meta-cell-label">Client</div>
            <div class="doc-meta-cell-value">${devisData.prenom} ${devisData.nom}</div>
            <div class="doc-meta-cell-sub">${devisData.email}${devisData.tel ? '<br>' + devisData.tel : ''}</div>
          </div>
          <div class="doc-meta-cell">
            <div class="doc-meta-cell-label">Référence</div>
            <div class="doc-meta-cell-value">${devisNumero}</div>
            <div class="doc-meta-cell-sub">Émis le ${dateStr}<br>Valable jusqu'au ${validite}</div>
          </div>
        </div>

        <!-- TABLE PRESTATION -->
        <div class="doc-table-wrap">
          <div class="doc-table-head">
            <div class="doc-th">Prestation</div>
            <div class="doc-th">Qté</div>
            <div class="doc-th">P.U.</div>
            <div class="doc-th">Total HT</div>
          </div>
          <div class="doc-row">
            <div class="doc-cell">
              <div class="doc-cell-name">Forfait coaching mensuel</div>
              <div class="doc-cell-items">
                ${items.map(i => `<span class="doc-cell-item${i.hl ? ' hl' : ''}">${i.text}</span>`).join('')}
              </div>
            </div>
            <div class="doc-cell">1</div>
            <div class="doc-cell">120,00 €</div>
            <div class="doc-cell doc-cell-price">120,00 €<span class="doc-cell-unit">/ mois</span></div>
          </div>
        </div>

        <!-- TOTAL + NOTE -->
        <div class="doc-total-band">
          <div class="doc-total-note">
            <span class="doc-total-note-label">Objectif · ${devisData.objectif} &nbsp;·&nbsp; Niveau · ${devisData.niveau}</span>
            <span class="doc-total-note-text">Ce qui te manque, c'est pas l'envie. C'est la discipline.</span>
          </div>
          <div class="doc-total-amount-block">
            <span class="doc-total-label">Total / mois</span>
            <span class="doc-total-amount">120,00 €</span>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="doc-footer">
          <div class="doc-footer-text">
            <p>Devis valable 30 jours à compter de la date d'émission.</p>
            <p>Place confirmée après réception du paiement &nbsp;·&nbsp; Places limitées.</p>
          </div>
          <div class="doc-footer-logo">NLD</div>
        </div>

      </div>
    </div>
  `;
}

function printDevis() {
  window.print();
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
}

// Parallax léger sur les orbs du hero
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 20;
  const y = (e.clientY / window.innerHeight - 0.5) * 20;
  const orb1 = document.querySelector('.orb-1');
  const orb2 = document.querySelector('.orb-2');
  if (orb1) orb1.style.transform = `translate(${x * 0.6}px, ${y * 0.6}px)`;
  if (orb2) orb2.style.transform = `translate(${-x * 0.4}px, ${-y * 0.4}px)`;
});
