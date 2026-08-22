export function formatLocalizedDecimalInput(value: string, decimalPlaces = 2): string {
  const cleaned = value.replace(/\s/g, '').replace(/[^\d,]/g, '')
  const commaIndex = cleaned.indexOf(',')
  const hasDecimalSeparator = commaIndex >= 0
  const integerDigits = (hasDecimalSeparator ? cleaned.slice(0, commaIndex) : cleaned)
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
  const decimalDigits = hasDecimalSeparator
    ? cleaned.slice(commaIndex + 1).replace(/\D/g, '').slice(0, decimalPlaces)
    : ''

  if (!integerDigits && !hasDecimalSeparator) return ''

  const integer = integerDigits || '0'
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return hasDecimalSeparator ? `${grouped},${decimalDigits}` : grouped
}

/**
 * Formata dinheiro como uma calculadora: cada dígito novo entra nos centavos e
 * empurra os anteriores para a esquerda (1 → 0,01 → 0,12 → 1,23).
 */
export function formatLocalizedCurrencyInput(value: string, decimalPlaces = 2): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (decimalPlaces <= 0) return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const padded = digits.padStart(decimalPlaces + 1, '0')
  const integerDigits = padded.slice(0, -decimalPlaces).replace(/^0+(?=\d)/, '') || '0'
  const fraction = padded.slice(-decimalPlaces)
  const grouped = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimalPlaces > 0 ? `${grouped},${fraction}` : grouped
}

export function completeLocalizedDecimalInput(value: string, decimalPlaces = 2): string {
  const formatted = formatLocalizedDecimalInput(value, decimalPlaces)
  if (!formatted) return ''

  const [integer, fraction = ''] = formatted.split(',')
  return `${integer},${fraction.padEnd(decimalPlaces, '0')}`
}

export function localizedDecimalToStorage(value: string, decimalPlaces = 2): string {
  const formatted = completeLocalizedDecimalInput(value, decimalPlaces)
  if (!formatted) throw new Error('Valor inválido')

  const [groupedInteger, fraction = ''] = formatted.split(',')
  const integer = groupedInteger.replace(/\./g, '')
  if (!/^\d+$/.test(integer) || !/^\d+$/.test(fraction)) throw new Error('Valor inválido')

  return `${BigInt(integer)}.${fraction.padEnd(decimalPlaces, '0').slice(0, decimalPlaces)}`
}

export function storageDecimalToLocalized(value: string, decimalPlaces = 2): string {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return ''
  const [integer, fraction = ''] = normalized.split('.')
  return formatLocalizedDecimalInput(`${integer},${fraction.padEnd(decimalPlaces, '0').slice(0, decimalPlaces)}`, decimalPlaces)
}
