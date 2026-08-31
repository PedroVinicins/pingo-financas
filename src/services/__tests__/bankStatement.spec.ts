import { describe, expect, it } from 'vitest'
import {
  duplicateStatementRows,
  parseBankAmount,
  parseDelimitedStatement,
  parseBankStatementFile,
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

  it('reads newer Inter columns and infers debit or credit when the value has no sign', () => {
    const statement = parseDelimitedStatement(`Data Entrada;Tipo Transação;Tipo Operação;Título;Descrição;Valor;Saldo
2026-08-29;PIX;D;Pix enviado;Mercado Central;12,34;87,66
2026-08-30;PIX;C;Pix recebido;Cliente Silva;100,00;187,66`, 'inter-atual.csv')

    expect(statement.transactions).toHaveLength(2)
    expect(statement.transactions[0]).toMatchObject({
      kind: 'expense', amount: '12.34', description: 'Mercado Central', movementType: 'pix_sent',
    })
    expect(statement.transactions[1]).toMatchObject({
      kind: 'income', amount: '100.00', description: 'Cliente Silva', movementType: 'pix_received',
    })
    expect(statement.closingBalance).toBe('187.66')
  })

  it('reads an Inter CSV saved as UTF-16 by spreadsheet applications', async () => {
    const contents = `Data Lançamento\tHistórico\tDescrição\tValor\tSaldo
30/08/2026\tPix enviado\tPadaria Central\t-15,90\t84,10`
    const bytes = new Uint8Array(2 + contents.length * 2)
    bytes[0] = 0xff
    bytes[1] = 0xfe
    for (let index = 0; index < contents.length; index += 1) {
      const code = contents.charCodeAt(index)
      bytes[2 + index * 2] = code & 0xff
      bytes[3 + index * 2] = code >> 8
    }
    const file = {
      name: 'extrato-inter.csv', type: 'text/csv', size: bytes.length,
      arrayBuffer: async () => bytes.buffer,
    } as File

    const statement = await parseBankStatementFile(file, 'inter')
    expect(statement.transactions[0]).toMatchObject({
      date: '2026-08-30', kind: 'expense', amount: '15.90', description: 'Padaria Central',
    })
  })

  it('reads the Nubank account CSV and classifies Pix, debit, invoice and Caixinhas', () => {
    const statement = parseDelimitedStatement(`Data,Descrição da Transação,Valor (R$),Saldo Disponível (R$)
25/08/2026,Transferência recebida (Pix) - João Silva,+200.00,200.00
26/08/2026,Compra no débito - Supermercado,-45.50,154.50
27/08/2026,Pagamento de fatura Cartão de Crédito,-100.00,54.50
28/08/2026,Aplicação Caixinha Reserva de Emergência,-50.00,4.50
29/08/2026,Resgate dinheiro guardado Caixinha,+20.00,24.50`, 'nubank.csv')

    expect(statement.transactions).toHaveLength(5)
    expect(statement.transactions.map((item) => item.movementType)).toEqual([
      'pix_received', 'debit_purchase', 'credit_purchase', 'vault_deposit', 'vault_withdrawal',
    ])
    expect(statement.transactions[2]).toMatchObject({ paymentMethod: 'credit', suggestedCardLink: true })
    expect(statement.transactions.slice(3).every((item) => item.isInternalTransfer)).toBe(true)
    expect(statement.closingBalance).toBe('24.50')
  })

  it('keeps the Nubank file importer explicitly in beta', async () => {
    const contents = `Data,Descrição da Transação,Valor (R$)
30/08/2026,Transferência recebida (Pix) - Cliente,+20.00`
    const file = {
      name: 'nubank.csv', type: 'text/csv', size: contents.length,
      arrayBuffer: async () => new TextEncoder().encode(contents).buffer,
    } as File

    const statement = await parseBankStatementFile(file, 'nubank')
    expect(statement.warnings).toContain('Importação do Nubank em beta: confira a prévia antes de confirmar.')
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

  it('reads OFX 1.x/QFX without transaction closing tags', () => {
    const statement = parseOfxStatement(`OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260827103000<TRNAMT>-9.90<FITID>one<NAME>PIX<MEMO>Padaria
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260828110000<TRNAMT>100.00<FITID>two<NAME>PIX RECEBIDO<MEMO>Cliente
</BANKTRANLIST><LEDGERBAL><BALAMT>90.10</LEDGERBAL></OFX>`, 'banco.qfx')

    expect(statement.transactions).toHaveLength(2)
    expect(statement.transactions.map((item) => item.amount)).toEqual(['9.90', '100.00'])
    expect(statement.closingBalance).toBe('90.10')
  })

  it('treats PAYMENT with an explicit Pix as Pix and keeps OFX decimal precision', () => {
    const statement = parseOfxStatement(`<OFX><BANKTRANLIST>
      <STMTTRN><TRNTYPE>PAYMENT<DTPOSTED>20260827120000<TRNAMT>-4.6000<FITID>pix-one
      <NAME>Nivea Maria Vale Da Silva<MEMO>Pix enviado: "Nivea Maria Vale da Silva"</STMTTRN>
      </BANKTRANLIST><LEDGERBAL><BALAMT>1.5300</LEDGERBAL></OFX>`)

    expect(statement.transactions[0]).toMatchObject({
      kind: 'expense', amount: '4.60', description: 'Nivea Maria Vale Da Silva',
      paymentMethod: 'pix', movementType: 'pix_sent', suggestedCardLink: false,
    })
    expect(statement.closingBalance).toBe('1.53')
  })

  it('keeps an ambiguous PAYMENT away from cards', () => {
    const statement = parseOfxStatement(`<OFX><BANKTRANLIST>
      <STMTTRN><TRNTYPE>PAYMENT<DTPOSTED>20260827<TRNAMT>-19.9900<NAME>Academia</STMTTRN>
      </BANKTRANLIST></OFX>`)

    expect(statement.transactions[0]).toMatchObject({
      amount: '19.99', description: 'Academia', paymentMethod: 'unknown',
      movementType: 'other', suggestedCardLink: false,
    })
  })

  it('only recommends a card when PAYMENT explicitly describes a card purchase', () => {
    const statement = parseOfxStatement(`<OFX><BANKTRANLIST>
      <STMTTRN><TRNTYPE>PAYMENT<DTPOSTED>20260827<TRNAMT>-4.605<NAME>Mercado
      <MEMO>Compra no débito</STMTTRN></BANKTRANLIST></OFX>`)

    expect(statement.transactions[0]).toMatchObject({
      amount: '4.61', description: 'Mercado', paymentMethod: 'debit',
      movementType: 'debit_purchase', suggestedCardLink: true,
    })
  })

  it('finds a CSV header after bank metadata and supports debit/credit columns', () => {
    const statement = parseDelimitedStatement(`Conta;12345-6
Período;Agosto de 2026
Data;Descrição;Débito;Crédito;Saldo
27/08/26;Mercado;1.234,56;;5.000,00
28/08/26;Salário;;2.500,00;7.500,00`, 'exportacao.csv')

    expect(statement.transactions).toHaveLength(2)
    expect(statement.transactions[0]).toMatchObject({
      date: '2026-08-27', kind: 'expense', amount: '1234.56', description: 'Mercado',
    })
    expect(statement.transactions[1]).toMatchObject({
      date: '2026-08-28', kind: 'income', amount: '2500.00', description: 'Salário',
    })
    expect(statement.closingBalance).toBe('7500.00')
  })

  it('understands Brazilian and international thousands separators', () => {
    expect(parseBankAmount('R$ 1.234,56')).toBe(123456n)
    expect(parseBankAmount('BRL 1,234.56')).toBe(123456n)
    expect(parseBankAmount('-1,234.56')).toBe(-123456n)
  })

  it('detects QFX content through the file importer', async () => {
    const contents = '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260827<TRNAMT>-10.00<NAME>PIX<MEMO>Teste</BANKTRANLIST></OFX>'
    const file = {
      name: 'movimentos.qfx', type: 'application/vnd.intu.qfx', size: contents.length,
      arrayBuffer: async () => new TextEncoder().encode(contents).buffer,
    } as File

    const statement = await parseBankStatementFile(file)
    expect(statement.format).toBe('ofx')
    expect(statement.transactions[0]).toMatchObject({ amount: '10.00', date: '2026-08-27' })
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

  it('understands abbreviated month names in Inter PDF date blocks', () => {
    const statement = parseStatementTextLines([
      '30 de ago. de 2026 Saldo do dia: R$ 84,10',
      'Pix enviado: "Padaria Central" -R$ 15,90 R$ 84,10',
    ])
    expect(statement.transactions[0]).toMatchObject({
      date: '2026-08-30', kind: 'expense', amount: '15.90', description: 'Padaria Central',
    })
    expect(statement.closingBalance).toBe('84.10')
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
