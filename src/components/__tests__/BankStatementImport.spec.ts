import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BankStatementImport from '../BankStatementImport.vue'
import type { Category, Transaction } from '../../types/finance'

const categories: Category[] = [
  { id: 'shopping', kind: 'expense', name: 'Compras', icon: 'shopping-bag', color: '#ef4444', createdAt: '2026-08-27T00:00:00Z' },
  { id: 'income', kind: 'income', name: 'Outras entradas', icon: 'banknote', color: '#10b981', createdAt: '2026-08-27T00:00:00Z' },
]

describe('BankStatementImport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 30, 12, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('marks Nubank as beta and keeps Banco Inter as the stable default', async () => {
    const wrapper = mount(BankStatementImport, {
      props: { categories, cards: [], transactions: [] },
      global: { plugins: [createPinia()], stubs: { Teleport: true } },
    })

    expect((wrapper.get('input[value="inter"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('Beta')
    await wrapper.get('input[value="nubank"]').setValue(true)
    expect(wrapper.text()).toContain('Nubank está em beta')
    expect(wrapper.text()).toContain('CSV do extrato da conta · até 12 MB')
  })

  it('allows the mobile picker to show every file and keeps the action outside the scroll area', async () => {
    const wrapper = mount(BankStatementImport, {
      props: { categories, cards: [], transactions: [] },
      global: { plugins: [createPinia()], stubs: { Teleport: true } },
    })
    const input = wrapper.get('input[type="file"]')
    expect(input.attributes('accept')).toBeUndefined()

    const contents = `Conta;12345-6
Data;Descrição;Débito;Crédito;Saldo
27/08/26;Mercado;25,90;;74,10
28/08/26;Cliente;;100,00;174,10`
    const file = {
      name: 'extrato.csv', type: 'application/vnd.ms-excel', size: contents.length,
      arrayBuffer: async () => new TextEncoder().encode(contents).buffer,
    } as File
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('CSV/planilha')
    expect(wrapper.text()).toContain('Importar 2 lançamentos')
    expect(wrapper.find('.pingo-modal-frame > footer').exists()).toBe(true)

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('import')?.[0]?.[0]).toMatchObject({
      closingBalance: '174.10',
      preserveCurrentBalance: false,
      statementPeriod: '2026-08',
      statementClosingBalance: '174.10',
      transactions: [
        { kind: 'expense', amount: '25.90', categoryId: 'shopping' },
        { kind: 'income', amount: '100.00', categoryId: 'income' },
      ],
    })
  })

  it('mantém o saldo atual por padrão ao importar um mês antigo', async () => {
    const newerTransaction: Transaction = {
      id: 'september-entry', kind: 'income', amount: '50.00', date: '2026-09-02', occurredAt: null,
      categoryId: 'income', debitCardId: null, description: 'Entrada de setembro', recurrence: 'variable',
      createdAt: '2026-09-02T12:00:00Z',
    }
    const wrapper = mount(BankStatementImport, {
      props: { categories, cards: [], transactions: [newerTransaction] },
      global: { plugins: [createPinia()], stubs: { Teleport: true } },
    })
    const contents = `Data;Descrição;Débito;Crédito;Saldo
27/08/26;Mercado;25,90;;74,10`
    const file = {
      name: 'agosto.csv', type: 'application/vnd.ms-excel', size: contents.length,
      arrayBuffer: async () => new TextEncoder().encode(contents).buffer,
    } as File
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('Como tratar o saldo deste mês antigo?')
    expect(wrapper.text()).toContain('Manter meu saldo atual')
    expect((wrapper.get('input[value="preserve"]').element as HTMLInputElement).checked).toBe(true)

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('import')?.[0]?.[0]).toMatchObject({
      closingBalance: null,
      preserveCurrentBalance: true,
      statementPeriod: '2026-08',
      statementClosingBalance: '74.10',
    })
  })

  it('shows the safe PIX recommendation for a PAYMENT imported from OFX', async () => {
    const wrapper = mount(BankStatementImport, {
      props: { categories, cards: [], transactions: [] },
      global: { plugins: [createPinia()], stubs: { Teleport: true } },
    })
    const contents = `<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>PAYMENT<DTPOSTED>20260827
      <TRNAMT>-4.6000<NAME>Nivea Maria Vale Da Silva
      <MEMO>Pix enviado: "Nivea Maria Vale da Silva"</STMTTRN></BANKTRANLIST></OFX>`
    const file = {
      name: 'inter.ofx', type: 'application/x-ofx', size: contents.length,
      arrayBuffer: async () => new TextEncoder().encode(contents).buffer,
    } as File
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await flushPromises()

    const row = wrapper.findAll('label').find((label) => label.text().includes('Nivea Maria Vale Da Silva'))
    expect(row?.text()).toContain('Pix enviado')
    expect(row?.text()).toContain('Recomendado: PIX · sem cartão')
    expect(row?.text()).toContain('-R$ 4,60')
  })
})
