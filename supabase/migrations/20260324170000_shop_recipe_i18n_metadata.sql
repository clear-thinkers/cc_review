alter table shop_recipes
add column if not exists title_i18n jsonb not null default '{"en":"","zh":""}'::jsonb,
add column if not exists intro_i18n jsonb not null default '{"en":"","zh":""}'::jsonb,
add column if not exists base_ingredients_i18n jsonb not null default '{"en":[],"zh":[]}'::jsonb,
add column if not exists special_ingredient_slots_i18n jsonb not null default '{"en":[],"zh":[]}'::jsonb;

update shop_recipes
set
  title_i18n = jsonb_build_object(
    'en',
    coalesce(nullif(title_i18n->>'en', ''), title),
    'zh',
    coalesce(nullif(title_i18n->>'zh', ''), nullif(title_i18n->>'en', ''), title)
  ),
  intro_i18n = jsonb_build_object(
    'en',
    coalesce(nullif(intro_i18n->>'en', ''), intro),
    'zh',
    coalesce(nullif(intro_i18n->>'zh', ''), nullif(intro_i18n->>'en', ''), intro)
  ),
  base_ingredients_i18n = jsonb_build_object(
    'en',
    case
      when jsonb_typeof(base_ingredients_i18n->'en') = 'array'
        and jsonb_array_length(base_ingredients_i18n->'en') > 0
      then base_ingredients_i18n->'en'
      else base_ingredients
    end,
    'zh',
    case
      when jsonb_typeof(base_ingredients_i18n->'zh') = 'array'
        and jsonb_array_length(base_ingredients_i18n->'zh') > 0
      then base_ingredients_i18n->'zh'
      when jsonb_typeof(base_ingredients_i18n->'en') = 'array'
        and jsonb_array_length(base_ingredients_i18n->'en') > 0
      then base_ingredients_i18n->'en'
      else base_ingredients
    end
  ),
  special_ingredient_slots_i18n = jsonb_build_object(
    'en',
    case
      when jsonb_typeof(special_ingredient_slots_i18n->'en') = 'array'
        and jsonb_array_length(special_ingredient_slots_i18n->'en') > 0
      then special_ingredient_slots_i18n->'en'
      else special_ingredient_slots
    end,
    'zh',
    case
      when jsonb_typeof(special_ingredient_slots_i18n->'zh') = 'array'
        and jsonb_array_length(special_ingredient_slots_i18n->'zh') > 0
      then special_ingredient_slots_i18n->'zh'
      when jsonb_typeof(special_ingredient_slots_i18n->'en') = 'array'
        and jsonb_array_length(special_ingredient_slots_i18n->'en') > 0
      then special_ingredient_slots_i18n->'en'
      else special_ingredient_slots
    end
  ),
  updated_at = now();
