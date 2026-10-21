/**
 * TOTP Two-Factor Authentication — Real Implementation
 * Library: otplib@12.x
 *
 * Replaces the broken validateTOTP() that accepted any 6-digit number.
 */

import { authenticator } from 'otplib'
import QRCode             from 'qrcode'
import bcrypt             from 'bcryptjs'
import crypto             from 'crypto'
import { logger }         from './logger'

const ISSUER          = process.env.TOTP_ISSUER ?? 'LuxSalon'
const WINDOW          = parseInt(process.env.TOTP_WINDOW ?? '1', 10)
const BACKUP_COUNT    = 10
const BCRYPT_ROUNDS   = 12
const ENCRYPTION_KEY  = process.env.ENCRYPTION_KEY!  // 32-byte hex string

// Configure otplib
authenticator.options = {
  window: WINDOW,     // Accept ±1 step (30-second tolerance)
  step:   30,
  digits: 6,
  algorithm: 'sha1' as any,
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TOTPSetupResult {
  secret:       string    // encrypted — store in DB
  otpauthUrl:   string    // for QR code
  qrCodeBase64: string    // data:image/png;base64,...
  backupCodes:  string[]  // plain text — show to user ONCE
}

export interface TOTPVerifyResult {
  valid:         boolean
  usedBackup:    boolean
  remainingCodes?: number
}

// ── Key Setup ─────────────────────────────────────────────────────────────────

/**
 * Generate a new TOTP setup for a user.
 * Returns secret (encrypted), QR code, and backup codes.
 *
 * Store in DB:
 *   - encrypted secret (never plain text)
 *   - hashed backup codes (never plain text)
 */
export async function generateTOTPSetup(
  userEmail: string
): Promise<TOTPSetupResult> {
  // Generate cryptographically random base32 secret
  const secret    = authenticator.generateSecret(32)
  const otpauthUrl = authenticator.keyuri(userEmail, ISSUER, secret)

  // Generate QR code as base64 PNG
  const qrCodeBase64 = await QRCode.toDataURL(otpauthUrl, {
    width:    256,
    margin:   2,
    color:    { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })

  // Generate backup codes (10 × 8 alphanumeric chars)
  const plainBackupCodes = Array.from({ length: BACKUP_COUNT }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8)
  )

  // Encrypt secret for storage
  const encryptedSecret = encryptSecret(secret)

  return {
    secret:       encryptedSecret,
    otpauthUrl,
    qrCodeBase64,
    backupCodes:  plainBackupCodes,
  }
}

/**
 * Hash backup codes for storage.
 * Call separately — don't store plain codes.
 */
export async function hashBackupCodes(plainCodes: string[]): Promise<string[]> {
  return Promise.all(plainCodes.map(code => bcrypt.hash(code, BCRYPT_ROUNDS)))
}

// ── Verification ──────────────────────────────────────────────────────────────

/**
 * Verify a TOTP token from authenticator app.
 * Token must be exactly 6 digits.
 */
export function verifyTOTPToken(
  encryptedSecret: string,
  token:           string
): boolean {
  if (!/^\d{6}$/.test(token)) {
    logger.warn('TOTP verification: invalid token format')
    return false
  }

  try {
    const secret = decryptSecret(encryptedSecret)
    const isValid = authenticator.verify({ token, secret })

    logger.info('TOTP verification', { valid: isValid })
    return isValid
  } catch (err) {
    logger.error('TOTP verification error', { err })
    return false
  }
}

/**
 * Verify a backup code.
 * Uses timing-safe bcrypt comparison to prevent timing attacks.
 * Returns the index of matching backup code for removal from DB.
 */
export async function verifyBackupCode(
  plainCode:       string,
  hashedCodesJson: string    // JSON array of bcrypt hashes
): Promise<{ valid: boolean; matchIndex: number }> {
  if (!plainCode || plainCode.length !== 8) {
    return { valid: false, matchIndex: -1 }
  }

  const hashedCodes: string[] = JSON.parse(hashedCodesJson)
  const normalized = plainCode.toUpperCase().replace(/\s/g, '')

  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(normalized, hashedCodes[i])
    if (match) {
      logger.info('TOTP backup code used', { index: i })
      return { valid: true, matchIndex: i }
    }
  }

  logger.warn('TOTP backup code invalid')
  return { valid: false, matchIndex: -1 }
}

/**
 * Remove a used backup code from the array.
 */
export function removeBackupCode(hashedCodesJson: string, index: number): string {
  const codes = JSON.parse(hashedCodesJson) as string[]
  codes.splice(index, 1)
  return JSON.stringify(codes)
}

/**
 * Generate new replacement backup codes.
 * Call this after user uses all backup codes or requests rotation.
 */
export async function regenerateBackupCodes(): Promise<{
  plain:  string[]
  hashed: string[]
}> {
  const plain  = Array.from({ length: BACKUP_COUNT }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8)
  )
  const hashed = await hashBackupCodes(plain)
  return { plain, hashed }
}

// ── Secret Encryption ─────────────────────────────────────────────────────────
// TOTP secrets must be encrypted at rest.
// Uses AES-256-GCM with a random IV per encryption.

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 64) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars). Generate with: openssl rand -hex 32')
  }
  return Buffer.from(ENCRYPTION_KEY, 'hex')
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv  = crypto.randomBytes(12)            // 96-bit IV for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()               // 16-byte auth tag

  // Format: iv_hex:tag_hex:ciphertext_hex
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptSecret(ciphertext: string): string {
  const key  = getEncryptionKey()
  const parts = ciphertext.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format')
  }

  const iv        = Buffer.from(parts[0], 'hex')
  const tag       = Buffer.from(parts[1], 'hex')
  const encrypted = Buffer.from(parts[2], 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function formatBackupCodeForDisplay(code: string): string {
  // Format ABCD1234 → ABCD-1234
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

export function isTOTPConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY
}
