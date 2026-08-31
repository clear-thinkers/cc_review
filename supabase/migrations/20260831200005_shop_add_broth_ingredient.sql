-- Insert the "broth" ingredient row, which existed in dev's
-- shop_ingredient_prices but was apparently never migrated to production
-- (a pre-existing gap discovered while pushing an icon_path update for it --
-- that update matched 0 rows in prod, since the row didn't exist there at
-- all). Uses ON CONFLICT DO NOTHING so this is safe to run even if the row
-- somehow already exists.
--
-- Scoped deliberately: only the one ingredient row -- no other ingredient
-- or recipe touched.

begin;

insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  'broth',
  3,
  '{"en":"Broth","zh":"高汤"}'::jsonb,
  '/ingredients/broth.png'
)
on conflict (ingredient_key) do nothing;

commit;
