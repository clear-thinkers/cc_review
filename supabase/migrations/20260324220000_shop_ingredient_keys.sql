create or replace function backfill_shop_ingredient_key(p_name text)
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
    else null
  end
$$;

update shop_recipes as recipe
set
  base_ingredients = coalesce((
    select jsonb_agg(
      case
        when mapped.ingredient_key is not null
          then mapped.ingredient || jsonb_build_object('ingredientKey', mapped.ingredient_key)
        else mapped.ingredient
      end
      order by mapped.ordinality
    )
    from (
      select
        ingredient,
        ordinality,
        coalesce(
          nullif(ingredient->>'ingredientKey', ''),
          backfill_shop_ingredient_key(ingredient->>'name')
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
            then mapped.ingredient || jsonb_build_object('ingredientKey', mapped.ingredient_key)
          else mapped.ingredient
        end
        order by mapped.ordinality
      )
      from (
        select
          ingredient,
          ordinality,
          coalesce(
            nullif(ingredient->>'ingredientKey', ''),
            backfill_shop_ingredient_key(ingredient->>'name')
          ) as ingredient_key
        from jsonb_array_elements(recipe.base_ingredients_i18n->'en') with ordinality as rows(ingredient, ordinality)
      ) as mapped
    ), '[]'::jsonb),
    'zh',
    coalesce((
      select jsonb_agg(
        case
          when en_mapped.ingredient_key is not null
            then zh_rows.ingredient || jsonb_build_object('ingredientKey', en_mapped.ingredient_key)
          else zh_rows.ingredient
        end
        order by zh_rows.ordinality
      )
      from jsonb_array_elements(recipe.base_ingredients_i18n->'zh') with ordinality as zh_rows(ingredient, ordinality)
      left join (
        select
          ordinality,
          coalesce(
            nullif(ingredient->>'ingredientKey', ''),
            backfill_shop_ingredient_key(ingredient->>'name')
          ) as ingredient_key
        from jsonb_array_elements(recipe.base_ingredients_i18n->'en') with ordinality as rows(ingredient, ordinality)
      ) as en_mapped
        on en_mapped.ordinality = zh_rows.ordinality
    ), '[]'::jsonb)
  ),
  updated_at = now();

drop function backfill_shop_ingredient_key(text);
