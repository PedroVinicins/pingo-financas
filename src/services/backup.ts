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

function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"` }

export async function exportTransactionsCsv(transactions: Transaction[], categories: Category[], cards: DebitCard[]) {
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.occurredAt?.slice(11, 16) ?? '',
    transaction.kind === 'income' ? 'Entrada' : 'Saída',
    transaction.description,
    categories.find((item) => item.id === transaction.categoryId)?.name ?? 'Sem categoria',
    cards.find((item) => item.id === transaction.debitCardId)?.name ?? '',
    transaction.amount.replace('.', ','),
  ].map(csvCell).join(';'))
  const csv = `\uFEFF${['Data', 'Hora', 'Tipo', 'Descrição', 'Categoria', 'Carteira', 'Valor'].map(csvCell).join(';')}\r\n${rows.join('\r\n')}`
  const date = new Date().toISOString().slice(0, 10)
  const filename = `pingo-transacoes-${date}.csv`
  const file = new File([csv], filename, { type: 'text/csv;charset=utf-8' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: 'Transações do Pingo', files: [file] })
    return
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
