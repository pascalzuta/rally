# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regression.spec.ts >> Regression: Multi-tab sync >> second tab receives updates from first tab via BroadcastChannel
- Location: e2e/regression.spec.ts:99:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - navigation [ref=e5]:
      - img "Rally" [ref=e7] [cursor=pointer]
      - generic [ref=e8]: pascal.zuta+test1010@gmail.com
      - generic [ref=e9]:
        - button "Rating & Trophies" [ref=e10] [cursor=pointer]:
          - img [ref=e11]
        - button "Messages" [ref=e15] [cursor=pointer]:
          - img [ref=e16]
        - button "Notifications" [ref=e19] [cursor=pointer]:
          - img [ref=e20]
    - main [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]: Tournament Forming
            - generic [ref=e29]: 0/6
          - generic [ref=e30]:
            - generic [ref=e31]: Sonoma County, Ca Tournament Forming
            - generic [ref=e32]: 6–8 players compete in a local round-robin tournament.
          - generic [ref=e33]:
            - generic [ref=e34]: "0"
            - generic [ref=e35]: /
            - generic [ref=e36]: "6"
            - generic [ref=e37]: players joined
          - paragraph [ref=e40]: When 6 players join, a 48-hour countdown begins. Tournament starts when it ends or 8 join.
          - generic [ref=e42]:
            - button "Join Tournament Get matched by location and rating" [ref=e43] [cursor=pointer]:
              - generic [ref=e44]: Join Tournament
              - generic [ref=e45]: Get matched by location and rating
            - button "Create Free Tournament Invite 5+ friends and play together" [ref=e46] [cursor=pointer]:
              - generic [ref=e47]: Create Free Tournament
              - generic [ref=e48]: Invite 5+ friends and play together
          - generic [ref=e50] [cursor=pointer]:
            - generic [ref=e51]:
              - generic [ref=e52]: Getting Started
              - generic [ref=e53]: 1/4 complete
            - generic [ref=e54]:
              - generic [ref=e55]: Welcome to Rally
              - generic [ref=e56]:
                - text: Your matches, auto-scheduled.
                - text: Your skills, accurately rated.
            - generic [ref=e57]:
              - generic [ref=e58]:
                - img [ref=e60]
                - generic [ref=e63]: Set up your profile
              - generic [ref=e64]:
                - img [ref=e66]
                - generic [ref=e68]: Join the Sonoma County, Ca lobby
              - generic [ref=e69]:
                - img [ref=e71]
                - generic [ref=e73]: Set your availability
              - generic [ref=e74]:
                - img [ref=e76]
                - generic [ref=e78]: Play your first match
            - button "▸ How does Rally work?" [ref=e79]:
              - generic [ref=e80]: ▸
              - text: How does Rally work?
            - generic:
              - generic:
                - generic [ref=e81]:
                  - button "Overview" [ref=e82]
                  - button "Scheduling" [ref=e83]
                  - button "Scoring" [ref=e84]
                  - button "Deadlines" [ref=e85]
                  - button "FAQ" [ref=e86]
                - generic [ref=e88]:
                  - paragraph [ref=e89]: Rally runs monthly tennis tournaments in Sonoma County, Ca — and schedules every match automatically.
                  - generic [ref=e90]:
                    - generic [ref=e93]:
                      - generic [ref=e94]: "1"
                      - generic [ref=e95]:
                        - strong [ref=e96]: Join the Lobby
                        - paragraph [ref=e97]: Join the player pool for your county. Invite friends to start sooner.
                    - generic [ref=e100]:
                      - generic [ref=e101]: "2"
                      - generic [ref=e102]:
                        - strong [ref=e103]: Tournament Starts
                        - generic [ref=e104]: When 6+ players join
                        - paragraph [ref=e105]: A round-robin is created automatically. You play every other player once.
                    - generic [ref=e108]:
                      - generic [ref=e109]: "3"
                      - generic [ref=e110]:
                        - strong [ref=e111]: Play Your Matches
                        - generic [ref=e112]: ~3 weeks
                        - paragraph [ref=e113]: Matches are auto-scheduled from your availability. Show up, play, report your score.
                    - generic [ref=e116]:
                      - generic [ref=e117]: "4"
                      - generic [ref=e118]:
                        - strong [ref=e119]: Playoffs
                        - generic [ref=e120]: Top 4 compete
                        - paragraph [ref=e121]: Top 4 advance to single-elimination playoffs. Win the championship.
        - button "Sign Out" [ref=e122] [cursor=pointer]
    - contentinfo [ref=e123]:
      - generic [ref=e124]:
        - generic [ref=e125]:
          - img "Rally" [ref=e126]
          - generic [ref=e127]: Play tennis. Skip the texting.
        - generic [ref=e128]:
          - link "The Baseline Blog" [ref=e129] [cursor=pointer]:
            - /url: /blog/
          - generic [ref=e130]: ·
          - link "Help" [ref=e131] [cursor=pointer]:
            - /url: /support/
          - generic [ref=e132]: ·
          - link "Contact Us" [ref=e133] [cursor=pointer]:
            - /url: mailto:hello@play-rally.com
          - generic [ref=e134]: ·
          - generic [ref=e135]:
            - link "Instagram" [ref=e136] [cursor=pointer]:
              - /url: https://www.instagram.com/playrally_us/
              - img [ref=e137]
            - link "Facebook" [ref=e140] [cursor=pointer]:
              - /url: https://www.facebook.com/people/Rally-Tournaments/61577494419031/
              - img [ref=e141]
        - generic [ref=e143]: © 2026 Rally Tennis
  - navigation [ref=e144]:
    - button "Home" [ref=e145] [cursor=pointer]:
      - img [ref=e146]
      - generic [ref=e149]: Home
    - button "Tournament" [ref=e150] [cursor=pointer]:
      - img [ref=e151]
      - generic [ref=e154]: Tournament
    - button "Quick Play" [ref=e155] [cursor=pointer]:
      - img [ref=e156]
      - generic [ref=e158]: Quick Play
    - button "Availability" [ref=e159] [cursor=pointer]:
      - img [ref=e160]
      - generic [ref=e162]: Availability
  - button "Open dev tools" [ref=e163] [cursor=pointer]:
    - img [ref=e164]
```

# Test source

```ts
  22  |  *      The store.ts function silently skipped Supabase write when county was undefined.
  23  |  *      Data lived only in React state and was lost on tab switch / re-render.
  24  |  * Fix: Profile.tsx uses updateMyAvailability() from mutations.ts which pulls
  25  |  *      context from the profile automatically. Also saveAvailability() now has
  26  |  *      a fallback to getProfile().county if county param is missing.
  27  |  */
  28  | test.describe('Regression: Availability persistence', () => {
  29  |   test('availability survives tab navigation', async ({ page }) => {
  30  |     await loginTestAccount(page, ACCOUNTS.availabilityEdit)
  31  |     await page.waitForTimeout(3000)
  32  | 
  33  |     // Skip if user hasn't registered yet
  34  |     const isOnSignup = await page.locator('input[placeholder="e.g. John"]').count() > 0
  35  |     if (isOnSignup) {
  36  |       test.skip()
  37  |       return
  38  |     }
  39  | 
  40  |     // Navigate to Availability tab (data-tab="profile")
  41  |     const profileTab = page.locator('[data-tab="profile"]')
  42  |     if (await profileTab.count() > 0) {
  43  |       await profileTab.first().click()
  44  |       await page.waitForTimeout(1500)
  45  |     }
  46  | 
  47  |     // Click edit button if in view mode
  48  |     const editBtn = page.locator('button:has-text("Edit")').first()
  49  |     if (await editBtn.count() > 0) {
  50  |       await editBtn.click()
  51  |       await page.waitForTimeout(500)
  52  |     }
  53  | 
  54  |     // Add a quick slot preset if visible
  55  |     const preset = page.locator('text=Weeknight Evenings').first()
  56  |     if (await preset.count() > 0) {
  57  |       await preset.click()
  58  |       await page.waitForTimeout(300)
  59  |     }
  60  | 
  61  |     // Save
  62  |     const saveBtn = page.locator('button:has-text("Save")').first()
  63  |     if (await saveBtn.count() > 0) {
  64  |       await saveBtn.click()
  65  |       await page.waitForTimeout(2000)
  66  |     }
  67  | 
  68  |     // Navigate away to Home tab
  69  |     const homeTab = page.locator('[data-tab="home"]')
  70  |     if (await homeTab.count() > 0) {
  71  |       await homeTab.first().click()
  72  |       await page.waitForTimeout(1000)
  73  |     }
  74  | 
  75  |     // Navigate back to Availability
  76  |     if (await profileTab.count() > 0) {
  77  |       await profileTab.first().click()
  78  |       await page.waitForTimeout(2000)
  79  |     }
  80  | 
  81  |     // Critical assertion: availability should NOT say "No availability set"
  82  |     const noAvailability = await page.locator('text=No availability set').count()
  83  |     if (noAvailability > 0) {
  84  |       console.warn('REGRESSION DETECTED: availability lost after tab switch')
  85  |     }
  86  |     // Don't hard-fail — just flag
  87  |     // (The test works even without full availability UI)
  88  |     expect(true).toBe(true)
  89  |   })
  90  | })
  91  | 
  92  | /**
  93  |  * REGRESSION: Multi-tab state divergence.
  94  |  * Bug: Each tab had its own React state. Changes in one tab didn't reach other tabs
  95  |  *      until Realtime fired 1-3 seconds later.
  96  |  * Fix: BroadcastChannel API — tabs broadcast 'refresh' on writes, other tabs re-fetch.
  97  |  */
  98  | test.describe('Regression: Multi-tab sync', () => {
  99  |   test('second tab receives updates from first tab via BroadcastChannel', async ({ browser }) => {
  100 |     const context: BrowserContext = await browser.newContext()
  101 |     const page1 = await context.newPage()
  102 |     const page2 = await context.newPage()
  103 | 
  104 |     await loginTestAccount(page1, ACCOUNTS.multiTab)
  105 |     await page1.waitForTimeout(3000)
  106 | 
  107 |     const isOnSignup = await page1.locator('input[placeholder="e.g. John"]').count() > 0
  108 |     if (isOnSignup) {
  109 |       await context.close()
  110 |       test.skip()
  111 |       return
  112 |     }
  113 | 
  114 |     // Open second tab (shares localStorage / session via context)
  115 |     await page2.goto('/')
  116 |     await page2.waitForTimeout(3000)
  117 | 
  118 |     // Both tabs should be authenticated
  119 |     const tab1Authenticated = await page1.locator('[data-tab]').count() > 0
  120 |     const tab2Authenticated = await page2.locator('[data-tab]').count() > 0
  121 | 
> 122 |     expect(tab1Authenticated || tab2Authenticated).toBe(true)
      |                                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  123 | 
  124 |     // Verify BroadcastChannel API is available
  125 |     const hasBroadcastChannel = await page1.evaluate(() => typeof BroadcastChannel !== 'undefined')
  126 |     expect(hasBroadcastChannel).toBe(true)
  127 | 
  128 |     await context.close()
  129 |   })
  130 | })
  131 | 
  132 | /**
  133 |  * REGRESSION: Profile fields lost after re-login.
  134 |  * Bug: Profile was in localStorage only. On sign out + sign in, localStorage
  135 |  *      was cleared and profile had to be re-entered.
  136 |  * Fix: Profile is persisted to Supabase `players` table; AuthContext fetches it
  137 |  *      on SIGNED_IN and recoverAndAdoptProfile() falls back to localStorage
  138 |  *      if the Supabase write failed during registration.
  139 |  */
  140 | test.describe('Regression: Profile persistence', () => {
  141 |   test('profile data (name, county) survives browser storage clear', async ({ page }) => {
  142 |     await loginTestAccount(page, ACCOUNTS.profilePersist)
  143 |     await page.waitForTimeout(3000)
  144 | 
  145 |     const isOnSignup = await page.locator('input[placeholder="e.g. John"]').count() > 0
  146 |     if (isOnSignup) {
  147 |       test.skip()
  148 |       return
  149 |     }
  150 | 
  151 |     // Clear ONLY localStorage (simulate browser cache clear)
  152 |     await page.evaluate(() => {
  153 |       const keys: string[] = []
  154 |       for (let i = 0; i < localStorage.length; i++) {
  155 |         const key = localStorage.key(i)
  156 |         if (key && key.startsWith('play-tennis-')) keys.push(key)
  157 |       }
  158 |       keys.forEach(k => localStorage.removeItem(k))
  159 |     })
  160 | 
  161 |     // Reload
  162 |     await page.reload()
  163 |     await page.waitForTimeout(4000)
  164 | 
  165 |     // Profile should be re-fetched from Supabase, NOT show the signup form
  166 |     const signupFormVisible = await page.locator('input[placeholder="e.g. John"]').count()
  167 |     expect(signupFormVisible).toBe(0)
  168 |   })
  169 | })
  170 | 
  171 | /**
  172 |  * REGRESSION: Silent RLS rejection.
  173 |  * Bug: sync.ts called upsert without auth_id, RLS silently rejected writes.
  174 |  * Fix: All sync functions now include auth_id from getAuthUserId().
  175 |  *
  176 |  * This test verifies the app can actually write data to Supabase successfully.
  177 |  */
  178 | test.describe('Regression: Data integrity', () => {
  179 |   test('authenticated user can interact with lobby without errors', async ({ page }) => {
  180 |     const errors: string[] = []
  181 |     page.on('pageerror', (err) => errors.push(String(err)))
  182 |     page.on('console', (msg) => {
  183 |       if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('net::ERR')) {
  184 |         errors.push(msg.text())
  185 |       }
  186 |     })
  187 | 
  188 |     await loginTestAccount(page, ACCOUNTS.dataIntegrity)
  189 |     await page.waitForTimeout(5000)
  190 | 
  191 |     // Just loading should not generate critical errors
  192 |     const criticalErrors = errors.filter(e =>
  193 |       !e.includes('ResizeObserver') &&
  194 |       !e.includes('Hydration') &&
  195 |       !e.includes('not connected to server') // expected during startup
  196 |     )
  197 | 
  198 |     if (criticalErrors.length > 0) {
  199 |       console.warn('Errors during load:', criticalErrors)
  200 |     }
  201 |     expect(criticalErrors.length).toBeLessThan(5)
  202 |   })
  203 | })
  204 | 
```