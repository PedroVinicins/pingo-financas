import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  Category,
  DebitCard,
  NewDebitCardInput,
  NewTransactionInput,
  Transaction,
  TransactionFilters,
  UpdateDebitCardStyleInput,
} from '../types/finance'
import * as repository from '../services/financeRepository'

export function decimalToCents(value: string): bigint {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Valor monetário inválido')

  const [whole, fraction = ''] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

export function centsToDecimal(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const whole = absolute / 100n
  const cents = (absolute % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${cents}`
}

export const useFinanceStore = defineStore('finance', () => {
  const transactions = ref<Transaction[]>([])
  const categories = ref<Category[]>([])
  const debitCards = ref<DebitCard[]>([])
  const filters = ref<TransactionFilters>({})

  const balanceCents = computed(() => transactions.value.reduce((total, transaction) => {
    const amount = decimalToCents(transaction.amount)
    return transaction.kind === 'income' ? total + amount : total - amount
  }, 0n))

  const currentMonthBalanceCents = computed(() => {
    const now = new Date()
    return transactions.value.reduce((total, transaction) => {
      const date = new Date(`${transaction.date}T12:00:00`)
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) return total
      const amount = decimalToCents(transaction.amount)
      return transaction.kind === 'income' ? total + amount : total - amount
    }, 0n)
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

  const recentTransactions = computed(() => filteredTransactions.value.slice(0, 6))
  const recentExpenses = computed(() => filteredTransactions.value.filter((item) => item.kind === 'expense').slice(0, 5))

  const recentExpenseCategoryIds = computed(() => {
    const result: string[] = []
    for (const transaction of recentExpenses.value) {
      if (transaction.categoryId && !result.includes(transaction.categoryId)) result.push(transaction.categoryId)
    }
    return result.slice(0, 4)
  })

  const expensesByCategory = computed(() => {
    const totals = new Map<string, bigint>()
    for (const transaction of transactions.value) {
      if (transaction.kind !== 'expense' || !transaction.categoryId) continue
      totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0n) + decimalToCents(transaction.amount))
    }
    return totals
  })

  const expensePercentages = computed(() => {
    const total = [...expensesByCategory.value.values()].reduce((sum, value) => sum + value, 0n)
    const percentages = new Map<string, number>()
    for (const [categoryId, amount] of expensesByCategory.value) {
      percentages.set(categoryId, total === 0n ? 0 : Number((amount * 10_000n) / total) / 100)
    }
    return percentages
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
    const now = new Date()
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

  function getTransactionsForCard(cardId: string) {
    return transactions.value
      .filter((transaction) => transaction.kind === 'expense' && transaction.debitCardId === cardId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }

  function addTransaction(transaction: Transaction) {
    if (decimalToCents(transaction.amount) <= 0n) throw new Error('O valor deve ser maior que zero')
    transactions.value.push(transaction)
  }

  function removeTransaction(id: string) {
    transactions.value = transactions.value.filter((transaction) => transaction.id !== id)
  }

  function setTransactions(items: Transaction[]) { transactions.value = [...items] }
  function setCategories(items: Category[]) { categories.value = [...items] }
  function setDebitCards(items: DebitCard[]) { debitCards.value = [...items] }
  function setFilters(next: TransactionFilters) { filters.value = { ...next } }

  async function initialize(defaultCategories: Category[] = []) {
    const [storedTransactions, storedCategories, storedDebitCards] = await Promise.all([
      repository.listTransactions(),
      repository.listCategories(defaultCategories),
      repository.listDebitCards(),
    ])
    setTransactions(storedTransactions)
    setCategories(storedCategories)
    setDebitCards(storedDebitCards)
  }

  async function createTransaction(input: NewTransactionInput) {
    const transaction = await repository.addTransaction(input)
    addTransaction(transaction)
    return transaction
  }

  async function deleteTransaction(id: string) {
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
      transaction.debitCardId === id ? { ...transaction, debitCardId: null } : transaction,
    )
  }

  return {
    transactions,
    categories,
    debitCards,
    filters,
    balanceCents,
    currentMonthBalanceCents,
    filteredTransactions,
    recentTransactions,
    recentExpenses,
    recentExpenseCategoryIds,
    expensesByCategory,
    expensePercentages,
    expensesByDebitCard,
    currentMonthExpensesByDebitCard,
    unassignedExpenseCents,
    defaultDebitCard,
    getTransactionsForCard,
    addTransaction,
    removeTransaction,
    setTransactions,
    setCategories,
    setDebitCards,
    setFilters,
    initialize,
    createTransaction,
    deleteTransaction,
    createDebitCard,
    updateCardStyle,
    setCardFrozen,
    makeDefaultCard,
    removeDebitCard,
  }
})
