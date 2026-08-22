import type { CurrencyCode } from '../types/finance'

export const SUPPORTED_CURRENCIES: ReadonlyArray<{
  code: CurrencyCode
  label: string
  symbol: string
}> = [
  { code: 'BRL', label: 'Real brasileiro', symbol: 'R$' },
  { code: 'USD', label: 'Dólar americano', symbol: 'US$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
]

export function currencySymbol(currency: CurrencyCode) {
  return SUPPORTED_CURRENCIES.find((item) => item.code === currency)?.symbol ?? currency
}

export function formatCurrencyValue(value: string | number, currency: CurrencyCode) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export function formatCurrencyCents(value: bigint, currency: CurrencyCode) {
  return formatCurrencyValue(Number(value) / 100, currency)
}

export function privateCurrencyCents(value: bigint, currency: CurrencyCode, hidden: boolean) {
  return hidden ? `${currencySymbol(currency)} •••••` : formatCurrencyCents(value, currency)
}
