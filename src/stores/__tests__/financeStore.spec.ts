import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { decimalToCents, useFinanceStore } from '../financeStore'
import type { Category, DebitCard, Transaction, Vault } from '../../types/finance'

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-default',
    kind: 'expense',
    amount: '10.00',
    date: '2026-08-09',
    occurredAt: null,
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
    backgroundImage: 'none',
    emoji: null,
    isDefault: true,
    isFrozen: false,
    monthlySpendingLimit: '200.00',
    createdAt: '2026-08-09T12:00:00Z',
    ...overrides,
  }
}

function vault(overrides: Partial<Vault> = {}): Vault {
  return {
    id: 'vault-1',
    name: 'Reserva',
    institution: 'Banco Inter',
    type: 'piggy_bank',
    balance: '300.00',
    targetAmount: '1000.00',
    annualYieldRate: '12.00',
    color: '#F97316',
    emoji: '🐷',
    createdAt: '2026-08-09T12:00:00Z',
    updatedAt: '2026-08-09T12:00:00Z',
    ...overrides,
  }
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'food',
    kind: 'expense',
    name: 'Alimentação',
    icon: 'utensils',
    color: '#EA580C',
    createdAt: '2026-08-09T12:00:00Z',
    ...overrides,
  }
}

describe('financeStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0, 0))
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.useRealTimers())

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

  it('separa saldo disponível do dinheiro reservado em cofres', () => {
    const store = useFinanceStore()
    const today = new Date().toISOString().slice(0, 10)
    store.setTransactions([
      transaction({ id: 'salary', kind: 'income', amount: '1000.00', categoryId: null, date: today }),
      transaction({ id: 'expense', amount: '200.00', date: today }),
    ])
    store.setVaults([vault()])

    expect(store.balanceCents).toBe(80000n)
    expect(store.vaultTotalCents).toBe(30000n)
    expect(store.availableBalanceCents).toBe(50000n)
    expect(store.currentMonthSavingsCents).toBe(80000n)
    expect(store.savingsRate).toBe(80)
  })

  it('impede usar uma categoria de entrada em uma despesa', async () => {
    const store = useFinanceStore()
    store.setCategories([category({ id: 'salary', kind: 'income', name: 'Salário' })])

    await expect(store.createTransaction({
      kind: 'expense',
      amount: '10.00',
      date: '2026-08-11',
      categoryId: 'salary',
      debitCardId: null,
      description: 'Teste',
      recurrence: 'variable',
    })).rejects.toThrow(/categoria válida/i)
  })

  it('transfere entre conta e porquinho sem alterar o patrimônio total', async () => {
    const store = useFinanceStore()
    const storedVault = vault({ balance: '300.00' })
    const storedIncome = transaction({ id: 'salary', kind: 'income', amount: '1000.00' })
    localStorage.setItem('pingo:vaults', JSON.stringify([storedVault]))
    localStorage.setItem('cashew-clone:transactions', JSON.stringify([storedIncome]))
    store.setTransactions([storedIncome])
    store.setVaults([storedVault])

    await store.moveVaultMoney({ id: storedVault.id, kind: 'deposit', amount: '200.00' })

    expect(store.balanceCents).toBe(100000n)
    expect(store.vaultTotalCents).toBe(50000n)
    expect(store.availableBalanceCents).toBe(50000n)
    expect(store.getMovementsForVault(storedVault.id)).toHaveLength(1)
  })

  it('não permite que uma nova despesa deixe a conta negativa', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    store.setCategories([expenseCategory])
    store.setTransactions([transaction({ id: 'salary', kind: 'income', amount: '100.00', categoryId: null })])

    await expect(store.createTransaction({
      kind: 'expense', amount: '100.01', date: '2026-08-12', categoryId: expenseCategory.id,
      debitCardId: null, description: 'Compra impossível', recurrence: 'variable',
    })).rejects.toThrow(/não deixa sua conta ficar negativa/i)
  })

  it('persiste as preferências e alerta ao atingir o radar diário', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    localStorage.setItem('cashew-clone:categories', JSON.stringify([expenseCategory]))
    store.setCategories([expenseCategory])
    await store.setAvailableBalance('200.00')
    store.updatePreferences({ dailySpendingAlertsEnabled: true, spendingAlertPercent: 80 })

    await store.createTransaction({
      kind: 'expense', amount: '8.00', date: '2026-08-12', occurredAt: '2026-08-12T10:00:00',
      categoryId: expenseCategory.id, debitCardId: null, description: 'Café', recurrence: 'variable',
    })

    expect(store.todayExpenseCents).toBe(800n)
    expect(store.pingoMessage).toMatch(/radar diário/i)
    expect(JSON.parse(localStorage.getItem('pingo:preferences') ?? '{}')).toMatchObject({ spendingAlertPercent: 80 })
  })

  it('aplica o limite mensal configurado no cartão', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    store.setCategories([expenseCategory])
    store.setDebitCards([card({ monthlySpendingLimit: '200.00' })])
    store.setTransactions([
      transaction({ id: 'salary', kind: 'income', amount: '500.00', categoryId: null }),
      transaction({ id: 'existing', amount: '195.00', debitCardId: 'card-1', date: '2026-08-05' }),
    ])

    await expect(store.createTransaction({
      kind: 'expense', amount: '5.01', date: '2026-08-12', categoryId: expenseCategory.id,
      debitCardId: 'card-1', description: 'Passou do limite', recurrence: 'variable',
    })).rejects.toThrow(/limite mensal/i)
  })

  it('permite corrigir uma compra antiga sem desbloquear o cartão no fallback Web', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    localStorage.setItem('cashew-clone:categories', JSON.stringify([expenseCategory]))
    store.setCategories([expenseCategory])
    await store.setAvailableBalance('100.00')
    const createdCard = await store.createDebitCard({
      name: 'Principal', issuer: 'Banco Teste', holderName: 'Pedro Silva', lastFour: '4242',
      network: 'mastercard', colorFrom: '#0F172A', colorTo: '#334155', pattern: 'soft',
      backgroundImage: 'none', emoji: null, isDefault: true, monthlySpendingLimit: '200.00',
    })
    const purchase = await store.createTransaction({
      kind: 'expense', amount: '10.00', date: '2026-08-09', categoryId: expenseCategory.id,
      debitCardId: createdCard.id, description: 'Compra antiga', recurrence: 'variable',
    })
    await store.setCardFrozen(createdCard.id, true)

    const updated = await store.editTransaction({
      id: purchase.id, kind: 'expense', amount: '12.00', date: '2026-08-08',
      categoryId: expenseCategory.id, debitCardId: createdCard.id,
      description: 'Compra corrigida', recurrence: 'variable',
    })

    expect(updated.amount).toBe('12.00')
    expect(updated.date).toBe('2026-08-08')
    expect(updated.description).toBe('Compra corrigida')
  })

  it('busca no histórico por descrição, categoria e cartão', () => {
    const store = useFinanceStore()
    store.setCategories([category()])
    store.setDebitCards([card({ name: 'Laranja' })])
    store.setTransactions([
      transaction({ id: 'market', description: 'Feira da semana', debitCardId: 'card-1' }),
      transaction({ id: 'bus', description: 'Passagem', categoryId: null }),
    ])

    store.setFilters({ query: 'laranja' })
    expect(store.filteredTransactions.map((item) => item.id)).toEqual(['market'])
    store.setFilters({ query: 'alimentação' })
    expect(store.filteredTransactions.map((item) => item.id)).toEqual(['market'])
  })

  it('edita o saldo disponível sem apagar transações ou cofres', () => {
    const store = useFinanceStore()
    store.setTransactions([transaction({ id: 'salary', kind: 'income', amount: '1000.00', categoryId: null })])
    store.setVaults([vault({ balance: '300.00' })])

    store.setAvailableBalance('250.00')

    expect(store.availableBalanceCents).toBe(25000n)
    expect(store.vaultTotalCents).toBe(30000n)
    expect(store.balanceCents).toBe(55000n)
    expect(store.transactions).toHaveLength(1)
  })

  it('mantém conta fixa pendente até a confirmação do usuário', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    localStorage.setItem('cashew-clone:categories', JSON.stringify([expenseCategory]))
    store.setCategories([expenseCategory])
    store.setAvailableBalance('100.00')
    const rule = await store.createRecurringRule({
      kind: 'expense', amount: '50.00', dayOfMonth: 12, categoryId: expenseCategory.id,
      debitCardId: null, description: 'Assinatura', reminderEnabled: false,
    })

    expect(store.availableBalanceCents).toBe(10000n)
    expect(store.transactions).toHaveLength(0)

    await store.settleRecurringRule(rule.id)
    expect(store.availableBalanceCents).toBe(5000n)
    expect(store.transactions).toHaveLength(1)
    expect(store.recurringRules[0]?.nextDueDate).toBe('2026-09-12')
  })

  it('impede que uma recorrência confirmada deixe o fallback Web negativo', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    localStorage.setItem('cashew-clone:categories', JSON.stringify([expenseCategory]))
    store.setCategories([expenseCategory])
    await store.setAvailableBalance('40.00')
    const rule = await store.createRecurringRule({
      kind: 'expense', amount: '50.00', dayOfMonth: 12, categoryId: expenseCategory.id,
      debitCardId: null, description: 'Conta acima do saldo', reminderEnabled: false,
    })

    await expect(store.settleRecurringRule(rule.id)).rejects.toThrow(/saldo insuficiente/i)
    expect(store.transactions).toHaveLength(0)
    expect(store.recurringRules[0]?.nextDueDate).toBe('2026-08-12')
  })

  it('não mostra confirmação antes do dia da conta ou do salário', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    const incomeCategory = category({ id: 'salary', kind: 'income', name: 'Salário' })
    store.setCategories([expenseCategory, incomeCategory])

    await store.createRecurringRule({
      kind: 'expense', amount: '50.00', dayOfMonth: 20, categoryId: expenseCategory.id,
      debitCardId: null, description: 'Internet', reminderEnabled: false,
    })
    await store.createRecurringRule({
      kind: 'income', amount: '700.00', dayOfMonth: 20, categoryId: incomeCategory.id,
      debitCardId: null, description: 'Salário', reminderEnabled: false,
    })

    expect(store.dueRecurringRules).toHaveLength(0)
    expect(store.upcomingRecurringRules).toHaveLength(2)
  })

  it('recorrência criada depois do dia escolhido começa no próximo mês', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    store.setCategories([expenseCategory])

    const rule = await store.createRecurringRule({
      kind: 'expense', amount: '50.00', dayOfMonth: 5, categoryId: expenseCategory.id,
      debitCardId: null, description: 'Assinatura', reminderEnabled: false,
    })

    expect(rule.nextDueDate).toBe('2026-09-05')
    expect(store.dueRecurringRules).toHaveLength(0)
    await expect(store.settleRecurringRule(rule.id)).rejects.toThrow(/confirmação ficará disponível/i)
  })

  it('libera confirmação no dia selecionado tanto para conta quanto para salário', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    const incomeCategory = category({ id: 'salary', kind: 'income', name: 'Salário' })
    store.setCategories([expenseCategory, incomeCategory])

    await store.createRecurringRule({
      kind: 'expense', amount: '50.00', dayOfMonth: 12, categoryId: expenseCategory.id,
      debitCardId: null, description: 'Internet', reminderEnabled: false,
    })
    await store.createRecurringRule({
      kind: 'income', amount: '700.00', dayOfMonth: 12, categoryId: incomeCategory.id,
      debitCardId: null, description: 'Salário', reminderEnabled: false,
    })

    expect(store.dueRecurringRules.map((rule) => rule.description)).toEqual(['Internet', 'Salário'])
  })

  it('conta os três dias somente depois do vencimento', async () => {
    const store = useFinanceStore()
    const expenseCategory = category()
    localStorage.setItem('cashew-clone:categories', JSON.stringify([expenseCategory]))
    store.setCategories([expenseCategory])
    store.setAvailableBalance('100.00')
    await store.createRecurringRule({
      kind: 'expense', amount: '50.00', dayOfMonth: 13, categoryId: expenseCategory.id,
      debitCardId: null, description: 'Internet', reminderEnabled: false,
    })

    vi.setSystemTime(new Date(2026, 7, 15, 23, 59, 0))
    await store.processRecurringRules()
    expect(store.transactions).toHaveLength(0)

    vi.setSystemTime(new Date(2026, 7, 16, 0, 1, 0))
    await store.processRecurringRules()
    expect(store.transactions).toHaveLength(1)
    expect(store.availableBalanceCents).toBe(5000n)
  })

  it('cria porquinho transferindo o valor inicial da conta', async () => {
    const store = useFinanceStore()
    store.setAvailableBalance('200.00')

    const created = await store.createVault({
      name: 'Viagem', institution: 'Inter', type: 'piggy_bank', initialBalance: '80.00',
      targetAmount: null, annualYieldRate: null, color: '#F97316', emoji: '🐷',
    })

    expect(store.availableBalanceCents).toBe(12000n)
    expect(store.vaultTotalCents).toBe(8000n)
    expect(store.getMovementsForVault(created.id)[0]?.kind).toBe('deposit')
  })

  it('cria a reserva mensal sem duplicar o valor inicial do porquinho', async () => {
    const store = useFinanceStore()
    await store.setAvailableBalance('200.00')

    const created = await store.createVault({
      name: 'Viagem', institution: 'Inter', type: 'piggy_bank', initialBalance: '80.00',
      targetAmount: null, annualYieldRate: null, color: '#F97316', emoji: '🐷',
    }, undefined, {
      enabled: true, mode: 'fixed', value: '80.00', dayOfMonth: 5, lastProcessedPeriod: null,
    })

    expect(store.vaultTotalCents).toBe(8000n)
    expect(store.availableBalanceCents).toBe(12000n)
    expect(store.getMonthlyReserveRule(created.id)?.lastProcessedPeriod).toBe('2026-08')
    await store.processScheduledAutomation()
    expect(store.vaultTotalCents).toBe(8000n)
  })

  it('corrige o saldo do porquinho preservando o patrimônio total', async () => {
    const store = useFinanceStore()
    await store.setAvailableBalance('200.00')
    const created = await store.createVault({
      name: 'Reserva', institution: 'Inter', type: 'piggy_bank', initialBalance: '80.00',
      targetAmount: null, annualYieldRate: null, color: '#10B981', emoji: '🐷',
    })
    const patrimônio = store.balanceCents

    await store.correctVaultBalance(created.id, '100.00')

    expect(store.vaultTotalCents).toBe(10000n)
    expect(store.availableBalanceCents).toBe(10000n)
    expect(store.balanceCents).toBe(patrimônio)
  })

  it('importa um extrato e concilia o saldo final informado pelo banco', async () => {
    const store = useFinanceStore()
    const expenseCategory = category({ id: 'shopping', name: 'Compras' })
    localStorage.setItem('cashew-clone:categories', JSON.stringify([expenseCategory]))
    store.setCategories([expenseCategory])
    await store.setAvailableBalance('0.00')

    const imported = await store.importBankStatement({
      transactions: [
        { kind: 'expense', amount: '500.00', date: '2026-08-07', categoryId: 'shopping', debitCardId: null, description: 'Pix enviado · Nivea', recurrence: 'variable' },
        { kind: 'expense', amount: '5.00', date: '2026-08-07', categoryId: 'shopping', debitCardId: null, description: 'Pix enviado · Elciany', recurrence: 'variable' },
      ],
      closingBalance: '1.53',
    })

    expect(imported).toBe(2)
    expect(store.transactions).toHaveLength(2)
    expect(store.availableBalanceCents).toBe(153n)
  })

  it('reserva parte de uma entrada de forma automática', async () => {
    const store = useFinanceStore()
    const incomeCategory = category({ id: 'salary', kind: 'income', name: 'Salário' })
    localStorage.setItem('cashew-clone:categories', JSON.stringify([incomeCategory]))
    store.setCategories([incomeCategory])
    await store.setAvailableBalance('0.00')
    const createdVault = await store.createVault({
      name: 'Reserva', institution: 'Inter', type: 'piggy_bank', initialBalance: '0.00',
      targetAmount: null, annualYieldRate: null, color: '#10B981', emoji: '🐷',
    })
    await store.saveAutomaticReserve({
      vaultId: createdVault.id, enabled: true, mode: 'percentage', value: '20.00',
    })

    await store.createTransaction({
      kind: 'income', amount: '100.00', date: '2026-08-12', categoryId: incomeCategory.id,
      debitCardId: null, description: 'Salário', recurrence: 'variable',
    })

    expect(store.vaultTotalCents).toBe(2000n)
    expect(store.availableBalanceCents).toBe(8000n)
    expect(store.getMovementsForVault(createdVault.id)[0]?.source).toBe('automatic')
  })

  it('não reserva mais do que a entrada quando várias regras estão ativas', async () => {
    const store = useFinanceStore()
    const incomeCategory = category({ id: 'salary', kind: 'income', name: 'Salário' })
    localStorage.setItem('cashew-clone:categories', JSON.stringify([incomeCategory]))
    store.setCategories([incomeCategory])
    await store.setAvailableBalance('0.00')
    const firstVault = await store.createVault({
      name: 'Reserva', institution: 'Inter', type: 'piggy_bank', initialBalance: '0.00',
      targetAmount: null, annualYieldRate: null, color: '#10B981', emoji: '🐷',
    })
    const secondVault = await store.createVault({
      name: 'Viagem', institution: 'Nubank', type: 'box', initialBalance: '0.00',
      targetAmount: null, annualYieldRate: null, color: '#8B5CF6', emoji: '✈️',
    })
    await store.saveAutomaticReserve({
      vaultId: firstVault.id, enabled: true, mode: 'percentage', value: '80.00',
    })
    await store.saveAutomaticReserve({
      vaultId: secondVault.id, enabled: true, mode: 'percentage', value: '80.00',
    })

    await store.createTransaction({
      kind: 'income', amount: '100.00', date: '2026-08-12', categoryId: incomeCategory.id,
      debitCardId: null, description: 'Salário', recurrence: 'variable',
    })

    expect(store.vaultTotalCents).toBe(10000n)
    expect(store.availableBalanceCents).toBe(0n)
    expect(store.vaultMovements.reduce((total, item) => total + decimalToCents(item.amount), 0n)).toBe(10000n)
  })
})
