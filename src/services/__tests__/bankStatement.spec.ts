import { describe, expect, it } from 'vitest'
import {
  duplicateStatementRows,
  parseDelimitedStatement,
  parseOfxStatement,
  parseStatementTextLines,
} from '../bankStatement'
import type { Transaction } from '../../types/finance'

describe('bank statement import', () => {
  const interSample = `Data Lançamento\tHistórico\tDescrição\tValor\tSaldo
07/08/2026\tPix enviado\tNivea Maria Vale Da Silva\t-500,00\t1,53
07/08/2026\tPix enviado\tElciany Gomes Piedade Tavares\t-5,00\t501,53`

  it('reads the Banco Inter tab-separated format and its newest balance', () => {
    const statement = parseDelimitedStatement(interSample, 'inter.csv')
    expect(statement.transactions).toHaveLength(2)
    expect(statement.transactions[0]).toMatchObject({
      kind: 'expense', amount: '500.00', date: '2026-08-07',
      occurredAt: null, description: 'Nivea Maria Vale Da Silva', balance: '1.53',
      paymentMethod: 'pix', suggestedCardLink: false,
    })
    expect(statement.closingBalance).toBe('1.53')
  })

  it('reads OFX transactions and ledger balance', () => {
    const statement = parseOfxStatement(`<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260807120000<TRNAMT>-12.34<FITID>abc<NAME>PIX<MEMO>Mercado</STMTTRN>
      </BANKTRANLIST><LEDGERBAL><BALAMT>98.76<DTASOF>20260807</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`)
    expect(statement.transactions[0]).toMatchObject({
      amount: '12.34', occurredAt: '2026-08-07T12:00:00', externalId: 'abc',
      description: 'Mercado', paymentMethod: 'debit', suggestedCardLink: true,
    })
    expect(statement.closingBalance).toBe('98.76')
  })

  it('preserves a separate bank time and removes operational identifiers', () => {
    const statement = parseDelimitedStatement(`Data;Hora;Descrição;Valor
07/08/2026;14:37:22;Compra cartão crédito MERCADO CENTRAL NSU 123456789;-42,90`)
    expect(statement.transactions[0]).toMatchObject({
      date: '2026-08-07', occurredAt: '2026-08-07T14:37:22',
      description: 'MERCADO CENTRAL', paymentMethod: 'credit', suggestedCardLink: true,
    })
  })

  it('reads bank rows extracted from a textual PDF', () => {
    const statement = parseStatementTextLines([
      'Data Lançamento Histórico Descrição Valor Saldo',
      '07/08/2026 Pix enviado Nivea Maria Vale Da Silva -500,00 1,53',
    ])
    expect(statement.transactions[0]).toMatchObject({ amount: '500.00', balance: '1.53' })
  })

  it('marks only occurrences already present in the history as duplicates', () => {
    const rows = parseDelimitedStatement(interSample).transactions
    const existing: Transaction[] = [{
      id: 'one', kind: rows[0].kind, amount: rows[0].amount, date: rows[0].date,
      occurredAt: rows[0].occurredAt,
      categoryId: 'shopping', debitCardId: null, description: rows[0].description,
      recurrence: 'variable', createdAt: '2026-08-08T00:00:00Z',
    }]
    expect(duplicateStatementRows(rows, existing)).toEqual([true, false])
  })
})
