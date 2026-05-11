-- ============================================================================
-- Tournament duplicate-creation race fix — 2026-05-11
-- ============================================================================
-- Drafted by QA audit. DO NOT auto-apply. Review with Pascal first.
--
-- Why this exists
-- startTournamentFromLobby in store.ts:325 runs client-side. With
-- tennis-server returning 401 (see audit P0-2), there is no server
-- coordinator. Two players tapping "Join tournament" at 5→6 within the
-- same second both run partition/cluster logic and both upsert a new
-- tournament row. Result: duplicate tournaments for overlapping rosters.
--
-- A unique partial index makes the second upsert fail at the DB layer.
-- The frontend's `else upsert` fallback in sync.ts then re-fetches and
-- joins the existing tournament.
--
-- Preconditions checked
--   • tournaments.county is a top-level text column (lowercased by CHECK
--     constraint).
--   • genderGroup, skillGroup, status live inside the data JSONB. The
--     index uses jsonb path expressions.
--   • If duplicates already exist in the live DB at apply time, the
--     CREATE UNIQUE INDEX will fail. The DO block below detects this and
--     reports the offending rows instead of silently failing.
-- ============================================================================

begin;

do $$
declare
  dup_count int;
begin
  select count(*) into dup_count
  from (
    select county, data->>'genderGroup' as g, data->>'skillGroup' as s, count(*) as n
    from public.tournaments
    where data->>'status' = 'setup'
    group by county, data->>'genderGroup', data->>'skillGroup'
    having count(*) > 1
  ) x;

  if dup_count > 0 then
    raise exception 'Cannot create unique index: % duplicate (county, genderGroup, skillGroup) setup tournaments already exist. Resolve manually first.', dup_count;
  end if;
end $$;

create unique index if not exists tournaments_unique_setup_per_partition
  on public.tournaments (
    county,
    (data->>'genderGroup'),
    (data->>'skillGroup')
  )
  where data->>'status' = 'setup';

comment on index tournaments_unique_setup_per_partition is
  'Prevents the duplicate-tournament race when two players join a lobby simultaneously. Second upsert fails at the DB layer; frontend falls back to fetching the existing row.';

commit;
