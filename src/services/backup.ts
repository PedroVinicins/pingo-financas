import type {
  AccountSettings, AutomaticReserveRule, Category, DashboardLayout, DebitCard,
  DigitalWalletItem, MonthlyReserveRule, PingoPreferences, RecurringRule, Transaction, Vault, VaultMovement,
} from '../types/finance'

export interface PingoBackup {
  format: 'pingo-backup'
  version: 1
  appVersion: '0.10.0'
  exportedAt: string
  data: {
    transactions: Transaction[]
    categories: Category[]
    debitCards: DebitCard[]
    vaults: Vault[]
    vaultMovements: VaultMovement[]
    automaticReserveRules: AutomaticReserveRule[]
    monthlyReserveRules: MonthlyReserveRule[]
    digitalWalletItems: DigitalWalletItem[]
    dashboardLayout: DashboardLayout
    recurringRules: RecurringRule[]
    accountSettings: AccountSettings
    preferences: PingoPreferences
  }
}

export async function exportBackup(data: PingoBackup['data']) {
  const backup: PingoBackup = {
    format: 'pingo-backup',
    version: 1,
    appVersion: '0.10.0',
    exportedAt: new Date().toISOString(),
    data,
  }
  const date = new Date()
  const filename = `pingo-backup-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.json`
  const file = new File([JSON.stringify(backup, null, 2)], filename, { type: 'application/json' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: 'Backup do Pingo', text: 'Cópia local dos meus dados no Pingo.', files: [file] })
    return
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
