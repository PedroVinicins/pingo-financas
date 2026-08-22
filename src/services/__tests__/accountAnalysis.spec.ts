import { describe, expect, it } from 'vitest'
import { analyzeAccount } from '../accountAnalysis'
import type { Category, Transaction } from '../../types/finance'

const categories: Category[] = [
  { id: 'salary', kind: 'income', name: 'Salário', icon: 'banknote', color: '#10B981', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'food', kind: 'expense', name: 'Alimentação', icon: 'utensils', color: '#F43F5E', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'leisure', kind: 'expense', name: 'Lazer', icon: 'gamepad', color: '#7C3AED', createdAt: '2026-08-01T00:00:00Z' },
]

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(), kind: 'expense', amount: '10.00', date: '2026-08-10',
    occurredAt: '2026-08-10T12:00:00', categoryId: 'food', debitCardId: null,
    description: 'Movimentação', recurrence: 'variable', createdAt: '2026-08-10T12:00:00Z',
    ...overrides,
  }
}

const formatMoney = (value: bigint) => `R$ ${(Number(value) / 100).toFixed(2)}`

describe('analyzeAccount', () => {
  it('cruza categorias de entradas e saídas no mesmo diagnóstico', () => {
    const analysis = analyzeAccount({
      transactions: [
        transaction({ id: 'income', kind: 'income', amount: '2000.00', categoryId: 'salary', description: 'Salário' }),
        transaction({ id: 'food', amount: '500.00', categoryId: 'food', description: 'Mercado' }),
        transaction({ id: 'leisure', amount: '100.00', categoryId: 'leisure', description: 'Cinema' }),
      ],
      categories, year: 2026, month: 8, formatMoney,
    })

    expect(analysis.incomeCents).toBe(200_000n)
    expect(analysis.expenseCents).toBe(60_000n)
    expect(analysis.categoryFlows.map((item) => [item.kind, item.name])).toEqual([
      ['income', 'Salário'], ['expense', 'Alimentação'], ['expense', 'Lazer'],
    ])
    expect(analysis.categoryFlows.find((item) => item.id === 'food')?.percentage).toBeCloseTo(83.33, 1)
  })

  it('analisa horário, média, maior valor e concentração de gastos', () => {
    const analysis = analyzeAccount({
      transactions: [
        transaction({ id: 'income', kind: 'income', amount: '1000.00', categoryId: 'salary' }),
        transaction({ id: 'night-1', amount: '250.00', occurredAt: '2026-08-10T21:00:00' }),
        transaction({ id: 'night-2', amount: '150.00', occurredAt: '2026-08-11T23:00:00' }),
        transaction({ id: 'dawn', amount: '100.00', occurredAt: '2026-08-12T02:00:00' }),
      ],
      categories, year: 2026, month: 8, formatMoney,
    })

    expect(analysis.averageExpenseCents).toBe(16_666n)
    expect(analysis.medianExpenseCents).toBe(15_000n)
    expect(analysis.largestExpense?.id).toBe('night-1')
    expect(analysis.spendingByTime.find((item) => item.id === 'night')).toMatchObject({
      amountCents: 40_000n, transactionCount: 2,
    })
    expect(analysis.alerts.map((item) => item.id)).toContain('off-hours-spending')
    expect(analysis.alerts.some((item) => item.id.startsWith('category-concentration:'))).toBe(true)
  })

  it('avisa quando as despesas passam das receitas', () => {
    const analysis = analyzeAccount({
      transactions: [
        transaction({ kind: 'income', amount: '500.00', categoryId: 'salary' }),
        transaction({ amount: '700.00', categoryId: 'food' }),
      ],
      categories, year: 2026, month: 8, formatMoney,
    })

    expect(analysis.alerts[0]).toMatchObject({ id: 'period-deficit', severity: 'critical' })
    expect(analysis.notificationKey).toContain('period-deficit')
  })
})
