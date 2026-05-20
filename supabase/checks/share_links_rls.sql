-- Hand-runnable RLS check for share_links. Two assertions:
--   1. Anon role sees zero rows in share_links.
--   2. Authenticated user A sees zero of user B's rows.
--
-- Run in the Supabase SQL editor. Substitute REAL_USER_A_UUID /
-- REAL_USER_B_UUID with two real account IDs from the project.

-- ── Assertion 1 ──────────────────────────────────────────────────
-- Anon sees nothing
set local role anon;
select count(*) as anon_visible_rows from public.share_links;
-- expected: 0

reset role;

-- ── Assertion 2 ──────────────────────────────────────────────────
-- User A cannot see User B's rows
set local role authenticated;
set local request.jwt.claims = '{"sub":"REAL_USER_A_UUID","role":"authenticated"}';
select count(*) as user_a_visible_b_rows
from public.share_links
where owner_id = 'REAL_USER_B_UUID';
-- expected: 0

reset role;
