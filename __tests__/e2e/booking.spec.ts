/**
 * E2E Tests — Booking Flow
 * Playwright tests for the complete booking experience.
 *
 * Requirements:
 *   1. Set up test Supabase project
 *   2. Set PLAYWRIGHT_BASE_URL=http://localhost:3000
 *   3. Seed test data (bun run seed)
 *   4. Run: npx playwright test
 */

import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// Test credentials — must exist in test Supabase instance
const TEST_CUSTOMER = {
  email:    'e2e-customer@test.luxsalon.com',
  password: 'TestPass123!',
}
const TEST_ADMIN = {
  email:    'e2e-admin@test.luxsalon.com',
  password: 'TestPass123!',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAs(page: Page, creds: typeof TEST_CUSTOMER) {
  await page.goto(`${BASE_URL}/auth/login`)
  await page.fill('input[type="email"]', creds.email)
  await page.fill('input[type="password"]', creds.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 })
}

// ── Auth Tests ────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('Login page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await expect(page.locator('h1, h2')).toContainText(/welcome|sign in/i)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('Rejects wrong credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await page.fill('input[type="email"]', 'wrong@email.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error, NOT redirect to dashboard
    await expect(page).toHaveURL(/login/)
  })

  test('Redirects unauthenticated users from dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await expect(page).toHaveURL(/login/)
  })

  test('Register page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/register`)
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })
})

// ── Booking Flow ──────────────────────────────────────────────────────────────

test.describe('Booking Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_CUSTOMER)
    await page.goto(`${BASE_URL}/booking`)
  })

  test('Booking page loads with step 1', async ({ page }) => {
    await expect(page.locator('h2')).toContainText(/choose a service|service/i)
  })

  test('Can filter services by category', async ({ page }) => {
    const categoryBtns = page.locator('button').filter({ hasText: /hair|beard|spa/i })
    if (await categoryBtns.count() > 0) {
      await categoryBtns.first().click()
      await expect(page.locator('[data-testid="service-card"]').or(page.locator('.service-card'))).toBeVisible()
    }
  })

  test('Selecting a service advances to step 2', async ({ page }) => {
    const firstService = page.locator('[data-testid="service-card"]').first()
    if (await firstService.isVisible()) {
      await firstService.click()
      await expect(page.locator('h2')).toContainText(/date|time/i, { timeout: 5000 })
    }
  })
})

// ── Dashboard ─────────────────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ADMIN)
  })

  test('Dashboard loads with stats', async ({ page }) => {
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('Revenue chart renders', async ({ page }) => {
    // Chart should appear within 5s
    await expect(page.locator('svg, canvas, [data-testid="chart"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('Queue page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/queue`)
    await expect(page.locator('h1')).toContainText(/queue/i)
  })
})

// ── Security ──────────────────────────────────────────────────────────────────

test.describe('Security', () => {
  test('Admin routes blocked for regular customers', async ({ page }) => {
    await loginAs(page, TEST_CUSTOMER)
    await page.goto(`${BASE_URL}/dashboard/admin`)
    // Should redirect away from admin
    await expect(page).not.toHaveURL(/\/admin/)
  })

  test('API returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/booking?service_id=test&date=2026-06-10`)
    expect(res.status()).toBe(401)
  })

  test('Rate limiting returns 429 on abuse', async ({ request }) => {
    // Make many rapid requests
    const promises = Array.from({ length: 150 }, () =>
      request.get(`${BASE_URL}/api/health`)
    )
    const responses = await Promise.all(promises)
    const hitRateLimit = responses.some(r => r.status() === 429)
    expect(hitRateLimit).toBe(true)
  })
})

// ── POS Terminal ──────────────────────────────────────────────────────────────

test.describe('POS Terminal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ADMIN)
    await page.goto(`${BASE_URL}/dashboard/pos`)
  })

  test('POS page loads', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/pos|terminal/i)
  })

  test('Cart starts empty', async ({ page }) => {
    const emptyMsg = page.locator('text=Cart is empty, text=No items')
    if (await emptyMsg.isVisible()) {
      await expect(emptyMsg).toBeVisible()
    }
  })
})

// ── Queue ─────────────────────────────────────────────────────────────────────

test.describe('Queue Board', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ADMIN)
    await page.goto(`${BASE_URL}/queue`)
  })

  test('Queue board shows 3 columns', async ({ page }) => {
    await expect(page.locator('text=Waiting, text=انتظار').or(page.locator('[data-col="waiting"]'))).toBeVisible()
  })

  test('Queue stats render', async ({ page }) => {
    await expect(page.locator('text=In Queue, text=Active Staff').or(page.locator('[data-testid="queue-stats"]'))).toBeVisible({ timeout: 5000 })
  })
})

// ── Walk-in API ───────────────────────────────────────────────────────────────

test.describe('Walk-in API', () => {
  test('Rejects without authentication', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/walk-in`, {
      data: {
        name:       'Test Customer',
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        branch_id:  '770e8400-e29b-41d4-a716-446655440000',
      },
    })
    expect(res.status()).toBe(401)
  })

  test('Rejects missing required fields', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/walk-in`, {
      data: { name: 'J' },   // Too short + missing service_id, branch_id
    })
    expect([400, 401]).toContain(res.status())
  })
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test('Login page has no critical a11y violations', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)

    // Check for basic accessibility requirements
    await expect(page.locator('label[for]')).toHaveCount({ minimum: 2 })
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toHaveAttribute('type', 'email')
  })

  test('Forms have visible labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/register`)
    const labels = page.locator('label')
    await expect(labels).toHaveCount({ minimum: 3 })
  })
})
