-- Exported from PRODUCTION shop content
-- Generated at 2026-03-26T18:51:15.361Z
-- Review before applying to another environment.

begin;

-- shop_ingredient_prices
insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'bamboo-leaves',
  5,
  '{"en":"Bamboo Leaves","zh":"粽叶"}'::jsonb,
  '/ingredients/bamboo-leaves_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'brown-sugar',
  3,
  '{"en":"Brown Sugar","zh":"黑糖"}'::jsonb,
  '/ingredients/brown-sugar.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'butter',
  5,
  '{"en":"Butter","zh":"黄油"}'::jsonb,
  '/ingredients/butter_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'chocolate',
  5,
  '{"en":"Chocolate","zh":"巧克力"}'::jsonb,
  '/ingredients/chocolate.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'cinnamon',
  3,
  '{"en":"Cinnamon","zh":"肉桂粉"}'::jsonb,
  '/ingredients/cinnamon.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'cooked-rice',
  3,
  '{"en":"Steam Rice","zh":"米饭"}'::jsonb,
  '/ingredients/rice_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'egg',
  4,
  '{"en":"Egg","zh":"鸡蛋"}'::jsonb,
  '/ingredients/egg_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'flour',
  2,
  '{"en":"Flour","zh":"面粉"}'::jsonb,
  '/ingredients/flour_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'ice-cream',
  3,
  '{"en":"Ice Cream","zh":"冰淇淋"}'::jsonb,
  '/ingredients/vanilla-ice-cream_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'jasmine',
  5,
  '{"en":"Jasmine tea leaves","zh":"茉莉花茶叶"}'::jsonb,
  '/ingredients/jasmine.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'matcha',
  5,
  '{"en":"Matcha","zh":"抹茶粉"}'::jsonb,
  '/ingredients/matcha.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'milk',
  3,
  '{"en":"Milk","zh":"牛奶"}'::jsonb,
  '/ingredients/milk_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'noodles',
  4,
  '{"en":"Noodles","zh":"面条"}'::jsonb,
  '/ingredients/noodles_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'pork-filling',
  7,
  '{"en":"Fresh ground pork","zh":"新鲜猪肉馅"}'::jsonb,
  '/ingredients/ground-pork.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'red-bean',
  2,
  '{"en":"Red Bean","zh":"红豆"}'::jsonb,
  '/ingredients/red-bean.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'salt',
  2,
  '{"en":"Salt","zh":"盐"}'::jsonb,
  '/ingredients/salt_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'seaweed',
  2,
  '{"en":"Seaweed","zh":"海苔"}'::jsonb,
  '/ingredients/seaweed_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'shrimp',
  5,
  '{"en":"Shrimp","zh":"虾"}'::jsonb,
  '/ingredients/shrimp.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'sticky-rice',
  3,
  '{"en":"Sticky Rice","zh":"糯米"}'::jsonb,
  '/ingredients/sticky-rice_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'strawberry',
  6,
  '{"en":"Strawberry","zh":"草莓"}'::jsonb,
  '/ingredients/strawberry_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'sugar',
  2,
  '{"en":"Sugar","zh":"糖"}'::jsonb,
  '/ingredients/sugar_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'sugar-sprinkles',
  2,
  '{"en":"Sugar Sprinkles","zh":"糖粉"}'::jsonb,
  '/ingredients/sugar-sprinkles_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'tapioca-pearls',
  4,
  '{"en":"Tapioca Pearls","zh":"珍珠"}'::jsonb,
  '/ingredients/tapioca-pearls_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'taro',
  2,
  '{"en":"Taro","zh":"香芋泥"}'::jsonb,
  '/ingredients/taro.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'vanilla',
  4,
  '{"en":"Vanilla","zh":"香草"}'::jsonb,
  '/ingredients/vanilla-extract.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'yeast',
  2,
  '{"en":"Yeast","zh":"酵母"}'::jsonb,
  '/ingredients/yeast_base.png'
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();
-- shop_recipes
update shop_recipes
set
  title = 'Bubble Tea',
  title_i18n = '{"en":"Bubble Tea","zh":"珍珠奶茶"}'::jsonb,
  intro = 'A sweet milk tea with chewy pearls that can change mood with special toppings.',
  intro_i18n = '{"en":"A sweet milk tea with chewy pearls that can change mood with special toppings.","zh":"一杯香甜顺滑的奶茶，里面有Q弹的珍珠。每一口都充满乐趣和小惊喜。"}'::jsonb,
  display_order = 1,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Milk","quantity":1,"ingredientKey":"milk"},{"name":"Tapioca Pearls","quantity":1,"ingredientKey":"tapioca-pearls"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Milk","quantity":1,"ingredientKey":"milk"},{"name":"Tapioca Pearls","quantity":1,"ingredientKey":"tapioca-pearls"}],"zh":[{"name":"牛奶","quantity":1,"ingredientKey":"milk"},{"name":"珍珠","quantity":1,"ingredientKey":"tapioca-pearls"}]}'::jsonb,
  special_ingredient_slots = '[{"name":"Brown Sugar","quantity":1,"ingredientKey":"brown-sugar"},{"name":"Jasmine tea leaves","quantity":1,"ingredientKey":"jasmine"},{"name":"Matcha","quantity":1,"ingredientKey":"matcha"},{"name":"Taro","quantity":1,"ingredientKey":"taro"}]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[{"name":"Brown Sugar","quantity":1,"ingredientKey":"brown-sugar"},{"name":"Jasmine tea leaves","quantity":1,"ingredientKey":"jasmine"},{"name":"Matcha","quantity":1,"ingredientKey":"matcha"},{"name":"Taro","quantity":1,"ingredientKey":"taro"}],"zh":[{"name":"黑糖","quantity":1,"ingredientKey":"brown-sugar"},{"name":"茉莉花茶","quantity":1,"ingredientKey":"jasmine"},{"name":"抹茶粉","quantity":1,"ingredientKey":"matcha"},{"name":"香芋泥","quantity":1,"ingredientKey":"taro"}]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/bubble-tea_plain.png"},{"match":["brown-sugar"],"iconPath":"/rewards/bubble-tea_brown-sugar_wink.png"},{"match":["jasmine"],"iconPath":"/rewards/bubble-tea_jasmine_excited.png"},{"match":["matcha"],"iconPath":"/rewards/bubble-tea_matcha_sleep.png"},{"match":["taro"],"iconPath":"/rewards/bubble-tea_taro_ambitious.png"}]'::jsonb,
  updated_at = now()
where slug = 'bubble_tea';

update shop_recipes
set
  title = 'Bun',
  title_i18n = '{"en":"Bun","zh":"包子"}'::jsonb,
  intro = 'A plain steamed bun, soft and fluffy.
It may look simple, but it can grow into many tasty surprises!',
  intro_i18n = '{"en":"A plain steamed bun, soft and fluffy.\nIt may look simple, but it can grow into many tasty surprises!","zh":"一个软软的白包子，看起来简单。\n但它可以变成各种美味的小惊喜！"}'::jsonb,
  display_order = 2,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Flour","quantity":2,"ingredientKey":"flour"},{"name":"Yeast","quantity":1,"ingredientKey":"yeast"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Flour","quantity":2,"ingredientKey":"flour"},{"name":"Yeast","quantity":1,"ingredientKey":"yeast"}],"zh":[{"name":"面粉","quantity":2,"ingredientKey":"flour"},{"name":"酵母","quantity":1,"ingredientKey":"yeast"}]}'::jsonb,
  special_ingredient_slots = '[{"name":"Red Bean","quantity":1,"ingredientKey":"red-bean"},{"name":"Fresh ground pork","quantity":1,"ingredientKey":"pork-filling"}]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[{"name":"Red Bean","quantity":1,"ingredientKey":"red-bean"},{"name":"Fresh ground pork","quantity":1,"ingredientKey":"pork-filling"}],"zh":[{"name":"红豆","quantity":1,"ingredientKey":"red-bean"},{"name":"新鲜猪肉馅","quantity":1,"ingredientKey":"pork-filling"}]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/bun_plain.png"},{"match":["red-bean"],"iconPath":"/rewards/bun_red-bean_wink.png"},{"match":["pork-filling"],"iconPath":"/rewards/bun_pork_excited.png"}]'::jsonb,
  updated_at = now()
where slug = 'bun';

update shop_recipes
set
  title = 'Cake',
  title_i18n = '{"en":"Cake","zh":"小蛋糕"}'::jsonb,
  intro = 'A soft and creamy cheesecake.
Sweet, gentle, and perfect for a cozy moment.',
  intro_i18n = '{"en":"A soft and creamy cheesecake.\nSweet, gentle, and perfect for a cozy moment.","zh":"一个奶香浓郁的芝士小蛋糕，口感软软的。\n每一口都让人放松又幸福，还有一点点小魔法。"}'::jsonb,
  display_order = 3,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Flour","quantity":2,"ingredientKey":"flour"},{"name":"Egg","quantity":2,"ingredientKey":"egg"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"},{"name":"Butter","quantity":1,"ingredientKey":"butter"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Flour","quantity":2,"ingredientKey":"flour"},{"name":"Egg","quantity":2,"ingredientKey":"egg"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"},{"name":"Butter","quantity":1,"ingredientKey":"butter"}],"zh":[{"name":"面粉","quantity":2,"ingredientKey":"flour"},{"name":"鸡蛋","quantity":2,"ingredientKey":"egg"},{"name":"糖","quantity":1,"ingredientKey":"sugar"},{"name":"黄油","quantity":1,"ingredientKey":"butter"}]}'::jsonb,
  special_ingredient_slots = '[{"name":"Strawberry","quantity":1,"ingredientKey":"strawberry"}]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[{"name":"Strawberry","quantity":1,"ingredientKey":"strawberry"}],"zh":[{"name":"草莓","quantity":1,"ingredientKey":"strawberry"}]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/cake_plain.png"},{"match":["strawberry"],"iconPath":"/rewards/cake_strawberry_sleep.png"}]'::jsonb,
  updated_at = now()
where slug = 'cake';

update shop_recipes
set
  title = 'Donut',
  title_i18n = '{"en":"Donut","zh":"甜甜圈"}'::jsonb,
  intro = 'A ring donut with toppings that can swing from sleepy to super ambitious.',
  intro_i18n = '{"en":"A ring donut with toppings that can swing from sleepy to super ambitious.","zh":"一个软软香香的圆环甜甜圈，上面可以搭配不同的配料。有时候它懒洋洋地打瞌睡，有时候又充满干劲，随时准备带来甜甜的能量。"}'::jsonb,
  display_order = 4,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Flour","quantity":2,"ingredientKey":"flour"},{"name":"Milk","quantity":1,"ingredientKey":"milk"},{"name":"Egg","quantity":1,"ingredientKey":"egg"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Flour","quantity":2,"ingredientKey":"flour"},{"name":"Milk","quantity":1,"ingredientKey":"milk"},{"name":"Egg","quantity":1,"ingredientKey":"egg"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"}],"zh":[{"name":"面粉","quantity":2,"ingredientKey":"flour"},{"name":"牛奶","quantity":1,"ingredientKey":"milk"},{"name":"鸡蛋","quantity":1,"ingredientKey":"egg"},{"name":"糖","quantity":1,"ingredientKey":"sugar"}]}'::jsonb,
  special_ingredient_slots = '[{"name":"Chocolate","quantity":1,"ingredientKey":"chocolate"},{"name":"Strawberry","quantity":1,"ingredientKey":"strawberry"},{"name":"Cinnamon","quantity":1,"ingredientKey":"cinnamon"},{"name":"Vanilla","quantity":1,"ingredientKey":"vanilla"},{"name":"Sugar Sprinkles","quantity":1,"ingredientKey":"sugar-sprinkles"}]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[{"name":"Chocolate","quantity":1,"ingredientKey":"chocolate"},{"name":"Strawberry","quantity":1,"ingredientKey":"strawberry"},{"name":"Cinnamon","quantity":1,"ingredientKey":"cinnamon"},{"name":"Vanilla","quantity":1,"ingredientKey":"vanilla"},{"name":"Sugar Sprinkles","quantity":1,"ingredientKey":"sugar-sprinkles"}],"zh":[{"name":"巧克力","quantity":1,"ingredientKey":"chocolate"},{"name":"草莓","quantity":1,"ingredientKey":"strawberry"},{"name":"肉桂粉","quantity":1,"ingredientKey":"cinnamon"},{"name":"香草","quantity":1,"ingredientKey":"vanilla"},{"name":"糖粉","quantity":1,"ingredientKey":"sugar-sprinkles"}]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/donut_plain.png"},{"match":["strawberry"],"iconPath":"/rewards/donut_strawberry_ambitious.png"},{"match":["chocolate","sugar-sprinkles"],"iconPath":"/rewards/donut_chocolate+sprinkles_sleep.png"},{"match":["cinnamon"],"iconPath":"/rewards/donut_cinnamon_happy.png"},{"match":["strawberry","sugar-sprinkles"],"iconPath":"/rewards/donut_strawberry+sprinkles_excited.png"},{"match":["chocolate","vanilla"],"iconPath":"/rewards/donut_vanilla+chocolate_wink.png"}]'::jsonb,
  updated_at = now()
where slug = 'donut';

update shop_recipes
set
  title = 'Milkshake',
  title_i18n = '{"en":"Milkshake","zh":"奶昔"}'::jsonb,
  intro = 'A smooth and creamy vanilla milkshake.
Cool, sweet, and perfect for a refreshing treat.',
  intro_i18n = '{"en":"A smooth and creamy vanilla milkshake.\nCool, sweet, and perfect for a refreshing treat.","zh":"一杯顺滑香甜的香草奶昔。\n清凉又美味，让人感到轻松又愉快。"}'::jsonb,
  display_order = 5,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Milk","quantity":1,"ingredientKey":"milk"},{"name":"Ice Cream","quantity":1,"ingredientKey":"ice-cream"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Milk","quantity":1,"ingredientKey":"milk"},{"name":"Ice Cream","quantity":1,"ingredientKey":"ice-cream"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"}],"zh":[{"name":"牛奶","quantity":1,"ingredientKey":"milk"},{"name":"冰淇淋","quantity":1,"ingredientKey":"ice-cream"},{"name":"糖","quantity":1,"ingredientKey":"sugar"}]}'::jsonb,
  special_ingredient_slots = '[{"name":"Strawberry","quantity":1,"ingredientKey":"strawberry"}]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[{"name":"Strawberry","quantity":1,"ingredientKey":"strawberry"}],"zh":[{"name":"草莓","quantity":1,"ingredientKey":"strawberry"}]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/milkshake_plain.png"},{"match":["strawberry"],"iconPath":"/rewards/milkshake_strawberry_sleep.png"}]'::jsonb,
  updated_at = now()
where slug = 'milkshake';

update shop_recipes
set
  title = 'Ramen',
  title_i18n = '{"en":"Ramen","zh":"拉面"}'::jsonb,
  intro = 'A warm bowl of ramen with soft noodles, egg, and seaweed.
It’s rich, cozy, and perfect for recharging your energy.',
  intro_i18n = '{"en":"A warm bowl of ramen with soft noodles, egg, and seaweed.\nIt’s rich, cozy, and perfect for recharging your energy.","zh":"一碗热腾腾的日式拉面，配有鸡蛋和海苔。\n汤香面软，让人感到温暖又充满能量。"}'::jsonb,
  display_order = 6,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Noodles","quantity":1,"ingredientKey":"noodles"},{"name":"Egg","quantity":1,"ingredientKey":"egg"},{"name":"Seaweed","quantity":1,"ingredientKey":"seaweed"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Noodles","quantity":1,"ingredientKey":"noodles"},{"name":"Egg","quantity":1,"ingredientKey":"egg"},{"name":"Seaweed","quantity":1,"ingredientKey":"seaweed"}],"zh":[{"name":"面条","quantity":1,"ingredientKey":"noodles"},{"name":"鸡蛋","quantity":1,"ingredientKey":"egg"},{"name":"海苔","quantity":1,"ingredientKey":"seaweed"}]}'::jsonb,
  special_ingredient_slots = '[{"name":"Shrimp","quantity":1,"ingredientKey":"shrimp"}]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[{"name":"Shrimp","quantity":1,"ingredientKey":"shrimp"}],"zh":[{"name":"虾","quantity":1,"ingredientKey":"shrimp"}]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/ramen_plain.png"},{"match":["shrimp"],"iconPath":"/rewards/ramen_shrimp_calm.png"}]'::jsonb,
  updated_at = now()
where slug = 'ramen';

update shop_recipes
set
  title = 'Rice Ball',
  title_i18n = '{"en":"Rice Ball","zh":"饭团"}'::jsonb,
  intro = 'A soft rice ball with a simple and tasty filling inside.
It’s easy to carry and gives you a nice little energy boost.',
  intro_i18n = '{"en":"A soft rice ball with a simple and tasty filling inside.\nIt’s easy to carry and gives you a nice little energy boost.","zh":"一个软软的饭团，里面有简单又好吃的馅料。\n方便携带，还能带来满满的能量。"}'::jsonb,
  display_order = 7,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Steam Rice","quantity":1,"ingredientKey":"cooked-rice"},{"name":"Seaweed","quantity":1,"ingredientKey":"seaweed"},{"name":"Salt","quantity":1,"ingredientKey":"salt"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Steam Rice","quantity":1,"ingredientKey":"cooked-rice"},{"name":"Seaweed","quantity":1,"ingredientKey":"seaweed"},{"name":"Salt","quantity":1,"ingredientKey":"salt"}],"zh":[{"name":"米饭","quantity":1,"ingredientKey":"cooked-rice"},{"name":"海苔","quantity":1,"ingredientKey":"seaweed"},{"name":"盐","quantity":1,"ingredientKey":"salt"}]}'::jsonb,
  special_ingredient_slots = '[]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[],"zh":[]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/rice-ball_plain.png"}]'::jsonb,
  updated_at = now()
where slug = 'rice_ball';

update shop_recipes
set
  title = 'Tangyuan',
  title_i18n = '{"en":"Tangyuan","zh":"汤圆"}'::jsonb,
  intro = 'Soft and chewy rice balls filled with sweet red bean paste.
They are warm, comforting, and perfect for sharing with family.',
  intro_i18n = '{"en":"Soft and chewy rice balls filled with sweet red bean paste.\nThey are warm, comforting, and perfect for sharing with family.","zh":"软软糯糯的汤圆，里面是香甜的红豆馅。\n暖暖的一碗，最适合和家人一起分享。"}'::jsonb,
  display_order = 8,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Sticky Rice","quantity":1,"ingredientKey":"sticky-rice"},{"name":"Red Bean","quantity":1,"ingredientKey":"red-bean"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Sticky Rice","quantity":1,"ingredientKey":"sticky-rice"},{"name":"Red Bean","quantity":1,"ingredientKey":"red-bean"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"}],"zh":[{"name":"糯米","quantity":1,"ingredientKey":"sticky-rice"},{"name":"红豆","quantity":1,"ingredientKey":"red-bean"},{"name":"糖","quantity":1,"ingredientKey":"sugar"}]}'::jsonb,
  special_ingredient_slots = '[]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[],"zh":[]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/tangyuan_plain.png"}]'::jsonb,
  updated_at = now()
where slug = 'tangyuan';

update shop_recipes
set
  title = 'Zongzi',
  title_i18n = '{"en":"Zongzi","zh":"粽子"}'::jsonb,
  intro = 'A soft and sticky rice dumpling wrapped in bamboo leaves.  It’s a traditional treat filled with warm, comforting flavors.',
  intro_i18n = '{"en":"A soft and sticky rice dumpling wrapped in bamboo leaves.  It’s a traditional treat filled with warm, comforting flavors.","zh":"用粽叶包裹的糯米团子，软软糯糯的。里面藏着香香的馅料，是端午节的传统美食。"}'::jsonb,
  display_order = 9,
  is_active = true,
  unlock_cost_coins = 25,
  base_ingredients = '[{"name":"Sticky Rice","quantity":1,"ingredientKey":"sticky-rice"},{"name":"Bamboo Leaves","quantity":1,"ingredientKey":"bamboo-leaves"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Sticky Rice","quantity":1,"ingredientKey":"sticky-rice"},{"name":"Bamboo Leaves","quantity":1,"ingredientKey":"bamboo-leaves"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"}],"zh":[{"name":"糯米","quantity":1,"ingredientKey":"sticky-rice"},{"name":"粽叶","quantity":1,"ingredientKey":"bamboo-leaves"},{"name":"糖","quantity":1,"ingredientKey":"sugar"}]}'::jsonb,
  special_ingredient_slots = '[]'::jsonb,
  special_ingredient_slots_i18n = '{"en":[],"zh":[]}'::jsonb,
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/zongzi_plain.png"}]'::jsonb,
  updated_at = now()
where slug = 'zongzi';

commit;
