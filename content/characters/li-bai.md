---
character_key: li-bai
deliverables:
  - public/characters/li-bai/li-bai_waiting.png     # delivered; 960 x 1080, transparent
  - public/characters/li-bai/li-bai_delighted.png   # delivered; 960 x 1080, transparent
  - public/characters/li-bai/li-bai_token.png       # delivered; 512 x 512, transparent
status: art delivered 2026-11-25. The agent returned 1376 x 768 JPGs with a painted checkerboard, so the transparent PNGs above were cut out, scaled to one height and foot position, and fitted by Claude. Sources are in _staging (git-ignored). The Café now expects 960 x 1080 sprites; use that size for every future character.
reference_images:
  - public/shop/shop.png
  - public/kitchen/chef_idle.png
  - public/paw-prints/shrewy_paw.png
---

# 李白 (Li Bai) Café visitor

Reference images (in attached order):

1. Café. The room he visits. A soft, hand-painted isometric storybook café in warm cream and butter-yellow, with sage-green accents (the door, the register, the towel), honey-coloured wood and gentle brown linework. Match this style and palette exactly.
2. Shrewy. The game's chef, a chubby grey tabby cat in a white chef hat and a sage-green apron. Match his proportions and finish: a big round head about a third of his height, a small soft body, rosy cheeks, clean soft outlines, gentle shading, no harsh shadows.
3. Shrewy's paw stamp. Another character's token. A round sage-green badge with a cream paw, a chef hat and small sparkles. Li Bai's token should feel like a matching set: the same round badge shape and finish, in his own colours and motif.

Prompt:

Draw Li Bai (李白), the great Tang-dynasty poet, as a visitor to the café in image 1. Use the same soft, hand-painted storybook style as images 1 and 2. He's an original cute character for a children's Chinese-learning game. Don't model him on any existing video game's characters or art style.

Li Bai: a cheerful, dreamy poet with Shrewy's chibi proportions (image 2): a big round head about a third of his height and a small body. He wears a black Tang-style futou hat (幞头) with two short soft flaps, and a flowing white scholar's robe (圆领袍 or 襦衫) edged in deep blue, with a sage-green sash. He has a neat black moustache and a small pointed goatee, rosy cheeks and kind, sparkly eyes. He carries a rolled poem scroll and a calligraphy brush. Moon motifs are his theme: a small crescent moon embroidered on the robe is welcome.

Not allowed: no wine, wine cup, wine jug, gourd or anything to drink. This is a children's game.

Draw three separate images:

1. **Waiting** (`li-bai_waiting.png`): standing politely, facing us in a three-quarter view turned slightly to the left. He holds the poem scroll in one hand and gives a small, hopeful smile, as if about to order food. Full body, both feet on the ground.
2. **Delighted** (`li-bai_delighted.png`): the same character, at the same size and in the same spot on the canvas. He's thrilled with his meal: eyes curved shut with joy, a big open smile, and his free hand lifted high holding the unrolled poem as a thank-you gift. A few small golden sparkles near his hand.
3. **Token** (`li-bai_token.png`): his payment, a 诗笺 (poem slip). A round badge in the same shape and finish as image 3, in cream and deep blue, with a small rolled scroll or folded poem paper and a crescent moon on it, plus one or two sparkles. Keep it simple and bold so it still reads as a tiny icon.

Technical:

- **Waiting and Delighted:** 960 × 1080 px PNG with a real transparent background (alpha), not a white or checkerboard background.
  - Full body, centred left to right. The feet sit about 30 px above the bottom edge, and the top of the hat about 40 px below the top edge.
  - Both images use the same scale and feet position, so swapping one for the other doesn't make him jump.
- **Token:** 512 × 512 px PNG with a real transparent background. The round badge fills about 90% of the canvas, centred.
  - It must still read at 28 px wide, and still read when shown in grey at one-third opacity (that's how a spent token looks). So use big, simple shapes and strong contrast.
- **Small on screen:** in the game the character is shown only about 220 px wide over the café. Keep shapes big and clear, and avoid fine detail that would turn to mush.
- **Isolated only:** no background, floor, shadow on a floor, room, speech bubble or dialogue box. The game draws the café and his speech bubble itself.
- **No text anywhere:** no letters, Chinese characters, names, labels or watermark. On the scroll and the poem slip, use soft wavy brush strokes that only suggest writing. The game shows the real poem.

---

## Copy for Shop Admin (not for the design agent)

Enter in Shop Admin → Café Characters. Line format in the admin form: `English | 中文`, one per row. The speech bubble is small (about 13 Chinese characters per line), so keep lines to about 24 Chinese characters or 60 English characters.

- **Key:** `li-bai`
- **Name:** Li Bai | 李白
- **Intro:** The great Tang poet. He pays in poems! | 唐代大诗人，用诗来付账！
- **Token name:** poem slip | 诗笺
- **Paths:** token `/characters/li-bai/li-bai_token.png`; waiting `/characters/li-bai/li-bai_waiting.png`; delighted `/characters/li-bai/li-bai_delighted.png`

**Ordering**
```
A poem for a plate? I'd love a little feast! | 一首诗换一份美食，好不好？
The moon is so bright tonight. Something sweet, please! | 今晚月色真好，来点甜的吧！
I've walked a thousand miles. I'm so hungry! | 我走了千里路，肚子好饿呀！
```

**After being served**
```
Delicious! Here's a poem, fresh from my brush! | 真好吃！送你一首刚写的诗！
This tastes like moonlight! Thank you! | 像月光一样美味！谢谢你！
Wonderful! I'll write a poem about this meal! | 太棒了！我要为这顿饭写首诗！
```

**When sent away**
```
No hurry! I'll wander by again. | 不着急，我改天再来逛逛！
Then I'll go count the stars. See you! | 那我去数星星啦，再见！
```

**Token content (poems).** All are well-known Li Bai poems, chosen because none mentions wine.

| Title | Text |
|---|---|
| 静夜思 | 床前明月光，疑是地上霜。举头望明月，低头思故乡。 |
| 古朗月行（节选） | 小时不识月，呼作白玉盘。又疑瑶台镜，飞在青云端。 |
| 夜宿山寺 | 危楼高百尺，手可摘星辰。不敢高声语，恐惊天上人。 |
| 望庐山瀑布 | 日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。 |
| 早发白帝城 | 朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。 |
| 赠汪伦 | 李白乘舟将欲行，忽闻岸上踏歌声。桃花潭水深千尺，不及汪伦送我情。 |
| 望天门山 | 天门中断楚江开，碧水东流至此回。两岸青山相对出，孤帆一片日边来。 |

**Orders (suggested, owner to decide):** Golden Mooncake × 1 → 2 诗笺 (the moon is his theme); Tangyuan × 2 → 2 诗笺; Golden Mooncake × 1 + Tangyuan × 1 → 3 诗笺.
