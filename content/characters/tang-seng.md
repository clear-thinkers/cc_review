---
character_key: tang-seng
deliverables:
  - public/characters/tang-seng/tang-seng_waiting.png     # delivered; 960 x 1080, transparent
  - public/characters/tang-seng/tang-seng_delighted.png   # delivered; 960 x 1080, transparent
  - public/characters/tang-seng/tang-seng_token.png       # delivered; 512 x 512, transparent
status: art delivered 2026-11-25 as one 1376 x 768 JPG holding all three on plain white (_staging/image_20261125205139.jpg, git-ignored). Claude split it at the white gaps, cut each out with cutout.mjs (--bg checker --chroma 10; plain white floods like a checkerboard), and then cleared by hand one enclosed white pocket between the book, arm and cheek in the delighted pose, which the edge flood can't reach. The figures were only ~648 px tall, so they're scaled up about 1.45x. His orders pin vegetarian variants (红豆包, plain 阳春面): Café Rule 4, migration 20261126130000.
reference_images:
  - public/shop/shop.png
  - public/kitchen/chef_idle.png
  - public/paw-prints/shrewy_paw.png
  - public/characters/li-bai/li-bai_waiting.png
---

# 唐僧 (Tang Seng) Café visitor

Reference images (in attached order):

1. Café. The room he visits. A soft, hand-painted isometric storybook café in warm cream and butter-yellow, with sage-green accents (the door, the register, the towel), honey-coloured wood and gentle brown linework. Match this style and palette exactly.
2. Shrewy. The game's chef, a chubby grey tabby cat in a white chef hat and a sage-green apron. Match his proportions and finish: a big round head about a third of his height, a small soft body, rosy cheeks, clean soft outlines, gentle shading, no harsh shadows.
3. Shrewy's paw stamp. Another character's token. A round sage-green badge with a cream paw, a chef hat and small sparkles. Tang Seng's token should feel like a matching set: the same round badge shape and finish, in his own colours and motif.
4. Li Bai (an approved visitor). Another visitor to the same café. Match his size, chibi proportions, line weight and finish, so the two look like they belong to one game.

Prompt:

Draw Tang Seng (唐僧), the kind monk who travels west to fetch the scriptures in the classic novel *Journey to the West* (西游记), as a visitor to the café in image 1. Use the same soft, hand-painted storybook style as images 1, 2 and 4. He's an original cute character for a children's Chinese-learning game. Don't model him on any existing film, TV series, cartoon or video game version of the story, or on any existing video game's characters or art style.

Tang Seng: a gentle, calm and kind young monk with Shrewy's chibi proportions (image 2): a big round head about a third of his height and a small body. He has a smooth shaved head and wears a golden five-panel Vairocana crown (毗卢帽), each panel a simple rounded petal shape with no pictures or writing on it. He wears a cream monk's robe with a bright red kasaya (袈裟) draped over one shoulder, in a simple patchwork of red squares edged in gold. He has a soft, peaceful smile, rosy cheeks and kind eyes, and a string of brown prayer beads (佛珠) around his wrist or in his hand. His second prop is his travel pass (通关文牒): a small folded document in cream paper with a red cover. Lotus flowers are his theme: a small pink lotus embroidered on the robe is welcome.

Not allowed: no weapons and no monk's staff (锡杖), no other characters from the story (no monkey, pig, horse or demons), no meat, and no cups, bowls of drink, jugs, gourds or anything to drink from. Nothing scary. This is a children's game.

Draw three separate images:

1. **Waiting** (`tang-seng_waiting.png`): standing politely, facing us in a three-quarter view turned slightly to the left. One hand is raised in front of his chest in a polite monk's greeting, the prayer beads hanging from it; the other holds the folded travel pass. A small, hopeful smile, as if about to order food. Full body, both feet on the ground.
2. **Delighted** (`tang-seng_delighted.png`): the same character, at the same size and in the same spot on the canvas. He's thrilled with his meal: eyes curved shut with joy, a big warm smile, and the travel pass held up beside his face as a thank-you gift. A few small golden sparkles near his hand. Keep his raised arm and the travel pass close to his body: a wide pose makes both sprites smaller in the game.
3. **Token** (`tang-seng_token.png`): his payment, a 通关印 (a stamp from his travel pass). A round badge in the same shape and finish as image 3, in warm red and gold on cream, with a simple pink lotus in the middle inside a red square seal-stamp border, plus one or two sparkles. Keep it simple and bold so it still reads as a tiny icon.

Technical:

- **Waiting and Delighted:** 960 × 1080 px PNG with a real transparent background (alpha), not a white or checkerboard background.
  - Full body, centred left to right. The feet sit about 30 px above the bottom edge, and the top of the crown about 40 px below the top edge.
  - Both images use the same scale and feet position, so swapping one for the other doesn't make him jump.
- **Token:** 512 × 512 px PNG with a real transparent background. The round badge fills about 90% of the canvas, centred.
  - It must still read at 28 px wide, and still read when shown in grey at one-third opacity (that's how a spent token looks). So use big, simple shapes and strong contrast.
- **Small on screen:** in the game the character is shown only about 220 px wide over the café. Keep shapes big and clear, and avoid fine detail that would turn to mush.
- **Isolated only:** no background, floor, shadow on a floor, room, speech bubble or dialogue box. The game draws the café and his speech bubble itself.
- **No text anywhere:** no letters, Chinese characters, names, labels or watermark. On the travel pass and inside the seal stamp, use soft wavy strokes that only suggest writing, or none at all. The game shows the real text.
- **If you can't give real transparency,** use a flat pure green background (#00FF00) with nothing else on it, never a checkerboard.

---

## Copy for Shop Admin (not for the design agent)

Enter in Shop Admin → Café Characters. Line format in the admin form: `English | 中文`, one per row. The speech bubble is small (about 13 Chinese characters per line), so keep lines to about 24 Chinese characters or 60 English characters.

- **Key:** `tang-seng`
- **Name:** Tang Seng | 唐僧
- **Intro:** The monk from Journey to the West. He only eats vegetarian food! | 《西游记》里的唐僧，只吃素食！
- **Token name:** travel stamp | 通关印
- **Paths:** token `/characters/tang-seng/tang-seng_token.png`; waiting `/characters/tang-seng/tang-seng_waiting.png`; delighted `/characters/tang-seng/tang-seng_delighted.png`
- **Visits:** up to 6 a day (the same as Li Bai's current setting)

**Ordering**
```
I've come a long way from Tang. A simple meal, please? | 贫僧从东土大唐来，想讨一份素斋。
Amituofo! May I have some vegetarian food? | 阿弥陀佛！请给贫僧来点素食吧。
We've walked so far. My disciples are hungry too! | 走了好远的路，徒儿们也饿了。
```

**After being served**
```
Thank you, kind friend! What a tasty meal. | 多谢施主！这顿素斋真香。
Now I have the strength to keep heading west! | 吃饱了，贫僧又有力气西行了！
How kind! Here's a stamp from my travel pass. | 善哉善哉！送你一枚通关印。
```

**When sent away**
```
No matter. I'll come by another day. | 不要紧，贫僧改日再来。
Then I'll be on my way. Farewell! | 那贫僧先去赶路啦，再会！
```

**Token content (stops on the journey).** Each 通关印 tells one well-known episode of 西游记, in order along the road. These are short retellings for children, not quotes from the novel.

| Title | Text |
|---|---|
| 五行山救悟空 | 唐僧路过五行山，揭下山顶的金字帖子。被压了五百年的孙悟空跳了出来，拜唐僧为师，保护师父去西天取经。 |
| 鹰愁涧收白龙马 | 在鹰愁涧，一条小白龙吃掉了唐僧的马。观音菩萨让小白龙变成一匹白马，驮着唐僧一路西行。 |
| 高老庄收八戒 | 在高老庄，悟空降服了猪八戒。八戒拜唐僧为师，从此跟着师父去取经。 |
| 流沙河收沙僧 | 流沙河又宽又深，沙悟净就住在河里。他拜唐僧为师，帮大家渡过了河。师徒四人到齐了！ |
| 三打白骨精 | 白骨精三次变成人的样子来骗唐僧，都被悟空的火眼金睛看穿了。 |
| 女儿国 | 西梁女国里住的都是女子。女王想留唐僧做国王，可唐僧一心取经，还是告别女王，继续西行。 |
| 火焰山 | 火焰山的大火挡住了去路。悟空向铁扇公主借来芭蕉扇，扇灭了大火，师徒才过了山。 |
| 灵山取经 | 师徒经历了九九八十一难，终于来到灵山，见到如来佛祖，取得了真经。 |

**Orders (suggested, owner to decide).** Each dish is pinned to a vegetarian kind, so a 小笼包 or a 猪肝面 never fills his order:

- 阳春面 (plain, nothing added) × 1 → 1 通关印
- 红豆包 × 2 → 2 通关印
- 饭团 × 2 → 2 通关印
- 阳春面 (plain) × 1 + 红豆包 × 1 + 饭团 × 1 → 4 通关印
