import type { PingoPreferences } from '../types/finance'

const PREFERENCES_KEY = 'pingo:preferences'

export const DEFAULT_PINGO_PREFERENCES: PingoPreferences = {
  voiceShortcutsEnabled: false,
  shakeToExpenseEnabled: false,
  shakeSensitivity: 'medium',
  dailySpendingAlertsEnabled: true,
  spendingAlertPercent: 80,
  greetingEnabled: true,
  economyMode: false,
  feedbackDurationMs: 4_000,
}

function normalize(raw: Partial<PingoPreferences> | null): PingoPreferences {
  const sensitivity = ['low', 'medium', 'high'].includes(raw?.shakeSensitivity ?? '')
    ? raw!.shakeSensitivity!
    : DEFAULT_PINGO_PREFERENCES.shakeSensitivity
  const duration = [3_000, 4_000, 5_000].includes(raw?.feedbackDurationMs ?? 0)
    ? raw!.feedbackDurationMs!
    : DEFAULT_PINGO_PREFERENCES.feedbackDurationMs
  const percent = Number(raw?.spendingAlertPercent)
  return {
    ...DEFAULT_PINGO_PREFERENCES,
    ...raw,
    shakeSensitivity: sensitivity,
    feedbackDurationMs: duration,
    spendingAlertPercent: Number.isFinite(percent) ? Math.min(100, Math.max(50, Math.round(percent))) : 80,
  }
}

export function loadPingoPreferences(): PingoPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)
    return normalize(stored ? JSON.parse(stored) as Partial<PingoPreferences> : null)
  } catch { return { ...DEFAULT_PINGO_PREFERENCES } }
}

export function savePingoPreferences(preferences: PingoPreferences) {
  const normalized = normalize(preferences)
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalized))
  return normalized
}

