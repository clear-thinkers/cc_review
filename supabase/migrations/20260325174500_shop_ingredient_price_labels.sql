alter table shop_ingredient_prices
add column if not exists label_i18n jsonb not null default '{}'::jsonb;
