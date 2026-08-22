import { describe, expect, it } from 'vitest'
import { financialBalanceInsight } from '../financialInsight'

const formatMoney = (value: bigint) => `R$ ${Number(value) / 100}`

describe('financialBalanceInsight', () => {
  it('distinguishes empty, negative, low and positive balances', () => {
    expect(financialBalanceInsight({ availableBalanceCents: 0n, monthlyIncomeCents: 0n, fixedCommitmentCents: 0n, hasTransactions: false, formatMoney })).toContain('Ainda não há')
    expect(financialBalanceInsight({ availableBalanceCents: -2500n, monthlyIncomeCents: 0n, fixedCommitmentCents: 0n, hasTransactions: true, formatMoney })).toContain('Saldo negativo')
    expect(financialBalanceInsight({ availableBalanceCents: 5000n, monthlyIncomeCents: 100000n, fixedCommitmentCents: 20000n, hasTransactions: true, formatMoney })).toContain('valor baixo')
    expect(financialBalanceInsight({ availableBalanceCents: 50000n, monthlyIncomeCents: 100000n, fixedCommitmentCents: 20000n, hasTransactions: true, formatMoney })).toContain('positivo')
  })
})
