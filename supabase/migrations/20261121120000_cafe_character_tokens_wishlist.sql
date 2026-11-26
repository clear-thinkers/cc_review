-- Café, character tokens + wishlist rewards (roadmap item U, 2026-11-21).
-- Spec: docs/feature-specs/2026-11-21-cafe-visitors-character-tokens-wishlist.md
--
-- Characters visit the Café and order a mix of dishes from the child's shelf. Serving an
-- order removes those dishes from the shelf for good and pays the child in that
-- character's own token. Tokens are spent on the Rewards page, including on real-world
-- rewards a parent sets up, redeemed with a child and a parent signature.
--
-- Tokens reuse the paw_print_* ledger: a paw print is simply Chef Shrewy's token.
--
-- Security posture (same as the paw-print tables): every ledger has RLS and NO client
-- insert/update/delete policy. The security-definer RPCs below are the only writers, and
-- each checks the caller itself. Catalog tables are readable by signed-in users and
-- writable by the platform admin only.

-- ---------------------------------------------------------------------------
-- 1. Character catalog
-- ---------------------------------------------------------------------------
create table shop_characters (
  character_key text primary key check (character_key ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name_i18n jsonb not null,
  intro_i18n jsonb not null default '{"en":"","zh":""}'::jsonb,
  token_name_i18n jsonb not null,
  token_icon_path text,
  -- Pose -> image path, e.g. { "waiting": "/characters/li-bai_waiting.png" }.
  sprite_paths jsonb not null default '{}'::jsonb check (jsonb_typeof(sprite_paths) = 'object'),
  -- Moment -> [{ en, zh }], e.g. { "order": [...], "served": [...], "dismissed": [...] }.
  lines_i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(lines_i18n) = 'object'),
  visits_cafe boolean not null default true,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shop_characters enable row level security;

create policy "shop_characters: authenticated read"
on shop_characters for select to authenticated using (true);

create policy "shop_characters: platform admin write"
on shop_characters for all
using (is_platform_admin())
with check (is_platform_admin());

-- Chef Shrewy gives tokens through his challenge and never visits the Café.
insert into shop_characters (
  character_key, name_i18n, token_name_i18n, token_icon_path, visits_cafe, is_active, display_order
) values (
  'shrewy',
  '{"en":"Chef Shrewy","zh":"鼩仔大厨"}'::jsonb,
  '{"en":"paw print","zh":"爪印"}'::jsonb,
  '/paw-prints/shrewy_paw.png',
  false,
  true,
  0
);

-- An order: one token price for a mix of dishes.
create table shop_character_orders (
  id uuid primary key default gen_random_uuid(),
  character_key text not null references shop_characters(character_key) on delete cascade,
  token_price integer not null check (token_price between 1 and 50),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shop_character_orders_character_idx on shop_character_orders (character_key, display_order);

alter table shop_character_orders enable row level security;

create policy "shop_character_orders: authenticated read"
on shop_character_orders for select to authenticated using (true);

create policy "shop_character_orders: platform admin write"
on shop_character_orders for all
using (is_platform_admin())
with check (is_platform_admin());

create table shop_character_order_items (
  order_id uuid not null references shop_character_orders(id) on delete cascade,
  recipe_id uuid not null references shop_recipes(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 9),
  primary key (order_id, recipe_id)
);

alter table shop_character_order_items enable row level security;

create policy "shop_character_order_items: authenticated read"
on shop_character_order_items for select to authenticated using (true);

create policy "shop_character_order_items: platform admin write"
on shop_character_order_items for all
using (is_platform_admin())
with check (is_platform_admin());

-- Curated content a token can carry, e.g. one of 李白's poems on a 诗笺.
create table shop_character_token_contents (
  id uuid primary key default gen_random_uuid(),
  character_key text not null references shop_characters(character_key) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  body text not null check (char_length(btrim(body)) between 1 and 600),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shop_character_token_contents_character_idx
  on shop_character_token_contents (character_key, display_order);

alter table shop_character_token_contents enable row level security;

create policy "shop_character_token_contents: authenticated read"
on shop_character_token_contents for select to authenticated using (true);

create policy "shop_character_token_contents: platform admin write"
on shop_character_token_contents for all
using (is_platform_admin())
with check (is_platform_admin());

-- ---------------------------------------------------------------------------
-- 2. Café visits
-- ---------------------------------------------------------------------------
create table cafe_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  character_key text not null references shop_characters(character_key),
  order_id uuid references shop_character_orders(id) on delete set null,
  -- Snapshot, so an admin edit never changes an order already at the counter:
  -- [{ "recipeId": uuid, "quantity": n }].
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) >= 1),
  token_price integer not null check (token_price > 0),
  status text not null default 'open' check (status in ('open', 'served', 'dismissed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'open') = (closed_at is null))
);

create unique index cafe_visits_one_open_idx on cafe_visits (user_id) where status = 'open';
create index cafe_visits_user_idx on cafe_visits (user_id, created_at desc);

alter table cafe_visits enable row level security;

create policy "cafe_visits: family scoped read"
on cafe_visits for select
using (is_platform_admin() or family_id = current_family_id());

-- ---------------------------------------------------------------------------
-- 3. Sold dishes leave the shelf for good
-- ---------------------------------------------------------------------------
alter table shop_cooked_dishes drop constraint shop_cooked_dishes_location_check;
alter table shop_cooked_dishes
  add constraint shop_cooked_dishes_location_check check (location in ('countertop', 'shelf', 'sold'));

alter table shop_cooked_dishes
  add column sold_visit_id uuid references cafe_visits(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. The token ledger accepts every character
-- ---------------------------------------------------------------------------
alter table paw_print_rewards drop constraint paw_print_rewards_giver_check;
alter table paw_print_rewards
  add constraint paw_print_rewards_giver_fkey foreign key (giver) references shop_characters(character_key);

alter table paw_print_awards drop constraint paw_print_awards_giver_check;
alter table paw_print_awards
  add constraint paw_print_awards_giver_fkey foreign key (giver) references shop_characters(character_key);

alter table paw_print_redemptions
  add constraint paw_print_redemptions_giver_fkey foreign key (giver) references shop_characters(character_key);

alter table paw_print_awards
  add column source text not null default 'chef_challenge' check (source in ('chef_challenge', 'cafe_sale')),
  add column cafe_visit_id uuid references cafe_visits(id) on delete set null,
  add column visit_token_index integer check (visit_token_index >= 1),
  add column content_id uuid references shop_character_token_contents(id) on delete set null,
  add constraint paw_print_awards_cafe_source_check check (source = 'cafe_sale' or cafe_visit_id is null),
  -- One visit can never pay the same token twice.
  add constraint paw_print_awards_visit_token_unique unique (cafe_visit_id, visit_token_index);

-- ---------------------------------------------------------------------------
-- 5. Real-world rewards, set up by a parent
-- ---------------------------------------------------------------------------
create table wishlist_rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  -- Null = any child in the family.
  user_id uuid references users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  is_repeatable boolean not null default false,
  is_active boolean not null default true,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wishlist_rewards_family_idx on wishlist_rewards (family_id, created_at);

alter table wishlist_rewards enable row level security;

create policy "wishlist_rewards: family scoped read"
on wishlist_rewards for select
using (is_platform_admin() or family_id = current_family_id());

create table wishlist_reward_prices (
  reward_id uuid not null references wishlist_rewards(id) on delete cascade,
  character_key text not null references shop_characters(character_key),
  token_count integer not null check (token_count between 1 and 999),
  primary key (reward_id, character_key)
);

alter table wishlist_reward_prices enable row level security;

create policy "wishlist_reward_prices: family scoped read"
on wishlist_reward_prices for select
using (
  is_platform_admin()
  or exists (
    select 1 from wishlist_rewards r
    where r.id = reward_id and r.family_id = current_family_id()
  )
);

create table wishlist_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  reward_id uuid references wishlist_rewards(id) on delete set null,
  title text not null,
  -- What was paid, kept even if the reward's price changes: { "li-bai": 10, "shrewy": 5 }.
  price_snapshot jsonb not null check (jsonb_typeof(price_snapshot) = 'object'),
  child_signature text not null check (char_length(btrim(child_signature)) between 1 and 60),
  parent_signature text not null check (char_length(btrim(parent_signature)) between 1 and 60),
  redeemed_at timestamptz not null default now()
);

create index wishlist_redemptions_user_idx on wishlist_redemptions (user_id, redeemed_at);

alter table wishlist_redemptions enable row level security;

create policy "wishlist_redemptions: family scoped read"
on wishlist_redemptions for select
using (is_platform_admin() or family_id = current_family_id());

-- ---------------------------------------------------------------------------
-- 6. Balance: tokens earned minus everything spent, for one character
-- ---------------------------------------------------------------------------
create or replace function paw_print_balance(p_user_id uuid, p_giver text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'collected', earned.total,
    'available', earned.total - catalog_spent.total - wishlist_spent.total
  )
  from
    (select count(*)::integer as total from paw_print_awards
      where user_id = p_user_id and giver = p_giver) earned,
    (select coalesce(sum(cost), 0)::integer as total from paw_print_redemptions
      where user_id = p_user_id and giver = p_giver) catalog_spent,
    (select coalesce(sum((price_snapshot ->> p_giver)::integer), 0)::integer as total from wishlist_redemptions
      where user_id = p_user_id and price_snapshot ? p_giver) wishlist_spent;
$$;

revoke execute on function paw_print_balance(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Café RPCs
-- ---------------------------------------------------------------------------

-- The child's current visitor, or a new one. Prefers orders the child could ever fill
-- (every recipe unlocked) and avoids repeating the order just closed.
create or replace function get_cafe_visit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_visit cafe_visits%rowtype;
  v_last_order uuid;
  v_order_id uuid;
  v_character text;
  v_price integer;
  v_items jsonb;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  -- Serialize per child so two devices can't both open a visit.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':cafe-visit', 0));

  select * into v_visit from cafe_visits where user_id = v_user_id and status = 'open';

  if not found then
    select order_id into v_last_order
    from cafe_visits
    where user_id = v_user_id
    order by created_at desc
    limit 1;

    select o.id, o.character_key, o.token_price,
      (
        select jsonb_agg(jsonb_build_object('recipeId', i.recipe_id, 'quantity', i.quantity) order by i.recipe_id)
        from shop_character_order_items i
        where i.order_id = o.id
      )
    into v_order_id, v_character, v_price, v_items
    from shop_character_orders o
    join shop_characters c on c.character_key = o.character_key
    where o.is_active
      and c.is_active
      and c.visits_cafe
      and exists (select 1 from shop_character_order_items i where i.order_id = o.id)
      -- Every dish must be something a child can actually cook.
      and not exists (
        select 1
        from shop_character_order_items i
        join shop_recipes r on r.id = i.recipe_id
        where i.order_id = o.id and (not r.is_active or r.cook_method is null)
      )
    order by
      exists (
        select 1 from shop_character_order_items i
        where i.order_id = o.id
          and not exists (
            select 1 from shop_recipe_unlocks u where u.user_id = v_user_id and u.recipe_id = i.recipe_id
          )
      ),
      (o.id is not distinct from v_last_order),
      random()
    limit 1;

    if v_order_id is null then
      return jsonb_build_object('success', false, 'code', 'no_visitors');
    end if;

    insert into cafe_visits (user_id, family_id, character_key, order_id, items, token_price)
    values (v_user_id, v_family_id, v_character, v_order_id, v_items, v_price)
    returning * into v_visit;
  end if;

  return jsonb_build_object(
    'success', true,
    'visitId', v_visit.id,
    'characterKey', v_visit.character_key,
    'items', v_visit.items,
    'tokenPrice', v_visit.token_price
  );
end;
$$;

-- Serve the whole order or nothing: the oldest shelved dishes of each recipe are sold,
-- and the character pays one award row per token.
create or replace function serve_cafe_visit(p_visit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_visit cafe_visits%rowtype;
  v_item record;
  v_ids uuid[];
  v_dish_ids uuid[] := '{}';
  v_missing jsonb := '[]'::jsonb;
  v_content_id uuid;
  v_balance jsonb;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select * into v_visit
  from cafe_visits
  where id = p_visit_id and user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'no_visit');
  end if;
  if v_visit.status <> 'open' then
    return jsonb_build_object('success', false, 'code', 'visit_closed');
  end if;

  for v_item in
    select * from jsonb_to_recordset(v_visit.items) as x("recipeId" uuid, quantity integer)
  loop
    select coalesce(array_agg(s.id), '{}') into v_ids
    from (
      select d.id
      from shop_cooked_dishes d
      where d.user_id = v_user_id
        and d.recipe_id = v_item."recipeId"
        and d.location = 'shelf'
      order by d.cooked_at, d.id
      limit v_item.quantity
      for update
    ) s;

    if cardinality(v_ids) < v_item.quantity then
      v_missing := v_missing || jsonb_build_object(
        'recipeId', v_item."recipeId",
        'missing', v_item.quantity - cardinality(v_ids)
      );
    else
      v_dish_ids := v_dish_ids || v_ids;
    end if;
  end loop;

  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object('success', false, 'code', 'not_on_shelf', 'missing', v_missing);
  end if;

  update shop_cooked_dishes
  set location = 'sold', sold_visit_id = v_visit.id
  where id = any(v_dish_ids);

  update cafe_visits set status = 'served', closed_at = now() where id = v_visit.id;

  for i in 1..v_visit.token_price loop
    -- Prefer content this child holds the fewest copies of, so a collection fills up.
    select c.id into v_content_id
    from shop_character_token_contents c
    where c.character_key = v_visit.character_key and c.is_active
    order by (
      select count(*) from paw_print_awards a where a.user_id = v_user_id and a.content_id = c.id
    ), random()
    limit 1;

    insert into paw_print_awards (
      user_id, family_id, giver, source, cafe_visit_id, visit_token_index, content_id
    ) values (
      v_user_id, v_family_id, v_visit.character_key, 'cafe_sale', v_visit.id, i, v_content_id
    );
  end loop;

  v_balance := paw_print_balance(v_user_id, v_visit.character_key);

  return jsonb_build_object(
    'success', true,
    'characterKey', v_visit.character_key,
    'tokensEarned', v_visit.token_price,
    'collected', v_balance -> 'collected',
    'available', v_balance -> 'available'
  );
end;
$$;

create or replace function dismiss_cafe_visit(p_visit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_role text;
  v_visit cafe_visits%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select * into v_visit
  from cafe_visits
  where id = p_visit_id and user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'no_visit');
  end if;
  if v_visit.status <> 'open' then
    return jsonb_build_object('success', false, 'code', 'visit_closed');
  end if;

  update cafe_visits set status = 'dismissed', closed_at = now() where id = v_visit.id;
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Admin: save an order and its items together
-- ---------------------------------------------------------------------------
create or replace function save_shop_character_order(
  p_order_id uuid,
  p_character_key text,
  p_token_price integer,
  p_is_active boolean,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := p_order_id;
  v_count integer;
  v_distinct integer;
begin
  if not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  if not exists (select 1 from shop_characters where character_key = p_character_key) then
    return jsonb_build_object('success', false, 'code', 'unknown_character');
  end if;
  if p_token_price is null or p_token_price not between 1 and 50 then
    return jsonb_build_object('success', false, 'code', 'invalid_price');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'code', 'invalid_items');
  end if;

  select count(*), count(distinct x."recipeId") into v_count, v_distinct
  from jsonb_to_recordset(p_items) as x("recipeId" uuid, quantity integer)
  join shop_recipes r on r.id = x."recipeId" and r.cook_method is not null
  where x.quantity between 1 and 9;

  if v_count <> jsonb_array_length(p_items) or v_distinct <> v_count then
    return jsonb_build_object('success', false, 'code', 'invalid_items');
  end if;

  if v_order_id is null then
    insert into shop_character_orders (character_key, token_price, is_active, display_order)
    values (
      p_character_key,
      p_token_price,
      coalesce(p_is_active, true),
      (select coalesce(max(display_order) + 1, 0) from shop_character_orders where character_key = p_character_key)
    )
    returning id into v_order_id;
  else
    update shop_character_orders
    set token_price = p_token_price, is_active = coalesce(p_is_active, true), updated_at = now()
    where id = v_order_id and character_key = p_character_key;
    if not found then
      return jsonb_build_object('success', false, 'code', 'unknown_order');
    end if;
    delete from shop_character_order_items where order_id = v_order_id;
  end if;

  insert into shop_character_order_items (order_id, recipe_id, quantity)
  select v_order_id, x."recipeId", x.quantity
  from jsonb_to_recordset(p_items) as x("recipeId" uuid, quantity integer);

  return jsonb_build_object('success', true, 'orderId', v_order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Wishlist RPCs
-- ---------------------------------------------------------------------------

-- A parent (or the platform admin) creates or edits a reward for their own family.
create or replace function save_wishlist_reward(
  p_reward_id uuid,
  p_title text,
  p_child_user_id uuid,
  p_is_repeatable boolean,
  p_is_active boolean,
  p_prices jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_reward_id uuid := p_reward_id;
  v_title text := btrim(coalesce(p_title, ''));
  v_count integer;
  v_distinct integer;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'parent' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  if char_length(v_title) not between 1 and 60 then
    return jsonb_build_object('success', false, 'code', 'invalid_title');
  end if;

  if p_child_user_id is not null and not exists (
    select 1 from users where id = p_child_user_id and family_id = v_family_id and role = 'child'
  ) then
    return jsonb_build_object('success', false, 'code', 'invalid_child');
  end if;

  if p_prices is null or jsonb_typeof(p_prices) <> 'array' or jsonb_array_length(p_prices) = 0 then
    return jsonb_build_object('success', false, 'code', 'invalid_price');
  end if;

  select count(*), count(distinct x."characterKey") into v_count, v_distinct
  from jsonb_to_recordset(p_prices) as x("characterKey" text, "tokenCount" integer)
  join shop_characters c on c.character_key = x."characterKey"
  where x."tokenCount" between 1 and 999;

  if v_count <> jsonb_array_length(p_prices) or v_distinct <> v_count then
    return jsonb_build_object('success', false, 'code', 'invalid_price');
  end if;

  if v_reward_id is null then
    insert into wishlist_rewards (family_id, user_id, title, is_repeatable, is_active, created_by_user_id)
    values (v_family_id, p_child_user_id, v_title, coalesce(p_is_repeatable, false), coalesce(p_is_active, true), v_user_id)
    returning id into v_reward_id;
  else
    update wishlist_rewards
    set title = v_title,
        user_id = p_child_user_id,
        is_repeatable = coalesce(p_is_repeatable, false),
        is_active = coalesce(p_is_active, true),
        updated_at = now()
    where id = v_reward_id and family_id = v_family_id;
    if not found then
      return jsonb_build_object('success', false, 'code', 'unknown_reward');
    end if;
    delete from wishlist_reward_prices where reward_id = v_reward_id;
  end if;

  insert into wishlist_reward_prices (reward_id, character_key, token_count)
  select v_reward_id, x."characterKey", x."tokenCount"
  from jsonb_to_recordset(p_prices) as x("characterKey" text, "tokenCount" integer);

  return jsonb_build_object('success', true, 'rewardId', v_reward_id);
end;
$$;

-- The child redeems with both signatures. The price always comes from the server.
create or replace function redeem_wishlist_reward(
  p_reward_id uuid,
  p_child_signature text,
  p_parent_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_reward wishlist_rewards%rowtype;
  v_child text := btrim(coalesce(p_child_signature, ''));
  v_parent text := btrim(coalesce(p_parent_signature, ''));
  v_price record;
  v_snapshot jsonb := '{}'::jsonb;
  v_available integer;
  v_missing jsonb := '[]'::jsonb;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  if char_length(v_child) not between 1 and 60 then
    return jsonb_build_object('success', false, 'code', 'invalid_child_signature');
  end if;
  if char_length(v_parent) not between 1 and 60 then
    return jsonb_build_object('success', false, 'code', 'invalid_parent_signature');
  end if;
  if lower(v_child) = lower(v_parent) then
    return jsonb_build_object('success', false, 'code', 'same_signature');
  end if;

  select * into v_reward
  from wishlist_rewards
  where id = p_reward_id
    and family_id = v_family_id
    and is_active
    and (user_id is null or user_id = v_user_id);

  if not found then
    return jsonb_build_object('success', false, 'code', 'unknown_reward');
  end if;

  -- Serialize per child + reward so a one-time reward can't be redeemed twice.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':wishlist:' || v_reward.id::text, 0));

  if not v_reward.is_repeatable and exists (
    select 1 from wishlist_redemptions where user_id = v_user_id and reward_id = v_reward.id
  ) then
    return jsonb_build_object('success', false, 'code', 'already_redeemed');
  end if;

  -- Take every character's spending lock in a fixed order (the same lock
  -- redeem_paw_print_reward uses), so concurrent spends can't overspend or deadlock.
  for v_price in
    select character_key, token_count
    from wishlist_reward_prices
    where reward_id = v_reward.id
    order by character_key
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':paw-prints:' || v_price.character_key, 0));

    v_available := (paw_print_balance(v_user_id, v_price.character_key) ->> 'available')::integer;
    if v_available < v_price.token_count then
      v_missing := v_missing || jsonb_build_object(
        'characterKey', v_price.character_key,
        'missing', v_price.token_count - v_available
      );
    end if;
    v_snapshot := v_snapshot || jsonb_build_object(v_price.character_key, v_price.token_count);
  end loop;

  if v_snapshot = '{}'::jsonb then
    return jsonb_build_object('success', false, 'code', 'unknown_reward');
  end if;
  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object('success', false, 'code', 'insufficient_tokens', 'missing', v_missing);
  end if;

  insert into wishlist_redemptions (
    user_id, family_id, reward_id, title, price_snapshot, child_signature, parent_signature
  ) values (
    v_user_id, v_family_id, v_reward.id, v_reward.title, v_snapshot, v_child, v_parent
  );

  return jsonb_build_object('success', true, 'title', v_reward.title);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Grants
-- ---------------------------------------------------------------------------
revoke execute on function get_cafe_visit() from public, anon;
revoke execute on function serve_cafe_visit(uuid) from public, anon;
revoke execute on function dismiss_cafe_visit(uuid) from public, anon;
revoke execute on function save_shop_character_order(uuid, text, integer, boolean, jsonb) from public, anon;
revoke execute on function save_wishlist_reward(uuid, text, uuid, boolean, boolean, jsonb) from public, anon;
revoke execute on function redeem_wishlist_reward(uuid, text, text) from public, anon;

grant execute on function get_cafe_visit() to authenticated;
grant execute on function serve_cafe_visit(uuid) to authenticated;
grant execute on function dismiss_cafe_visit(uuid) to authenticated;
grant execute on function save_shop_character_order(uuid, text, integer, boolean, jsonb) to authenticated;
grant execute on function save_wishlist_reward(uuid, text, uuid, boolean, boolean, jsonb) to authenticated;
grant execute on function redeem_wishlist_reward(uuid, text, text) to authenticated;
