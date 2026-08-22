import { describe, expect, it } from 'vitest'
import { analysisNotificationCopy, recurringNotificationCopy } from '../notifications'
import { analyzeAccount } from '../accountAnalysis'
import type { Category, RecurringRule, Transaction } from '../../types/finance'

const rule: RecurringRule = {
  id: 'rule-1', kind: 'expense', amount: '1234.56', description: 'Aluguel', categoryId: 'home', debitCardId: null,
  dayOfMonth: 10, active: true, reminderEnabled: true, autoProcessAfterDays: 3,
  nextDueDate: '2026-08-10', lastProcessedPeriod: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('recurring notifications', () => {
  it('includes description, amount, currency and due context', () => {
    const copy = recurringNotificationCopy(rule, 'BRL')
    expect(copy.body).toContain('Aluguel')
    expect(copy.body).toContain('R$')
    expect(copy.body).toContain('1.234,56')
    expect(copy.body).toContain('vence hoje')
  })

  it('usa o problema real da análise na notificação', () => {
    const categories: Category[] = [
      { id: 'income', kind: 'income', name: 'Salário', icon: 'banknote', color: '#10B981', createdAt: '' },
      { id: 'expense', kind: 'expense', name: 'Casa', icon: 'house', color: '#F43F5E', createdAt: '' },
    ]
    const base: Transaction = {
      id: 'income', kind: 'income', amount: '500.00', date: '2026-08-10', occurredAt: '2026-08-10T09:00:00',
      categoryId: 'income', debitCardId: null, description: 'Salário', recurrence: 'variable', createdAt: '',
    }
    const analysis = analyzeAccount({
      transactions: [base, { ...base, id: 'expense', kind: 'expense', amount: '700.00', categoryId: 'expense', description: 'Aluguel' }],
      categories, year: 2026, month: 8,
      formatMoney: (value) => `R$ ${(Number(value) / 100).toFixed(2)}`,
    })
    const copy = analysisNotificationCopy(analysis, 'BRL')

    expect(copy.title).toContain('Atenção')
    expect(copy.body).toContain('saídas passaram')
    expect(copy.body).toContain('R$ 200.00')
  })
})
