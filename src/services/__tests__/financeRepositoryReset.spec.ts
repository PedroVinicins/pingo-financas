import { beforeEach, describe, expect, it } from 'vitest'
import { factoryReset, restoreBackup } from '../financeRepository'
import { DEFAULT_DASHBOARD_LAYOUT } from '../dashboardLayout'
import { DEFAULT_PINGO_PREFERENCES } from '../pingoPreferences'
import type { PingoBackup } from '../backup'

describe('factory reset on the Web', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('removes every Pingo key without touching unrelated sites', async () => {
    localStorage.setItem('cashew-clone:transactions', '[{"id":"transaction"}]')
    localStorage.setItem('pingo:vaults', '[{"id":"vault"}]')
    localStorage.setItem('pingo:dashboard-layout:recovery:1', '{broken}')
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('another-app:preference', 'preserve-me')
    sessionStorage.setItem('pingo:active-view', 'wallet')

    await factoryReset()

    expect(localStorage.getItem('cashew-clone:transactions')).toBeNull()
    expect(localStorage.getItem('pingo:vaults')).toBeNull()
    expect(localStorage.getItem('pingo:dashboard-layout:recovery:1')).toBeNull()
    expect(localStorage.getItem('theme')).toBeNull()
    expect(sessionStorage.getItem('pingo:active-view')).toBeNull()
    expect(localStorage.getItem('another-app:preference')).toBe('preserve-me')
  })

  it('restaura um backup Web validado sem tocar em dados de outro site', async () => {
    const data: PingoBackup['data'] = {
      categories: [{ id: 'salary', kind: 'income', name: 'Salário', icon: 'banknote', color: '#7C3AED', createdAt: '2026-08-17T10:00:00Z' }],
      transactions: [{ id: 'income', kind: 'income', amount: '250.00', date: '2026-08-17', occurredAt: null, categoryId: 'salary', debitCardId: null, description: 'Salário', recurrence: 'variable', createdAt: '2026-08-17T10:00:00Z' }],
      debitCards: [], vaults: [], vaultMovements: [], automaticReserveRules: [], monthlyReserveRules: [],
      digitalWalletItems: [], recurringRules: [],
      dashboardLayout: { widgets: DEFAULT_DASHBOARD_LAYOUT.widgets.map((item) => ({ ...item })) },
      accountSettings: { openingBalanceAdjustment: '0.00', balanceHidden: true, migratedAt: '2026-08-17T10:00:00Z' },
      preferences: { ...DEFAULT_PINGO_PREFERENCES, displayName: 'Pedro', themeMode: 'dark' },
    }
    localStorage.setItem('cashew-clone:transactions', '[]')
    localStorage.setItem('pingo:app-lock:v1', '{"protected":true}')
    localStorage.setItem('another-app:preference', 'preserve-me')

    await restoreBackup(data)

    expect(JSON.parse(localStorage.getItem('cashew-clone:transactions') ?? '[]')).toEqual(data.transactions)
    expect(JSON.parse(localStorage.getItem('pingo:preferences') ?? '{}')).toMatchObject({ displayName: 'Pedro', themeMode: 'dark' })
    expect(localStorage.getItem('another-app:preference')).toBe('preserve-me')
    expect(localStorage.getItem('pingo:app-lock:v1')).toBe('{"protected":true}')
  })
})
