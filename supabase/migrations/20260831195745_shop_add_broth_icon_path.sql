-- Set icon_path for the existing "broth" ingredient (previously null).
--
-- Scoped deliberately: this only updates shop_ingredient_prices.icon_path
-- for ingredient_key = 'broth' -- it does not touch any other ingredient
-- or recipe row. The icon file itself (public/ingredients/broth.png) ships
-- as a normal checked-in asset alongside this migration.
--
-- NOTE: when this ran against production, it matched 0 rows -- the
-- "broth" row itself didn't exist there at all (a pre-existing gap, never
-- migrated). See the follow-up migration
-- 20260831200005_shop_add_broth_ingredient.sql, which inserts the row;
-- once that runs, THIS update becomes a real no-op forever after (icon_path
-- is already correct from the insert), which is fine -- migrations are
-- meant to be idempotent/order-independent here, not rewritten.

begin;

update shop_ingredient_prices
set
  icon_path = '/ingredients/broth.png',
  updated_at = now()
where ingredient_key = 'broth';

commit;
