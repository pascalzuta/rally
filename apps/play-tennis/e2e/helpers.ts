import { Page, expect } from '@playwright/test'

/**
 * Login a test account by entering the email.
 * Test accounts (pascal.zuta+testNNNN) auto-authenticate via edge function —
 * no OTP needed.
 */
export async function loginTestAccount(page: Page, testNumber: number) {
  const email = `pascal.zuta+test${testNumber}@gmail.com`

  await page.goto('/')
  await page.waitForTimeout(2000)

  // If already logged in, we're done
  const hasAppUI = await page.locator('text=Start Tournament').or(page.locator('text=Start Competing')).or(page.locator('[data-tab]')).count()
  if (hasAppUI > 0 && !(await page.locator('input[type="email"]').count())) {
    return
  }

  // Navigate to signup page — the landing page has "Get started" or "Sign up for free" buttons
  const emailInput = page.locator('input[type="email"]')
  if (await emailInput.count() === 0) {
    // Try various CTA buttons on the landing page
    const ctaBtn = page.locator('a:has-text("Get started")').or(
      page.locator('a:has-text("Sign up")')
    ).or(
      page.locator('button:has-text("Get started")')
    ).or(
      page.locator('text=Sign up for free')
    ).or(
      page.locator('text=Log In')
    )
    if (await ctaBtn.count() > 0) {
      await ctaBtn.first().click()
      await page.waitForTimeout(1500)
    } else {
      // Direct navigation as fallback
      await page.goto('/signup')
      await page.waitForTimeout(1500)
    }
  }

  await emailInput.waitFor({ timeout: 10_000 })
  await emailInput.fill(email)

  // Submit — button text varies: "Sign Up with Email", "Continue", etc.
  const submitBtn = page.locator('button:has-text("Sign Up with Email")').or(
    page.locator('button:has-text("Continue")')
  ).or(
    page.locator('button:has-text("Log In with Email")')
  ).or(
    page.locator('button[type="submit"]')
  )
  await submitBtn.first().click()

  // Wait for auto-auth to complete (test accounts skip OTP)
  await page.waitForTimeout(4000)
}

/**
 * Complete registration for a new test account.
 * Uses the actual form field placeholders from the Rally signup form.
 */
export async function completeRegistration(
  page: Page,
  options: {
    firstName: string
    lastName: string
    county: string
    skillLevel?: 'beginner' | 'intermediate' | 'advanced'
    availability?: 'weeknight-evenings' | 'weekend-mornings' | 'weekend-afternoons'
  }
) {
  // Fill name fields — placeholders are "e.g. John" and "e.g. Smith"
  const firstNameInput = page.locator('input[placeholder="e.g. John"]')
  const lastNameInput = page.locator('input[placeholder="e.g. Smith"]')

  await firstNameInput.waitFor({ timeout: 10_000 })
  await firstNameInput.fill(options.firstName)
  await lastNameInput.fill(options.lastName)

  // Fill county — placeholder is "Search county..."
  const countyInput = page.locator('input[placeholder="Search county..."]')
  await countyInput.fill(options.county)
  await page.waitForTimeout(800)

  // Click the autocomplete suggestion (visible as a dropdown below the input)
  const suggestion = page.locator('text=County, CA').first()
  await suggestion.waitFor({ timeout: 5000 })
  await suggestion.click()
  await page.waitForTimeout(500)

  // Click "Start Competing" to proceed
  const startBtn = page.locator('button:has-text("Start Competing")')
  await startBtn.click()
  await page.waitForTimeout(1500)

  // "About your game" step — skill level + gender selection
  if (options.skillLevel) {
    const label = options.skillLevel.charAt(0).toUpperCase() + options.skillLevel.slice(1)
    const skillBtn = page.locator(`button:has-text("${label}")`).or(page.locator(`text=${label}`))
    if (await skillBtn.count() > 0) {
      await skillBtn.first().click()
      await page.waitForTimeout(300)
    }
  }

  // Select gender (required to enable Continue button)
  const genderBtn = page.getByRole('button', { name: 'Male', exact: true })
  if (await genderBtn.count() > 0) {
    await genderBtn.click()
    await page.waitForTimeout(300)
  }

  // Continue button on skill/gender step
  const nextBtn = page.locator('button:has-text("Continue")').or(page.locator('button:has-text("Next")'))
  if (await nextBtn.count() > 0) {
    await nextBtn.first().click()
    await page.waitForTimeout(1500)
  }

  // Availability step — click a preset
  if (options.availability) {
    const presetMap: Record<string, string> = {
      'weeknight-evenings': 'Weeknight Evenings',
      'weekend-mornings': 'Weekend Mornings',
      'weekend-afternoons': 'Weekend Afternoons',
    }
    const presetText = presetMap[options.availability] ?? options.availability
    const presetBtn = page.locator(`text=${presetText}`).first()
    if (await presetBtn.count() > 0) {
      await presetBtn.click()
      await page.waitForTimeout(500)
    }
  }

  // Final submit — look for finish/done/next button
  const finishBtn = page.locator('button:has-text("Finish")').or(
    page.locator('button:has-text("Done")')
  ).or(
    page.locator('button:has-text("Next")')
  ).or(
    page.locator('button:has-text("Let")')
  )
  if (await finishBtn.count() > 0) {
    await finishBtn.first().click()
  }

  // Wait for confirmation + redirect to home
  await page.waitForTimeout(4000)
}

/**
 * Sign out the current user.
 * Clears browser storage to ensure a clean slate — avoids the "Loading..." hang
 * that can happen when Supabase auth state doesn't fully clear.
 */
export async function signOut(page: Page) {
  // Clear all browser state to force a fresh session
  await page.context().clearCookies()
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.waitForTimeout(500)
  // Navigate to root — will load as unauthenticated guest
  await page.goto('/')
  await page.waitForTimeout(2000)
}
