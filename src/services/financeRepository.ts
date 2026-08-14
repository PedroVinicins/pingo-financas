import type {
  AccountSettings,
  AutomaticReserveRule,
  Category,
  DebitCard,
  MoveVaultMoneyInput,
  NewCategoryInput,
  NewDebitCardInput,
  NewRecurringRuleInput,
  NewTransactionInput,
  NewVaultInput,
  RecurringRule,
  RecurringSettlement,
  Transaction,
  UpdateTransactionInput,
  UpdateDebitCardStyleInput,
  UpdateVaultInput,
  Vault,
  VaultMovement,
  VaultMovementSource,
} from '../types/finance'
import { firstRecurringDueDate, followingRecurringDueDate, localDateKey } from './recurringDates'

// Mantidos para preservar dados de quem já usou as versões 0.1/0.2 no navegador.
const TRANSACTIONS_KEY = 'cashew-clone:transactions'
const CATEGORIES_KEY = 'cashew-clone:categories'
const DEBIT_CARDS_KEY = 'cashew-clone:debit-cards'
const VAULTS_KEY = 'pingo:vaults'
const VAULT_MOVEMENTS_KEY = 'pingo:vault-movements'
const AUTOMATIC_RESERVE_KEY = 'pingo:automatic-reserve-rules'
const ACCOUNT_SETTINGS_KEY = 'pingo:account-settings'
const RECURRING_RULES_KEY = 'pingo:recurring-rules'
const SQLITE_MIGRATION_KEY = 'pingo:sqlite-state-migrated-v0.7'

export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    const corrupted = localStorage.getItem(key)
    if (corrupted) {
      try { localStorage.setItem(`${key}:recovery:${Date.now()}`, corrupted) } catch { /* sem espaço */ }
    }
    return fallback
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('Não foi possível salvar os dados neste dispositivo. Verifique o espaço disponível.')
  }
}

function localRecurringRules(): RecurringRule[] {
  return readLocal<RecurringRule[]>(RECURRING_RULES_KEY, [])
    .map((rule) => {
      let nextDueDate = rule.nextDueDate
      if (!nextDueDate) {
        nextDueDate = firstRecurringDueDate(rule.dayOfMonth, new Date(rule.createdAt))
        if (rule.lastProcessedPeriod) {
          const processedDueDate = `${rule.lastProcessedPeriod}-${String(Math.min(rule.dayOfMonth, 28)).padStart(2, '0')}`
          nextDueDate = followingRecurringDueDate(rule.dayOfMonth, processedDueDate)
        }
      }
      return { ...rule, nextDueDate, autoProcessAfterDays: rule.autoProcessAfterDays ?? 3 }
    })
    .sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.description.localeCompare(b.description, 'pt-BR'))
}

export async function migrateLegacyAppData(): Promise<void> {
  if (!isTauriRuntime() || localStorage.getItem(SQLITE_MIGRATION_KEY)) return

  const [vaults, categories, cards] = await Promise.all([
    tauriInvoke<Vault[]>('list_vaults'),
    tauriInvoke<Category[]>('list_categories'),
    tauriInvoke<DebitCard[]>('list_debit_cards'),
  ])
  const vaultIds = new Set(vaults.map((item) => item.id))
  const categoryIds = new Set(categories.map((item) => item.id))
  const cardIds = new Set(cards.map((item) => item.id))

  const data = {
    accountSettings: readLocal<AccountSettings | null>(ACCOUNT_SETTINGS_KEY, null),
    vaultMovements: readLocal<VaultMovement[]>(VAULT_MOVEMENTS_KEY, [])
      .filter((item) => vaultIds.has(item.vaultId)),
    automaticReserveRules: readLocal<AutomaticReserveRule[]>(AUTOMATIC_RESERVE_KEY, [])
      .filter((item) => vaultIds.has(item.vaultId)),
    recurringRules: localRecurringRules().filter((item) =>
      categoryIds.has(item.categoryId) && (!item.debitCardId || cardIds.has(item.debitCardId))),
  }
  await tauriInvoke<void>('import_legacy_app_data', { data })
  localStorage.setItem(SQLITE_MIGRATION_KEY, new Date().toISOString())
}

function normalizeCard(card: DebitCard): DebitCard {
  return {
    ...card,
    pattern: card.pattern ?? 'soft',
    backgroundImage: card.backgroundImage ?? 'none',
    emoji: card.emoji ?? null,
  }
}

function normalizeCategory(category: Category): Category {
  return {
    ...category,
    kind: category.kind ?? 'expense',
  }
}

function transactionEffectCents(transaction: Pick<Transaction, 'kind' | 'amount'>) {
  const amount = moneyToCents(transaction.amount)
  return transaction.kind === 'income' ? amount : -amount
}

function localAvailableBalanceCents(transactions = readLocal<Transaction[]>(TRANSACTIONS_KEY, [])) {
  const settings = readLocal<AccountSettings | null>(ACCOUNT_SETTINGS_KEY, null)
  const transactionTotal = transactions.reduce(
    (total, item) => total + transactionEffectCents(item), 0n,
  )
  const vaultTotal = readLocal<Vault[]>(VAULTS_KEY, [])
    .reduce((total, vault) => total + moneyToCents(vault.balance), 0n)
  return transactionTotal
    + signedMoneyToCents(settings?.openingBalanceAdjustment ?? '0.00')
    - vaultTotal
}

function applyLocalAutomaticReserves(incomeCents: bigint) {
  const vaults = readLocal<Vault[]>(VAULTS_KEY, [])
  const rules = readLocal<AutomaticReserveRule[]>(AUTOMATIC_RESERVE_KEY, [])
    .filter((rule) => rule.enabled)
  if (!vaults.length || !rules.length) return

  let available = localAvailableBalanceCents()
  if (available <= 0n) return

  const now = new Date().toISOString()
  const movements = readLocal<VaultMovement[]>(VAULT_MOVEMENTS_KEY, [])
  let remainingIncome = incomeCents
  for (const rule of rules) {
    const vault = vaults.find((item) => item.id === rule.vaultId)
    if (!vault) continue
    const desired = rule.mode === 'percentage'
      ? (incomeCents * moneyToCents(rule.value)) / 10_000n
      : moneyToCents(rule.value)
    const availableAmount = desired > available ? available : desired
    const amount = availableAmount > remainingIncome ? remainingIncome : availableAmount
    if (amount <= 0n) continue
    vault.balance = centsToMoney(moneyToCents(vault.balance) + amount)
    vault.updatedAt = now
    movements.unshift({
      id: crypto.randomUUID(), vaultId: vault.id, kind: 'deposit', amount: centsToMoney(amount),
      source: 'automatic', occurredAt: now,
    })
    available -= amount
    remainingIncome -= amount
    if (available <= 0n || remainingIncome <= 0n) break
  }
  writeLocal(VAULTS_KEY, vaults)
  writeLocal(VAULT_MOVEMENTS_KEY, movements.slice(0, 500))
}

export async function listTransactions(): Promise<Transaction[]> {
  if (isTauriRuntime()) return tauriInvoke<Transaction[]>('list_transactions')
  return readLocal<Transaction[]>(TRANSACTIONS_KEY, [])
}

export async function addTransaction(input: NewTransactionInput): Promise<Transaction> {
  if (isTauriRuntime()) return tauriInvoke<Transaction>('add_transaction', { input })

  const amount = moneyToCents(input.amount)
  if (amount <= 0n) throw new Error('O valor deve ser maior que zero')
  if (input.kind === 'income' && input.debitCardId) {
    throw new Error('Um cartão de débito só pode ser associado a uma despesa')
  }
  if (!input.categoryId) throw new Error('Selecione uma categoria')
  const category = (await listCategories([])).find((item) => item.id === input.categoryId)
  if (!category || category.kind !== input.kind) {
    throw new Error('A categoria não corresponde ao tipo da transação')
  }

  const transactions = await listTransactions()
  if (input.kind === 'expense' && amount > localAvailableBalanceCents(transactions)) {
    throw new Error('Saldo insuficiente. O Pingo não deixa sua conta ficar negativa.')
  }

  if (input.kind === 'expense' && input.debitCardId) {
    const card = (await listDebitCards()).find((item) => item.id === input.debitCardId)
    if (!card) throw new Error('Cartão não encontrado')
    if (card.isFrozen) throw new Error('Este cartão está congelado')
    if (card.monthlySpendingLimit) {
      const used = transactions.reduce((total, item) =>
        item.kind === 'expense'
        && item.debitCardId === card.id
        && item.date.slice(0, 7) === input.date.slice(0, 7)
          ? total + moneyToCents(item.amount)
          : total, 0n)
      if (used + amount > moneyToCents(card.monthlySpendingLimit)) {
        throw new Error(`Esta compra ultrapassa o limite mensal de ${card.monthlySpendingLimit} definido para o cartão`)
      }
    }
  }

  const transaction: Transaction = {
    ...input,
    debitCardId: input.kind === 'income' ? null : input.debitCardId,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  transactions.push(transaction)
  writeLocal(TRANSACTIONS_KEY, transactions)
  if (transaction.kind === 'income') applyLocalAutomaticReserves(moneyToCents(transaction.amount))
  return transaction
}

export async function updateTransaction(input: UpdateTransactionInput): Promise<Transaction> {
  if (isTauriRuntime()) return tauriInvoke<Transaction>('update_transaction', { id: input.id, input })

  const amount = moneyToCents(input.amount)
  if (amount <= 0n) throw new Error('O valor deve ser maior que zero')
  if (input.kind === 'income' && input.debitCardId) {
    throw new Error('Um cartão de débito só pode ser associado a uma despesa')
  }
  if (!input.categoryId) throw new Error('Selecione uma categoria')
  const category = (await listCategories([])).find((item) => item.id === input.categoryId)
  if (!category || category.kind !== input.kind) {
    throw new Error('A categoria não corresponde ao tipo da transação')
  }

  const transactions = await listTransactions()
  const index = transactions.findIndex((item) => item.id === input.id)
  if (index < 0) throw new Error('Transação não encontrada')
  const projected = localAvailableBalanceCents(transactions)
    - transactionEffectCents(transactions[index])
    + transactionEffectCents(input)
  if (projected < 0n) throw new Error('Essa alteração deixaria a conta negativa.')

  if (input.kind === 'expense' && input.debitCardId) {
    const card = (await listDebitCards()).find((item) => item.id === input.debitCardId)
    if (!card) throw new Error('Cartão não encontrado')
    if (card.isFrozen) throw new Error('Este cartão está congelado')
    if (card.monthlySpendingLimit) {
      const used = transactions.reduce((total, item) =>
        item.id !== input.id
        && item.kind === 'expense'
        && item.debitCardId === card.id
        && item.date.slice(0, 7) === input.date.slice(0, 7)
          ? total + moneyToCents(item.amount)
          : total, 0n)
      if (used + amount > moneyToCents(card.monthlySpendingLimit)) {
        throw new Error(`Esta compra ultrapassa o limite mensal de ${card.monthlySpendingLimit} definido para o cartão`)
      }
    }
  }

  const updated: Transaction = {
    ...transactions[index],
    ...input,
    categoryId: input.categoryId,
    debitCardId: input.kind === 'income' ? null : input.debitCardId,
  }
  transactions[index] = updated
  writeLocal(TRANSACTIONS_KEY, transactions)
  return updated
}

export async function deleteTransaction(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('delete_transaction', { id })
    return
  }
  const transactions = await listTransactions()
  const transaction = transactions.find((item) => item.id === id)
  if (!transaction) throw new Error('Transação não encontrada')
  if (localAvailableBalanceCents(transactions) - transactionEffectCents(transaction) < 0n) {
    throw new Error('Excluir essa entrada deixaria a conta negativa.')
  }
  writeLocal(TRANSACTIONS_KEY, transactions.filter((item) => item.id !== id))
}

export async function listCategories(fallback: Category[]): Promise<Category[]> {
  if (isTauriRuntime()) return tauriInvoke<Category[]>('list_categories')

  const stored = readLocal<Category[]>(CATEGORIES_KEY, []).map(normalizeCategory)
  const categories = [...stored]

  for (const defaultCategory of fallback) {
    const alreadyExists = categories.some((category) =>
      category.kind === defaultCategory.kind
      && category.name.localeCompare(defaultCategory.name, 'pt-BR', { sensitivity: 'base' }) === 0,
    )
    if (!alreadyExists) categories.push(defaultCategory)
  }

  writeLocal(CATEGORIES_KEY, categories)
  return categories
}

export async function addCategory(input: NewCategoryInput): Promise<Category> {
  if (isTauriRuntime()) return tauriInvoke<Category>('add_category', { input })

  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome da categoria')

  const categories = await listCategories([])
  const duplicate = categories.some((category) =>
    category.kind === input.kind
    && category.name.localeCompare(name, 'pt-BR', { sensitivity: 'base' }) === 0,
  )
  if (duplicate) throw new Error('Essa categoria já existe')

  const category: Category = {
    ...input,
    id: crypto.randomUUID(),
    name,
    color: input.color.toUpperCase(),
    createdAt: new Date().toISOString(),
  }
  categories.push(category)
  writeLocal(CATEGORIES_KEY, categories)
  return category
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
  if (!card) throw new Error('Cartão não encontrado')
  card.isFrozen = frozen
  writeLocal(DEBIT_CARDS_KEY, cards)
}

export async function setDefaultDebitCard(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('set_default_debit_card', { id })
    return
  }

  const cards = await listDebitCards()
  if (!cards.some((card) => card.id === id)) throw new Error('Cartão não encontrado')
  cards.forEach((card) => { card.isDefault = card.id === id })
  writeLocal(DEBIT_CARDS_KEY, cards)
}

export async function deleteDebitCard(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('delete_debit_card', { id })
    return
  }

  const cards = await listDebitCards()
  if (!cards.some((card) => card.id === id)) throw new Error('Cartão não encontrado')
  writeLocal(DEBIT_CARDS_KEY, cards.filter((card) => card.id !== id))
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

  const initialBalance = moneyToCents(input.initialBalance)
  if (initialBalance > localAvailableBalanceCents()) {
    throw new Error('Não há saldo suficiente na conta para começar esse cofre')
  }
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
  if (initialBalance > 0n) {
    const movements = readLocal<VaultMovement[]>(VAULT_MOVEMENTS_KEY, [])
    movements.unshift({
      id: crypto.randomUUID(),
      vaultId: vault.id,
      kind: 'deposit',
      amount: input.initialBalance,
      source: 'manual',
      occurredAt: now,
    })
    writeLocal(VAULT_MOVEMENTS_KEY, movements.slice(0, 500))
  }
  return vault
}

export async function moveVaultMoney(
  input: MoveVaultMoneyInput,
  source: VaultMovementSource = 'manual',
): Promise<Vault> {
  if (isTauriRuntime()) return tauriInvoke<Vault>('move_vault_money', { input, source })

  const vaults = await listVaults()
  const vault = vaults.find((item) => item.id === input.id)
  if (!vault) throw new Error('Cofre não encontrado')

  const current = moneyToCents(vault.balance)
  const amount = moneyToCents(input.amount)
  if (amount <= 0n) throw new Error('O valor deve ser maior que zero')
  if (input.kind === 'deposit' && amount > localAvailableBalanceCents()) {
    throw new Error('Saldo insuficiente na conta principal para guardar esse valor')
  }
  const next = input.kind === 'deposit' ? current + amount : current - amount
  if (next < 0n) throw new Error('O cofre não tem saldo suficiente')

  vault.balance = centsToMoney(next)
  vault.updatedAt = new Date().toISOString()
  writeLocal(VAULTS_KEY, vaults)
  const movements = readLocal<VaultMovement[]>(VAULT_MOVEMENTS_KEY, [])
  movements.unshift({
    id: crypto.randomUUID(),
    vaultId: input.id,
    kind: input.kind,
    amount: input.amount,
    source,
    occurredAt: vault.updatedAt,
  })
  writeLocal(VAULT_MOVEMENTS_KEY, movements.slice(0, 500))
  return { ...vault }
}

export async function updateVault(input: UpdateVaultInput): Promise<Vault> {
  if (isTauriRuntime()) return tauriInvoke<Vault>('update_vault', { input })

  const vaults = await listVaults()
  const vault = vaults.find((item) => item.id === input.id)
  if (!vault) throw new Error('Cofre não encontrado')
  vault.name = input.name.trim()
  vault.institution = input.institution.trim()
  vault.targetAmount = input.targetAmount
  vault.annualYieldRate = input.annualYieldRate
  vault.color = input.color.toUpperCase()
  vault.emoji = input.emoji?.trim() || null
  vault.updatedAt = new Date().toISOString()
  writeLocal(VAULTS_KEY, vaults)
  return { ...vault }
}

export async function deleteVault(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await tauriInvoke<void>('delete_vault', { id })
    return
  }
  const vaults = await listVaults()
  if (!vaults.some((vault) => vault.id === id)) throw new Error('Cofre não encontrado')
  writeLocal(VAULTS_KEY, vaults.filter((vault) => vault.id !== id))
  writeLocal(VAULT_MOVEMENTS_KEY, readLocal<VaultMovement[]>(VAULT_MOVEMENTS_KEY, [])
    .filter((movement) => movement.vaultId !== id))
  writeLocal(AUTOMATIC_RESERVE_KEY, readLocal<AutomaticReserveRule[]>(AUTOMATIC_RESERVE_KEY, [])
    .filter((rule) => rule.vaultId !== id))
}

export async function loadAccountSettings(): Promise<AccountSettings | null> {
  if (isTauriRuntime()) return tauriInvoke<AccountSettings | null>('get_account_settings')
  return readLocal<AccountSettings | null>(ACCOUNT_SETTINGS_KEY, null)
}

export async function saveAccountSettings(settings: AccountSettings): Promise<void> {
  if (isTauriRuntime()) return tauriInvoke<void>('save_account_settings', { settings })
  writeLocal(ACCOUNT_SETTINGS_KEY, settings)
}

export async function listVaultMovements(): Promise<VaultMovement[]> {
  if (isTauriRuntime()) return tauriInvoke<VaultMovement[]>('list_vault_movements')
  return readLocal<VaultMovement[]>(VAULT_MOVEMENTS_KEY, [])
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

export async function listAutomaticReserveRules(): Promise<AutomaticReserveRule[]> {
  if (isTauriRuntime()) return tauriInvoke<AutomaticReserveRule[]>('list_automatic_reserve_rules')
  return readLocal<AutomaticReserveRule[]>(AUTOMATIC_RESERVE_KEY, [])
}

export async function saveAutomaticReserveRule(rule: AutomaticReserveRule): Promise<void> {
  if (isTauriRuntime()) return tauriInvoke<void>('save_automatic_reserve_rule', { rule })
  const value = moneyToCents(rule.value)
  if (value <= 0n) throw new Error('O valor da reserva automática deve ser maior que zero')
  if (rule.mode === 'percentage' && value > 10_000n) {
    throw new Error('A porcentagem da reserva automática deve ficar entre 0% e 100%')
  }
  if (!(await listVaults()).some((vault) => vault.id === rule.vaultId)) {
    throw new Error('Cofre não encontrado')
  }
  const rules = (await listAutomaticReserveRules()).filter((item) => item.vaultId !== rule.vaultId)
  rules.push(rule)
  writeLocal(AUTOMATIC_RESERVE_KEY, rules)
}

export async function removeAutomaticReserveRule(vaultId: string): Promise<void> {
  if (isTauriRuntime()) return tauriInvoke<void>('remove_automatic_reserve_rule', { vaultId })
  writeLocal(AUTOMATIC_RESERVE_KEY, (await listAutomaticReserveRules())
    .filter((item) => item.vaultId !== vaultId))
}

export async function listRecurringRules(): Promise<RecurringRule[]> {
  if (isTauriRuntime()) return tauriInvoke<RecurringRule[]>('list_recurring_rules')
  return localRecurringRules()
}

export async function addRecurringRule(input: NewRecurringRuleInput): Promise<RecurringRule> {
  if (isTauriRuntime()) {
    return tauriInvoke<RecurringRule>('add_recurring_rule', { input, today: localDateKey(new Date()) })
  }
  const now = new Date().toISOString()
  const rule: RecurringRule = {
    ...input,
    id: crypto.randomUUID(),
    autoProcessAfterDays: 3,
    active: true,
    lastProcessedPeriod: null,
    nextDueDate: firstRecurringDueDate(input.dayOfMonth),
    createdAt: now,
    updatedAt: now,
  }
  const rules = localRecurringRules()
  rules.push(rule)
  writeLocal(RECURRING_RULES_KEY, rules)
  return rule
}

export async function updateRecurringRule(rule: RecurringRule): Promise<RecurringRule> {
  if (isTauriRuntime()) return tauriInvoke<RecurringRule>('update_recurring_rule', { rule })
  const rules = localRecurringRules()
  const index = rules.findIndex((item) => item.id === rule.id)
  if (index < 0) throw new Error('Renda ou despesa fixa não encontrada')
  const updated = { ...rule, updatedAt: new Date().toISOString() }
  rules[index] = updated
  writeLocal(RECURRING_RULES_KEY, rules)
  return updated
}

export async function settleRecurringRule(id: string, today: string): Promise<RecurringSettlement> {
  if (isTauriRuntime()) {
    return tauriInvoke<RecurringSettlement>('settle_recurring_rule', { id, today })
  }

  const rule = localRecurringRules().find((item) => item.id === id)
  if (!rule) throw new Error('Renda ou despesa fixa não encontrada')
  if (!rule.active || today < rule.nextDueDate) {
    throw new Error(`A confirmação ficará disponível em ${rule.nextDueDate.split('-').reverse().join('/')}.`)
  }
  const processedDueDate = rule.nextDueDate
  const transaction = await addTransaction({
    kind: rule.kind,
    amount: rule.amount,
    date: today,
    categoryId: rule.categoryId,
    debitCardId: rule.kind === 'expense' ? rule.debitCardId : null,
    description: rule.description,
    recurrence: 'fixed',
  })
  const updated = await updateRecurringRule({
    ...rule,
    lastProcessedPeriod: processedDueDate.slice(0, 7),
    nextDueDate: followingRecurringDueDate(rule.dayOfMonth, processedDueDate),
  })
  return { transaction, rule: updated }
}

export async function deleteRecurringRule(id: string): Promise<void> {
  if (isTauriRuntime()) return tauriInvoke<void>('delete_recurring_rule', { id })
  const rules = localRecurringRules()
  if (!rules.some((item) => item.id === id)) throw new Error('Renda ou despesa fixa não encontrada')
  writeLocal(RECURRING_RULES_KEY, rules.filter((item) => item.id !== id))
}

function moneyToCents(value: string): bigint {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Valor monetário inválido')
  const [whole, fraction = ''] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

function signedMoneyToCents(value: string): bigint {
  const normalized = value.trim().replace(',', '.')
  const negative = normalized.startsWith('-')
  const cents = moneyToCents(negative ? normalized.slice(1) : normalized)
  return negative ? -cents : cents
}

function centsToMoney(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`
}
