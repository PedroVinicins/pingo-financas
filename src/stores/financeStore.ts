import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
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
  Transaction,
  TransactionFilters,
  UpdateDebitCardStyleInput,
  UpdateTransactionInput,
  UpdateVaultInput,
  Vault,
  VaultMovement,
  VaultMovementSource,
} from '../types/finance'
import * as repository from '../services/financeRepository'
import {
  cancelRecurringRuleNotification,
  maybeNotifyDueRecurringRules,
  scheduleRecurringRuleNotification,
} from '../services/notifications'
import { pingoMessageForTransaction } from '../services/pingoMessages'
import {
  daysAfterRecurringDueDate,
  followingRecurringDueDate,
  isRecurringRuleDue,
  localDateKey,
} from '../services/recurringDates'

export function decimalToCents(value: string): bigint {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Valor monetário inválido')
  const [whole, fraction = ''] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

function signedDecimalToCents(value: string): bigint {
  const normalized = value.trim().replace(',', '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Valor monetário inválido')
  const negative = normalized.startsWith('-')
  const cents = decimalToCents(negative ? normalized.slice(1) : normalized)
  return negative ? -cents : cents
}

export function centsToDecimal(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const whole = absolute / 100n
  const cents = (absolute % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${cents}`
}

function transactionEffect(transaction: Pick<Transaction, 'kind' | 'amount'>) {
  const amount = decimalToCents(transaction.amount)
  return transaction.kind === 'income' ? amount : -amount
}

export const useFinanceStore = defineStore('finance', () => {
  const transactions = ref<Transaction[]>([])
  const categories = ref<Category[]>([])
  const debitCards = ref<DebitCard[]>([])
  const vaults = ref<Vault[]>([])
  const vaultMovements = ref<VaultMovement[]>([])
  const automaticReserveRules = ref<AutomaticReserveRule[]>([])
  const recurringRules = ref<RecurringRule[]>([])
  const filters = ref<TransactionFilters>({})
  const accountSettings = ref<AccountSettings>({
    openingBalanceAdjustment: '0.00',
    balanceHidden: false,
    migratedAt: new Date().toISOString(),
  })
  const clock = ref(new Date())
  const pingoMessage = ref('')

  const transactionNetCents = computed(() => transactions.value.reduce(
    (total, transaction) => total + transactionEffect(transaction), 0n,
  ))
  const balanceCents = computed(() => transactionNetCents.value
    + signedDecimalToCents(accountSettings.value.openingBalanceAdjustment))
  const vaultTotalCents = computed(() => vaults.value.reduce(
    (total, vault) => total + decimalToCents(vault.balance), 0n,
  ))
  const availableBalanceCents = computed(() => {
    const available = balanceCents.value - vaultTotalCents.value
    return available > 0n ? available : 0n
  })
  const balanceHidden = computed(() => accountSettings.value.balanceHidden)

  const currentMonthBalanceCents = computed(() => {
    const now = clock.value
    return transactions.value.reduce((total, transaction) => {
      const date = new Date(`${transaction.date}T12:00:00`)
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) return total
      return total + transactionEffect(transaction)
    }, 0n)
  })
  const currentMonthIncomeCents = computed(() => currentMonthTotal('income'))
  const currentMonthExpenseCents = computed(() => currentMonthTotal('expense'))
  const currentMonthSavingsCents = computed(() => currentMonthIncomeCents.value - currentMonthExpenseCents.value)
  const savingsRate = computed(() => currentMonthIncomeCents.value === 0n
    ? 0
    : Number((currentMonthSavingsCents.value * 10_000n) / currentMonthIncomeCents.value) / 100)
  const currentMonthFixedExpenseCents = computed(() => {
    const now = clock.value
    return transactions.value.reduce((total, transaction) => {
      if (transaction.kind !== 'expense' || transaction.recurrence !== 'fixed') return total
      const date = new Date(`${transaction.date}T12:00:00`)
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) return total
      return total + decimalToCents(transaction.amount)
    }, 0n)
  })
  const fixedCostRatio = computed(() => currentMonthIncomeCents.value === 0n
    ? 0
    : Number((currentMonthFixedExpenseCents.value * 10_000n) / currentMonthIncomeCents.value) / 100)

  const averageMonthlyExpenseCents = computed(() => {
    const now = clock.value
    let total = 0n
    for (let offset = 0; offset < 3; offset += 1) {
      const target = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      total += transactions.value.reduce((monthTotal, transaction) => {
        if (transaction.kind !== 'expense') return monthTotal
        const date = new Date(`${transaction.date}T12:00:00`)
        return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth()
          ? monthTotal + decimalToCents(transaction.amount)
          : monthTotal
      }, 0n)
    }
    return total / 3n
  })
  const projectedMonthExpenseCents = computed(() => {
    const now = clock.value
    const elapsedDays = BigInt(Math.max(1, now.getDate()))
    const daysInMonth = BigInt(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())
    return (currentMonthExpenseCents.value * daysInMonth) / elapsedDays
  })
  const dailySpendingAverageCents = computed(() => currentMonthExpenseCents.value
    / BigInt(Math.max(1, clock.value.getDate())))
  const dailyBudgetCents = computed(() => {
    const now = clock.value
    const daysRemaining = BigInt(Math.max(
      1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1,
    ))
    return availableBalanceCents.value / daysRemaining
  })
  const emergencyFundMonths = computed(() => averageMonthlyExpenseCents.value > 0n
    ? Number((vaultTotalCents.value * 100n) / averageMonthlyExpenseCents.value) / 100
    : 0)
  const financialHealthScore = computed(() => {
    const savingsPoints = Math.max(0, Math.min(30, (savingsRate.value / 20) * 30))
    const fixedPoints = currentMonthIncomeCents.value === 0n
      ? 0
      : Math.max(0, Math.min(25, ((100 - fixedCostRatio.value) / 50) * 25))
    const reservePoints = Math.max(0, Math.min(30, (emergencyFundMonths.value / 6) * 30))
    const cashPoints = availableBalanceCents.value > 0n ? 15 : 0
    return Math.round(savingsPoints + fixedPoints + reservePoints + cashPoints)
  })

  const filteredTransactions = computed(() => {
    const result = transactions.value.filter((transaction) => {
      const date = new Date(`${transaction.date}T12:00:00`)
      if (filters.value.year !== undefined && date.getFullYear() !== filters.value.year) return false
      if (filters.value.month !== undefined && date.getMonth() + 1 !== filters.value.month) return false
      if (filters.value.kind && transaction.kind !== filters.value.kind) return false
      if (filters.value.categoryId && transaction.categoryId !== filters.value.categoryId) return false
      if (filters.value.debitCardId && transaction.debitCardId !== filters.value.debitCardId) return false
      return true
    })
    return [...result].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  })
  const recentTransactions = computed(() => filteredTransactions.value.slice(0, 8))
  const recentExpenses = computed(() => filteredTransactions.value.filter((item) => item.kind === 'expense').slice(0, 5))
  const recentExpenseCategoryIds = computed(() => {
    const result: string[] = []
    for (const transaction of recentExpenses.value) {
      if (transaction.categoryId && !result.includes(transaction.categoryId)) result.push(transaction.categoryId)
    }
    return result.slice(0, 4)
  })

  const expensesByCategory = computed(() => categoryTotals(false))
  const currentMonthExpensesByCategory = computed(() => categoryTotals(true))
  const expensePercentages = computed(() => percentageMap(expensesByCategory.value))
  const currentMonthExpensePercentages = computed(() => percentageMap(currentMonthExpensesByCategory.value))
  const topExpenseCategory = computed(() => {
    let topId: string | null = null
    let topAmount = 0n
    for (const [categoryId, amount] of currentMonthExpensesByCategory.value) {
      if (amount > topAmount) { topId = categoryId; topAmount = amount }
    }
    return {
      category: categories.value.find((item) => item.id === topId) ?? null,
      amount: topAmount,
      percentage: topId ? currentMonthExpensePercentages.value.get(topId) ?? 0 : 0,
    }
  })
  const expensesByDebitCard = computed(() => {
    const totals = new Map<string, bigint>()
    for (const transaction of transactions.value) {
      if (transaction.kind !== 'expense' || !transaction.debitCardId) continue
      totals.set(transaction.debitCardId, (totals.get(transaction.debitCardId) ?? 0n) + decimalToCents(transaction.amount))
    }
    return totals
  })
  const currentMonthExpensesByDebitCard = computed(() => {
    const now = clock.value
    const totals = new Map<string, bigint>()
    for (const transaction of transactions.value) {
      if (transaction.kind !== 'expense' || !transaction.debitCardId) continue
      const date = new Date(`${transaction.date}T12:00:00`)
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) continue
      totals.set(transaction.debitCardId, (totals.get(transaction.debitCardId) ?? 0n) + decimalToCents(transaction.amount))
    }
    return totals
  })
  const unassignedExpenseCents = computed(() => transactions.value.reduce((total, transaction) => {
    if (transaction.kind !== 'expense' || transaction.debitCardId) return total
    return total + decimalToCents(transaction.amount)
  }, 0n))
  const defaultDebitCard = computed(() => debitCards.value.find((card) => card.isDefault) ?? null)

  const fixedMonthlyCommitmentCents = computed(() => recurringRules.value.reduce((total, rule) =>
    rule.active && rule.kind === 'expense' ? total + decimalToCents(rule.amount) : total, 0n))
  const expectedMonthlyIncomeCents = computed(() => recurringRules.value.reduce((total, rule) =>
    rule.active && rule.kind === 'income' ? total + decimalToCents(rule.amount) : total, 0n))
  const dueRecurringRules = computed(() => recurringRules.value.filter((rule) =>
    isRecurringRuleDue(rule, clock.value)))
  const upcomingRecurringRules = computed(() => recurringRules.value.filter((rule) =>
    rule.active
    && !dueRecurringRules.value.some((item) => item.id === rule.id)))

  function categoryTotals(currentMonthOnly: boolean) {
    const now = clock.value
    const totals = new Map<string, bigint>()
    for (const transaction of transactions.value) {
      if (transaction.kind !== 'expense' || !transaction.categoryId) continue
      if (currentMonthOnly) {
        const date = new Date(`${transaction.date}T12:00:00`)
        if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) continue
      }
      totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0n) + decimalToCents(transaction.amount))
    }
    return totals
  }
  function percentageMap(totals: Map<string, bigint>) {
    const total = [...totals.values()].reduce((sum, value) => sum + value, 0n)
    const percentages = new Map<string, number>()
    for (const [categoryId, amount] of totals) {
      percentages.set(categoryId, total === 0n ? 0 : Number((amount * 10_000n) / total) / 100)
    }
    return percentages
  }
  function currentMonthTotal(kind: 'income' | 'expense') {
    const now = clock.value
    return transactions.value.reduce((total, transaction) => {
      if (transaction.kind !== kind) return total
      const date = new Date(`${transaction.date}T12:00:00`)
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) return total
      return total + decimalToCents(transaction.amount)
    }, 0n)
  }
  function getTransactionsForCard(cardId: string) {
    return transactions.value
      .filter((transaction) => transaction.kind === 'expense' && transaction.debitCardId === cardId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }
  function getMovementsForVault(vaultId: string) {
    return vaultMovements.value.filter((movement) => movement.vaultId === vaultId)
  }
  function getAutomaticReserveRule(vaultId: string) {
    return automaticReserveRules.value.find((rule) => rule.vaultId === vaultId) ?? null
  }

  function addTransaction(transaction: Transaction) {
    if (decimalToCents(transaction.amount) <= 0n) throw new Error('O valor deve ser maior que zero')
    transactions.value.push(transaction)
  }
  function removeTransaction(id: string) { transactions.value = transactions.value.filter((transaction) => transaction.id !== id) }
  function setTransactions(items: Transaction[]) { transactions.value = [...items] }
  function setCategories(items: Category[]) { categories.value = [...items] }
  function setDebitCards(items: DebitCard[]) { debitCards.value = [...items] }
  function setVaults(items: Vault[]) { vaults.value = [...items] }
  function setFilters(next: TransactionFilters) { filters.value = { ...next } }
  function dismissPingoMessage() { pingoMessage.value = '' }

  async function initialize(defaultCategories: Category[] = []) {
    const [storedTransactions, storedCategories, storedDebitCards, storedVaults] = await Promise.all([
      repository.listTransactions(), repository.listCategories(defaultCategories),
      repository.listDebitCards(), repository.listVaults(),
    ])
    setTransactions(storedTransactions)
    setCategories(storedCategories)
    setDebitCards(storedDebitCards)
    setVaults(storedVaults)
    vaultMovements.value = repository.listVaultMovements()
    automaticReserveRules.value = repository.listAutomaticReserveRules()
      .filter((rule) => storedVaults.some((vault) => vault.id === rule.vaultId))
    recurringRules.value = repository.listRecurringRules()
    const storedSettings = repository.loadAccountSettings()
    if (storedSettings) accountSettings.value = storedSettings
    else {
      const requiredAdjustment = vaultTotalCents.value - transactionNetCents.value
      accountSettings.value = {
        openingBalanceAdjustment: centsToDecimal(requiredAdjustment > 0n ? requiredAdjustment : 0n),
        balanceHidden: false,
        migratedAt: new Date().toISOString(),
      }
      repository.saveAccountSettings(accountSettings.value)
    }
    await processRecurringRules()
  }

  function validateTransactionInput(input: NewTransactionInput) {
    const category = categories.value.find((item) => item.id === input.categoryId)
    if (!category || category.kind !== input.kind) {
      throw new Error('Selecione uma categoria válida para esta transação')
    }
    const amount = decimalToCents(input.amount)
    if (input.kind === 'expense' && amount > availableBalanceCents.value) {
      throw new Error('Saldo insuficiente. O Pingo não deixa sua conta ficar negativa.')
    }
  }
  async function createTransaction(input: NewTransactionInput) {
    validateTransactionInput(input)
    const transaction = await repository.addTransaction(input)
    addTransaction(transaction)
    pingoMessage.value = pingoMessageForTransaction(transaction, availableBalanceCents.value)
    if (transaction.kind === 'income') await applyAutomaticReserve(decimalToCents(transaction.amount))
    return transaction
  }
  async function editTransaction(input: UpdateTransactionInput) {
    const current = transactions.value.find((item) => item.id === input.id)
    if (!current) throw new Error('Transação não encontrada')
    const category = categories.value.find((item) => item.id === input.categoryId)
    if (!category || category.kind !== input.kind) throw new Error('Selecione uma categoria válida')
    const projectedTotal = balanceCents.value - transactionEffect(current) + transactionEffect(input)
    if (projectedTotal < vaultTotalCents.value) {
      throw new Error('Essa alteração deixaria a conta negativa. Ajuste o valor ou o saldo primeiro.')
    }
    const updated = await repository.updateTransaction(input)
    const index = transactions.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) transactions.value[index] = updated
    pingoMessage.value = 'Pronto! O passado foi corrigido sem bagunçar as contas. 🧾'
    return updated
  }
  async function createCategory(input: NewCategoryInput) {
    const category = await repository.addCategory(input)
    categories.value.push(category)
    categories.value.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return category
  }
  async function deleteTransaction(id: string) {
    const transaction = transactions.value.find((item) => item.id === id)
    if (transaction && balanceCents.value - transactionEffect(transaction) < vaultTotalCents.value) {
      throw new Error('Excluir essa entrada deixaria a conta negativa.')
    }
    await repository.deleteTransaction(id)
    removeTransaction(id)
  }

  async function createDebitCard(input: NewDebitCardInput) {
    const card = await repository.addDebitCard(input)
    if (card.isDefault) debitCards.value.forEach((item) => { item.isDefault = false })
    debitCards.value.push(card)
    return card
  }
  async function updateCardStyle(input: UpdateDebitCardStyleInput) {
    const updated = await repository.updateDebitCardStyle(input)
    const index = debitCards.value.findIndex((card) => card.id === updated.id)
    if (index >= 0) debitCards.value[index] = updated
    return updated
  }
  async function setCardFrozen(id: string, frozen: boolean) {
    await repository.setDebitCardFrozen(id, frozen)
    const card = debitCards.value.find((item) => item.id === id)
    if (card) card.isFrozen = frozen
  }
  async function makeDefaultCard(id: string) {
    await repository.setDefaultDebitCard(id)
    debitCards.value.forEach((card) => { card.isDefault = card.id === id })
  }
  async function removeDebitCard(id: string) {
    await repository.deleteDebitCard(id)
    debitCards.value = debitCards.value.filter((card) => card.id !== id)
    transactions.value = transactions.value.map((transaction) =>
      transaction.debitCardId === id ? { ...transaction, debitCardId: null } : transaction)
  }

  async function createVault(input: NewVaultInput) {
    const initial = decimalToCents(input.initialBalance)
    if (initial > availableBalanceCents.value) throw new Error('Não há saldo suficiente na conta para começar esse cofre.')
    const vault = await repository.addVault(input)
    vaults.value.push(vault)
    if (initial > 0n) recordVaultMovement({ id: vault.id, kind: 'deposit', amount: input.initialBalance }, 'manual')
    return vault
  }
  async function moveVaultMoney(input: MoveVaultMoneyInput, source: VaultMovementSource = 'manual') {
    const amount = decimalToCents(input.amount)
    if (input.kind === 'deposit' && amount > availableBalanceCents.value) {
      throw new Error('Saldo insuficiente na conta principal para guardar esse valor.')
    }
    const updated = await repository.moveVaultMoney(input)
    const index = vaults.value.findIndex((vault) => vault.id === updated.id)
    if (index >= 0) vaults.value[index] = updated
    recordVaultMovement(input, source)
    if (source === 'manual') {
      pingoMessage.value = input.kind === 'deposit'
        ? 'Aí sim! Um pingo guardado hoje vira uma poça amanhã. 🐷'
        : 'O porquinho abriu a porteira. Use com carinho! 😅'
    }
    return updated
  }
  function recordVaultMovement(input: MoveVaultMoneyInput, source: VaultMovementSource) {
    const movement = repository.addVaultMovement(input, source)
    vaultMovements.value.unshift(movement)
  }
  async function customizeVault(input: UpdateVaultInput) {
    const updated = await repository.updateVault(input)
    const index = vaults.value.findIndex((vault) => vault.id === updated.id)
    if (index >= 0) vaults.value[index] = updated
    return updated
  }
  async function removeVault(id: string) {
    await repository.deleteVault(id)
    vaults.value = vaults.value.filter((vault) => vault.id !== id)
    automaticReserveRules.value = automaticReserveRules.value.filter((rule) => rule.vaultId !== id)
    repository.removeAutomaticReserveRule(id)
  }
  function saveAutomaticReserve(rule: AutomaticReserveRule) {
    if (decimalToCents(rule.value) <= 0n) throw new Error('Informe um valor maior que zero')
    if (rule.mode === 'percentage' && decimalToCents(rule.value) > 10_000n) {
      throw new Error('A porcentagem deve ser de no máximo 100%')
    }
    repository.saveAutomaticReserveRule(rule)
    const index = automaticReserveRules.value.findIndex((item) => item.vaultId === rule.vaultId)
    if (index >= 0) automaticReserveRules.value[index] = rule
    else automaticReserveRules.value.push(rule)
  }
  async function applyAutomaticReserve(incomeCents: bigint) {
    for (const rule of automaticReserveRules.value.filter((item) => item.enabled)) {
      if (!vaults.value.some((vault) => vault.id === rule.vaultId)) continue
      let amount = rule.mode === 'percentage'
        ? (incomeCents * decimalToCents(rule.value)) / 10_000n
        : decimalToCents(rule.value)
      if (amount > availableBalanceCents.value) amount = availableBalanceCents.value
      if (amount <= 0n) continue
      await moveVaultMoney(
        { id: rule.vaultId, kind: 'deposit', amount: centsToDecimal(amount) },
        'automatic',
      ).catch(() => undefined)
    }
  }

  function setAvailableBalance(amount: string) {
    const desired = decimalToCents(amount)
    const adjustment = desired + vaultTotalCents.value - transactionNetCents.value
    accountSettings.value = { ...accountSettings.value, openingBalanceAdjustment: centsToDecimal(adjustment) }
    repository.saveAccountSettings(accountSettings.value)
    pingoMessage.value = 'Saldo ajustado. Agora o Pingo e sua conta estão falando a mesma língua. ✅'
  }
  function toggleBalanceVisibility() {
    accountSettings.value = { ...accountSettings.value, balanceHidden: !accountSettings.value.balanceHidden }
    repository.saveAccountSettings(accountSettings.value)
  }

  async function createRecurringRule(input: NewRecurringRuleInput) {
    if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
      throw new Error('Escolha um dia entre 1 e 31')
    }
    const category = categories.value.find((item) => item.id === input.categoryId)
    if (!category || category.kind !== input.kind) throw new Error('Selecione uma categoria válida')
    const rule = repository.addRecurringRule(input)
    recurringRules.value.push(rule)
    recurringRules.value.sort((a, b) => a.dayOfMonth - b.dayOfMonth)
    if (rule.reminderEnabled) {
      try {
        await scheduleRecurringRuleNotification(rule, true)
      } catch (cause) {
        repository.deleteRecurringRule(rule.id)
        recurringRules.value = recurringRules.value.filter((item) => item.id !== rule.id)
        throw cause
      }
    }
    pingoMessage.value = rule.kind === 'expense'
      ? `Piloto ligado para “${rule.description}”. Quando o boleto acordar, eu te aviso. 🤖`
      : `Salário “${rule.description}” entrou no radar. Quando chegar o dia, eu grito: PINGOU! 💸`
    return rule
  }
  async function settleRecurringRule(id: string, automatic = false) {
    clock.value = new Date()
    const rule = recurringRules.value.find((item) => item.id === id)
    if (!rule) throw new Error('Renda ou despesa fixa não encontrada')
    if (!isRecurringRuleDue(rule, clock.value)) {
      throw new Error(`A confirmação ficará disponível em ${rule.nextDueDate.split('-').reverse().join('/')}.`)
    }
    const processedDueDate = rule.nextDueDate
    const transaction = await createTransaction({
      kind: rule.kind,
      amount: rule.amount,
      date: localDateKey(clock.value),
      categoryId: rule.categoryId,
      debitCardId: rule.kind === 'expense' ? rule.debitCardId : null,
      description: rule.description,
      recurrence: 'fixed',
    })
    rule.lastProcessedPeriod = processedDueDate.slice(0, 7)
    rule.nextDueDate = followingRecurringDueDate(rule.dayOfMonth, processedDueDate)
    const updated = repository.updateRecurringRule(rule)
    const index = recurringRules.value.findIndex((item) => item.id === id)
    if (index >= 0) recurringRules.value[index] = updated
    if (automatic) pingoMessage.value = `Você demorou 3 dias, então o Pingo registrou “${rule.description}”. Tudo sem deixar o saldo negativo.`
    else pingoMessage.value = rule.kind === 'income'
      ? `Opa, pingou “${rule.description}”! Agora respira antes de abrir as promoções. 😅`
      : `“${rule.description}” paga. Um boleto a menos encarando você enquanto dorme. 😴`
    return transaction
  }
  async function processRecurringRules() {
    clock.value = new Date()
    for (const rule of dueRecurringRules.value) {
      if (rule.kind !== 'expense') continue
      const elapsedDays = daysAfterRecurringDueDate(rule.nextDueDate, clock.value)
      if (elapsedDays < rule.autoProcessAfterDays || decimalToCents(rule.amount) > availableBalanceCents.value) continue
      await settleRecurringRule(rule.id, true).catch(() => undefined)
    }
    await maybeNotifyDueRecurringRules(dueRecurringRules.value)
  }
  async function removeRecurringRule(id: string) {
    repository.deleteRecurringRule(id)
    recurringRules.value = recurringRules.value.filter((rule) => rule.id !== id)
    await cancelRecurringRuleNotification(id)
  }

  return {
    transactions, categories, debitCards, vaults, vaultMovements, automaticReserveRules, recurringRules,
    filters, accountSettings, pingoMessage, balanceHidden, transactionNetCents, balanceCents, vaultTotalCents,
    availableBalanceCents, currentMonthBalanceCents, currentMonthIncomeCents, currentMonthExpenseCents,
    currentMonthSavingsCents, currentMonthFixedExpenseCents, savingsRate, fixedCostRatio,
    averageMonthlyExpenseCents, projectedMonthExpenseCents, dailySpendingAverageCents, dailyBudgetCents,
    emergencyFundMonths, financialHealthScore, filteredTransactions, recentTransactions, recentExpenses,
    recentExpenseCategoryIds, expensesByCategory, currentMonthExpensesByCategory, expensePercentages,
    currentMonthExpensePercentages, topExpenseCategory, expensesByDebitCard, currentMonthExpensesByDebitCard,
    unassignedExpenseCents, defaultDebitCard, fixedMonthlyCommitmentCents, expectedMonthlyIncomeCents,
    dueRecurringRules, upcomingRecurringRules, getTransactionsForCard, getMovementsForVault,
    getAutomaticReserveRule, addTransaction, removeTransaction, setTransactions, setCategories,
    setDebitCards, setVaults, setFilters, dismissPingoMessage, initialize, createTransaction,
    editTransaction, createCategory, deleteTransaction, createDebitCard, updateCardStyle, setCardFrozen,
    makeDefaultCard, removeDebitCard, createVault, moveVaultMoney, customizeVault, removeVault,
    saveAutomaticReserve, applyAutomaticReserve, setAvailableBalance, toggleBalanceVisibility,
    createRecurringRule, settleRecurringRule, processRecurringRules, removeRecurringRule,
  }
})
