alter table shop_ingredient_prices
add column if not exists icon_path text;

update shop_ingredient_prices
set icon_path = case ingredient_key
  when 'butter' then '/ingredients/butter_base.png'
  when 'egg' then '/ingredients/egg_base.png'
  when 'flour' then '/ingredients/flour_base.png'
  when 'milk' then '/ingredients/milk_base.png'
  when 'strawberry' then '/ingredients/strawberry_base.png'
  when 'sugar' then '/ingredients/sugar_base.png'
  when 'sugar-sprinkles' then '/ingredients/sugar-sprinkles_base.png'
  else icon_path
end
where ingredient_key in (
  'butter',
  'egg',
  'flour',
  'milk',
  'strawberry',
  'sugar',
  'sugar-sprinkles'
);
