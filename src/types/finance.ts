export type TransactionType = 'income' | 'expense'
export type RecurrenceType = 'fixed' | 'variable'
export type CardNetwork = 'visa' | 'mastercard' | 'elo' | 'other'
export type CardPattern = 'soft' | 'waves' | 'dots' | 'grid' | 'aurora'
export type CardBackground = 'none' | 'amazonia' | 'praia' | 'cidade' | 'montanhas'
export type VaultType = 'piggy_bank' | 'box' | 'savings' | 'investment' | 'cash'
export type VaultMovementType = 'deposit' | 'withdraw'

export interface Category {
  id: string
  kind: TransactionType
  name: string
  icon: string
  color: string
  createdAt: string
}

export interface NewCategoryInput {
  kind: TransactionType
  name: string
  icon: string
  color: string
}

export interface DebitCard {
  id: string
  name: string
  issuer: string
  holderName: string
  lastFour: string
  network: CardNetwork
  colorFrom: string
  colorTo: string
  pattern: CardPattern
  backgroundImage: CardBackground
  emoji: string | null
  isDefault: boolean
  isFrozen: boolean
  monthlySpendingLimit: string | null
  createdAt: string
}

export interface NewDebitCardInput {
  name: string
  issuer: string
  holderName: string
  lastFour: string
  network: CardNetwork
  colorFrom: string
  colorTo: string
  pattern: CardPattern
  backgroundImage: CardBackground
  emoji: string | null
  isDefault: boolean
  monthlySpendingLimit: string | null
}

export interface UpdateDebitCardStyleInput {
  id: string
  colorFrom: string
  colorTo: string
  pattern: CardPattern
  backgroundImage: CardBackground
  emoji: string | null
}

export interface Vault {
  id: string
  name: string
  institution: string
  type: VaultType
  balance: string
  targetAmount: string | null
  annualYieldRate: string | null
  color: string
  emoji: string | null
  createdAt: string
  updatedAt: string
}

export interface NewVaultInput {
  name: string
  institution: string
  type: VaultType
  initialBalance: string
  targetAmount: string | null
  annualYieldRate: string | null
  color: string
  emoji: string | null
}

export interface MoveVaultMoneyInput {
  id: string
  kind: VaultMovementType
  amount: string
}

export interface Transaction {
  id: string
  kind: TransactionType
  amount: string
  date: string
  categoryId: string | null
  debitCardId: string | null
  description: string
  recurrence: RecurrenceType
  createdAt: string
}

export interface NewTransactionInput {
  kind: TransactionType
  amount: string
  date: string
  categoryId: string | null
  debitCardId: string | null
  description: string
  recurrence: RecurrenceType
}

export interface TransactionFilters {
  year?: number
  month?: number
  kind?: TransactionType
  categoryId?: string
  debitCardId?: string
}

export type QuickLaunchAction =
  | { type: 'expense'; cardId?: string }
  | { type: 'wallet'; cardId?: string }
  | { type: 'vaults' }
  | { type: 'dashboard' }
