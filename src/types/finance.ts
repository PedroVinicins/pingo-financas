export type TransactionType = 'income' | 'expense'
export type RecurrenceType = 'fixed' | 'variable'
export type CardNetwork = 'visa' | 'mastercard' | 'elo' | 'other'
export type CardPattern = 'soft' | 'waves' | 'dots' | 'grid' | 'aurora'
export type CardBackground = 'none' | 'amazonia' | 'praia' | 'cidade' | 'montanhas'
export type VaultType = 'piggy_bank' | 'box' | 'savings' | 'investment' | 'cash'
export type VaultMovementType = 'deposit' | 'withdraw'
export type VaultMovementSource = 'manual' | 'automatic'
export type AutomaticReserveMode = 'fixed' | 'percentage'
export type FeedbackTone = 'success' | 'error' | 'info'
export type DashboardWidgetId =
  | 'net_worth'
  | 'available_balance'
  | 'vault_total'
  | 'month_expenses'
  | 'daily_budget'
  | 'month_balance'
  | 'recurring'
  | 'insights'
  | 'history'
export type DashboardWidgetSize = 'small' | 'medium' | 'large'
export type DigitalWalletItemKind = 'ticket' | 'document' | 'qr_code' | 'other'
export type BankPaymentMethod = 'pix' | 'debit' | 'credit' | 'card' | 'unknown'
export type BankMovementType =
  | 'pix_sent'
  | 'pix_received'
  | 'salary'
  | 'debit_purchase'
  | 'credit_purchase'
  | 'card_purchase'
  | 'vault_withdrawal'
  | 'vault_deposit'
  | 'refund'
  | 'transfer_sent'
  | 'transfer_received'
  | 'fee'
  | 'other'
export type ShakeSensitivity = 'low' | 'medium' | 'high'
export type FeedbackDurationMs = 3000 | 4000 | 5000
export type ThemeMode = 'light' | 'dark' | 'system'
export type CurrencyCode = 'BRL' | 'USD' | 'EUR'

export interface PingoPreferences {
  displayName: string
  themeMode: ThemeMode
  monthlyBudget: string | null
  currency: CurrencyCode
  billsDueNotifications: boolean
  weeklySummaryNotifications: boolean
  expenseReminderNotifications: boolean
  shakeToExpenseEnabled: boolean
  shakeSensitivity: ShakeSensitivity
  dailySpendingAlertsEnabled: boolean
  spendingAlertPercent: number
  greetingEnabled: boolean
  economyMode: boolean
  feedbackDurationMs: FeedbackDurationMs
}

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

export interface VaultMovement {
  id: string
  vaultId: string
  kind: VaultMovementType
  amount: string
  source: VaultMovementSource
  occurredAt: string
}

export interface UpdateVaultInput {
  id: string
  name: string
  institution: string
  targetAmount: string | null
  annualYieldRate: string | null
  color: string
  emoji: string | null
}

export interface AutomaticReserveRule {
  vaultId: string
  enabled: boolean
  mode: AutomaticReserveMode
  value: string
}

export interface MonthlyReserveRule extends AutomaticReserveRule {
  dayOfMonth: number
  lastProcessedPeriod: string | null
}

export interface DashboardWidgetPreference {
  id: DashboardWidgetId
  visible: boolean
  size: DashboardWidgetSize
}

export interface DashboardLayout {
  widgets: DashboardWidgetPreference[]
}

export interface DigitalWalletItem {
  id: string
  kind: DigitalWalletItemKind
  title: string
  issuer: string
  notes: string
  qrValue: string | null
  fileName: string | null
  mimeType: string | null
  fileDataUrl: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NewDigitalWalletItemInput {
  kind: DigitalWalletItemKind
  title: string
  issuer: string
  notes: string
  qrValue: string | null
  fileName: string | null
  mimeType: string | null
  fileDataUrl: string | null
  expiresAt: string | null
}

export interface Transaction {
  id: string
  kind: TransactionType
  amount: string
  date: string
  occurredAt: string | null
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
  occurredAt?: string | null
  categoryId: string | null
  debitCardId: string | null
  description: string
  recurrence: RecurrenceType
}

export interface UpdateTransactionInput extends NewTransactionInput {
  id: string
}

export type BankStatementFormat = 'csv' | 'ofx' | 'pdf'
export type SupportedStatementBank = 'inter' | 'nubank'

export interface ParsedBankStatementTransaction {
  kind: TransactionType
  amount: string
  date: string
  occurredAt: string | null
  description: string
  balance: string | null
  externalId: string | null
  paymentMethod: BankPaymentMethod
  movementType: BankMovementType
  isInternalTransfer: boolean
  suggestedCardLink: boolean
}

export interface ParsedBankStatement {
  format: BankStatementFormat
  fileName: string
  transactions: ParsedBankStatementTransaction[]
  closingBalance: string | null
  warnings: string[]
}

export interface BankStatementImportInput {
  transactions: NewTransactionInput[]
  closingBalance: string | null
}

export interface AccountSettings {
  openingBalanceAdjustment: string
  balanceHidden: boolean
  migratedAt: string
}

export interface RecurringRule {
  id: string
  kind: TransactionType
  amount: string
  dayOfMonth: number
  categoryId: string
  debitCardId: string | null
  description: string
  reminderEnabled: boolean
  autoProcessAfterDays: number
  active: boolean
  lastProcessedPeriod: string | null
  nextDueDate: string
  createdAt: string
  updatedAt: string
}

export interface NewRecurringRuleInput {
  kind: TransactionType
  amount: string
  dayOfMonth: number
  categoryId: string
  debitCardId: string | null
  description: string
  reminderEnabled: boolean
}

export interface RecurringSettlement {
  transaction: Transaction
  rule: RecurringRule
}

export interface AppFeedback {
  id: number
  tone: FeedbackTone
  message: string
}

export interface TransactionFilters {
  query?: string
  year?: number
  month?: number
  kind?: TransactionType
  categoryId?: string
  debitCardId?: string
}

export type QuickLaunchAction =
  | { type: 'expense'; cardId?: string }
  | { type: 'income' }
  | { type: 'wallet'; cardId?: string }
  | { type: 'vaults' }
  | { type: 'dashboard' }
