-- Mystery food #2: Golden Mooncake (金箔流心月饼) + its four mystery ingredients.
-- Same shape as the Crystal Dumplings launch content in 20261024170000_mystery_foods.sql.
-- art: public/ingredients/<key>.png, public/rewards/golden-mooncake_plain.png
insert into shop_ingredient_prices (ingredient_key, cost_coins, label_i18n, icon_path, is_mystery)
values
  ('moonlit-lotus-paste',  0, '{"en":"Moonlit Lotus Paste","zh":"月光白莲蓉"}'::jsonb,  '/ingredients/moonlit-lotus-paste.png',  true),
  ('gilded-salted-yolk',   0, '{"en":"Gilded Salted Yolk","zh":"金沙流心蛋黄"}'::jsonb, '/ingredients/gilded-salted-yolk.png',   true),
  ('frosted-pastry-flour', 0, '{"en":"Frosted Pastry Flour","zh":"雪花糕粉"}'::jsonb,   '/ingredients/frosted-pastry-flour.png', true),
  ('osmanthus-honey',      0, '{"en":"Osmanthus Honey","zh":"金桂蜜露"}'::jsonb,        '/ingredients/osmanthus-honey.png',      true)
on conflict (ingredient_key) do nothing;

insert into shop_recipes (
  slug, title, title_i18n, display_order, is_active,
  intro, intro_i18n, unlock_cost_coins,
  base_ingredients, base_ingredients_i18n,
  special_ingredient_slots, special_ingredient_slots_i18n,
  variant_icon_rules, cook_method, food_type,
  is_mystery, teaser_i18n
)
values (
  'golden-mooncake',
  'Golden Mooncake',
  '{"en":"Golden Mooncake","zh":"金箔流心月饼"}'::jsonb,
  15,
  true,
  'Baked with moonlight and spun gold! Slice it open to reveal a warm, glowing stream of sweet golden custard.',
  '{"en":"Baked with moonlight and spun gold! Slice it open to reveal a warm, glowing stream of sweet golden custard.","zh":"揉进明月与金光的御膳点心！轻轻切开，就会流出暖融融的金沙奶黄。"}'::jsonb,
  0,
  '[{"ingredientKey":"moonlit-lotus-paste","name":"Moonlit Lotus Paste","quantity":2},{"ingredientKey":"gilded-salted-yolk","name":"Gilded Salted Yolk","quantity":2},{"ingredientKey":"frosted-pastry-flour","name":"Frosted Pastry Flour","quantity":1},{"ingredientKey":"osmanthus-honey","name":"Osmanthus Honey","quantity":1}]'::jsonb,
  '{"en":[{"ingredientKey":"moonlit-lotus-paste","name":"Moonlit Lotus Paste","quantity":2},{"ingredientKey":"gilded-salted-yolk","name":"Gilded Salted Yolk","quantity":2},{"ingredientKey":"frosted-pastry-flour","name":"Frosted Pastry Flour","quantity":1},{"ingredientKey":"osmanthus-honey","name":"Osmanthus Honey","quantity":1}],"zh":[{"ingredientKey":"moonlit-lotus-paste","name":"月光白莲蓉","quantity":2},{"ingredientKey":"gilded-salted-yolk","name":"金沙流心蛋黄","quantity":2},{"ingredientKey":"frosted-pastry-flour","name":"雪花糕粉","quantity":1},{"ingredientKey":"osmanthus-honey","name":"金桂蜜露","quantity":1}]}'::jsonb,
  '[]'::jsonb,
  '{"en":[],"zh":[]}'::jsonb,
  '[{"match":[],"iconPath":"/rewards/golden-mooncake_plain.png"}]'::jsonb,
  'oven',
  'desserts',
  true,
  '{"en":"A round festival pastry hides a flowing golden sun inside.","zh":"圆圆的节日点心里，藏着一颗流光溢彩的金色小太阳。"}'::jsonb
);
