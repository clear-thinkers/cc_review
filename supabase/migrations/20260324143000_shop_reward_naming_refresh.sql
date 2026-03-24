update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/bubble-tea_plain.png" },
    { "match": ["brown-sugar"], "iconPath": "/rewards/bubble-tea_brown-sugar_wink.png" },
    { "match": ["jasmine"], "iconPath": "/rewards/bubble-tea_jasmine_excited.png" },
    { "match": ["matcha"], "iconPath": "/rewards/bubble-tea_matcha_sleep.png" },
    { "match": ["taro"], "iconPath": "/rewards/bubble-tea_taro_ambitious.png" }
  ]$$::jsonb,
  special_ingredient_slots = $$[
    {
      "slotKey": "specialty_ingredients",
      "label": "Special Ingredients",
      "maxSelections": 1,
      "options": [
        { "key": "brown-sugar", "label": "Brown Sugar", "effect": "used in specialty recipes" },
        { "key": "jasmine", "label": "Jasmine", "effect": "used in specialty recipes" },
        { "key": "matcha", "label": "Matcha", "effect": "used in specialty recipes" },
        { "key": "taro", "label": "Taro", "effect": "used in specialty recipes" }
      ]
    }
  ]$$::jsonb,
  updated_at = now()
where slug = 'bubble_tea';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/bun_plain.png" },
    { "match": ["pork"], "iconPath": "/rewards/bun_pork_excited.png" },
    { "match": ["red-bean"], "iconPath": "/rewards/bun_red-bean_wink.png" }
  ]$$::jsonb,
  special_ingredient_slots = $$[
    {
      "slotKey": "specialty_ingredients",
      "label": "Special Ingredients",
      "maxSelections": 1,
      "options": [
        { "key": "pork", "label": "Pork", "effect": "used in specialty recipes" },
        { "key": "red-bean", "label": "Red Bean", "effect": "used in specialty recipes" }
      ]
    }
  ]$$::jsonb,
  updated_at = now()
where slug = 'bun';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/cake_plain.png" },
    { "match": ["strawberry"], "iconPath": "/rewards/cake_strawberry_sleep.png" }
  ]$$::jsonb,
  special_ingredient_slots = $$[
    {
      "slotKey": "specialty_ingredients",
      "label": "Special Ingredients",
      "maxSelections": 1,
      "options": [
        { "key": "strawberry", "label": "Strawberry", "effect": "used in specialty recipes" }
      ]
    }
  ]$$::jsonb,
  updated_at = now()
where slug = 'cake';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/donut_plain.png" },
    { "match": ["chocolate", "sprinkles"], "iconPath": "/rewards/donut_chocolate+sprinkles_sleep.png" },
    { "match": ["cinnamon"], "iconPath": "/rewards/donut_cinnamon_happy.png" },
    { "match": ["strawberry"], "iconPath": "/rewards/donut_strawberry_ambitious.png" },
    { "match": ["strawberry", "sprinkles"], "iconPath": "/rewards/donut_strawberry+sprinkles_excited.png" },
    { "match": ["vanilla", "chocolate"], "iconPath": "/rewards/donut_vanilla+chocolate_wink.png" }
  ]$$::jsonb,
  special_ingredient_slots = $$[
    {
      "slotKey": "specialty_ingredients",
      "label": "Special Ingredients",
      "maxSelections": 2,
      "options": [
        { "key": "chocolate", "label": "Chocolate", "effect": "used in specialty recipes" },
        { "key": "cinnamon", "label": "Cinnamon", "effect": "used in specialty recipes" },
        { "key": "sprinkles", "label": "Sprinkles", "effect": "used in specialty recipes" },
        { "key": "strawberry", "label": "Strawberry", "effect": "used in specialty recipes" },
        { "key": "vanilla", "label": "Vanilla", "effect": "used in specialty recipes" }
      ]
    }
  ]$$::jsonb,
  updated_at = now()
where slug = 'donut';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": ["strawberry"], "iconPath": "/rewards/milkshake_strawberry_sleep.png" }
  ]$$::jsonb,
  special_ingredient_slots = $$[
    {
      "slotKey": "specialty_ingredients",
      "label": "Special Ingredients",
      "maxSelections": 1,
      "options": [
        { "key": "strawberry", "label": "Strawberry", "effect": "used in specialty recipes" }
      ]
    }
  ]$$::jsonb,
  updated_at = now()
where slug = 'milkshake';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/ramen_plain.png" },
    { "match": ["shrimp"], "iconPath": "/rewards/ramen_shrimp_calm.png" }
  ]$$::jsonb,
  special_ingredient_slots = $$[
    {
      "slotKey": "specialty_ingredients",
      "label": "Special Ingredients",
      "maxSelections": 1,
      "options": [
        { "key": "shrimp", "label": "Shrimp", "effect": "used in specialty recipes" }
      ]
    }
  ]$$::jsonb,
  updated_at = now()
where slug = 'ramen';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/rice-ball_plain.png" }
  ]$$::jsonb,
  special_ingredient_slots = '[]'::jsonb,
  updated_at = now()
where slug = 'rice_ball';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/tangyuan_plain.png" }
  ]$$::jsonb,
  special_ingredient_slots = '[]'::jsonb,
  updated_at = now()
where slug = 'tangyuan';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/zongzi_plain.png" }
  ]$$::jsonb,
  special_ingredient_slots = '[]'::jsonb,
  updated_at = now()
where slug = 'zongzi';
