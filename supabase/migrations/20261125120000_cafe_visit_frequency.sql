-- Café visit frequency (roadmap item U follow-up, authorized by the owner 2026-11-25).
-- Spec: docs/feature-specs/2026-11-21-cafe-visitors-character-tokens-wishlist.md
--
-- Each character can be limited, per child, to x visits a day / week / month, or to one
-- visit on each of x random days a month. A visit counts the moment the visitor walks in,
-- whether it is then served or sent away ("Not now"), and once the limit is reached the
-- character doesn't come back until the next period (owner decisions 2026-11-25).
--
-- Days, weeks (Monday first) and months use the child's device time zone, passed by the
-- app and checked against pg_timezone_names; anything unknown falls back to UTC.

alter table shop_characters
  add column visit_frequency text not null default 'unlimited'
    check (visit_frequency in ('unlimited', 'daily', 'weekly', 'monthly', 'random_days')),
  add column visit_limit integer check (visit_limit between 1 and 100),
  add constraint shop_characters_visit_frequency_limit_check check (
    (visit_frequency = 'unlimited' and visit_limit is null)
    or (visit_frequency in ('daily', 'weekly', 'monthly') and visit_limit is not null)
    or (visit_frequency = 'random_days' and visit_limit between 1 and 31)
  );

-- The random days a character visits one child in one month: a stable pick (the same on
-- every call), so refreshing never moves them. Asking for more days than the month has
-- gives every day.
create or replace function cafe_random_visit_days(
  p_user_id uuid,
  p_character_key text,
  p_month date,
  p_count integer
)
returns integer[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(d order by d), '{}')
  from (
    select d
    from generate_series(
      1,
      extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::integer
    ) as d
    order by md5(p_user_id::text || ':' || p_character_key || ':' || to_char(p_month, 'YYYY-MM') || ':' || d)
    limit greatest(p_count, 0)
  ) picked;
$$;

revoke execute on function cafe_random_visit_days(uuid, text, date, integer) from public, anon, authenticated;

-- Whether this character may visit this child now, given how often they've come.
create or replace function cafe_character_can_visit(
  p_user_id uuid,
  p_character_key text,
  p_frequency text,
  p_limit integer,
  p_time_zone text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now timestamp := now() at time zone p_time_zone;
  v_period_start timestamp;
  v_period_end timestamp;
  v_count integer;
begin
  if p_frequency = 'unlimited' or p_limit is null then
    return true;
  end if;

  if p_frequency = 'random_days' then
    if not (extract(day from v_now)::integer = any(
      cafe_random_visit_days(p_user_id, p_character_key, v_now::date, p_limit)
    )) then
      return false;
    end if;
    v_period_start := date_trunc('day', v_now);
    v_period_end := v_period_start + interval '1 day';
    p_limit := 1; -- one visit on each chosen day (owner, 2026-11-25)
  elsif p_frequency = 'daily' then
    v_period_start := date_trunc('day', v_now);
    v_period_end := v_period_start + interval '1 day';
  elsif p_frequency = 'weekly' then
    v_period_start := date_trunc('week', v_now); -- ISO weeks start on Monday
    v_period_end := v_period_start + interval '1 week';
  else
    v_period_start := date_trunc('month', v_now);
    v_period_end := v_period_start + interval '1 month';
  end if;

  select count(*) into v_count
  from cafe_visits
  where user_id = p_user_id
    and character_key = p_character_key
    and (created_at at time zone p_time_zone) >= v_period_start
    and (created_at at time zone p_time_zone) < v_period_end;

  return v_count < p_limit;
end;
$$;

revoke execute on function cafe_character_can_visit(uuid, text, text, integer, text) from public, anon, authenticated;

-- Orders a visitor could place at all, ignoring how often they've come: active order and
-- character, a character who visits the Café, at least one item, every dish cookable.
create or replace function cafe_candidate_orders()
returns table (order_id uuid, character_key text, token_price integer, visit_frequency text, visit_limit integer)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.character_key, o.token_price, c.visit_frequency, c.visit_limit
  from shop_character_orders o
  join shop_characters c on c.character_key = o.character_key
  where o.is_active
    and c.is_active
    and c.visits_cafe
    and exists (select 1 from shop_character_order_items i where i.order_id = o.id)
    and not exists (
      select 1
      from shop_character_order_items i
      join shop_recipes r on r.id = i.recipe_id
      where i.order_id = o.id and (not r.is_active or r.cook_method is null)
    );
$$;

revoke execute on function cafe_candidate_orders() from public, anon, authenticated;

-- get_cafe_visit gains the device time zone. The old no-argument version is dropped so the
-- RPC name stays unambiguous.
drop function if exists get_cafe_visit();

create or replace function get_cafe_visit(p_time_zone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_tz text := 'UTC';
  v_visit cafe_visits%rowtype;
  v_last_order uuid;
  v_order_id uuid;
  v_character text;
  v_price integer;
  v_items jsonb;
  v_any_order boolean;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  if p_time_zone is not null and exists (select 1 from pg_timezone_names where name = p_time_zone) then
    v_tz := p_time_zone;
  end if;

  -- Serialize per child so two devices can't both open a visit.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':cafe-visit', 0));

  -- A visitor already at the counter stays (and was already counted when they arrived).
  select * into v_visit from cafe_visits where user_id = v_user_id and status = 'open';

  if not found then
    select order_id into v_last_order
    from cafe_visits
    where user_id = v_user_id
    order by created_at desc
    limit 1;

    select exists (select 1 from cafe_candidate_orders()) into v_any_order;

    select co.order_id, co.character_key, co.token_price,
      (
        select jsonb_agg(jsonb_build_object('recipeId', i.recipe_id, 'quantity', i.quantity) order by i.recipe_id)
        from shop_character_order_items i
        where i.order_id = co.order_id
      )
    into v_order_id, v_character, v_price, v_items
    from cafe_candidate_orders() co
    where cafe_character_can_visit(v_user_id, co.character_key, co.visit_frequency, co.visit_limit, v_tz)
    order by
      exists (
        select 1 from shop_character_order_items i
        where i.order_id = co.order_id
          and not exists (
            select 1 from shop_recipe_unlocks u where u.user_id = v_user_id and u.recipe_id = i.recipe_id
          )
      ),
      (co.order_id is not distinct from v_last_order),
      random()
    limit 1;

    if v_order_id is null then
      -- Characters exist but have all used up their visits for now.
      return jsonb_build_object('success', false, 'code', case when v_any_order then 'no_visitors_today' else 'no_visitors' end);
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

revoke execute on function get_cafe_visit(text) from public, anon;
grant execute on function get_cafe_visit(text) to authenticated;
