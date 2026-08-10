import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFinanceStore } from '../financeStore'
import type { DebitCard, Transaction } from '../../types/finance'

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-default',
    kind: 'expense',
    amount: '10.00',
    date: '2026-08-09',
    categoryId: 'food',
    debitCardId: null,
    description: 'Teste',
    recurrence: 'variable',
    createdAt: '2026-08-09T12:00:00Z',
    ...overrides,
  }
}

function card(overrides: Partial<DebitCard> = {}): DebitCard {
  return {
    id: 'card-1',
    name: 'Principal',
    issuer: 'Banco Teste',
    holderName: 'Pedro Silva',
    lastFour: '4242',
    network: 'mastercard',
    colorFrom: '#0F172A',
    colorTo: '#334155',
    pattern: 'soft',
    emoji: null,
    isDefault: true,
    isFrozen: false,
    monthlySpendingLimit: '200.00',
    createdAt: '2026-08-09T12:00:00Z',
    ...overrides,
  }
}

describe('financeStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('adiciona e remove transações mantendo o saldo reativo', () => {
    const store = useFinanceStore()

    store.addTransaction(transaction({ id: 'salary', kind: 'income', amount: '702.00' }))
    store.addTransaction(transaction({ id: 'food', amount: '42.35' }))

    expect(store.balanceCents).toBe(65965n)

    store.removeTransaction('food')
    expect(store.balanceCents).toBe(70200n)
  })

  it('recalcula o saldo quando o estado muda', () => {
    const store = useFinanceStore()
    store.setTransactions([transaction({ kind: 'income', amount: '100.10' })])
    expect(store.balanceCents).toBe(10010n)

    store.addTransaction(transaction({ amount: '0.10' }))
    expect(store.balanceCents).toBe(10000n)
  })

  it('rejeita valor zero', () => {
    const store = useFinanceStore()
    expect(() => store.addTransaction(transaction({ amount: '0.00' }))).toThrow(/maior que zero/i)
  })

  it('separa despesas por cartão sem criar um segundo saldo', () => {
    const store = useFinanceStore()
    store.setDebitCards([card(), card({ id: 'card-2', lastFour: '9090', isDefault: false })])
    store.setTransactions([
      transaction({ id: 'salary', kind: 'income', amount: '500.00', categoryId: null }),
      transaction({ id: 'a', amount: '20.00', debitCardId: 'card-1' }),
      transaction({ id: 'b', amount: '35.50', debitCardId: 'card-2' }),
      transaction({ id: 'pix', amount: '10.00', debitCardId: null }),
    ])

    expect(store.expensesByDebitCard.get('card-1')).toBe(2000n)
    expect(store.expensesByDebitCard.get('card-2')).toBe(3550n)
    expect(store.unassignedExpenseCents).toBe(1000n)
    expect(store.balanceCents).toBe(43450n)
  })
})
