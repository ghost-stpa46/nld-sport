-- ============================================================
-- setup.sql — noLackinDiscipline (NLD)
-- Colle ce script dans l'éditeur SQL de Supabase
-- (Supabase Dashboard > SQL Editor > New query)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- TABLE : profiles
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('coach','client')),
  prenom       text,
  nom          text,
  email        text,
  coach_id     uuid references public.profiles(id) on delete set null,
  objectif     text,
  niveau       text,
  telephone    text,
  created_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE : mesures
-- ────────────────────────────────────────────────────────────
create table if not exists public.mesures (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid not null references public.profiles(id) on delete cascade,
  date           date not null,
  poids          numeric(5,2),
  masse_grasse   numeric(4,2),
  tour_poitrine  numeric(5,2),
  tour_taille    numeric(5,2),
  tour_hanches   numeric(5,2),
  tour_bras      numeric(5,2),
  tour_cuisse    numeric(5,2),
  notes          text,
  created_at     timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE : seances
-- ────────────────────────────────────────────────────────────
create table if not exists public.seances (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  date          date not null,
  titre         text not null,
  programme     text,
  completee     boolean not null default false,
  duree_min     integer,
  notes_coach   text,
  notes_client  text,
  created_at    timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE : plans_nutrition
-- ────────────────────────────────────────────────────────────
create table if not exists public.plans_nutrition (
  id               uuid primary key default uuid_generate_v4(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  titre            text not null,
  contenu          text,
  calories_cible   integer,
  proteines_g      integer,
  glucides_g       integer,
  lipides_g        integer,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE : logs_nutrition
-- ────────────────────────────────────────────────────────────
create table if not exists public.logs_nutrition (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid not null references public.profiles(id) on delete cascade,
  date           date not null,
  respect_score  integer check (respect_score between 1 and 10),
  notes          text,
  created_at     timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE : objectifs
-- ────────────────────────────────────────────────────────────
create table if not exists public.objectifs (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  titre        text not null,
  description  text,
  statut       text not null default 'en_cours'
               check (statut in ('en_cours','atteint','abandonne')),
  date_cible   date,
  created_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE : compte_rendus
-- ────────────────────────────────────────────────────────────
create table if not exists public.compte_rendus (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  seance_id   uuid references public.seances(id) on delete set null,
  contenu     text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TRIGGER : auto-create profile on new auth user
-- (le trigger insère juste l'id ; le rôle doit être défini
--  manuellement ou via le flow d'inscription)
-- ────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    -- Si l'email correspond à celui du coach, attribuer 'coach', sinon 'client'
    -- À adapter selon votre logique métier
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- Activer RLS sur toutes les tables
alter table public.profiles        enable row level security;
alter table public.mesures         enable row level security;
alter table public.seances         enable row level security;
alter table public.plans_nutrition enable row level security;
alter table public.logs_nutrition  enable row level security;
alter table public.objectifs       enable row level security;
alter table public.compte_rendus   enable row level security;

-- ── PROFILES ────────────────────────────────────────────────

-- Le coach voit tous ses clients + son propre profil
create policy "coach voit ses clients"
  on public.profiles for select
  using (
    id = auth.uid()
    or coach_id = auth.uid()
  );

-- Le coach peut modifier ses clients + son propre profil
create policy "coach modifie ses clients"
  on public.profiles for update
  using (
    id = auth.uid()
    or coach_id = auth.uid()
  );

-- Le coach peut insérer un nouveau profil client
create policy "coach insere clients"
  on public.profiles for insert
  with check (
    auth.uid() is not null
  );

-- Un client voit uniquement son propre profil
-- (inclus dans la policy "coach voit ses clients" ci-dessus
--  car coach_id peut être null pour le coach lui-même)

-- ── MESURES ─────────────────────────────────────────────────

create policy "coach voit mesures clients"
  on public.mesures for select
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = mesures.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "coach insere mesures"
  on public.mesures for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = mesures.client_id
        and (p.id = auth.uid() or p.coach_id = auth.uid())
    )
  );

create policy "coach modifie mesures"
  on public.mesures for update
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = mesures.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "coach supprime mesures"
  on public.mesures for delete
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = mesures.client_id
        and p.coach_id = auth.uid()
    )
  );

-- ── SÉANCES ─────────────────────────────────────────────────

create policy "coach voit seances clients"
  on public.seances for select
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = seances.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "coach insere seances"
  on public.seances for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = seances.client_id
        and (p.id = auth.uid() or p.coach_id = auth.uid())
    )
  );

create policy "coach modifie seances"
  on public.seances for update
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = seances.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "coach supprime seances"
  on public.seances for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = seances.client_id
        and p.coach_id = auth.uid()
    )
  );

-- Le client peut mettre à jour sa propre note et le flag completee
create policy "client met a jour sa seance"
  on public.seances for update
  using (client_id = auth.uid());

-- ── PLANS NUTRITION ─────────────────────────────────────────

create policy "coach voit plans nutrition"
  on public.plans_nutrition for select
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = plans_nutrition.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "coach gere plans nutrition"
  on public.plans_nutrition for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = plans_nutrition.client_id
        and p.coach_id = auth.uid()
    )
  );

-- ── LOGS NUTRITION ───────────────────────────────────────────

create policy "voir logs nutrition"
  on public.logs_nutrition for select
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = logs_nutrition.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "inserer logs nutrition"
  on public.logs_nutrition for insert
  with check (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = logs_nutrition.client_id
        and p.coach_id = auth.uid()
    )
  );

-- ── OBJECTIFS ───────────────────────────────────────────────

create policy "voir objectifs"
  on public.objectifs for select
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = objectifs.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "gerer objectifs"
  on public.objectifs for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = objectifs.client_id
        and p.coach_id = auth.uid()
    )
  );

-- ── COMPTE-RENDUS ────────────────────────────────────────────

create policy "voir compte rendus"
  on public.compte_rendus for select
  using (
    client_id = auth.uid()
    or created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = compte_rendus.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "coach cree compte rendus"
  on public.compte_rendus for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = compte_rendus.client_id
        and p.coach_id = auth.uid()
    )
  );

create policy "coach supprime compte rendus"
  on public.compte_rendus for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = compte_rendus.client_id
        and p.coach_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- INDEX (performance)
-- ────────────────────────────────────────────────────────────
create index if not exists idx_profiles_coach_id        on public.profiles(coach_id);
create index if not exists idx_mesures_client_id        on public.mesures(client_id);
create index if not exists idx_mesures_date             on public.mesures(date);
create index if not exists idx_seances_client_id        on public.seances(client_id);
create index if not exists idx_seances_date             on public.seances(date);
create index if not exists idx_plans_nutrition_client   on public.plans_nutrition(client_id);
create index if not exists idx_logs_nutrition_client    on public.logs_nutrition(client_id);
create index if not exists idx_objectifs_client_id      on public.objectifs(client_id);
create index if not exists idx_compte_rendus_client_id  on public.compte_rendus(client_id);

-- ────────────────────────────────────────────────────────────
-- DONNÉES INITIALES (optionnel — à décommenter pour les tests)
-- ────────────────────────────────────────────────────────────

-- Exemple : créer un profil coach manuellement après avoir créé
-- l'utilisateur dans Supabase Auth > Users
--
-- UPDATE public.profiles
-- SET role = 'coach', prenom = 'Ton Prénom', nom = 'Ton Nom'
-- WHERE id = 'TON_UUID_AUTH_USER_ICI';
--
-- ────────────────────────────────────────────────────────────
-- NOTE : Pour "Ajouter un client" depuis le dashboard coach,
-- deux approches sont possibles :
--
-- 1. SERVICE ROLE (backend) : Utilise l'API admin Supabase depuis
--    un serveur ou une Edge Function pour createUser() + insérer profil.
--    C'est l'approche recommandée en production.
--
-- 2. INVITATION (frontend) : supabase.auth.signInWithOtp({ email })
--    crée le compte et envoie un magic link. Le trigger ci-dessus
--    crée automatiquement le profil, puis le coach met à jour
--    coach_id via update.
--
-- Le dashboard coach utilise l'approche 2 + insert profil direct.
-- ────────────────────────────────────────────────────────────
