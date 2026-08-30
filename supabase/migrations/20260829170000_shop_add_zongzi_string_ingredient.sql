-- Add the "Zongzi String" ingredient and link it to the Zongzi recipe's
-- base ingredients.
--
-- Scoped deliberately: this only inserts the one new shop_ingredient_prices
-- row and updates shop_recipes.base_ingredients / base_ingredients_i18n for
-- slug = 'zongzi' -- it does not touch any other recipe or ingredient row,
-- unlike a full export-shop-content-patch.mjs snapshot (dev and prod have
-- diverged elsewhere, so a full-table promotion would be unsafe here).
--
-- The appended base_ingredients_i18n array below reflects dev's zongzi
-- recipe at the time this migration was written (Sticky Rice, Bamboo
-- Leaves, Sugar). If prod's zongzi recipe has since diverged from that,
-- this update will not reflect prod's actual current ingredient list --
-- that check was explicitly skipped for this migration.

begin;

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'zongzi-string',
  2,
  '{"en":"Zongzi String","zh":"绑粽子的线"}'::jsonb,
  '/ingredients/zongzi-string.png'
)
on conflict (ingredient_key) do nothing;

update shop_recipes
set
  base_ingredients = '[{"name":"Sticky Rice","quantity":1,"ingredientKey":"sticky-rice"},{"name":"Bamboo Leaves","quantity":1,"ingredientKey":"bamboo-leaves"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"},{"ingredientKey":"zongzi-string","name":"Zongzi String","quantity":1}]'::jsonb,
  base_ingredients_i18n = '{"en":[{"name":"Sticky Rice","quantity":1,"ingredientKey":"sticky-rice"},{"name":"Bamboo Leaves","quantity":1,"ingredientKey":"bamboo-leaves"},{"name":"Sugar","quantity":1,"ingredientKey":"sugar"},{"ingredientKey":"zongzi-string","name":"Zongzi String","quantity":1}],"zh":[{"name":"糯米","quantity":1,"ingredientKey":"sticky-rice"},{"name":"粽叶","quantity":1,"ingredientKey":"bamboo-leaves"},{"name":"糖","quantity":1,"ingredientKey":"sugar"},{"ingredientKey":"zongzi-string","name":"绑粽子的线","quantity":1}]}'::jsonb,
  updated_at = now()
where slug = 'zongzi';

commit;
