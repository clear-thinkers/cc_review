create table if not exists shop_ingredient_prices (
  ingredient_key text primary key,
  cost_coins integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_ingredient_prices_cost_nonnegative check (cost_coins >= 0)
);

alter table shop_ingredient_prices enable row level security;

create policy "shop_ingredient_prices: authenticated read"
on shop_ingredient_prices for select
using (
  is_platform_admin()
  or current_user_id() is not null
);

create policy "shop_ingredient_prices: platform admin insert"
on shop_ingredient_prices for insert
with check (is_platform_admin());

create policy "shop_ingredient_prices: platform admin update"
on shop_ingredient_prices for update
using (is_platform_admin());

create policy "shop_ingredient_prices: platform admin delete"
on shop_ingredient_prices for delete
using (is_platform_admin());

insert into shop_ingredient_prices (ingredient_key, cost_coins)
values
  ('black-tea', 3),
  ('bamboo-leaves', 2),
  ('broth', 3),
  ('butter', 5),
  ('cooked-rice', 2),
  ('egg', 3),
  ('flour', 3),
  ('glutinous-rice-flour', 4),
  ('ice-cream', 4),
  ('milk', 4),
  ('noodles', 4),
  ('red-bean-filling', 5),
  ('salt', 1),
  ('seaweed', 2),
  ('sesame-filling', 5),
  ('sticky-rice', 3),
  ('strawberry', 6),
  ('sugar', 2),
  ('sugar-sprinkles', 4),
  ('tapioca-pearls', 5),
  ('warm-water', 1),
  ('water', 1),
  ('yeast', 2)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  updated_at = now();

create or replace function backfill_shop_ingredient_key_v2(p_name text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_name, '')))
    when 'milk' then 'milk'
    when 'flour' then 'flour'
    when 'sugar' then 'sugar'
    when 'butter' then 'butter'
    when 'egg' then 'egg'
    when 'eggs' then 'egg'
    when 'strawberry' then 'strawberry'
    when 'black tea' then 'black-tea'
    when 'tea' then 'black-tea'
    when 'tapioca pearls' then 'tapioca-pearls'
    when 'yeast' then 'yeast'
    when 'warm water' then 'warm-water'
    when 'ice cream' then 'ice-cream'
    when 'noodles' then 'noodles'
    when 'broth' then 'broth'
    when 'cooked rice' then 'cooked-rice'
    when 'seaweed' then 'seaweed'
    when 'salt' then 'salt'
    when 'glutinous rice flour' then 'glutinous-rice-flour'
    when 'water' then 'water'
    when 'sesame filling' then 'sesame-filling'
    when 'sticky rice' then 'sticky-rice'
    when 'bamboo leaves' then 'bamboo-leaves'
    when 'red bean filling' then 'red-bean-filling'
    else null
  end
$$;

update shop_recipes as recipe
set
  base_ingredients = coalesce((
    select jsonb_agg(
      case
        when mapped.ingredient_key is not null
          then (mapped.ingredient - 'costCoins') || jsonb_build_object('ingredientKey', mapped.ingredient_key)
        else (mapped.ingredient - 'ingredientKey' - 'costCoins')
      end
      order by mapped.ordinality
    )
    from (
      select
        ingredient,
        ordinality,
        coalesce(
          nullif(ingredient->>'ingredientKey', ''),
          backfill_shop_ingredient_key_v2(ingredient->>'name')
        ) as ingredient_key
      from jsonb_array_elements(recipe.base_ingredients) with ordinality as rows(ingredient, ordinality)
    ) as mapped
  ), '[]'::jsonb),
  base_ingredients_i18n = jsonb_build_object(
    'en',
    coalesce((
      select jsonb_agg(
        case
          when mapped.ingredient_key is not null
            then (mapped.ingredient - 'costCoins') || jsonb_build_object('ingredientKey', mapped.ingredient_key)
          else (mapped.ingredient - 'ingredientKey' - 'costCoins')
        end
        order by mapped.ordinality
      )
      from (
        select
          ingredient,
          ordinality,
          coalesce(
            nullif(ingredient->>'ingredientKey', ''),
            backfill_shop_ingredient_key_v2(ingredient->>'name')
          ) as ingredient_key
        from jsonb_array_elements(recipe.base_ingredients_i18n->'en') with ordinality as rows(ingredient, ordinality)
      ) as mapped
    ), '[]'::jsonb),
    'zh',
    coalesce((
      select jsonb_agg(
        case
          when en_mapped.ingredient_key is not null
            then (zh_rows.ingredient - 'costCoins') || jsonb_build_object('ingredientKey', en_mapped.ingredient_key)
          else (zh_rows.ingredient - 'ingredientKey' - 'costCoins')
        end
        order by zh_rows.ordinality
      )
      from jsonb_array_elements(recipe.base_ingredients_i18n->'zh') with ordinality as zh_rows(ingredient, ordinality)
      left join (
        select
          ordinality,
          coalesce(
            nullif(ingredient->>'ingredientKey', ''),
            backfill_shop_ingredient_key_v2(ingredient->>'name')
          ) as ingredient_key
        from jsonb_array_elements(recipe.base_ingredients_i18n->'en') with ordinality as rows(ingredient, ordinality)
      ) as en_mapped
        on en_mapped.ordinality = zh_rows.ordinality
    ), '[]'::jsonb)
  ),
  updated_at = now();

drop function backfill_shop_ingredient_key_v2(text);
