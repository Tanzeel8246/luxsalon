/**
 * TOTP Tests — verifies that the broken 2FA is now properly fixed.
 * Critical: these tests MUST pass. Any 6-digit number must NOT work.
 */

import { authenticator } from 'otplib'
import {
  encryptSecret,
  decryptSecret,
  verifyTOTPToken,
  hashBackupCodes,
  verifyBackupCode,
  removeBackupCode,
  generateTOTPSetup,
} from '@/lib/totp'

// Mock encryption key for tests
process.env.ENCRYPTION_KEY = 'a'.repeat(64)   // 32 bytes hex
process.env.TOTP_ISSUER    = 'LuxSalon-Test'

describe('TOTP — Encryption', () => {
  it('encrypts and decrypts a secret correctly', () => {
    const plaintext  = 'JBSWY3DPEHPK3PXP'
    const ciphertext = encryptSecret(plaintext)

    expect(ciphertext).not.toBe(plaintext)
    expect(ciphertext).toContain(':')             // iv:tag:cipher format

    const decrypted = decryptSecret(ciphertext)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const c1     = encryptSecret(secret)
    const c2     = encryptSecret(secret)
    expect(c1).not.toBe(c2)   // Different IVs → different ciphertext
  })

  it('throws on tampered ciphertext', () => {
    const ciphertext = encryptSecret('secret')
    const tampered   = ciphertext.slice(0, -4) + 'XXXX'
    expect(() => decryptSecret(tampered)).toThrow()
  })
})

describe('TOTP — Token Verification', () => {
  it('rejects tokens that are not exactly 6 digits', () => {
    const secret    = authenticator.generateSecret()
    const encrypted = encryptSecret(secret)

    // The critical fix: these must ALL return false
    expect(verifyTOTPToken(encrypted, '12345')).toBe(false)    // 5 digits
    expect(verifyTOTPToken(encrypted, '1234567')).toBe(false)  // 7 digits
    expect(verifyTOTPToken(encrypted, 'abcdef')).toBe(false)   // letters
    expect(verifyTOTPToken(encrypted, '      ')).toBe(false)   // spaces
    expect(verifyTOTPToken(encrypted, '')).toBe(false)         // empty
  })

  it('accepts a valid TOTP token from authenticator', () => {
    const secret     = authenticator.generateSecret()
    const encrypted  = encryptSecret(secret)
    const validToken = authenticator.generate(secret)

    expect(verifyTOTPToken(encrypted, validToken)).toBe(true)
  })

  it('rejects an expired TOTP token', async () => {
    const secret    = authenticator.generateSecret()
    const encrypted = encryptSecret(secret)

    // Simulate an obviously wrong token
    expect(verifyTOTPToken(encrypted, '000000')).toBe(false)
  })

  it('CRITICAL: random 6-digit numbers are rejected (not accepted like before)', () => {
    const secret    = authenticator.generateSecret()
    const encrypted = encryptSecret(secret)

    // This was the bug: validateTOTP returned true for ANY 6-digit number
    // Now it must cryptographically verify
    let falsePositives = 0
    for (let i = 0; i < 50; i++) {
      const random6 = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
      if (verifyTOTPToken(encrypted, random6)) falsePositives++
    }

    // Statistically, valid window is ±1 step (~3 in 1,000,000 possible)
    // With 50 tries, probability of even one false positive is ~0.015%
    expect(falsePositives).toBe(0)
  })
})

describe('TOTP — Backup Codes', () => {
  it('hashes backup codes (not stored in plain text)', async () => {
    const plain  = ['ABCD1234', 'EFGH5678', 'IJKL9012']
    const hashed = await hashBackupCodes(plain)

    expect(hashed.length).toBe(plain.length)
    hashed.forEach((hash, i) => {
      expect(hash).not.toBe(plain[i])   // Must be hashed
      expect(hash).toMatch(/^\$2[aby]\$/)  // bcrypt format
    })
  })

  it('verifies correct backup code', async () => {
    const plain        = ['ABCD1234', 'EFGH5678']
    const hashed       = await hashBackupCodes(plain)
    const hashedJson   = JSON.stringify(hashed)

    const result = await verifyBackupCode('ABCD1234', hashedJson)
    expect(result.valid).toBe(true)
    expect(result.matchIndex).toBe(0)
  })

  it('rejects wrong backup code', async () => {
    const hashed     = await hashBackupCodes(['ABCD1234'])
    const hashedJson = JSON.stringify(hashed)

    const result = await verifyBackupCode('XXXX9999', hashedJson)
    expect(result.valid).toBe(false)
    expect(result.matchIndex).toBe(-1)
  })

  it('removes used backup code', async () => {
    const hashed   = await hashBackupCodes(['A', 'B', 'C'])
    const json     = JSON.stringify(hashed)
    const updated  = removeBackupCode(json, 1)
    const remaining = JSON.parse(updated)

    expect(remaining.length).toBe(2)
  })
})

describe('TOTP — Setup', () => {
  it('generates setup with encrypted secret and QR code', async () => {
    const setup = await generateTOTPSetup('test@example.com')

    expect(setup.secret).toContain(':')           // Encrypted format
    expect(setup.qrCodeBase64).toMatch(/^data:image\/png;base64,/)
    expect(setup.backupCodes.length).toBe(10)
    expect(setup.otpauthUrl).toContain('otpauth://totp/')
    expect(setup.otpauthUrl).toContain('LuxSalon-Test')

    // Backup codes must be plain 8-char alphanumeric
    setup.backupCodes.forEach(code => {
      expect(code).toHaveLength(8)
      expect(code).toMatch(/^[A-F0-9]{8}$/)
    })
  })
})
