-- ============================================================
-- setup-fix.sql — noLackinDiscipline
-- Colle ce script dans Supabase > SQL Editor > New query
-- Il est safe de le lancer plusieurs fois (IF NOT EXISTS partout)
-- ============================================================

-- ── 1. COLONNES MANQUANTES ────────────────────────────────────

-- coach_id dans profiles (peut manquer si table créée avant ajout colonne)
alter table public.profiles
  add column if not exists coach_id uuid references public.profiles(id) on delete set null;

-- coach_id dans seances (dashboard l'utilise mais absent du schema initial)
alter table public.seances
  add column if not exists coach_id uuid references public.profiles(id) on delete set null;

-- ── 2. TABLES MANQUANTES ─────────────────────────────────────

-- pending_clients : clients en attente de création de compte
create table if not exists public.pending_clients (
  id         uuid primary key default uuid_generate_v4(),
  email      text not null unique,
  prenom     text,
  nom        text,
  coach_id   uuid references public.profiles(id) on delete set null,
  objectif   text,
  niveau     text,
  telephone  text,
  created_at timestamptz not null default now()
);

-- devis
create table if not exists public.devis (
  id               uuid primary key default uuid_generate_v4(),
  coach_id         uuid references public.profiles(id) on delete cascade,
  client_id        uuid references public.profiles(id) on delete set null,
  titre            text not null,
  description      text,
  montant          numeric(10,2) not null default 0,
  statut           text not null default 'brouillon'
                     check (statut in ('brouillon','envoyé','payé','virement_en_attente')),
  prospect_email   text,
  prospect_prenom  text,
  prospect_nom     text,
  lien_paiement    text,
  "payé_le"        timestamptz,
  created_at       timestamptz not null default now()
);

-- subscriptions
create table if not exists public.subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  client_id               uuid references public.profiles(id) on delete cascade,
  coach_id                uuid references public.profiles(id) on delete set null,
  montant                 numeric(10,2) not null default 0,
  statut                  text not null default 'en_attente'
                            check (statut in ('en_attente','actif','impayé','annulé')),
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now()
);

-- messages
create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- notifications
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'info',
  titre      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- photos_progression
create table if not exists public.photos_progression (
  id         uuid primary key default uuid_generate_v4(),
  client_id  uuid not null references public.profiles(id) on delete cascade,
  url        text not null,
  date       date not null,
  notes      text,
  created_at timestamptz not null default now()
);

-- ── 3. RLS ───────────────────────────────────────────────────

alter table public.pending_clients    enable row level security;
alter table public.devis              enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.messages           enable row level security;
alter table public.notifications      enable row level security;
alter table public.photos_progression enable row level security;

-- ─ Recréer les policies profiles (safe : drop if exists d'abord) ─

drop policy if exists "coach voit ses clients"   on public.profiles;
drop policy if exists "coach modifie ses clients" on public.profiles;
drop policy if exists "coach insere clients"      on public.profiles;

create policy "coach voit ses clients"
  on public.profiles for select
  using (id = auth.uid() or coach_id = auth.uid());

create policy "coach modifie ses clients"
  on public.profiles for update
  using (id = auth.uid() or coach_id = auth.uid());

create policy "coach insere clients"
  on public.profiles for insert
  with check (auth.uid() is not null);

-- ─ pending_clients : service role only (edge functions) ─
drop policy if exists "service only pending_clients" on public.pending_clients;
create policy "service only pending_clients"
  on public.pending_clients for all
  using (true)
  with check (true);

-- ─ devis ─
drop policy if exists "coach gere ses devis"  on public.devis;
drop policy if exists "client voit ses devis" on public.devis;

create policy "coach gere ses devis"
  on public.devis for all
  using (coach_id = auth.uid());

create policy "client voit ses devis"
  on public.devis for select
  using (client_id = auth.uid());

-- ─ subscriptions ─
drop policy if exists "coach gere subscriptions"  on public.subscriptions;
drop policy if exists "client voit subscription"  on public.subscriptions;

create policy "coach gere subscriptions"
  on public.subscriptions for all
  using (coach_id = auth.uid());

create policy "client voit subscription"
  on public.subscriptions for select
  using (client_id = auth.uid());

-- ─ messages ─
drop policy if exists "messages entre coach et client" on public.messages;

create policy "messages entre coach et client"
  on public.messages for all
  using (sender_id = auth.uid() or receiver_id = auth.uid());

-- ─ notifications ─
drop policy if exists "user voit ses notifs" on public.notifications;

create policy "user voit ses notifs"
  on public.notifications for all
  using (user_id = auth.uid());

-- ─ photos_progression ─
drop policy if exists "coach et client voient les photos" on public.photos_progression;
drop policy if exists "client gere ses photos"            on public.photos_progression;

create policy "coach et client voient les photos"
  on public.photos_progression for select
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = photos_progression.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "client gere ses photos"
  on public.photos_progression for all
  using (client_id = auth.uid());

-- ── 4. INDEX ─────────────────────────────────────────────────

create index if not exists idx_devis_coach_id         on public.devis(coach_id);
create index if not exists idx_devis_client_id        on public.devis(client_id);
create index if not exists idx_subs_client_id         on public.subscriptions(client_id);
create index if not exists idx_messages_sender        on public.messages(sender_id);
create index if not exists idx_messages_receiver      on public.messages(receiver_id);
create index if not exists idx_notifs_user_id         on public.notifications(user_id);
create index if not exists idx_photos_client_id       on public.photos_progression(client_id);
create index if not exists idx_seances_coach_id       on public.seances(coach_id);
