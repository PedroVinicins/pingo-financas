import type { CurrencyCode, PingoPreferences } from '../types/finance'

const PREFERENCES_KEY = 'pingo:preferences'

export const DEFAULT_PINGO_PREFERENCES: PingoPreferences = {
  displayName: '',
  themeMode: 'system',
  monthlyBudget: null,
  currency: 'BRL',
  billsDueNotifications: true,
  weeklySummaryNotifications: false,
  expenseReminderNotifications: false,
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
  const legacyTheme = (() => {
    try { return localStorage.getItem('theme') } catch { return null }
  })()
  const themeMode = ['light', 'dark', 'system'].includes(raw?.themeMode ?? '')
    ? raw!.themeMode!
    : legacyTheme === 'light' || legacyTheme === 'dark' ? legacyTheme : 'system'
  const monthlyBudget = typeof raw?.monthlyBudget === 'string' && /^\d+(\.\d{1,2})?$/.test(raw.monthlyBudget)
    ? raw.monthlyBudget
    : null
  const currency: CurrencyCode = ['BRL', 'USD', 'EUR'].includes(raw?.currency ?? '')
    ? raw!.currency!
    : DEFAULT_PINGO_PREFERENCES.currency
  return {
    ...DEFAULT_PINGO_PREFERENCES,
    displayName: typeof raw?.displayName === 'string' ? raw.displayName.trim().slice(0, 60) : '',
    billsDueNotifications: raw?.billsDueNotifications ?? DEFAULT_PINGO_PREFERENCES.billsDueNotifications,
    weeklySummaryNotifications: raw?.weeklySummaryNotifications ?? DEFAULT_PINGO_PREFERENCES.weeklySummaryNotifications,
    expenseReminderNotifications: raw?.expenseReminderNotifications ?? DEFAULT_PINGO_PREFERENCES.expenseReminderNotifications,
    shakeToExpenseEnabled: raw?.shakeToExpenseEnabled ?? DEFAULT_PINGO_PREFERENCES.shakeToExpenseEnabled,
    dailySpendingAlertsEnabled: raw?.dailySpendingAlertsEnabled ?? DEFAULT_PINGO_PREFERENCES.dailySpendingAlertsEnabled,
    greetingEnabled: raw?.greetingEnabled ?? DEFAULT_PINGO_PREFERENCES.greetingEnabled,
    economyMode: raw?.economyMode ?? DEFAULT_PINGO_PREFERENCES.economyMode,
    shakeSensitivity: sensitivity,
    themeMode,
    monthlyBudget,
    currency,
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
