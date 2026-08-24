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
      paymentMethod: 'pix', movementType: 'pix_sent', suggestedCardLink: false,
    })
    expect(statement.closingBalance).toBe('1.53')
  })

  it('reads OFX transactions and ledger balance', () => {
    const statement = parseOfxStatement(`<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260807120000<TRNAMT>-12.34<FITID>abc<NAME>PIX<MEMO>Mercado</STMTTRN>
      </BANKTRANLIST><LEDGERBAL><BALAMT>98.76<DTASOF>20260807</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`)
    expect(statement.transactions[0]).toMatchObject({
      amount: '12.34', occurredAt: '2026-08-07T12:00:00', externalId: 'abc',
      description: 'Mercado', paymentMethod: 'pix', movementType: 'pix_sent', suggestedCardLink: false,
    })
    expect(statement.closingBalance).toBe('98.76')
  })

  it('preserves a separate bank time and removes operational identifiers', () => {
    const statement = parseDelimitedStatement(`Data;Hora;Descrição;Valor
07/08/2026;14:37:22;Compra cartão crédito MERCADO CENTRAL NSU 123456789;-42,90`)
    expect(statement.transactions[0]).toMatchObject({
      date: '2026-08-07', occurredAt: '2026-08-07T14:37:22',
      description: 'MERCADO CENTRAL', paymentMethod: 'credit',
      movementType: 'credit_purchase', suggestedCardLink: true,
    })
  })

  it('reads bank rows extracted from a textual PDF', () => {
    const statement = parseStatementTextLines([
      'Data Lançamento Histórico Descrição Valor Saldo',
      '07/08/2026 Pix enviado Nivea Maria Vale Da Silva -500,00 1,53',
    ])
    expect(statement.transactions[0]).toMatchObject({ amount: '500.00', balance: '1.53' })
  })

  it('understands Banco Inter date blocks, daily balances and movement types', () => {
    const statement = parseStatementTextLines(`
25 de Junho de 2026 Saldo do dia: R$ 2,06
Pix enviado: "Cp :18236120-Marcelo Victor da Silva Lopes" -R$ 4,60 -R$ 2,54
Resgate: "CDB Porq Obj BANCO INTER SA" R$ 4,60 R$ 2,06
26 de Junho de 2026 Saldo do dia: R$ 2,06
Pix enviado: "Cp :18236120-Laianny Luiza das Chagas Santos" -R$ 4,00 -R$ 1,94
Resgate: "CDB Porq Obj BANCO INTER SA" R$ 2,34 R$ 0,40
Resgate: "CDB Porq Obj BANCO INTER SA" R$ 1,03 R$ 1,43
Resgate: "CDB Porq Obj BANCO INTER SA" R$ 0,63 R$ 2,06
27 de Junho de 2026 Saldo do dia: R$ 0,06
Aplicacao: "CDB Porq Obj BANCO INTER SA" -R$ 2,00 R$ 0,06
29 de Junho de 2026 Saldo do dia: R$ 0,05
Pix enviado: "Cp :14796606-99 TECNOLOGIA LTDA" -R$ 12,10 -R$ 12,04
Resgate: "CDB Porq Obj BANCO INTER SA" R$ 3,94 -R$ 8,10
Resgate: "CDB Porq Obj BANCO INTER SA" R$ 8,15 R$ 0,05
Pix enviado: "Cp :00000000-SURF TELECOM SA" -R$ 30,00 -R$ 29,95
Resgate: "CDB Porq Obj BANCO INTER SA" R$ 30,00 R$ 0,05
30 de Junho de 2026 Saldo do dia: R$ 1,05
Estorno: "Estorno no estabelecimento nao informado" R$ 1,00 R$ 1,05
Compra no debito: "No estabelecimento DL *TEMPORARY HOLD SAO PAULO BRA" -R$ 1,00 R$ 0,05
Resgate: "CDB Porq Obj BANCO INTER SA" R$ 1,00 R$ 1,05
2 de Julho de 2026 Saldo do dia: R$ 16,05
Pix recebido: "00019 200575880 GIOVANNA SANTOS" R$ 15,00 R$ 16,05
4 de Julho de 2026 Saldo do dia: R$ 16,05
Pix enviado: "00019 311004326 MARIA TAVARES" -R$ 22,00 -R$ 5,95
Resgate: "CDB Porq Obj BANCO INTER S A" R$ 22,00 R$ 16,05
6 de Julho de 2026 Saldo do dia: R$ 733,05
Salario recebido - Portabilidade: "341 1135 977872 PEDRO VINICIUS VALE DA COSTA DA SI" R$ 722,00 R$ 738,05
Pix enviado: "Cp :20855875-Denis Martins" -R$ 5,00 R$ 733,05
7 de Julho de 2026 Saldo do dia: R$ 713,85
Pix enviado: "Cp :60746948-AUTOPASS SA" -R$ 9,20 R$ 723,85
Pix enviado: "Cp :59285411-RITA DE CASSIA DE OLIVEIRA" -R$ 10,00 R$ 713,85
8 de Julho de 2026 Saldo do dia: R$ 193,77
Fale com a gente
SAC: 0800 940 9999 (opção 09)
Aplicacao: "CDB Porq Obj BANCO INTER S A" -R$ 120,08 R$ 593,77
Pix enviado: "Cp :60746948-Nivea Maria Vale da Silva"
`.trim().split('\n'), 'inter.pdf')

    expect(statement.transactions).toHaveLength(23)
    expect(statement.closingBalance).toBe('193.77')
    expect(statement.transactions[0]).toMatchObject({
      date: '2026-06-25', description: 'Marcelo Victor da Silva Lopes',
      movementType: 'pix_sent', isInternalTransfer: false,
    })
    expect(statement.transactions.filter((item) => item.isInternalTransfer)).toHaveLength(11)
    expect(statement.transactions.find((item) => item.movementType === 'salary')).toMatchObject({
      date: '2026-07-06', description: 'PEDRO VINICIUS VALE DA COSTA DA SI', amount: '722.00',
    })
    expect(statement.transactions.find((item) => item.movementType === 'debit_purchase')).toMatchObject({
      description: 'DL *TEMPORARY HOLD SAO PAULO BRA', suggestedCardLink: true,
    })
    expect(statement.transactions.find((item) => item.movementType === 'refund')).toMatchObject({
      description: 'Estabelecimento não informado', kind: 'income',
    })
    expect(statement.transactions.at(-1)).toMatchObject({
      date: '2026-07-08', movementType: 'vault_deposit', balance: '593.77',
    })
  })

  it('joins a contextual movement whose amounts were extracted on the following PDF line', () => {
    const statement = parseStatementTextLines([
      '8 de Julho de 2026 Saldo do dia: R$ 18,77',
      'Pix enviado: "Cp :60746948-Nivea Maria Vale da Silva"',
      '-R$ 175,00 R$ 18,77',
    ])
    expect(statement.transactions).toHaveLength(1)
    expect(statement.transactions[0]).toMatchObject({
      date: '2026-07-08', amount: '175.00', balance: '18.77',
      description: 'Nivea Maria Vale da Silva', movementType: 'pix_sent',
    })
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
