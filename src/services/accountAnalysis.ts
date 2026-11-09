import type { Category, Transaction, TransactionType } from '../types/finance'

export type AnalysisSeverity = 'critical' | 'warning' | 'info' | 'positive'
export type SpendingTimeBucketId = 'dawn' | 'morning' | 'afternoon' | 'night' | 'unknown'

export interface AnalysisAlert {
  id: string
  severity: AnalysisSeverity
  title: string
  message: string
}

export interface CategoryFlowAnalysis {
  id: string
  categoryId: string | null
  kind: TransactionType
  name: string
  color: string
  amountCents: bigint
  transactionCount: number
  percentage: number
}

export interface SpendingTimeAnalysis {
  id: SpendingTimeBucketId
  label: string
  amountCents: bigint
  transactionCount: number
  percentage: number
}

export interface AccountAnalysis {
  periodKey: string
  transactionCount: number
  incomeCount: number
  expenseCount: number
  refundCount: number
  transferCount: number
  incomeCents: bigint
  expenseCents: bigint
  refundCents: bigint
  netExpenseCents: bigint
  netCents: bigint
  savingsRate: number | null
  averageExpenseCents: bigint
  medianExpenseCents: bigint
  largestExpense: Transaction | null
  fixedExpenseCents: bigint
  categoryFlows: CategoryFlowAnalysis[]
  spendingByTime: SpendingTimeAnalysis[]
  alerts: AnalysisAlert[]
  headline: string
  notificationKey: string
}

export interface AccountAnalysisInput {
  transactions: Transaction[]
  categories: Category[]
  year: number
  month: number
  formatMoney: (value: bigint) => string
}

const TIME_BUCKETS: Array<{ id: SpendingTimeBucketId; label: string; from: number; to: number }> = [
  { id: 'dawn', label: 'Madrugada · 00h–05h', from: 0, to: 5 },
  { id: 'morning', label: 'Manhã · 06h–11h', from: 6, to: 11 },
  { id: 'afternoon', label: 'Tarde · 12h–17h', from: 12, to: 17 },
  { id: 'night', label: 'Noite · 18h–23h', from: 18, to: 23 },
  { id: 'unknown', label: 'Horário não informado', from: -1, to: -1 },
]

function amountToCents(value: string) {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

function percentage(amount: bigint, total: bigint) {
  return total > 0n ? Number((amount * 10_000n) / total) / 100 : 0
}

function transactionHour(transaction: Transaction) {
  const match = transaction.occurredAt?.match(/T(\d{2}):/)
  if (!match) return null
  const hour = Number(match[1])
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null
}

function severityRank(severity: AnalysisSeverity) {
  return ({ critical: 0, warning: 1, info: 2, positive: 3 })[severity]
}

export function analyzeAccount(input: AccountAnalysisInput): AccountAnalysis {
  const periodKey = `${input.year}-${String(input.month).padStart(2, '0')}`
  const transactions = input.transactions.filter((transaction) => transaction.date.startsWith(periodKey))
  const classificationOf = (transaction: Transaction) => transaction.classification ?? transaction.kind
  const incomes = transactions.filter((transaction) => classificationOf(transaction) === 'income')
  const expenses = transactions.filter((transaction) => classificationOf(transaction) === 'expense')
  const refunds = transactions.filter((transaction) => classificationOf(transaction) === 'refund')
  const transfers = transactions.filter((transaction) => classificationOf(transaction) === 'transfer')
  const incomeCents = incomes.reduce((total, item) => total + amountToCents(item.amount), 0n)
  const expenseCents = expenses.reduce((total, item) => total + amountToCents(item.amount), 0n)
  const refundCents = refunds.reduce((total, item) => total + amountToCents(item.amount), 0n)
  const netExpenseCents = expenseCents - refundCents
  const netCents = incomeCents - netExpenseCents
  const expenseAmounts = expenses.map((item) => amountToCents(item.amount)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
  const middle = Math.floor(expenseAmounts.length / 2)
  const medianExpenseCents = expenseAmounts.length === 0
    ? 0n
    : expenseAmounts.length % 2 === 1
      ? expenseAmounts[middle]
      : (expenseAmounts[middle - 1] + expenseAmounts[middle]) / 2n
  const largestExpense = [...expenses].sort((a, b) => {
    const first = amountToCents(a.amount)
    const second = amountToCents(b.amount)
    return first > second ? -1 : first < second ? 1 : 0
  })[0] ?? null
  const fixedExpenseCents = expenses.reduce((total, item) =>
    item.recurrence === 'fixed' ? total + amountToCents(item.amount) : total, 0n)

  const categoryTotals = new Map<string, { categoryId: string | null; kind: TransactionType; amount: bigint; count: number }>()
  for (const transaction of [...incomes, ...expenses]) {
    const key = transaction.categoryId ?? `uncategorized:${transaction.kind}`
    const current = categoryTotals.get(key) ?? {
      categoryId: transaction.categoryId,
      kind: transaction.kind,
      amount: 0n,
      count: 0,
    }
    current.amount += amountToCents(transaction.amount)
    current.count += 1
    categoryTotals.set(key, current)
  }
  for (const refund of refunds) {
    if (!refund.relatedTransactionId) continue
    const original = input.transactions.find((item) =>
      item.id === refund.relatedTransactionId && classificationOf(item) === 'expense')
    if (!original) continue
    const key = original.categoryId ?? `uncategorized:${original.kind}`
    const current = categoryTotals.get(key) ?? {
      categoryId: original.categoryId,
      kind: 'expense' as const,
      amount: 0n,
      count: 0,
    }
    current.amount -= amountToCents(refund.amount)
    current.count += 1
    categoryTotals.set(key, current)
  }
  const categorizedIncome = [...categoryTotals.values()]
    .filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0n)
  const categorizedExpense = [...categoryTotals.values()]
    .filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0n)
  const categoryFlows = [...categoryTotals.entries()].map(([id, total]) => {
    const category = input.categories.find((item) => item.id === total.categoryId)
    const kindTotal = total.kind === 'income' ? categorizedIncome : categorizedExpense
    return {
      id,
      categoryId: total.categoryId,
      kind: total.kind,
      name: category?.name ?? (total.kind === 'income' ? 'Entrada sem categoria' : 'Saída sem categoria'),
      color: category?.color ?? (total.kind === 'income' ? '#10B981' : '#F43F5E'),
      amountCents: total.amount,
      transactionCount: total.count,
      percentage: total.amount > 0n ? percentage(total.amount, kindTotal) : 0,
    }
  }).sort((a, b) => a.kind === b.kind
    ? (a.amountCents > b.amountCents ? -1 : a.amountCents < b.amountCents ? 1 : 0)
    : a.kind === 'income' ? -1 : 1)

  const timeTotals = new Map<SpendingTimeBucketId, { amount: bigint; count: number }>(
    TIME_BUCKETS.map((bucket) => [bucket.id, { amount: 0n, count: 0 }]),
  )
  for (const transaction of expenses) {
    const hour = transactionHour(transaction)
    const bucket = hour === null
      ? TIME_BUCKETS[TIME_BUCKETS.length - 1]
      : TIME_BUCKETS.find((item) => item.id !== 'unknown' && hour >= item.from && hour <= item.to)!
    const total = timeTotals.get(bucket.id)!
    total.amount += amountToCents(transaction.amount)
    total.count += 1
  }
  const spendingByTime = TIME_BUCKETS.map((bucket) => {
    const total = timeTotals.get(bucket.id)!
    return {
      id: bucket.id,
      label: bucket.label,
      amountCents: total.amount,
      transactionCount: total.count,
      percentage: percentage(total.amount, expenseCents),
    }
  })

  const alerts: AnalysisAlert[] = []
  if (transactions.length === 0) {
    alerts.push({
      id: 'empty-period', severity: 'info', title: 'Período sem dados',
      message: 'Registre entradas e saídas para comparar categorias, valores e horários.',
    })
  } else if (expenses.length === 0 && refunds.length > 0) {
    alerts.push({
      id: 'refunds-without-expenses', severity: 'info', title: 'Reembolsos sem compras no período',
      message: `Entraram ${input.formatMoney(refundCents)} em reembolsos. Eles aumentam o saldo, mas não são tratados como renda.`,
    })
  } else if (expenses.length === 0 && transfers.length > 0) {
    alerts.push({
      id: 'only-transfers', severity: 'info', title: 'Movimentações classificadas como transferências',
      message: `${transfers.length} transferência(s) não entram nos totais de renda ou gastos.`,
    })
  } else if (expenses.length === 0) {
    alerts.push({
      id: 'no-expenses', severity: 'positive', title: 'Nenhuma saída registrada',
      message: `Há ${input.formatMoney(incomeCents)} em entradas e nenhuma despesa neste período.`,
    })
  } else {
    if (incomeCents === 0n) {
      alerts.push({
        id: 'expenses-without-income', severity: 'warning', title: 'Saídas sem entradas registradas',
        message: `Existem ${input.formatMoney(expenseCents)} em despesas, mas nenhuma receita no período. Confira se as entradas estão atualizadas.`,
      })
    } else if (netExpenseCents > incomeCents) {
      alerts.push({
        id: 'period-deficit', severity: 'critical', title: 'As saídas passaram das entradas',
        message: `O período está negativo em ${input.formatMoney(-netCents)}. Revise primeiro as maiores despesas e compromissos fixos.`,
      })
    } else {
      const savingsRate = percentage(netCents, incomeCents)
      if (savingsRate < 10) alerts.push({
        id: 'low-savings', severity: 'warning', title: 'Pouca margem entre entrada e saída',
        message: `Sobrou ${input.formatMoney(netCents)}, equivalente a ${savingsRate.toFixed(0)}% das entradas.`,
      })
    }

    if (incomeCents > 0n && fixedExpenseCents * 100n >= incomeCents * 50n) {
      alerts.push({
        id: 'high-fixed-costs', severity: 'warning', title: 'Custos fixos pressionando a renda',
        message: `${input.formatMoney(fixedExpenseCents)} das saídas são fixas e já comprometem pelo menos metade das entradas.`,
      })
    }

    const topExpenseCategory = categoryFlows.find((item) => item.kind === 'expense')
    if (topExpenseCategory && expenses.length >= 2 && topExpenseCategory.percentage >= 45) {
      alerts.push({
        id: `category-concentration:${topExpenseCategory.categoryId ?? 'none'}`,
        severity: 'warning', title: `Gasto concentrado em ${topExpenseCategory.name}`,
        message: `${topExpenseCategory.percentage.toFixed(0)}% das saídas (${input.formatMoney(topExpenseCategory.amountCents)}) estão nessa categoria.`,
      })
    }

    const offHours = spendingByTime.filter((item) => item.id === 'dawn' || item.id === 'night')
    const offHoursAmount = offHours.reduce((total, item) => total + item.amountCents, 0n)
    const offHoursCount = offHours.reduce((total, item) => total + item.transactionCount, 0)
    if (offHoursCount >= 3 && percentage(offHoursAmount, expenseCents) >= 35) {
      alerts.push({
        id: 'off-hours-spending', severity: 'warning', title: 'Muitas saídas à noite ou de madrugada',
        message: `${input.formatMoney(offHoursAmount)} (${percentage(offHoursAmount, expenseCents).toFixed(0)}%) saíram entre 18h e 05h. Veja se esse padrão era esperado.`,
      })
    }

    if (largestExpense && incomeCents > 0n) {
      const largestAmount = amountToCents(largestExpense.amount)
      if (largestAmount * 100n >= incomeCents * 25n) alerts.push({
        id: `large-expense:${largestExpense.categoryId ?? 'none'}`, severity: 'warning', title: 'Uma saída teve grande impacto',
        message: `“${largestExpense.description}” foi de ${input.formatMoney(largestAmount)}, pelo menos 25% das entradas do período.`,
      })
    }

    const unknownTime = spendingByTime.find((item) => item.id === 'unknown')!
    if (unknownTime.transactionCount > 0 && unknownTime.transactionCount * 2 >= expenses.length) alerts.push({
      id: 'missing-times', severity: 'info', title: 'Análise de horário incompleta',
      message: `${unknownTime.transactionCount} de ${expenses.length} saídas não têm hora informada. Preencher o horário melhora a leitura dos hábitos.`,
    })

    if (!alerts.some((alert) => alert.severity === 'critical' || alert.severity === 'warning')) alerts.push({
      id: 'balanced-period', severity: 'positive', title: 'Fluxo do período está equilibrado',
      message: `Entraram ${input.formatMoney(incomeCents)} e os gastos líquidos foram ${input.formatMoney(netExpenseCents)}. Nenhum sinal importante foi detectado.`,
    })
  }

  alerts.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
  const topAlert = alerts[0]
  const savingsRate = incomeCents > 0n ? Number((netCents * 10_000n) / incomeCents) / 100 : null
  const headline = topAlert?.message
    ?? `Entraram ${input.formatMoney(incomeCents)} e os gastos líquidos foram ${input.formatMoney(netExpenseCents)} neste período.`

  return {
    periodKey,
    transactionCount: transactions.length,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    refundCount: refunds.length,
    transferCount: transfers.length,
    incomeCents,
    expenseCents,
    refundCents,
    netExpenseCents,
    netCents,
    savingsRate,
    averageExpenseCents: expenses.length ? expenseCents / BigInt(expenses.length) : 0n,
    medianExpenseCents,
    largestExpense,
    fixedExpenseCents,
    categoryFlows,
    spendingByTime,
    alerts,
    headline,
    notificationKey: `${periodKey}:${topAlert?.id ?? 'summary'}`,
  }
}
