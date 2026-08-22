export interface FinancialInsightInput {
  availableBalanceCents: bigint
  monthlyIncomeCents: bigint
  fixedCommitmentCents: bigint
  hasTransactions: boolean
  formatMoney: (value: bigint) => string
}

export function financialBalanceInsight(input: FinancialInsightInput) {
  const { availableBalanceCents: balance, monthlyIncomeCents, fixedCommitmentCents, hasTransactions, formatMoney } = input
  if (!hasTransactions) {
    return 'Ainda não há lançamentos para analisar. Registre uma entrada ou saída para o Pingo acompanhar seu saldo. 👀'
  }
  if (balance < 0n) {
    return `Saldo negativo em ${formatMoney(-balance)}. Pause gastos não essenciais e revise os próximos compromissos. 🫠`
  }
  if (balance === 0n) {
    return 'Seu saldo disponível chegou a zero. Revise os próximos gastos antes de assumir um novo compromisso. ⚠️'
  }

  const incomeThreshold = monthlyIncomeCents > 0n ? monthlyIncomeCents / 10n : 0n
  const lowThreshold = fixedCommitmentCents > incomeThreshold ? fixedCommitmentCents : incomeThreshold
  if (lowThreshold > 0n && balance <= lowThreshold) {
    return `Atenção: restam ${formatMoney(balance)} disponíveis, um valor baixo diante dos seus compromissos. ⚠️`
  }
  return `Seu saldo disponível está positivo em ${formatMoney(balance)}. Continue acompanhando os gastos para manter essa folga. 🐷`
}
