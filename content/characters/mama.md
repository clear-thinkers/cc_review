---
character_key: mama
deliverables:
  - public/characters/mama/mama_waiting.png     # 960 x 1080, transparent
  - public/characters/mama/mama_delighted.png   # 960 x 1080, transparent
  - public/characters/mama/mama_token.png       # 512 x 512, transparent
status: art delivered 2026-11-27 as three green-screen JPGs (sources and 瓜瓜's drawing kept git-ignored in public/characters/mama/_staging/). Cut out with cutout.mjs --bg green, which gained enclosed green-pocket removal and green-spill cleanup for her hair. Seeded on dev 2026-11-27 (supabase/manual/2026-11-27-seed-cafe-mama.sql). The first poses had wrong sums on the homework sheet (e.g. "4=5"); the designer redrew the sheet the same day with the four correct sums in the redo request below (Chibi_mom_holding_homework_1b845564.jpg / _sheet_8af6fc5d.jpg), checked digit by digit. Still different from the brief: colored-pencil style with taller (not chibi) proportions, and navy sneakers instead of sandals.
reference_images:
  - public/shop/shop.png
  - public/kitchen/chef_idle.png
  - public/paw-prints/shrewy_paw.png
  - public/characters/li-bai/li-bai_waiting.png
  - public/characters/mama/_staging/reference-guagua-drawing.jpg
---

# 妈妈 (Mom) Café visitor

Reference images (in attached order):

1. Café. The room she visits. A soft, hand-painted isometric storybook café in warm cream and butter-yellow, with sage-green accents (the door, the register, the towel), honey-coloured wood and gentle brown linework. Match this style and palette exactly.
2. Shrewy. The game's chef, a chubby grey tabby cat in a white chef hat and a sage-green apron. Match his proportions and finish: a big round head about a third of his height, a small soft body, rosy cheeks, clean soft outlines, gentle shading, no harsh shadows.
3. Shrewy's paw stamp. Another character's token. A round sage-green badge with a cream paw, a chef hat and small sparkles. Mom's token should feel like a matching set: the same round badge shape and finish, in her own colours and motif.
4. Li Bai (an approved visitor). Another visitor to the same café. Match his size, chibi proportions, line weight and finish, so the two look like they belong to one game.
5. A child's drawing of Mom. This is who she is: follow her look (hair, glasses, clothes, sandals, colours) closely, but draw her in the game's style from images 1, 2 and 4, not in crayon.

Prompt:

Draw Mom (妈妈), as drawn by her daughter in image 5, as a visitor to the café in image 1. Use the same soft, hand-painted storybook style as images 1, 2 and 4. She's an original cute character for a children's Chinese-learning game. Don't model her on any existing video game's characters or art style.

Mom: a warm, cheerful young mom with Shrewy's chibi proportions (image 2): a big round head about a third of her height and a small body. Follow image 5:

- Long, straight, dark-brown hair well past her shoulders, flowing a little to one side.
- Navy-blue rectangular glasses, kind brown eyes, rosy cheeks and a gentle smile.
- A white T-shirt with a navy collar and navy sleeve trim. Where the drawing has words on the shirt, put a small navy open-book emblem instead (no letters).
- Light beige jogger pants with a drawstring, gathered at the ankles.
- Beige sandals.

She grades her daughter's math homework every day, so her props are a red pen and a sheet of math homework with big red check marks and a big red **A+** at the top.

Not allowed: no cups, mugs, bottles or anything to drink from, no weapons, nothing scary. This is a children's game.

Draw three separate images:

1. **Waiting** (`mama_waiting.png`): standing, facing us in a three-quarter view turned slightly to the left. She holds the homework sheet against her chest in one hand and the red pen in the other, with a warm, hopeful smile, as if about to order food. Full body, both feet on the ground.
2. **Delighted** (`mama_delighted.png`): the same character, at the same size and in the same spot on the canvas. She's thrilled with her meal: eyes curved shut with joy, a big smile, holding the homework sheet up beside her face so the big red A+ shows, as a thank-you gift. A few small golden sparkles near the sheet. Keep the raised arm and the sheet close to her body, and the hair falling close to her too: a wide pose makes both sprites smaller in the game.
3. **Token** (`mama_token.png`): her payment, an A+ homework sheet. A round badge in the same shape and finish as image 3, in cream and navy with red accents: a small sheet of homework paper with two or three red check marks and a big red A+ in the middle, plus one or two sparkles. Keep it simple and bold so it still reads as a tiny icon.

Technical:

- **Waiting and Delighted:** 960 × 1080 px PNG with a real transparent background (alpha), not a white or checkerboard background.
  - Full body, centred left to right. The feet sit about 30 px above the bottom edge, and the top of the head about 40 px below the top edge.
  - Both images use the same scale and feet position, so swapping one for the other doesn't make her jump.
- **Token:** 512 × 512 px PNG with a real transparent background. The round badge fills about 90% of the canvas, centred.
  - It must still read at 28 px wide, and still read when shown in grey at one-third opacity (that's how a spent token looks). So use big, simple shapes and strong contrast.
- **Small on screen:** in the game the character is shown only about 220 px wide over the café. Keep shapes big and clear, and avoid fine detail that would turn to mush.
- **Isolated only:** no background, floor, shadow on a floor, room, speech bubble or dialogue box. The game draws the café and her speech bubble itself.
- **The only writing allowed is the big red "A+"** on the homework sheet and the token. No other letters, numbers, Chinese characters, names, labels or watermark: on the shirt use the book emblem, and on the homework use soft wavy strokes that only suggest sums.
- **If you can't give real transparency,** use a flat pure green background (#00FF00) with nothing else on it, never a checkerboard.

---

## Copy for Shop Admin (not for the design agent)

Enter in Shop Admin → Café Characters. Line format in the admin form: `English | 中文`, one per row. The speech bubble is small (about 13 Chinese characters per line), so keep lines to about 24 Chinese characters or 60 English characters.

- **Key:** `mama`
- **Name:** Mom | 妈妈
- **Intro:** Mom grades math homework every day. Earn an A+! | 妈妈每天批改数学作业，来拿个A+吧！
- **Token name:** A+ homework | A+作业纸
- **Paths:** token `/characters/mama/mama_token.png`; waiting `/characters/mama/mama_waiting.png`; delighted `/characters/mama/mama_delighted.png`
- **Visits:** up to 3 a day to start; the owner tunes this in prod Shop Admin

**Ordering**
```
Homework all done? Then a milk tea for me, please! | 作业写完了吗？先给妈妈来杯奶茶！
Grading is tiring. I'd love some soup dumplings! | 改作业好累呀，想吃小笼包！
Mom's done with work! What's good today? | 妈妈下班啦，今天有什么好吃的？
```

**After being served**
```
Delicious! Here's an A+ for you! | 真好吃！给你一张A+作业纸！
You made this perfectly. Full marks! | 这一份做得太棒了，满分！
Thank you, sweetie! Mom is so happy! | 谢谢宝贝，妈妈好开心！
```

**When sent away**
```
That's okay. I'll come back after grading. | 没关系，妈妈改完作业再来。
Okay, see you tomorrow! | 好的，那我们明天见！
```

**Token content (math puzzles for grades 3–4).** Each A+ sheet carries one classic 趣味数学题, **question only** (owner, 2026-11-27: no answers on the token).

| Title | Text |
|---|---|
| 鸡兔同笼 | 笼子里有鸡和兔一共8只，数一数一共有22只脚。鸡和兔各有几只？ |
| 植树问题 | 一条小路长20米，从头到尾每隔5米种一棵树，两头都要种。一共要种几棵树？ |
| 锯木头 | 把一根木头锯成4段，每锯一次要3分钟。一共要锯几分钟？ |
| 妈妈的年龄 | 妈妈今年35岁，孩子今年8岁。几年后，妈妈的年龄正好是孩子的4倍？ |
| 爬楼梯 | 从1楼走到3楼要走36级台阶。照这样，从1楼走到6楼要走几级台阶？ |
| 握握手 | 4个小朋友见面，每两个人都要握一次手。一共握了几次手？ |
| 分糖果 | 两个盒子里一共有20颗糖，第一盒比第二盒多4颗。每盒各有几颗糖？ |
| 敲钟 | 大钟敲3下要用2秒。照这样，敲6下要用几秒？ |

**Answer key (for Mom only; not entered in the game):**

| Title | Answer |
|---|---|
| 鸡兔同笼 | 鸡5只、兔3只 |
| 植树问题 | 5棵 |
| 锯木头 | 9分钟 |
| 妈妈的年龄 | 1年后 |
| 爬楼梯 | 90级 |
| 握握手 | 6次 |
| 分糖果 | 第一盒12颗、第二盒8颗 |
| 敲钟 | 5秒 |

**Orders (suggested, owner to decide).** 小笼包 and 肉粽 are pinned, so a plain 包子 or a plain 粽子 doesn't count:

- 珍珠奶茶 (any kind) × 1 → 1 A+作业纸
- 小笼包 × 2 → 2
- 肉粽 × 2 → 2
- 小笼包 × 1 + 珍珠奶茶 × 1 → 2
- 藏式甜茶 × 1 → 2 (a mystery food: only once the child has unlocked it, so this order is rarely fillable)

---

## Redo request: the homework sheet (for the design agent)

Attach, in order: (1) `_staging/Chibi_mom_holding_homework_3084ed4e.jpg` (waiting), (2) `_staging/Chibi_mom_holding_homework_sheet_be3b7ae0.jpg` (delighted).

Prompt:

Edit only the math homework sheet in images 1 and 2. Keep everything else exactly the same: the character, her pose, colours, size, position on the canvas, and the flat pure green background (#00FF00).

On the sheet, keep the word "math" and the big red circled "A+" at the top. Replace all the other writing with exactly these four sums, one per line, each followed by a red check mark, in large, clear, neat handwriting:

- 3 + 4 = 7 ✓
- 9 − 5 = 4 ✓
- 6 × 7 = 42 ✓
- 24 ÷ 6 = 4 ✓

This is a math game for children, so every sum must be correct: check each digit. Don't add any other numbers, letters or sums. If you can't write them clearly and correctly, use soft wavy lines with red check marks instead of numbers.
