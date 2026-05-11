-- ============================================================================
-- Pre-beta RLS lockdown — 2026-05-11
-- ============================================================================
-- Drafted by QA audit. DO NOT auto-apply. Review with Pascal first.
-- Apply via Supabase dashboard SQL editor OR `npx supabase db push`.
--
-- Why this exists
-- Today, the public anon key (shipped in the JS bundle) can:
--   • DELETE every row of `lobby` and `tournaments`
--   • UPDATE any tournament JSON
--   • SELECT every player's email, name, county
-- A single curious friend with devtools can wipe the beta. This migration
-- removes the wide-open `anon ALL true/true` policies that coexist with
-- (correct) authenticated policies, and restricts `players` SELECT to the
-- row's owner so emails stop leaking.
--
-- Frontend impact (verified by grep):
--   • The only direct read of `players` is fetchPlayerProfile, scoped to
--     auth_id = userId. Restricting SELECT to own row is safe.
--   • All lobby/tournament/ratings/availability writes go through the
--     authenticated client. Authenticated policies (auth_id = auth.uid())
--     already exist on every table below and keep working.
--   • The `Public read` policy on lobby/tournaments/ratings is preserved
--     so the home-screen counter and bracket display still work for
--     non-authed views (e.g. share links).
-- ============================================================================

begin;

-- --- lobby ----------------------------------------------------------------
-- Authenticated users keep their own-row write policy.
-- Public read stays (the home counter needs it). Anon write is removed.
drop policy if exists "Anon write lobby migration" on public.lobby;

-- --- tournaments ----------------------------------------------------------
-- Same shape as lobby.
drop policy if exists "Anon write tournaments migration" on public.tournaments;
-- The "Authenticated write tournaments migration" policy currently uses
-- qual=true / with_check=true (any signed-in user can mutate any tournament).
-- That's still too loose. Replace it with a check that the caller is a
-- listed player.
drop policy if exists "Authenticated write tournaments migration" on public.tournaments;
create policy "Authenticated write own tournaments" on public.tournaments
  for all
  to authenticated
  using (
    -- Allow read/write if the caller's auth.uid()::text is in data->players[].id
    exists (
      select 1
      from jsonb_array_elements(coalesce(data->'players', '[]'::jsonb)) p
      where p->>'id' = auth.uid()::text
    )
    -- Or the tournament has no players yet (initial create) and the caller
    -- is authenticated. Bootstrapping case.
    or jsonb_array_length(coalesce(data->'players', '[]'::jsonb)) = 0
  )
  with check (
    exists (
      select 1
      from jsonb_array_elements(coalesce(data->'players', '[]'::jsonb)) p
      where p->>'id' = auth.uid()::text
    )
    or jsonb_array_length(coalesce(data->'players', '[]'::jsonb)) = 0
  );

-- --- ratings --------------------------------------------------------------
drop policy if exists "Anon write ratings migration" on public.ratings;

-- --- availability ---------------------------------------------------------
drop policy if exists "Anon write availability" on public.availability;

-- --- players: stop leaking email ------------------------------------------
-- Drop the wide public-read policy.
drop policy if exists "Public read" on public.players;
-- Replace with own-row read for authenticated users. fetchPlayerProfile
-- only ever reads with .eq('auth_id', userId), so this is sufficient.
create policy "Authenticated read own player" on public.players
  for select
  to authenticated
  using (auth_id = auth.uid());
-- Insert and update policies are unchanged ("Own player insert", "Own
-- player update") and continue working.

-- --- rating_history: keep public read, restrict write ---------------------
-- The Rating panel reads other players' history aggregates. Keep SELECT
-- open. But the "Allow all for rating_history" policy is currently ALL/true
-- which lets anon WRITE too. Tighten.
drop policy if exists "Allow all for rating_history" on public.rating_history;
create policy "Public read rating_history" on public.rating_history
  for select using (true);
create policy "Authenticated write own rating_history" on public.rating_history
  for insert to authenticated with check (auth_id = auth.uid());
create policy "Authenticated update own rating_history" on public.rating_history
  for update to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- --- trophies / badges: same pattern --------------------------------------
drop policy if exists "Allow all for trophies" on public.trophies;
create policy "Public read trophies" on public.trophies
  for select using (true);
create policy "Authenticated write own trophies" on public.trophies
  for insert to authenticated with check (auth_id = auth.uid());
create policy "Authenticated update own trophies" on public.trophies
  for update to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());

drop policy if exists "Allow all for badges" on public.badges;
create policy "Public read badges" on public.badges
  for select using (true);
create policy "Authenticated write own badges" on public.badges
  for insert to authenticated with check (auth_id = auth.uid());
create policy "Authenticated update own badges" on public.badges
  for update to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- ============================================================================
-- Verification queries to run after applying
-- ============================================================================
-- 1. Anon DELETE on lobby should now return 401/permission denied:
--    curl -X DELETE 'https://gxiflulfgqahlvdirecz.supabase.co/rest/v1/lobby?player_id=eq.fake' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
-- 2. Anon SELECT * on players should no longer return email:
--    curl 'https://gxiflulfgqahlvdirecz.supabase.co/rest/v1/players?select=*&limit=1' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--    Should return [] (no rows visible to anon) or rows with restricted columns.
--
-- 3. The signed-in app at staging.play-rally.com still works (sign in →
--    lobby join → bracket views → rating panel all load).

commit;
