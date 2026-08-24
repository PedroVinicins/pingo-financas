import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type {
  BankMovementType,
  BankPaymentMethod,
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

function parseBankMoment(value: string, separateTime = ''): { date: string; occurredAt: string | null } | null {
  const clean = value.trim()
  let year: number
  let month: number
  let day: number
  let match = /^(\d{2})[/-](\d{2})[/-](\d{4})(?:[ T]+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(clean)
  let hour = match?.[4] ? Number(match[4]) : 0
  let minute = match?.[5] ? Number(match[5]) : 0
  let second = match?.[6] ? Number(match[6]) : 0
  let hasTime = Boolean(match?.[4])
  if (match) {
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3])
  } else {
    match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(clean)
    if (match) {
      year = Number(match[1]); month = Number(match[2]); day = Number(match[3])
      hour = match[4] ? Number(match[4]) : 0
      minute = match[5] ? Number(match[5]) : 0
      second = match[6] ? Number(match[6]) : 0
      hasTime = Boolean(match[4])
    } else {
      match = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?/.exec(clean)
      if (!match) return null
      year = Number(match[1]); month = Number(match[2]); day = Number(match[3])
      hour = match[4] ? Number(match[4]) : 0
      minute = match[5] ? Number(match[5]) : 0
      second = match[6] ? Number(match[6]) : 0
      hasTime = Boolean(match[4])
    }
  }
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(separateTime.trim())
  if (timeMatch) {
    hour = Number(timeMatch[1]); minute = Number(timeMatch[2]); second = Number(timeMatch[3] ?? 0)
    hasTime = true
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
    || hour > 23 || minute > 59 || second > 59) return null
  const dateKey = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  return {
    date: dateKey,
    occurredAt: hasTime
      ? `${dateKey}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
      : null,
  }
}

export function detectBankPaymentMethod(value: string): BankPaymentMethod {
  const normalized = normalizedHeader(value)
  if (/\bpix\b/.test(normalized)) return 'pix'
  if (/\b(?:compra|cartao|card)\b.*\b(?:debito|debit)\b|\b(?:debito|debit)\b.*\b(?:compra|cartao|card)\b/.test(normalized)) return 'debit'
  if (/\b(?:compra|cartao|card)\b.*\b(?:credito|credit)\b|\b(?:credito|credit)\b.*\b(?:compra|cartao|card)\b/.test(normalized)) return 'credit'
  if (/\bcartao\b/.test(normalized)) return 'card'
  return 'unknown'
}

export function detectBankMovementType(value: string, signedAmount = 0n): BankMovementType {
  const normalized = normalizedHeader(value)
  const outgoing = signedAmount < 0n

  if (/\b(?:salario|ordenado|pagamento de salario|portabilidade de salario)\b/.test(normalized)) return 'salary'
  if (/\b(?:resgate|retirada)\b.*\b(?:cdb|porq|porquinho|poupanca|investimento)\b|\b(?:cdb|porq|porquinho)\b.*\b(?:resgate|retirada)\b/.test(normalized)) return 'vault_withdrawal'
  if (/\b(?:aplicacao|investimento|guardar)\b.*\b(?:cdb|porq|porquinho|poupanca|objetivo)\b|\b(?:cdb|porq|porquinho)\b.*\b(?:aplicacao|guardar)\b/.test(normalized)) return 'vault_deposit'
  if (/\b(?:estorno|chargeback|devolucao|reembolso)\b/.test(normalized)) return 'refund'
  if (/\b(?:compra|pagamento)\b.*\b(?:debito|debit)\b|\b(?:debito|debit)\b.*\b(?:compra|pagamento)\b/.test(normalized)) return 'debit_purchase'
  if (/\b(?:compra|pagamento)\b.*\b(?:credito|credit)\b|\b(?:credito|credit)\b.*\b(?:compra|pagamento)\b/.test(normalized)) return 'credit_purchase'
  if (/\b(?:compra|pagamento)\b.*\bcartao\b|\bcartao\b.*\b(?:compra|pagamento)\b/.test(normalized)) return 'card_purchase'
  if (/\bpix\b/.test(normalized)) {
    if (/\b(?:recebido|recebida|entrada|credito)\b/.test(normalized)) return 'pix_received'
    if (/\b(?:enviado|enviada|saida|pagamento)\b/.test(normalized)) return 'pix_sent'
    return outgoing ? 'pix_sent' : 'pix_received'
  }
  if (/\b(?:ted|doc|transferencia|transf)\b/.test(normalized)) {
    if (/\b(?:recebida|recebido|entrada|credito)\b/.test(normalized)) return 'transfer_received'
    if (/\b(?:enviada|enviado|saida|debito)\b/.test(normalized)) return 'transfer_sent'
    return outgoing ? 'transfer_sent' : 'transfer_received'
  }
  if (/\b(?:tarifa|taxa|encargo|juros|iof)\b/.test(normalized)) return 'fee'
  return 'other'
}

export function cleanBankDescription(...parts: Array<string | undefined | null>) {
  const unique: string[] = []
  for (const part of parts) {
    const value = part?.replace(/\s+/g, ' ').trim()
    if (value && !unique.some((item) => normalizedHeader(item) === normalizedHeader(value))) unique.push(value)
  }
  let description = unique.join(' · ')
    .replace(/\bcp\s*:\s*\d+\s*[-–]\s*/gi, '')
    .replace(/\b(?:end\s*to\s*end|e2e|nsu|aut(?:oriza[cç][aã]o)?|id|c[oó]d(?:igo)?|doc(?:umento)?)\s*[:#-]?\s*[a-z0-9-]{5,}\b/gi, ' ')
    .replace(/\b(?=[a-z0-9-]{12,}\b)(?=[a-z0-9-]*\d)[a-z0-9-]+\b/gi, ' ')
    .replace(/\s*[·|]\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim()
  const operationalPrefix = /^(?:(?:pix(?:\s+(?:enviado|recebido))?(?:\s+(?:para|de))?)|(?:transfer[eê]ncia(?:\s+(?:enviada|recebida))?(?:\s+(?:para|de))?)|(?:compra\s+(?:(?:no|com)\s+)?(?:cart[aã]o\s+)?(?:de\s+)?(?:d[eé]bito|cr[eé]dito|debit|credit))|(?:(?:d[eé]bito|cr[eé]dito|debit|credit)(?:\s+em)?)|(?:pagamento\s+(?:de\s+)?cart[aã]o)|(?:sal[aá]rio\s+recebido(?:\s*[-–]\s*portabilidade)?)|(?:resgate|aplica[cç][aã]o|estorno|devolu[cç][aã]o|reembolso)|cart[aã]o)\s*(?:[-:·|]+\s*)?/i
  while (operationalPrefix.test(description)) description = description.replace(operationalPrefix, '').trim()
  description = description
    .replace(/^(?:lan[cç]amento|hist[oó]rico)\s*(?:[-:·|]+\s*)?/i, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^(?:estorno|devolu[cç][aã]o|reembolso)\s+(?=no\s+estabelecimento)/i, '')
    .replace(/^cp\s*:\s*\d+\s*[-–]\s*/i, '')
    .replace(/^(?:\d{3,}\s+){2,3}(?=[a-zà-ÿ])/i, '')
    .replace(/^no\s+estabelecimento\s+n[aã]o\s+informado/i, 'Estabelecimento não informado')
    .replace(/^no\s+estabelecimento\s+/i, '')
    .replace(/^cdb\s+porq(?:uinho)?\s+obj(?:etivo)?\s+/i, 'Porquinho · ')
    .replace(/\bBANCO\s+INTER\s+S\s*A\b/i, 'Banco Inter')
    .replace(/\s+/g, ' ')
    .trim()
  return (description || 'Movimentação importada').slice(0, 160)
}

function transactionFromValues(
  dateValue: string,
  amountValue: string,
  description: string,
  balanceValue?: string | null,
  externalId?: string | null,
  timeValue = '',
): ParsedBankStatementTransaction | null {
  const moment = parseBankMoment(dateValue, timeValue)
  const signedAmount = parseBankAmount(amountValue)
  if (!moment || signedAmount === null || signedAmount === 0n) return null
  const balance = balanceValue ? parseBankAmount(balanceValue) : null
  const movementType = detectBankMovementType(description, signedAmount)
  const paymentMethod = detectBankPaymentMethod(description)
  const isInternalTransfer = movementType === 'vault_deposit' || movementType === 'vault_withdrawal'
  return {
    kind: signedAmount < 0n ? 'expense' : 'income',
    amount: centsToStorage(signedAmount < 0n ? -signedAmount : signedAmount),
    date: moment.date,
    occurredAt: moment.occurredAt,
    description: cleanBankDescription(description),
    balance: balance === null ? null : centsToStorage(balance),
    externalId: externalId?.trim() || null,
    paymentMethod,
    movementType,
    isInternalTransfer,
    suggestedCardLink: movementType === 'debit_purchase' || movementType === 'credit_purchase' || movementType === 'card_purchase',
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
  const timeIndex = headerIndex(headers, ['hora lancamento', 'horario', 'hora', 'time'])
  const amountIndex = headerIndex(headers, ['valor lancamento', 'valor', 'amount'])
  const balanceIndex = headerIndex(headers, ['saldo', 'balance'])
  const historyIndex = headerIndex(headers, ['historico', 'lancamento', 'tipo'])
  const descriptionIndex = headerIndex(headers, ['descricao', 'detalhes', 'memo', 'nome'])
  if (dateIndex < 0 || amountIndex < 0) {
    throw new Error('Não encontrei as colunas de data e valor. Use um CSV/TSV com cabeçalho.')
  }
  const transactions = rows.slice(1).map((row) => transactionFromValues(
    row[dateIndex] ?? '', row[amountIndex] ?? '',
    [row[historyIndex], row[descriptionIndex]].filter(Boolean).join(' · '),
    balanceIndex >= 0 ? row[balanceIndex] : null,
    null,
    timeIndex >= 0 ? row[timeIndex] : '',
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
      [ofxValue(block, 'TRNTYPE'), ofxValue(block, 'NAME'), ofxValue(block, 'MEMO')].filter(Boolean).join(' · '),
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

const PORTUGUESE_MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

function textDateHeader(line: string) {
  const normalized = normalizedHeader(line)
  const writtenDate = /\b(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/.exec(normalized)
  const numericDate = /\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\b/.exec(line)
  const isDailyHeader = Boolean(writtenDate) || (/\bsaldo\s+do\s+dia\b/.test(normalized) && Boolean(numericDate))
  if (!isDailyHeader) return null

  const dateValue = writtenDate
    ? `${writtenDate[1].padStart(2, '0')}/${String(PORTUGUESE_MONTHS[writtenDate[2]]).padStart(2, '0')}/${writtenDate[3]}`
    : numericDate?.[1] ?? ''
  const moment = parseBankMoment(dateValue)
  if (!moment) return null
  const balanceMatch = /\bsaldo\s+do\s+dia\b/.test(normalized)
    ? [...line.matchAll(TEXT_MONEY_PATTERN)].at(-1)?.[0] ?? null
    : null
  const balance = balanceMatch ? parseBankAmount(balanceMatch) : null
  return {
    date: moment.date,
    balance: balance === null ? null : centsToStorage(balance),
  }
}

function transactionFromText(dateValue: string, rest: string) {
  const timeMatch = /^\s+(\d{1,2}:\d{2}(?::\d{2})?)\b/.exec(rest)
  const moneyMatches = [...rest.matchAll(TEXT_MONEY_PATTERN)]
  if (!moneyMatches.length) return null
  const amountMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : moneyMatches[0]
  const balanceMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 1] : null
  const description = rest.slice(timeMatch?.[0].length ?? 0, amountMatch.index).replace(/[|\t]+/g, ' ')
  return transactionFromValues(
    dateValue, amountMatch[0], description, balanceMatch?.[0] ?? null, null, timeMatch?.[1] ?? '',
  )
}

function looksLikeContextualTransaction(line: string) {
  const normalized = normalizedHeader(line)
  return /^(?:pix|salario|compra|pagamento|resgate|aplicacao|estorno|transferencia|ted|doc|tarifa|taxa|reembolso|devolucao)\b/.test(normalized)
}

export function parseStatementTextLines(lines: string[], fileName = 'extrato.pdf'): ParsedBankStatement {
  const transactions: ParsedBankStatementTransaction[] = []
  let currentDate = ''
  let pendingDescription = ''
  let headerBalance: string | null = null
  let headerBalanceDate = ''
  const physicalLines = lines.flatMap((line) => line.split(/\r?\n/)).map((line) => line.replace(/\s+/g, ' ').trim())

  for (const line of physicalLines) {
    if (!line) continue
    const header = textDateHeader(line)
    if (header) {
      currentDate = header.date
      pendingDescription = ''
      if (header.balance !== null && header.date >= headerBalanceDate) {
        headerBalanceDate = header.date
        headerBalance = header.balance
      }
      continue
    }

    const dateMatch = /\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\b/.exec(line)
    let transaction: ParsedBankStatementTransaction | null = null
    if (dateMatch) {
      currentDate = parseBankMoment(dateMatch[0])?.date ?? currentDate
      transaction = transactionFromText(dateMatch[0], line.slice(dateMatch.index + dateMatch[0].length))
      pendingDescription = ''
    } else if (currentDate) {
      const rest = pendingDescription && TEXT_MONEY_PATTERN.test(line)
        ? `${pendingDescription} ${line}`
        : line
      TEXT_MONEY_PATTERN.lastIndex = 0
      transaction = transactionFromText(currentDate, rest)
      if (transaction) pendingDescription = ''
      else if (looksLikeContextualTransaction(line)) pendingDescription = line
    }
    if (transaction) transactions.push(transaction)
    if (transactions.length >= MAX_IMPORT_ROWS) break
  }
  if (!transactions.length) {
    throw new Error('Não encontrei lançamentos no PDF. Use um extrato com texto selecionável; PDFs escaneados precisam de OCR.')
  }
  return {
    format: 'pdf', fileName, transactions,
    closingBalance: headerBalanceDate >= transactions.reduce(
      (latest, transaction) => transaction.date > latest ? transaction.date : latest, '',
    ) ? headerBalance : closingBalanceFrom(transactions),
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
  transaction: Pick<Transaction | ParsedBankStatementTransaction, 'date' | 'occurredAt' | 'kind' | 'amount' | 'description'>,
) {
  return [transaction.occurredAt ?? transaction.date, transaction.kind, transaction.amount.replace(',', '.'), normalizedHeader(transaction.description)].join('|')
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
