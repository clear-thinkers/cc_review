-- Café orders can pin a variant (roadmap item U follow-up, authorized by the owner 2026-11-25).
-- Spec: docs/feature-specs/2026-11-21-cafe-visitors-character-tokens-wishlist.md (Follow-up:
-- variant-pinned order items).
--
-- Until now any variant of a recipe filled an order item (Café Rule 4), so a vegetarian
-- visitor (唐僧) ordering 红豆包 could be served a 小笼包 (bun + pork filling). An order item
-- can now name the exact special ingredients its dishes must have been cooked with:
--   null            -> any dish of that recipe (the old behaviour; every existing item)
--   []              -> plain: cooked with no special ingredient
--   ["red-bean"]    -> exactly that set (order of keys doesn't matter)
-- The match is exact, not the icon's subset match: a bun cooked with red bean AND pork is
-- not a 红豆包. An order still holds each recipe once (primary key unchanged).

alter table shop_character_order_items
  add column special_ingredient_keys jsonb
    check (special_ingredient_keys is null or jsonb_typeof(special_ingredient_keys) = 'array');

comment on column shop_character_order_items.special_ingredient_keys is
  'Null = any variant of the recipe. An array = the dish must have been cooked with exactly these special ingredient keys ([] = plain).';

-- A jsonb list of keys as a sorted, de-duplicated text array, so two lists compare as sets.
create or replace function cafe_ingredient_key_set(p_keys jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct key order by key), '{}')
  from jsonb_array_elements_text(
    case when jsonb_typeof(p_keys) = 'array' then p_keys else '[]'::jsonb end
  ) as k(key)
  where btrim(key) <> '';
$$;

-- Orders a visitor could place at all. Now also skips an order whose pinned variant uses a
-- special ingredient the recipe no longer offers, since no dish could ever fill it.
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
      where i.order_id = o.id
        and (
          not r.is_active
          or r.cook_method is null
          or not (
            cafe_ingredient_key_set(i.special_ingredient_keys) <@ array(
              select slot ->> 'ingredientKey'
              from jsonb_array_elements(coalesce(r.special_ingredient_slots, '[]'::jsonb)) slot
            )
          )
        )
    );
$$;

revoke execute on function cafe_candidate_orders() from public, anon, authenticated;

-- get_cafe_visit: unchanged except that each snapshotted item carries its pinned
-- specialIngredientKeys (left out when the item takes any variant).
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
        select jsonb_agg(
          jsonb_build_object('recipeId', i.recipe_id, 'quantity', i.quantity)
            || case
                 when i.special_ingredient_keys is null then '{}'::jsonb
                 else jsonb_build_object('specialIngredientKeys', to_jsonb(cafe_ingredient_key_set(i.special_ingredient_keys)))
               end
          order by i.recipe_id
        )
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

-- serve_cafe_visit: an item with specialIngredientKeys only takes shelf dishes cooked with
-- exactly those special ingredients. Items without the key (every visit opened before this
-- migration, and "any variant" items) behave as before.
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
    select * from jsonb_to_recordset(v_visit.items)
      as x("recipeId" uuid, quantity integer, "specialIngredientKeys" jsonb)
  loop
    select coalesce(array_agg(s.id), '{}') into v_ids
    from (
      select d.id
      from shop_cooked_dishes d
      where d.user_id = v_user_id
        and d.recipe_id = v_item."recipeId"
        and d.location = 'shelf'
        and (
          v_item."specialIngredientKeys" is null
          or cafe_ingredient_key_set(d.special_ingredient_keys) = cafe_ingredient_key_set(v_item."specialIngredientKeys")
        )
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

revoke execute on function serve_cafe_visit(uuid) from public, anon;
grant execute on function serve_cafe_visit(uuid) to authenticated;

-- save_shop_character_order: each item may carry specialIngredientKeys (absent or null = any
-- variant). Every key must be one of that recipe's own special ingredients; the list is
-- stored sorted and de-duplicated.
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
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) <> 'object'
      or (
        item ? 'specialIngredientKeys'
        and jsonb_typeof(item -> 'specialIngredientKeys') not in ('array', 'null')
      )
  ) then
    return jsonb_build_object('success', false, 'code', 'invalid_items');
  end if;

  select count(*), count(distinct x."recipeId") into v_count, v_distinct
  from jsonb_to_recordset(p_items) as x("recipeId" uuid, quantity integer, "specialIngredientKeys" jsonb)
  join shop_recipes r on r.id = x."recipeId" and r.cook_method is not null
  where x.quantity between 1 and 9
    and (
      x."specialIngredientKeys" is null
      or jsonb_typeof(x."specialIngredientKeys") = 'null'
      or cafe_ingredient_key_set(x."specialIngredientKeys") <@ array(
        select slot ->> 'ingredientKey'
        from jsonb_array_elements(coalesce(r.special_ingredient_slots, '[]'::jsonb)) slot
      )
    );

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

  insert into shop_character_order_items (order_id, recipe_id, quantity, special_ingredient_keys)
  select
    v_order_id,
    x."recipeId",
    x.quantity,
    case
      when x."specialIngredientKeys" is null or jsonb_typeof(x."specialIngredientKeys") = 'null' then null
      else to_jsonb(cafe_ingredient_key_set(x."specialIngredientKeys"))
    end
  from jsonb_to_recordset(p_items) as x("recipeId" uuid, quantity integer, "specialIngredientKeys" jsonb);

  return jsonb_build_object('success', true, 'orderId', v_order_id);
end;
$$;

revoke execute on function save_shop_character_order(uuid, text, integer, boolean, jsonb) from public, anon;
grant execute on function save_shop_character_order(uuid, text, integer, boolean, jsonb) to authenticated;
