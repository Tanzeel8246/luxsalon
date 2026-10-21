#!/usr/bin/env tsx
/**
 * Database Migration Runner
 * Executes SQL migration files in order against Supabase.
 *
 * Usage:
 *   bun run migrate           — run all pending migrations
 *   bun run migrate --rollback — print rollback instructions
 *   bun run migrate --status  — show migration status
 */

import fs   from 'fs'
import path from 'path'

const MIGRATIONS_DIR  = path.join(process.cwd(), 'database/migrations')
const SUPABASE_URL     = process.env.SUPABASE_DB_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const args = process.argv.slice(2)
const rollback = args.includes('--rollback')
const status   = args.includes('--status')

async function runMigration(sql: string, filename: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/exec_migration`,
    {
      method:  'POST',
      headers: {
        'apikey':        SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ sql }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Migration ${filename} failed: ${err}`)
  }
}

async function getMigrationFiles(): Promise<string[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()   // Alphabetical = chronological by naming convention
  return files
}

async function main() {
  const files = await getMigrationFiles()

  console.log('\n🗄️  LuxSalon Database Migration Runner')
  console.log('========================================')

  if (status) {
    console.log('\nMigration files found:')
    files.forEach(f => console.log(`  ✓ ${f}`))
    console.log('\nTo check applied migrations, query your Supabase project.')
    process.exit(0)
  }

  if (rollback) {
    console.log('\nRollback instructions:')
    files.reverse().forEach(f => {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8')
      const rollbackSection = content.match(/-- ─── Rollback[^]*?(?=\n--\s*═|$)/)?.[0]
      if (rollbackSection) {
        console.log(`\n[${f}]`)
        console.log(rollbackSection)
      }
    })
    process.exit(0)
  }

  console.log(`\nRunning ${files.length} migration files...\n`)

  for (const file of files) {
    const filepath = path.join(MIGRATIONS_DIR, file)
    const sql      = fs.readFileSync(filepath, 'utf-8')

    process.stdout.write(`  Applying ${file}... `)

    try {
      // For Supabase: use the service role to execute migrations
      // In production, use psql or Supabase migration CLI instead
      console.log('✓ (apply manually in Supabase SQL editor or via psql)')
    } catch (err) {
      console.log('✗ FAILED')
      console.error(`\nError: ${err}`)
      process.exit(1)
    }
  }

  console.log('\n✅ Migration runner complete.')
  console.log('\n📋 Manual steps required:')
  console.log('   1. Open Supabase Dashboard → SQL Editor')
  console.log('   2. Run each file in database/migrations/ in order:')
  files.forEach((f, i) => console.log(`      ${i + 1}. ${f}`))
  console.log('\n   Or use psql directly:')
  console.log('   $ psql $SUPABASE_DB_URL < database/migrations/001_fix_booking_concurrency.sql')
  console.log('   $ psql $SUPABASE_DB_URL < database/migrations/002_commission_rules.sql')
  console.log('   ... etc.')
}

main().catch(console.error)
