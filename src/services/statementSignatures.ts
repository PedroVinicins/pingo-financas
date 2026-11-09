import type { NewTransactionInput, ParsedBankStatementTransaction, Transaction } from '../types/finance'

type StatementRow = Pick<
  Transaction | ParsedBankStatementTransaction | NewTransactionInput,
  'date' | 'occurredAt' | 'kind' | 'amount' | 'description' | 'sourceBank' | 'externalId'
>

function normalizedDescription(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function statementTransactionSignature(transaction: StatementRow) {
  if (transaction.externalId) {
    return `${transaction.sourceBank ?? 'inter'}|id|${transaction.externalId.trim().toLowerCase()}`
  }
  return [
    transaction.occurredAt ?? transaction.date,
    transaction.kind,
    transaction.amount.replace(',', '.'),
    normalizedDescription(transaction.description),
  ].join('|')
}
