-- Wishlist reward photos (roadmap item U follow-up, authorized by the owner 2026-11-26).
-- Spec: docs/feature-specs/2026-11-21-cafe-visitors-character-tokens-wishlist.md
--
-- A parent (or the platform admin) can attach one optional photo of the real item to a
-- wishlist reward, so the child can see it. Photos live in a PRIVATE storage bucket under
-- a folder named after the family: "<family_id>/<file>". Only that family can read them,
-- and only its parents (or the platform admin) can add, replace or remove them.

-- 1. The bucket. Private: the app shows photos through short-lived signed URLs. The app
--    shrinks every photo to a JPEG before upload, so 2 MB is plenty.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist-photos', 'wishlist-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 2. Access rules on the files, by the family folder.
create policy "wishlist-photos: family read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'wishlist-photos'
  and (
    (storage.foldername(name))[1] = public.current_family_id()::text
    or public.is_platform_admin()
  )
);

create policy "wishlist-photos: parent insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'wishlist-photos'
  and (storage.foldername(name))[1] = public.current_family_id()::text
  and (
    public.is_platform_admin()
    or exists (select 1 from public.users u where u.id = public.current_user_id() and u.role = 'parent')
  )
);

create policy "wishlist-photos: parent update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'wishlist-photos'
  and (storage.foldername(name))[1] = public.current_family_id()::text
  and (
    public.is_platform_admin()
    or exists (select 1 from public.users u where u.id = public.current_user_id() and u.role = 'parent')
  )
)
with check (
  bucket_id = 'wishlist-photos'
  and (storage.foldername(name))[1] = public.current_family_id()::text
);

create policy "wishlist-photos: parent delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'wishlist-photos'
  and (storage.foldername(name))[1] = public.current_family_id()::text
  and (
    public.is_platform_admin()
    or exists (select 1 from public.users u where u.id = public.current_user_id() and u.role = 'parent')
  )
);

-- 3. The reward remembers its photo's path in the bucket (null = no photo).
alter table wishlist_rewards
  add column image_path text check (image_path is null or char_length(image_path) between 1 and 300);

-- 4. save_wishlist_reward gains the photo. p_image_path is the reward's full photo state:
--    a path in the caller's own family folder that really exists, or null for none. The
--    old 6-argument version is replaced (the new parameter has a default).
drop function if exists save_wishlist_reward(uuid, text, uuid, boolean, boolean, jsonb);

create or replace function save_wishlist_reward(
  p_reward_id uuid,
  p_title text,
  p_child_user_id uuid,
  p_is_repeatable boolean,
  p_is_active boolean,
  p_prices jsonb,
  p_image_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_reward_id uuid := p_reward_id;
  v_title text := btrim(coalesce(p_title, ''));
  v_count integer;
  v_distinct integer;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'parent' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  if char_length(v_title) not between 1 and 60 then
    return jsonb_build_object('success', false, 'code', 'invalid_title');
  end if;

  if p_child_user_id is not null and not exists (
    select 1 from users where id = p_child_user_id and family_id = v_family_id and role = 'child'
  ) then
    return jsonb_build_object('success', false, 'code', 'invalid_child');
  end if;

  if p_prices is null or jsonb_typeof(p_prices) <> 'array' or jsonb_array_length(p_prices) = 0 then
    return jsonb_build_object('success', false, 'code', 'invalid_price');
  end if;

  select count(*), count(distinct x."characterKey") into v_count, v_distinct
  from jsonb_to_recordset(p_prices) as x("characterKey" text, "tokenCount" integer)
  join shop_characters c on c.character_key = x."characterKey"
  where x."tokenCount" between 1 and 999;

  if v_count <> jsonb_array_length(p_prices) or v_distinct <> v_count then
    return jsonb_build_object('success', false, 'code', 'invalid_price');
  end if;

  -- A photo must be an uploaded file in this family's own folder.
  if p_image_path is not null and (
    char_length(p_image_path) > 300
    or split_part(p_image_path, '/', 1) <> v_family_id::text
    or not exists (
      select 1 from storage.objects o where o.bucket_id = 'wishlist-photos' and o.name = p_image_path
    )
  ) then
    return jsonb_build_object('success', false, 'code', 'invalid_image');
  end if;

  if v_reward_id is null then
    insert into wishlist_rewards (family_id, user_id, title, is_repeatable, is_active, created_by_user_id, image_path)
    values (
      v_family_id, p_child_user_id, v_title, coalesce(p_is_repeatable, false), coalesce(p_is_active, true), v_user_id, p_image_path
    )
    returning id into v_reward_id;
  else
    update wishlist_rewards
    set title = v_title,
        user_id = p_child_user_id,
        is_repeatable = coalesce(p_is_repeatable, false),
        is_active = coalesce(p_is_active, true),
        image_path = p_image_path,
        updated_at = now()
    where id = v_reward_id and family_id = v_family_id;
    if not found then
      return jsonb_build_object('success', false, 'code', 'unknown_reward');
    end if;
    delete from wishlist_reward_prices where reward_id = v_reward_id;
  end if;

  insert into wishlist_reward_prices (reward_id, character_key, token_count)
  select v_reward_id, x."characterKey", x."tokenCount"
  from jsonb_to_recordset(p_prices) as x("characterKey" text, "tokenCount" integer);

  return jsonb_build_object('success', true, 'rewardId', v_reward_id);
end;
$$;

revoke execute on function save_wishlist_reward(uuid, text, uuid, boolean, boolean, jsonb, text) from public, anon;
grant execute on function save_wishlist_reward(uuid, text, uuid, boolean, boolean, jsonb, text) to authenticated;
