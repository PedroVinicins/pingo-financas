import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type {
  BankStatementFormat,
  ParsedBankStatement,
  ParsedBankStatementTransaction,
  Transaction,
} from '../types/finance'

const MAX_STATEMENT_BYTES = 12 * 1024 * 1024
const MAX_IMPORT_ROWS = 2_000

function normalizedHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function decodeStatement(buffer: ArrayBuffer) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '') }
  catch { return new TextDecoder('windows-1252').decode(buffer).replace(/^\uFEFF/, '') }
}

function centsToStorage(value: bigint) {
  const negative = value < 0n
  const absolute = negative ? -value : value
  return `${negative ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

export function parseBankAmount(value: string): bigint | null {
  let normalized = value.replace(/\u00a0/g, ' ').replace(/R\$/gi, '').trim()
  if (!normalized) return null
  let negative = false
  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    negative = true
    normalized = normalized.slice(1, -1)
  }
  if (normalized.endsWith('-')) {
    negative = true
    normalized = normalized.slice(0, -1)
  }
  if (normalized.startsWith('-')) {
    negative = true
    normalized = normalized.slice(1)
  } else if (normalized.startsWith('+')) normalized = normalized.slice(1)
  normalized = normalized.replace(/\s/g, '')

  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')
  const decimalIndex = comma >= 0 ? comma : dot >= 0 && normalized.length - dot <= 3 ? dot : -1
  const wholeRaw = decimalIndex >= 0 ? normalized.slice(0, decimalIndex) : normalized
  const fractionRaw = decimalIndex >= 0 ? normalized.slice(decimalIndex + 1) : ''
  const whole = wholeRaw.replace(/[^0-9]/g, '')
  const fraction = fractionRaw.replace(/[^0-9]/g, '')
  if (!whole || fraction.length > 2 || !/^\d+$/.test(whole)) return null
  const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
  return negative ? -cents : cents
}

function parseDate(value: string): string | null {
  const clean = value.trim()
  let year: number
  let month: number
  let day: number
  let match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(clean)
  if (match) {
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3])
  } else {
    match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean)
    if (match) {
      year = Number(match[1]); month = Number(match[2]); day = Number(match[3])
    } else {
      match = /^(\d{4})(\d{2})(\d{2})/.exec(clean)
      if (!match) return null
      year = Number(match[1]); month = Number(match[2]); day = Number(match[3])
    }
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function cleanDescription(...parts: Array<string | undefined | null>) {
  const unique: string[] = []
  for (const part of parts) {
    const value = part?.replace(/\s+/g, ' ').trim()
    if (value && !unique.some((item) => normalizedHeader(item) === normalizedHeader(value))) unique.push(value)
  }
  return (unique.join(' · ') || 'Movimentação importada').slice(0, 160)
}

function transactionFromValues(
  dateValue: string,
  amountValue: string,
  description: string,
  balanceValue?: string | null,
  externalId?: string | null,
): ParsedBankStatementTransaction | null {
  const date = parseDate(dateValue)
  const signedAmount = parseBankAmount(amountValue)
  if (!date || signedAmount === null || signedAmount === 0n) return null
  const balance = balanceValue ? parseBankAmount(balanceValue) : null
  return {
    kind: signedAmount < 0n ? 'expense' : 'income',
    amount: centsToStorage(signedAmount < 0n ? -signedAmount : signedAmount),
    date,
    description: cleanDescription(description),
    balance: balance === null ? null : centsToStorage(balance),
    externalId: externalId?.trim() || null,
  }
}

function parseDelimited(content: string, delimiter: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    if (character === '"') {
      if (quoted && content[index + 1] === '"') { field += '"'; index += 1 }
      else quoted = !quoted
    } else if (character === delimiter && !quoted) {
      row.push(field); field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && content[index + 1] === '\n') index += 1
      row.push(field); field = ''
      if (row.some((item) => item.trim())) rows.push(row)
      row = []
    } else field += character
  }
  row.push(field)
  if (row.some((item) => item.trim())) rows.push(row)
  return rows
}

function headerIndex(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const exact = headers.findIndex((header) => header === alias)
    if (exact >= 0) return exact
  }
  for (const alias of aliases) {
    const partial = headers.findIndex((header) => header.includes(alias))
    if (partial >= 0) return partial
  }
  return -1
}

function closingBalanceFrom(transactions: ParsedBankStatementTransaction[]) {
  let newestDate = ''
  let balance: string | null = null
  for (const transaction of transactions) {
    if (transaction.balance !== null && transaction.date > newestDate) {
      newestDate = transaction.date
      balance = transaction.balance
    }
  }
  return balance
}

export function parseDelimitedStatement(content: string, fileName = 'extrato.csv'): ParsedBankStatement {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = ['\t', ';', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]
  const rows = parseDelimited(content, delimiter)
  if (rows.length < 2) throw new Error('O arquivo não possui cabeçalho e lançamentos reconhecíveis.')
  const headers = rows[0].map(normalizedHeader)
  const dateIndex = headerIndex(headers, ['data lancamento', 'data movimento', 'data', 'date'])
  const amountIndex = headerIndex(headers, ['valor lancamento', 'valor', 'amount'])
  const balanceIndex = headerIndex(headers, ['saldo', 'balance'])
  const historyIndex = headerIndex(headers, ['historico', 'lancamento', 'tipo'])
  const descriptionIndex = headerIndex(headers, ['descricao', 'detalhes', 'memo', 'nome'])
  if (dateIndex < 0 || amountIndex < 0) {
    throw new Error('Não encontrei as colunas de data e valor. Use um CSV/TSV com cabeçalho.')
  }
  const transactions = rows.slice(1).map((row) => transactionFromValues(
    row[dateIndex] ?? '', row[amountIndex] ?? '',
    cleanDescription(row[historyIndex], row[descriptionIndex]),
    balanceIndex >= 0 ? row[balanceIndex] : null,
  )).filter((item): item is ParsedBankStatementTransaction => item !== null).slice(0, MAX_IMPORT_ROWS)
  if (!transactions.length) throw new Error('Nenhum lançamento válido foi encontrado no arquivo.')
  return {
    format: 'csv', fileName, transactions,
    closingBalance: closingBalanceFrom(transactions),
    warnings: rows.length - 1 > MAX_IMPORT_ROWS ? [`Somente os primeiros ${MAX_IMPORT_ROWS} lançamentos foram carregados.`] : [],
  }
}

function ofxValue(block: string, tag: string) {
  return new RegExp(`<${tag}>\\s*([^<\\r\\n]+)`, 'i').exec(block)?.[1]?.trim() ?? ''
}

export function parseOfxStatement(content: string, fileName = 'extrato.ofx'): ParsedBankStatement {
  const transactions: ParsedBankStatementTransaction[] = []
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []
  for (const block of blocks.slice(0, MAX_IMPORT_ROWS)) {
    const transaction = transactionFromValues(
      ofxValue(block, 'DTPOSTED'), ofxValue(block, 'TRNAMT'),
      cleanDescription(ofxValue(block, 'NAME'), ofxValue(block, 'MEMO')),
      null, ofxValue(block, 'FITID'),
    )
    if (transaction) transactions.push(transaction)
  }
  if (!transactions.length) throw new Error('Nenhum lançamento válido foi encontrado no OFX.')
  const ledgerBalance = parseBankAmount(ofxValue(content, 'BALAMT'))
  return {
    format: 'ofx', fileName, transactions,
    closingBalance: ledgerBalance === null ? null : centsToStorage(ledgerBalance),
    warnings: blocks.length > MAX_IMPORT_ROWS ? [`Somente os primeiros ${MAX_IMPORT_ROWS} lançamentos foram carregados.`] : [],
  }
}

const TEXT_MONEY_PATTERN = /[-+]?(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2}|\.\d{2})/g

export function parseStatementTextLines(lines: string[], fileName = 'extrato.pdf'): ParsedBankStatement {
  const transactions: ParsedBankStatementTransaction[] = []
  for (const line of lines) {
    const dateMatch = /\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\b/.exec(line)
    if (!dateMatch) continue
    const rest = line.slice(dateMatch.index + dateMatch[0].length)
    const moneyMatches = [...rest.matchAll(TEXT_MONEY_PATTERN)]
    if (!moneyMatches.length) continue
    const amountMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : moneyMatches[0]
    const balanceMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 1] : null
    const description = rest.slice(0, amountMatch.index).replace(/[|\t]+/g, ' ')
    const transaction = transactionFromValues(
      dateMatch[0], amountMatch[0], description, balanceMatch?.[0] ?? null,
    )
    if (transaction) transactions.push(transaction)
    if (transactions.length >= MAX_IMPORT_ROWS) break
  }
  if (!transactions.length) {
    throw new Error('Não encontrei lançamentos no PDF. Use um extrato com texto selecionável; PDFs escaneados precisam de OCR.')
  }
  return {
    format: 'pdf', fileName, transactions,
    closingBalance: closingBalanceFrom(transactions),
    warnings: [],
  }
}

async function extractPdfLines(buffer: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const document = await loadingTask.promise
  const lines: string[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const positioned = content.items.filter((item): item is typeof item & { str: string; transform: number[] } =>
      'str' in item && 'transform' in item && Boolean(item.str.trim()))
      .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
      .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x)
    let current: { y: number; parts: string[] } | null = null
    for (const item of positioned) {
      if (!current || Math.abs(current.y - item.y) > 2) {
        if (current) lines.push(current.parts.join(' '))
        current = { y: item.y, parts: [item.text] }
      } else current.parts.push(item.text)
    }
    if (current) lines.push(current.parts.join(' '))
  }
  await loadingTask.destroy()
  return lines
}

export async function parseBankStatementFile(file: File): Promise<ParsedBankStatement> {
  if (file.size > MAX_STATEMENT_BYTES) throw new Error('O extrato deve ter no máximo 12 MB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  const buffer = await file.arrayBuffer()
  if (extension === 'pdf' || file.type === 'application/pdf') {
    return parseStatementTextLines(await extractPdfLines(buffer), file.name)
  }
  const content = decodeStatement(buffer)
  if (extension === 'ofx' || /<OFX[>\s]/i.test(content)) return parseOfxStatement(content, file.name)
  return parseDelimitedStatement(content, file.name)
}

export function statementTransactionSignature(
  transaction: Pick<Transaction | ParsedBankStatementTransaction, 'date' | 'kind' | 'amount' | 'description'>,
) {
  return [transaction.date, transaction.kind, transaction.amount.replace(',', '.'), normalizedHeader(transaction.description)].join('|')
}

export function duplicateStatementRows(
  rows: ParsedBankStatementTransaction[],
  existing: Transaction[],
) {
  const existingCounts = new Map<string, number>()
  existing.forEach((transaction) => {
    const signature = statementTransactionSignature(transaction)
    existingCounts.set(signature, (existingCounts.get(signature) ?? 0) + 1)
  })
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const signature = statementTransactionSignature(row)
    const occurrence = (seen.get(signature) ?? 0) + 1
    seen.set(signature, occurrence)
    return occurrence <= (existingCounts.get(signature) ?? 0)
  })
}

export function statementFormatLabel(format: BankStatementFormat) {
  return ({ csv: 'CSV/planilha', ofx: 'OFX', pdf: 'PDF textual' })[format]
}
