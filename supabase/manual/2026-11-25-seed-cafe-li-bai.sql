-- Seed 李白 (Li Bai) as a Café visitor (roadmap item U). Idempotent: safe to run again.
-- Source of the copy, art paths and poems: content/characters/li-bai.md.
-- Once seeded, Shop Admin → Café Characters is the place to edit him.
--
-- Run on dev:  npx supabase db query --linked -f supabase/manual/2026-11-25-seed-cafe-li-bai.sql

begin;

insert into shop_characters (
  character_key, name_i18n, intro_i18n, token_name_i18n, token_icon_path,
  sprite_paths, lines_i18n, visits_cafe, is_active, display_order
) values (
  'li-bai',
  '{"en": "Li Bai", "zh": "李白"}',
  '{"en": "The great Tang poet. He pays in poems!", "zh": "唐代大诗人，用诗来付账！"}',
  '{"en": "poem slip", "zh": "诗笺"}',
  '/characters/li-bai/li-bai_token.png',
  '{"waiting": "/characters/li-bai/li-bai_waiting.png", "delighted": "/characters/li-bai/li-bai_delighted.png"}',
  '{
    "order": [
      {"en": "A poem for a plate? I''d love a little feast!", "zh": "一首诗换一份美食，好不好？"},
      {"en": "The moon is so bright tonight. Something sweet, please!", "zh": "今晚月色真好，来点甜的吧！"},
      {"en": "I''ve walked a thousand miles. I''m so hungry!", "zh": "我走了千里路，肚子好饿呀！"}
    ],
    "served": [
      {"en": "Delicious! Here''s a poem, fresh from my brush!", "zh": "真好吃！送你一首刚写的诗！"},
      {"en": "This tastes like moonlight! Thank you!", "zh": "像月光一样美味！谢谢你！"},
      {"en": "Wonderful! I''ll write a poem about this meal!", "zh": "太棒了！我要为这顿饭写首诗！"}
    ],
    "dismissed": [
      {"en": "No hurry! I''ll wander by again.", "zh": "不着急，我改天再来逛逛！"},
      {"en": "Then I''ll go count the stars. See you!", "zh": "那我去数星星啦，再见！"}
    ]
  }',
  true,
  true,
  1
)
on conflict (character_key) do nothing;

-- Orders: added only if he has none yet, so admin edits are never overwritten.
do $$
declare
  v_mooncake uuid := (select id from shop_recipes where slug = 'golden-mooncake');
  v_tangyuan uuid := (select id from shop_recipes where slug = 'tangyuan');
  v_order uuid;
begin
  if v_mooncake is null or v_tangyuan is null then
    raise exception 'golden-mooncake or tangyuan recipe not found';
  end if;
  if exists (select 1 from shop_character_orders where character_key = 'li-bai') then
    return;
  end if;

  insert into shop_character_orders (character_key, token_price, display_order)
  values ('li-bai', 2, 0) returning id into v_order;
  insert into shop_character_order_items (order_id, recipe_id, quantity) values (v_order, v_mooncake, 1);

  insert into shop_character_orders (character_key, token_price, display_order)
  values ('li-bai', 2, 1) returning id into v_order;
  insert into shop_character_order_items (order_id, recipe_id, quantity) values (v_order, v_tangyuan, 2);

  insert into shop_character_orders (character_key, token_price, display_order)
  values ('li-bai', 3, 2) returning id into v_order;
  insert into shop_character_order_items (order_id, recipe_id, quantity)
  values (v_order, v_mooncake, 1), (v_order, v_tangyuan, 1);
end;
$$;

-- Poems: chosen because none mentions wine. Skips any title he already has.
insert into shop_character_token_contents (character_key, title, body, display_order)
select 'li-bai', p.title, p.body, p.ord
from (values
  ('静夜思', '床前明月光，疑是地上霜。举头望明月，低头思故乡。', 0),
  ('古朗月行（节选）', '小时不识月，呼作白玉盘。又疑瑶台镜，飞在青云端。', 1),
  ('夜宿山寺', '危楼高百尺，手可摘星辰。不敢高声语，恐惊天上人。', 2),
  ('望庐山瀑布', '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。', 3),
  ('早发白帝城', '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。', 4),
  ('赠汪伦', '李白乘舟将欲行，忽闻岸上踏歌声。桃花潭水深千尺，不及汪伦送我情。', 5),
  ('望天门山', '天门中断楚江开，碧水东流至此回。两岸青山相对出，孤帆一片日边来。', 6)
) as p(title, body, ord)
where not exists (
  select 1 from shop_character_token_contents c where c.character_key = 'li-bai' and c.title = p.title
);

commit;
