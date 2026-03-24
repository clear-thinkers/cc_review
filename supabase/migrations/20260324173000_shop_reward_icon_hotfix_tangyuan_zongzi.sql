update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/tangyuan_plain.png" }
  ]$$::jsonb,
  updated_at = now()
where slug = 'tangyuan';

update shop_recipes
set
  variant_icon_rules = $$[
    { "match": [], "iconPath": "/rewards/zongzi_plain.png" }
  ]$$::jsonb,
  updated_at = now()
where slug = 'zongzi';
