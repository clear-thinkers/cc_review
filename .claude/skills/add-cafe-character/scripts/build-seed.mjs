#!/usr/bin/env node
/**
 * Builds an idempotent seed SQL file for one Café character from its JSON spec.
 *
 *   node build-seed.mjs content/characters/<key>.json [--date YYYY-MM-DD]
 *   -> supabase/manual/<date>-seed-cafe-<key>.sql
 *
 * The SQL (one transaction):
 *   - inserts the character, or does nothing if the key exists (Shop Admin edits are never
 *     overwritten);
 *   - adds its orders only if it has none yet, resolving recipes by slug and failing the
 *     whole run if a slug is missing, inactive or not cookable, or an item pins a special
 *     ingredient its recipe doesn't offer (items[].specialIngredients: [] = plain,
 *     ["red-bean"] = that variant only; leave it out for any variant);
 *   - adds each token-content entry (poem etc.) whose title it doesn't already have.
 *
 * Everything is validated against the same limits the database and Shop Admin enforce, so a
 * bad spec fails here, before any SQL runs. Run it on dev with
 *   npx supabase db query --linked -f <file>
 * and on prod only when the owner asks (run-prod-sql.mjs). Run from the repo root.
 */
import { readFileSync, writeFileSync } from "node:fs";

const LIMITS = { orderPrice: 50, quantity: 9, title: 60, body: 600, visitLimit: 100, randomDays: 31 };
const FREQUENCIES = ["unlimited", "daily", "weekly", "monthly", "random_days"];
const MOMENTS = ["order", "served", "dismissed"];
// The speech bubble fits about 13 Chinese characters per line; longer lines wrap onto 3+ lines.
const LINE_WARN = { zh: 24, en: 60 };

const [specPath, ...rest] = process.argv.slice(2);
const dateIndex = rest.indexOf("--date");
const date = dateIndex >= 0 ? rest[dateIndex + 1] : new Date().toISOString().slice(0, 10);
if (!specPath || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("Usage: build-seed.mjs content/characters/<key>.json [--date YYYY-MM-DD]");
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, "utf8"));
const problems = [];
const warnings = [];
const need = (ok, message) => {
  if (!ok) problems.push(message);
};
const isText = (value) => typeof value === "string" && value.trim() !== "";
const isLocalized = (value) => value && isText(value.en) && isText(value.zh);

need(/^[a-z0-9][a-z0-9-]{0,39}$/.test(spec.key ?? ""), "key: lowercase letters, digits and dashes, starting with a letter or digit");
need(isLocalized(spec.name), "name: needs en and zh");
need(isLocalized(spec.tokenName), "tokenName: needs en and zh");
need(!spec.intro || (typeof spec.intro.en === "string" && typeof spec.intro.zh === "string"), "intro: { en, zh }");

const frequency = spec.visitFrequency ?? "unlimited";
const visitLimit = spec.visitLimit ?? null;
need(FREQUENCIES.includes(frequency), `visitFrequency: one of ${FREQUENCIES.join(", ")}`);
if (frequency === "unlimited") need(visitLimit === null, "visitLimit must be null when visitFrequency is unlimited");
else {
  const max = frequency === "random_days" ? LIMITS.randomDays : LIMITS.visitLimit;
  need(Number.isInteger(visitLimit) && visitLimit >= 1 && visitLimit <= max, `visitLimit: whole number 1-${max} for ${frequency}`);
}

for (const moment of MOMENTS) {
  const lines = spec.lines?.[moment] ?? [];
  need(Array.isArray(lines) && lines.every(isLocalized), `lines.${moment}: a list of { en, zh }`);
  if (lines.length === 0) warnings.push(`lines.${moment} is empty: the Café falls back to its generic line`);
  for (const line of Array.isArray(lines) ? lines : []) {
    if (line.zh?.length > LINE_WARN.zh || line.en?.length > LINE_WARN.en) {
      warnings.push(`long ${moment} line (bubble wraps a lot): "${line.zh}" / "${line.en}"`);
    }
  }
}

const orders = spec.orders ?? [];
need(Array.isArray(orders) && orders.length > 0, "orders: at least one, or the character never visits");
orders.forEach((order, i) => {
  need(Number.isInteger(order.tokenPrice) && order.tokenPrice >= 1 && order.tokenPrice <= LIMITS.orderPrice, `orders[${i}].tokenPrice: 1-${LIMITS.orderPrice}`);
  const items = order.items ?? [];
  need(items.length > 0, `orders[${i}].items: at least one dish`);
  need(new Set(items.map((item) => item.recipe)).size === items.length, `orders[${i}]: each recipe once; raise its quantity instead`);
  items.forEach((item, j) => {
    need(isText(item.recipe), `orders[${i}].items[${j}].recipe: a recipe slug`);
    need(Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= LIMITS.quantity, `orders[${i}].items[${j}].quantity: 1-${LIMITS.quantity}`);
    need(
      item.specialIngredients === undefined || (Array.isArray(item.specialIngredients) && item.specialIngredients.every(isText)),
      `orders[${i}].items[${j}].specialIngredients: leave it out (any variant) or a list of ingredient keys ([] = plain)`
    );
  });
});

const contents = spec.tokenContents ?? [];
contents.forEach((content, i) => {
  need(isText(content.title) && content.title.trim().length <= LIMITS.title, `tokenContents[${i}].title: 1-${LIMITS.title} characters`);
  need(isText(content.body) && content.body.trim().length <= LIMITS.body, `tokenContents[${i}].body: 1-${LIMITS.body} characters`);
});
need(new Set(contents.map((content) => content.title)).size === contents.length, "tokenContents: titles must be unique");

if (problems.length > 0) {
  console.error(`✗ ${specPath} has problems:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}

const key = spec.key;
const art = {
  token: spec.art?.token ?? `/characters/${key}/${key}_token.png`,
  waiting: spec.art?.waiting ?? `/characters/${key}/${key}_waiting.png`,
  delighted: spec.art?.delighted ?? `/characters/${key}/${key}_delighted.png`,
};

// Dollar-quoted literals, so quotes and Chinese punctuation in the copy need no escaping.
const TAG = "$seed$";
const literal = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.includes(TAG)) throw new Error(`The text may not contain ${TAG}`);
  return `${TAG}${text}${TAG}`;
};
const trimLocalized = (value) => ({ en: value.en.trim(), zh: value.zh.trim() });
const lines = Object.fromEntries(MOMENTS.map((moment) => [moment, (spec.lines?.[moment] ?? []).map(trimLocalized)]));
const orderRows = orders.map((order) => ({
  tokenPrice: order.tokenPrice,
  items: order.items.map((item) => ({
    recipe: item.recipe.trim(),
    quantity: item.quantity,
    ...(item.specialIngredients ? { specialIngredients: [...new Set(item.specialIngredients.map((key) => key.trim()))].sort() } : {}),
  })),
}));

const sql = `-- Seed ${spec.name.zh} (${spec.name.en}) as a Café visitor. Generated by
-- .claude/skills/add-cafe-character/scripts/build-seed.mjs from ${specPath}.
-- Idempotent: safe to run again. Once seeded, Shop Admin → Café Characters is the place to
-- edit the character; this file never overwrites those edits.
--
-- Dev:  npx supabase db query --linked -f supabase/manual/${date}-seed-cafe-${key}.sql
-- Prod: only when the owner asks, with .claude/skills/add-cafe-character/scripts/run-prod-sql.mjs

begin;

insert into shop_characters (
  character_key, name_i18n, intro_i18n, token_name_i18n, token_icon_path,
  sprite_paths, lines_i18n, visits_cafe, is_active, display_order, visit_frequency, visit_limit
) values (
  ${literal(key)},
  ${literal(trimLocalized(spec.name))}::jsonb,
  ${literal(spec.intro ? trimLocalized(spec.intro) : { en: "", zh: "" })}::jsonb,
  ${literal(trimLocalized(spec.tokenName))}::jsonb,
  ${literal(art.token)},
  ${literal({ waiting: art.waiting, delighted: art.delighted })}::jsonb,
  ${literal(lines)}::jsonb,
  true,
  true,
  (select coalesce(max(display_order) + 1, 0) from shop_characters),
  ${literal(frequency)},
  ${visitLimit === null ? "null" : visitLimit}
)
on conflict (character_key) do nothing;

-- Orders: only if the character has none yet, so admin edits are never overwritten.
do $do$
declare
  v_orders jsonb := ${literal(orderRows)}::jsonb;
  v_order jsonb;
  v_order_id uuid;
  v_bad text;
  v_index integer := 0;
begin
  select string_agg(distinct item ->> 'recipe', ', ') into v_bad
  from jsonb_array_elements(v_orders) o, jsonb_array_elements(o -> 'items') item
  where not exists (
    select 1 from shop_recipes r
    where r.slug = item ->> 'recipe' and r.is_active and r.cook_method is not null
  );
  if v_bad is not null then
    raise exception 'Recipes missing, inactive or not cookable: %', v_bad;
  end if;

  -- A pinned variant may only use the recipe's own special ingredients.
  select string_agg(distinct (item ->> 'recipe') || ' + ' || key, ', ') into v_bad
  from jsonb_array_elements(v_orders) o
  cross join lateral jsonb_array_elements(o -> 'items') item
  cross join lateral jsonb_array_elements_text(coalesce(item -> 'specialIngredients', '[]'::jsonb)) as k(key)
  join shop_recipes r on r.slug = item ->> 'recipe'
  where not exists (
    select 1 from jsonb_array_elements(coalesce(r.special_ingredient_slots, '[]'::jsonb)) slot
    where slot ->> 'ingredientKey' = key
  );
  if v_bad is not null then
    raise exception 'Special ingredients these recipes do not offer: %', v_bad;
  end if;

  if exists (select 1 from shop_character_orders where character_key = ${literal(key)}) then
    return;
  end if;

  for v_order in select * from jsonb_array_elements(v_orders) loop
    insert into shop_character_orders (character_key, token_price, display_order)
    values (${literal(key)}, (v_order ->> 'tokenPrice')::integer, v_index)
    returning id into v_order_id;

    insert into shop_character_order_items (order_id, recipe_id, quantity, special_ingredient_keys)
    select v_order_id, r.id, (item ->> 'quantity')::integer, item -> 'specialIngredients'
    from jsonb_array_elements(v_order -> 'items') item
    join shop_recipes r on r.slug = item ->> 'recipe';

    v_index := v_index + 1;
  end loop;
end;
$do$;
${
  contents.length === 0
    ? ""
    : `
-- Token content: skips any title the character already has.
insert into shop_character_token_contents (character_key, title, body, display_order)
select ${literal(key)}, c.title, c.body, c.ord
from (values
${contents.map((content, i) => `  (${literal(content.title.trim())}, ${literal(content.body.trim())}, ${i})`).join(",\n")}
) as c(title, body, ord)
where not exists (
  select 1 from shop_character_token_contents t where t.character_key = ${literal(key)} and t.title = c.title
);
`
}
commit;
`;

const outPath = `supabase/manual/${date}-seed-cafe-${key}.sql`;
writeFileSync(outPath, sql, "utf8");
console.log(`Wrote ${outPath}`);
console.log(
  `  ${orders.length} order(s), ${contents.length} token content(s), ${MOMENTS.map((m) => `${lines[m].length} ${m}`).join(" / ")} lines, frequency ${frequency}${visitLimit ? ` x${visitLimit}` : ""}`
);
for (const warning of warnings) console.log(`  ! ${warning}`);
