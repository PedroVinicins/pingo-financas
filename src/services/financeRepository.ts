import type {
  Category,
  DebitCard,
  MoveVaultMoneyInput,
  NewDebitCardInput,
  NewTransactionInput,
  NewVaultInput,
  Transaction,
  UpdateDebitCardStyleInput,
  Vault,
} from '../types/finance'

// Mantidos para preservar dados de quem já usou as versões 0.1/0.2 no navegador.
const TRANSACTIONS_KEY = 'cashew-clone:transactions'
const CATEGORIES_KEY = 'cashew-clone:categories'
const DEBIT_CARDS_KEY = 'cashew-clone:debit-cards'
const VAULTS_KEY = 'pingo:vaults'

export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

function readLocal<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key)
  return value ? (JSON.parse(value) as T) : fallback
}

function writeLocal<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function normalizeCard(card: DebitCard): DebitCard {
  return {
    ...card,
    pattern: card.pattern ?? 'soft',
    backgroundImage: card.backgroundImage ?? 'none',
    emoji: card.emoji ?? null,
  }
}

export async function listTransactions(): Promise<Transaction[]> {
  if (isTauriRuntime()) return tauriInvoke<Transaction[]>('list_transactions')
  return readLocal<Transaction[]>(TRANSACTIONS_KEY, [])
}

export async function addTransaction(input: NewTransactionInput): Promise<Transaction> {
  if (isTauriRuntime()) return tauriInvoke<Transaction>('add_transaction', { input })

  if (input.debitCardId) {
    const card = (await listDebitCards()).find((item) => item.id === input.debitCardId)
    if (card?.isFrozen) throw new Error('Este cartão está congelado')
  }

  const transaction: Transaction = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const transactions = await listTransactions()
  transactions.push(transaction)
  writeLocal(TRANSACTIONS_KEY, transactions)
  return transaction
}

export async function deleteTransaction(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('delete_transaction', { id })
    return
  }
  writeLocal(TRANSACTIONS_KEY, (await listTransactions()).filter((item) => item.id !== id))
}

export async function listCategories(fallback: Category[]): Promise<Category[]> {
  if (isTauriRuntime()) return tauriInvoke<Category[]>('list_categories')

  const categories = readLocal<Category[]>(CATEGORIES_KEY, [])
  if (categories.length) return categories
  writeLocal(CATEGORIES_KEY, fallback)
  return fallback
}

export async function listDebitCards(): Promise<DebitCard[]> {
  if (isTauriRuntime()) return (await tauriInvoke<DebitCard[]>('list_debit_cards')).map(normalizeCard)
  const cards = readLocal<DebitCard[]>(DEBIT_CARDS_KEY, []).map(normalizeCard)
  writeLocal(DEBIT_CARDS_KEY, cards)
  return cards
}

export async function addDebitCard(input: NewDebitCardInput): Promise<DebitCard> {
  if (isTauriRuntime()) return tauriInvoke<DebitCard>('add_debit_card', { input })

  const cards = await listDebitCards()
  if (input.isDefault) cards.forEach((card) => { card.isDefault = false })

  const card: DebitCard = {
    ...input,
    id: crypto.randomUUID(),
    isFrozen: false,
    createdAt: new Date().toISOString(),
  }
  cards.push(card)
  writeLocal(DEBIT_CARDS_KEY, cards)
  return card
}

export async function updateDebitCardStyle(input: UpdateDebitCardStyleInput): Promise<DebitCard> {
  if (isTauriRuntime()) return tauriInvoke<DebitCard>('update_debit_card_style', { input })

  const cards = await listDebitCards()
  const card = cards.find((item) => item.id === input.id)
  if (!card) throw new Error('Cartão não encontrado')

  card.colorFrom = input.colorFrom
  card.colorTo = input.colorTo
  card.pattern = input.pattern
  card.backgroundImage = input.backgroundImage
  card.emoji = input.emoji?.trim() || null
  writeLocal(DEBIT_CARDS_KEY, cards)
  return { ...card }
}

export async function setDebitCardFrozen(id: string, frozen: boolean): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('set_debit_card_frozen', { id, frozen })
    return
  }

  const cards = await listDebitCards()
  const card = cards.find((item) => item.id === id)
  if (card) card.isFrozen = frozen
  writeLocal(DEBIT_CARDS_KEY, cards)
}

export async function setDefaultDebitCard(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('set_default_debit_card', { id })
    return
  }

  const cards = await listDebitCards()
  cards.forEach((card) => { card.isDefault = card.id === id })
  writeLocal(DEBIT_CARDS_KEY, cards)
}

export async function deleteDebitCard(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('delete_debit_card', { id })
    return
  }

  writeLocal(DEBIT_CARDS_KEY, (await listDebitCards()).filter((card) => card.id !== id))
  const transactions = (await listTransactions()).map((transaction) =>
    transaction.debitCardId === id ? { ...transaction, debitCardId: null } : transaction,
  )
  writeLocal(TRANSACTIONS_KEY, transactions)
}

export async function listVaults(): Promise<Vault[]> {
  if (isTauriRuntime()) return tauriInvoke<Vault[]>('list_vaults')
  return readLocal<Vault[]>(VAULTS_KEY, [])
}

export async function addVault(input: NewVaultInput): Promise<Vault> {
  if (isTauriRuntime()) return tauriInvoke<Vault>('add_vault', { input })

  const now = new Date().toISOString()
  const vault: Vault = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    institution: input.institution.trim(),
    type: input.type,
    balance: input.initialBalance,
    targetAmount: input.targetAmount,
    annualYieldRate: input.annualYieldRate,
    color: input.color,
    emoji: input.emoji?.trim() || null,
    createdAt: now,
    updatedAt: now,
  }
  const vaults = await listVaults()
  vaults.push(vault)
  writeLocal(VAULTS_KEY, vaults)
  return vault
}

export async function moveVaultMoney(input: MoveVaultMoneyInput): Promise<Vault> {
  if (isTauriRuntime()) return tauriInvoke<Vault>('move_vault_money', { input })

  const vaults = await listVaults()
  const vault = vaults.find((item) => item.id === input.id)
  if (!vault) throw new Error('Cofre não encontrado')

  const current = moneyToCents(vault.balance)
  const amount = moneyToCents(input.amount)
  if (amount <= 0n) throw new Error('O valor deve ser maior que zero')
  const next = input.kind === 'deposit' ? current + amount : current - amount
  if (next < 0n) throw new Error('O cofre não tem saldo suficiente')

  vault.balance = centsToMoney(next)
  vault.updatedAt = new Date().toISOString()
  writeLocal(VAULTS_KEY, vaults)
  return { ...vault }
}

export async function deleteVault(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('delete_vault', { id })
    return
  }
  writeLocal(VAULTS_KEY, (await listVaults()).filter((vault) => vault.id !== id))
}

function moneyToCents(value: string): bigint {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Valor monetário inválido')
  const [whole, fraction = ''] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

function centsToMoney(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`
}
