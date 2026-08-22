import { isTauriRuntime } from './financeRepository'

export interface AppLockConfig {
  enabled: boolean
  biometricEnabled: boolean
}

export interface AppLockVerification {
  valid: boolean
  retryAfterSeconds: number
}

export interface BiometricAvailability {
  available: boolean
  label: string
  reason: string
}

interface WebAppLockRecord {
  salt: string
  pinHash: string
  failedAttempts: number
  lockedUntil: number | null
}

export const APP_LOCK_BACKGROUND_DELAY_MS = 30_000
export const APP_LOCK_CHANGED_EVENT = 'pingo:app-lock-changed'
const WEB_APP_LOCK_KEY = 'pingo:app-lock:v1'
const PBKDF2_ITERATIONS = 310_000

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

export function validateAppLockPin(pin: string) {
  return /^\d{4,6}$/.test(pin)
}

function readWebRecord(): WebAppLockRecord | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(WEB_APP_LOCK_KEY) ?? 'null') as Partial<WebAppLockRecord> | null
    if (!parsed?.salt || !parsed.pinHash) return null
    return {
      salt: parsed.salt,
      pinHash: parsed.pinHash,
      failedAttempts: Number.isInteger(parsed.failedAttempts) ? Math.max(0, parsed.failedAttempts ?? 0) : 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
    }
  } catch { return null }
}

function writeWebRecord(record: WebAppLockRecord | null) {
  if (record) localStorage.setItem(WEB_APP_LOCK_KEY, JSON.stringify(record))
  else localStorage.removeItem(WEB_APP_LOCK_KEY)
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function deriveWebPin(pin: string, salt: Uint8Array) {
  if (!crypto.subtle) throw new Error('Este navegador não oferece armazenamento seguro para o PIN.')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS,
  }, key, 256)
  return bytesToBase64(new Uint8Array(bits))
}

export async function getAppLockConfig(): Promise<AppLockConfig> {
  if (isTauriRuntime()) return invoke<AppLockConfig>('get_app_lock_config')
  return { enabled: readWebRecord() !== null, biometricEnabled: false }
}

export async function configureAppLock(pin: string, biometricEnabled: boolean): Promise<AppLockConfig> {
  if (!validateAppLockPin(pin)) throw new Error('O PIN deve ter de 4 a 6 números.')
  if (isTauriRuntime()) return invoke<AppLockConfig>('configure_app_lock', { pin, biometricEnabled })
  if (readWebRecord()) throw new Error('O bloqueio já está ativo.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  writeWebRecord({ salt: bytesToBase64(salt), pinHash: await deriveWebPin(pin, salt), failedAttempts: 0, lockedUntil: null })
  return { enabled: true, biometricEnabled: false }
}

export async function verifyAppLockPin(pin: string): Promise<AppLockVerification> {
  if (isTauriRuntime()) return invoke<AppLockVerification>('verify_app_lock_pin', { pin })
  const record = readWebRecord()
  if (!record) throw new Error('O bloqueio do aplicativo não está ativo.')
  const now = Date.now()
  if (record.lockedUntil && record.lockedUntil > now) {
    return { valid: false, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1_000) }
  }
  const valid = validateAppLockPin(pin)
    && await deriveWebPin(pin, base64ToBytes(record.salt)) === record.pinHash
  if (valid) {
    writeWebRecord({ ...record, failedAttempts: 0, lockedUntil: null })
    return { valid: true, retryAfterSeconds: 0 }
  }
  const attempts = record.failedAttempts + 1
  const lockedUntil = attempts >= 5 ? now + 30_000 : null
  writeWebRecord({ ...record, failedAttempts: lockedUntil ? 0 : attempts, lockedUntil })
  return { valid: false, retryAfterSeconds: lockedUntil ? 30 : 0 }
}

export async function changeAppLockPin(currentPin: string, newPin: string): Promise<AppLockConfig> {
  if (!validateAppLockPin(newPin)) throw new Error('O novo PIN deve ter de 4 a 6 números.')
  if (isTauriRuntime()) return invoke<AppLockConfig>('change_app_lock_pin', { currentPin, newPin })
  const verification = await verifyAppLockPin(currentPin)
  if (!verification.valid) throw new Error('PIN atual incorreto.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  writeWebRecord({ salt: bytesToBase64(salt), pinHash: await deriveWebPin(newPin, salt), failedAttempts: 0, lockedUntil: null })
  return { enabled: true, biometricEnabled: false }
}

export async function setAppLockBiometric(pin: string, enabled: boolean): Promise<AppLockConfig> {
  if (!isTauriRuntime()) throw new Error('A biometria está disponível apenas no aplicativo móvel.')
  return invoke<AppLockConfig>('set_app_lock_biometric', { pin, enabled })
}

export async function disableAppLock(pin: string): Promise<AppLockConfig> {
  if (isTauriRuntime()) return invoke<AppLockConfig>('disable_app_lock', { pin })
  const verification = await verifyAppLockPin(pin)
  if (!verification.valid) throw new Error('PIN incorreto.')
  writeWebRecord(null)
  return { enabled: false, biometricEnabled: false }
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (!isTauriRuntime()) return {
    available: false,
    label: 'Biometria do aparelho',
    reason: 'Disponível no aplicativo instalado no celular.',
  }
  try {
    const { BiometryType, checkStatus } = await import('@tauri-apps/plugin-biometric')
    const status = await checkStatus()
    const label = status.biometryType === BiometryType.FaceID
      ? 'reconhecimento facial'
      : status.biometryType === BiometryType.Iris
        ? 'leitura da íris'
        : /Android/i.test(navigator.userAgent) ? 'biometria do aparelho' : 'Touch ID'
    const reasons: Record<string, string> = {
      biometryNotEnrolled: 'Cadastre uma digital ou rosto nas configurações de segurança do aparelho.',
      biometryNotAvailable: 'Este aparelho não informou um sensor biométrico compatível.',
      passcodeNotSet: 'Configure primeiro o bloqueio de tela do aparelho.',
      biometryLockout: 'A biometria foi bloqueada temporariamente pelo sistema. Desbloqueie o aparelho e tente novamente.',
    }
    return {
      available: status.isAvailable,
      label,
      reason: status.isAvailable ? 'Proteção confirmada pelo sistema do aparelho.'
        : reasons[status.errorCode ?? ''] ?? status.error ?? 'Biometria indisponível neste aparelho.',
    }
  } catch (cause) {
    return {
      available: false,
      label: 'Biometria do aparelho',
      reason: biometricErrorMessage(cause, 'a biometria'),
    }
  }
}

export async function authenticateAppLockBiometric() {
  const { authenticate } = await import('@tauri-apps/plugin-biometric')
  await authenticate('Desbloqueie o Pingo para acessar suas informações financeiras.', {
    allowDeviceCredential: false,
    cancelTitle: 'Usar PIN',
    fallbackTitle: 'Usar PIN',
    title: 'Desbloquear o Pingo',
    subtitle: 'Suas finanças estão protegidas',
    confirmationRequired: true,
    maxAttemps: 5,
  })
}

export function biometricErrorMessage(cause: unknown, label: string) {
  const raw = cause instanceof Error ? cause.message : String(cause ?? '')
  const normalized = raw.toLowerCase()
  if (normalized.includes('notenrolled') || normalized.includes('not enrolled') || normalized.includes('no biometrics')) {
    return `Nenhum rosto ou digital está cadastrado no aparelho. Cadastre nas configurações do Android e tente ${label} novamente.`
  }
  if (normalized.includes('lockout')) return 'A biometria está bloqueada temporariamente. Desbloqueie o aparelho e tente novamente.'
  if (normalized.includes('usercancel') || normalized.includes('cancel')) return `A autenticação com ${label} foi cancelada.`
  if (normalized.includes('notavailable') || normalized.includes('no biometric') || normalized.includes('no hardware')) {
    return 'O sistema não encontrou biometria facial ou digital disponível.'
  }
  return `Não foi possível confirmar ${label} pelo sistema do aparelho.`
}

export function announceAppLockChange(config: AppLockConfig) {
  window.dispatchEvent(new CustomEvent<AppLockConfig>(APP_LOCK_CHANGED_EVENT, { detail: config }))
}
