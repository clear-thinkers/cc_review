-- Add the "Pork Zongzi" (肉粽) named variant to the Zongzi recipe.
--
-- Scoped deliberately: only updates shop_recipes.variant_icon_rules for
-- slug = 'zongzi' -- appends one rule matching special ingredient
-- "pork-filling" (already linked to zongzi's special_ingredient_slots by a
-- companion migration) to a titled icon rule, using the recipe's existing
-- variant_icon_rules array as a base. It does not touch any other recipe,
-- ingredient, or column.
--
-- NOT verified against production's current variant_icon_rules for
-- slug = 'zongzi'. The base array below reflects DEV's state at the time
-- this file was generated -- if prod has diverged on this recipe's variant
-- rules since then, review this diff before running db:push:prod; it will
-- overwrite prod's variant_icon_rules for this recipe with the array below,
-- not merge with whatever prod currently has.
--
-- This file is NOT applied automatically. Review it, then run:
--   npm run db:push:prod:dry
--   npm run db:push:prod

begin;

update shop_recipes
set
  variant_icon_rules = '[{"match":[],"iconPath":"/rewards/zongzi_plain.png"},{"match":["pork-filling"],"iconPath":"/rewards/zongzi_pork.png","titleI18n":{"en":"Pork Zongzi","zh":"肉粽"}}]'::jsonb,
  updated_at = now()
where slug = 'zongzi';

commit;
