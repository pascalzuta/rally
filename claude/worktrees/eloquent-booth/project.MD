# Project Log

## 2026-02-27
- Corrected Fund Advisors section on Team page using source content from https://greenroompartners.com/advisory-board.
- Replaced advisor bios with source-accurate summaries shortened by roughly 60%.
- Updated advisor photo URLs to official advisory-board image links with encoded crop parameters for reliability.
- Mirrored the same corrections in `GRP-alt/team.html` to keep instances aligned.
- Updated Team page advisor role labels: René Gamboa is now "Legal Advisor" and Hanno Fichtner is now "Strategy Advisor".
- 2026-02-27: Enabled CMS visibility on all subpages when logged in (including News and Post), removed page exclusions, and fixed CMS image-migration initialization bug in cms.js.
- 2026-02-27: Fixed CMS availability after Partner Login by forcing page reload on login/logout (GRP + GRP-alt). Bumped app.js cache-bust to v=20260227b.
- 2026-02-27: Updated mobile nav (<=780px) to open as a bottom-anchored sheet above iPhone bottom toolbar/safe area for easier testing. Bumped styles.css cache-bust to v=20260227n (GRP + GRP-alt).
- 2026-02-27 (rollback): Restored GRP to post-CMS-all-pages baseline by reverting later global login reload and bottom-anchored mobile nav changes. Asset refs reset to styles.css?v=20260225m and app.js?v=20260225n.
- 2026-02-28: Added full-site password gate in GRP frontend. Site is blocked until password `wimbledon` is entered (localStorage key grp-site-gate-auth-v1).
- 2026-03-01: Documented migration path away from localStorage to Netlify + Supabase (DB-backed CMS/blog). Pending credentials: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Goal: content persistence across deploys and server-side auth/API.
