import type {
  AccountSettings, AutomaticReserveRule, Category, DashboardLayout, DebitCard,
  DigitalWalletItem, MonthlyReserveRule, PingoPreferences, RecurringRule, Transaction, Vault, VaultMovement,
} from '../types/finance'

export interface PingoBackup {
  format: 'pingo-backup'
  version: 1
  appVersion: string
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

const REQUIRED_ARRAYS = [
  'transactions', 'categories', 'debitCards', 'vaults', 'vaultMovements',
  'automaticReserveRules', 'monthlyReserveRules', 'digitalWalletItems', 'recurringRules',
] as const

function amountToCents(value: unknown) {
  if (typeof value !== 'string' || !/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error('O backup contém um valor monetário inválido.')
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.')
  const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
  return negative ? -cents : cents
}

export function validateBackupData(data: unknown): asserts data is PingoBackup['data'] {
  if (!data || typeof data !== 'object') throw new Error('O arquivo não contém dados do Pingo.')
  const candidate = data as Record<string, unknown>
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(candidate[key])) throw new Error(`O backup não contém ${key}.`)
  }
  if (!candidate.accountSettings || typeof candidate.accountSettings !== 'object'
    || !candidate.preferences || typeof candidate.preferences !== 'object'
    || !candidate.dashboardLayout || typeof candidate.dashboardLayout !== 'object') {
    throw new Error('O backup não contém configurações completas.')
  }
  if ((candidate.transactions as unknown[]).length > 50_000
    || (candidate.categories as unknown[]).length > 1_000
    || (candidate.debitCards as unknown[]).length > 500
    || (candidate.vaults as unknown[]).length > 1_000) {
    throw new Error('O backup ultrapassa os limites seguros do Pingo.')
  }
  const categories = new Map((candidate.categories as Category[]).map((item) => [item.id, item.kind]))
  const cards = new Set((candidate.debitCards as DebitCard[]).map((item) => item.id))
  const vaults = new Set((candidate.vaults as Vault[]).map((item) => item.id))
  if (categories.size !== (candidate.categories as Category[]).length
    || cards.size !== (candidate.debitCards as DebitCard[]).length
    || vaults.size !== (candidate.vaults as Vault[]).length) throw new Error('O backup contém identificadores duplicados.')
  let available = amountToCents((candidate.accountSettings as AccountSettings).openingBalanceAdjustment)
  const transactionIds = new Set<string>()
  for (const transaction of candidate.transactions as Transaction[]) {
    const amount = amountToCents(transaction.amount)
    if (!transactionIds.add(transaction.id) || amount <= 0n || categories.get(transaction.categoryId ?? '') !== transaction.kind
      || (transaction.debitCardId !== null && !cards.has(transaction.debitCardId))
      || (transaction.kind === 'income' && transaction.debitCardId !== null)) {
      throw new Error('O backup contém uma transação ou categoria inválida.')
    }
    available += transaction.kind === 'income' ? amount : -amount
  }
  for (const vault of candidate.vaults as Vault[]) {
    const balance = amountToCents(vault.balance)
    if (balance < 0n) throw new Error('O backup contém um Porquinho inválido.')
    available -= balance
  }
  if (available < 0n) throw new Error('Este backup deixaria o saldo disponível negativo.')
  if ((candidate.vaultMovements as VaultMovement[]).some((item) => !vaults.has(item.vaultId))
    || (candidate.automaticReserveRules as AutomaticReserveRule[]).some((item) => !vaults.has(item.vaultId))
    || (candidate.monthlyReserveRules as MonthlyReserveRule[]).some((item) => !vaults.has(item.vaultId))) {
    throw new Error('O backup contém vínculos de Porquinho inválidos.')
  }
}

export async function parseBackupFile(file: File): Promise<PingoBackup> {
  if (file.size > 100 * 1024 * 1024) throw new Error('O backup ultrapassa o limite de 100 MB.')
  let parsed: unknown
  try { parsed = JSON.parse(await file.text()) }
  catch { throw new Error('Não foi possível ler este arquivo JSON.') }
  if (!parsed || typeof parsed !== 'object' || (parsed as Partial<PingoBackup>).format !== 'pingo-backup'
    || (parsed as Partial<PingoBackup>).version !== 1) {
    throw new Error('Selecione um backup válido do Pingo.')
  }
  validateBackupData((parsed as PingoBackup).data)
  return parsed as PingoBackup
}

export async function exportBackup(data: PingoBackup['data']) {
  const backup: PingoBackup = {
    format: 'pingo-backup',
    version: 1,
    appVersion: '0.11.0',
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
