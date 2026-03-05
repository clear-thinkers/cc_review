-- Supabase Schema Migration
-- 2026-03-05 Initial Schema Setup
-- Tables: families, users, words, flashcard_contents, quiz_sessions, wallets
-- All tables include Row Level Security (RLS)

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLE: families
-- One row per tenant (one family = one tenant)
-- ============================================================================

create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table families enable row level security;

create index families_id_idx on families(id);


-- ============================================================================
-- TABLE: users
-- All human users — parents (Supabase Auth) and children (PIN-only)
-- ============================================================================

create table users (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families(id) on delete cascade,
  auth_user_id        uuid references auth.users(id) on delete set null,
    -- ^ non-null for parent accounts; null for child (PIN-only)
  name                text not null,
  role                text not null check (role in ('parent', 'child')),
  pin_hash            text,
    -- ^ null for parent; required for child
  is_platform_admin   boolean not null default false,
    -- ^ true only for Chengyuan; bypasses all RLS
  failed_pin_attempts integer not null default 0,
    -- ^ incremented on wrong PIN; reset to 0 on success
    -- ^ application locks UI at 5; parent must re-auth to reset
  avatar_id           text,
    -- ^ filename stem; valid: bubble_tea_excited_1, cake_sleep_1, donut_wink_1,
    -- ^ rice_ball_sleep_1, zongzi_smile_1, ramen_excited_1, babaorice_smile_1, bun_wink_1
  created_at          timestamptz not null default now()
);

alter table users enable row level security;

create index users_family_id_idx on users(family_id);
create unique index users_auth_user_id_idx on users(auth_user_id) where auth_user_id is not null;


-- ============================================================================
-- TABLE: words
-- One row per Hanzi character, scoped to a family
-- Preserved from IndexedDB schema with snake_case naming
-- ============================================================================

create table words (
  id              text primary key,
    -- ^ preserves existing makeId() pattern
  family_id       uuid not null references families(id) on delete cascade,
  hanzi           text not null,
  pinyin          text,
  meaning         text,
  created_at      timestamptz not null default now(),
  repetitions     integer not null default 0,
  interval_days   numeric not null default 0,
  ease            numeric not null default 21,
  next_review_at  bigint not null default 0,
    -- ^ Unix timestamp in milliseconds; 0 = immediately due
  review_count    integer not null default 0,
  test_count      integer not null default 0,
  fill_test       jsonb
    -- ^ nullable; populated only after Content Admin curation
    -- ^ stores FillTest object as-is from current schema
);

alter table words enable row level security;

create index words_family_id_idx on words(family_id);
create unique index words_family_hanzi_idx on words(family_id, hanzi);
  -- ^ enforces no duplicate hanzi per family


-- ============================================================================
-- TABLE: flashcard_contents
-- Curated content per character+pronunciation pair, scoped to a family
-- ============================================================================

create table flashcard_contents (
  id          text not null,
    -- ^ composite key: "{character}|{pronunciation}"
  family_id   uuid not null references families(id) on delete cascade,
  meanings    jsonb not null default '[]',
    -- ^ string[]
  phrases     jsonb not null default '[]',
    -- ^ Phrase[]: { zh, pinyin, en, include_in_fill_test }
  examples    jsonb not null default '[]',
    -- ^ Example[]: { zh, pinyin, en, include_in_fill_test }
  updated_at  timestamptz not null default now(),
  primary key (id, family_id)
);

alter table flashcard_contents enable row level security;

create index flashcard_contents_family_id_idx on flashcard_contents(family_id);


-- ============================================================================
-- TABLE: quiz_sessions
-- Completed fill-test session records, scoped to a user
-- Immutable audit record — no updates allowed
-- ============================================================================

create table quiz_sessions (
  id                       text primary key,
  user_id                  uuid not null references users(id) on delete cascade,
  family_id                uuid not null references families(id) on delete cascade,
    -- ^ denormalized for RLS policy efficiency
  created_at               timestamptz not null default now(),
  session_type             text not null default 'fill-test',
  grade_data               jsonb not null default '[]',
    -- ^ SessionGradeData[]: { wordId, hanzi, grade, timestamp }
  fully_correct_count      integer not null default 0,
  failed_count             integer not null default 0,
  partially_correct_count  integer not null default 0,
  total_grades             integer not null default 0,
  duration_seconds         integer not null default 0,
  coins_earned             integer not null default 0
);

alter table quiz_sessions enable row level security;

create index quiz_sessions_user_id_idx on quiz_sessions(user_id);
create index quiz_sessions_family_id_idx on quiz_sessions(family_id);


-- ============================================================================
-- TABLE: wallets
-- Cumulative coin balance, one row per user (singleton per user, not per family)
-- ============================================================================

create table wallets (
  user_id         uuid primary key references users(id) on delete cascade,
  family_id       uuid not null references families(id) on delete cascade,
    -- ^ denormalized for RLS policy efficiency
  total_coins     integer not null default 0,
  last_updated_at timestamptz not null default now(),
  version         integer not null default 1
);

alter table wallets enable row level security;

create index wallets_family_id_idx on wallets(family_id);
