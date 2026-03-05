-- Correction: avatar_id valid values
-- Initial schema listed ramen_excited_1 and babaorice_smile_1.
-- Actual files in /public/avatar/ are ramen_calm_1 and tangyuan_smile_1.
-- This migration updates the column comment to match the filesystem source of truth.

comment on column users.avatar_id is
  'Filename stem matching /public/avatar/{avatar_id}.png. Valid values: '
  'bubble_tea_excited_1, bun_wink_1, cake_sleep_1, donut_wink_1, '
  'ramen_calm_1, rice_ball_sleep_1, tangyuan_smile_1, zongzi_smile_1';
