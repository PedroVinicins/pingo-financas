<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertCircle, CheckCircle2, CreditCard, FileSpreadsheet, FileUp, Landmark, X } from 'lucide-vue-next'
import type {
  BankMovementType, BankStatementImportInput, Category, DebitCard, NewDebitCardInput,
  ParsedBankStatement, ParsedBankStatementTransaction, SupportedStatementBank, Transaction,
} from '../types/finance'
import {
  duplicateStatementRows, parseBankStatementFile, statementFormatLabel, SUPPORTED_STATEMENT_BANKS,
} from '../services/bankStatement'
import { useFinanceStore } from '../stores/financeStore'
import { formatCurrencyValue } from '../services/currency'
import AddDebitCardModal from './AddDebitCardModal.vue'

const props = defineProps<{ categories: Category[]; cards: DebitCard[]; transactions: Transaction[]; busy?: boolean }>()
const emit = defineEmits<{ close: []; import: [input: BankStatementImportInput] }>()
const store = useFinanceStore()
const statement = ref<ParsedBankStatement | null>(null)
const duplicates = ref<boolean[]>([])
const selected = ref<boolean[]>([])
const expenseCategoryId = ref('')
const incomeCategoryId = ref('')
const suggestedCardId = ref('')
const reconcileBalance = ref(true)
const parsing = ref(false)
const error = ref('')
const showCardCreator = ref(false)
const cardSaving = ref(false)
const cardSaveError = ref('')
const selectedBank = ref<SupportedStatementBank>('inter')

const expenseCategories = computed(() => props.categories.filter((item) => item.kind === 'expense'))
const incomeCategories = computed(() => props.categories.filter((item) => item.kind === 'income'))
const selectedCount = computed(() => selected.value.filter(Boolean).length)
const duplicateCount = computed(() => duplicates.value.filter(Boolean).length)
const internalCount = computed(() => statement.value?.transactions.filter((item) => item.isInternalTransfer).length ?? 0)
const statementDate = computed(() => statement.value?.transactions.reduce(
  (latest, item) => item.date > latest ? item.date : latest, '',
) ?? '')
const hasNewerTransactions = computed(() => props.transactions.some((item) => item.date > statementDate.value))
const hasExpenses = computed(() => statement.value?.transactions.some((item, index) => selected.value[index] && item.kind === 'expense') ?? false)
const hasIncomes = computed(() => statement.value?.transactions.some((item, index) => selected.value[index] && item.kind === 'income') ?? false)
const hasCardSuggestions = computed(() => statement.value?.transactions.some(
  (item, index) => selected.value[index] && item.kind === 'expense' && item.suggestedCardLink,
) ?? false)
const canReconcile = computed(() => statement.value?.closingBalance !== null
  && Number(statement.value?.closingBalance) >= 0 && !hasNewerTransactions.value)
const canImport = computed(() => selectedCount.value > 0
  && (!hasExpenses.value || Boolean(expenseCategoryId.value))
  && (!hasIncomes.value || Boolean(incomeCategoryId.value)))

function money(value: string) {
  return formatCurrencyValue(value, store.preferences.currency)
}
function date(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`))
}
function moment(dateValue: string, occurredAt: string | null) {
  if (!occurredAt) return date(dateValue)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(occurredAt))
}
function movementLabel(type: BankMovementType) {
  return ({
    pix_sent: 'Pix enviado',
    pix_received: 'Pix recebido',
    salary: 'Salário',
    debit_purchase: 'Compra no débito',
    credit_purchase: 'Compra no crédito',
    card_purchase: 'Compra no cartão',
    vault_withdrawal: 'Resgate do Porquinho',
    vault_deposit: 'Aplicação no Porquinho',
    refund: 'Estorno ou reembolso',
    transfer_sent: 'Transferência enviada',
    transfer_received: 'Transferência recebida',
    fee: 'Tarifa bancária',
    other: 'Outra movimentação',
  })[type]
}
function importRecommendation(item: ParsedBankStatementTransaction) {
  if (item.movementType === 'pix_sent' || item.movementType === 'pix_received') return 'Recomendado: PIX · sem cartão'
  if (item.suggestedCardLink) return 'Recomendado: vincular cartão'
  if (item.movementType === 'salary') return 'Recomendado: entrada · sem cartão'
  if (item.movementType === 'transfer_sent' || item.movementType === 'transfer_received') return 'Recomendado: transferência · sem cartão'
  if (item.movementType === 'fee') return 'Recomendado: tarifa · sem cartão'
  return 'Recomendado: revisar · sem cartão'
}
function normalizedName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}
function categoryWithName(kind: 'income' | 'expense', names: string[]) {
  return props.categories.find((category) => category.kind === kind
    && names.includes(normalizedName(category.name)))?.id
}
function categoryIdFor(item: ParsedBankStatementTransaction) {
  if (item.kind === 'income') {
    if (item.movementType === 'salary') {
      return categoryWithName('income', ['salario']) || incomeCategoryId.value
    }
    return categoryWithName('income', ['outras entradas']) || incomeCategoryId.value
  }
  if (['debit_purchase', 'credit_purchase', 'card_purchase'].includes(item.movementType)) {
    return categoryWithName('expense', ['compras']) || expenseCategoryId.value
  }
  if (item.movementType === 'fee') {
    return categoryWithName('expense', ['contas']) || expenseCategoryId.value
  }
  return expenseCategoryId.value
}
function categoryNameFor(item: ParsedBankStatementTransaction) {
  return props.categories.find((category) => category.id === categoryIdFor(item))?.name ?? 'Sem categoria'
}
function chooseDefaults() {
  expenseCategoryId.value = categoryWithName('expense', ['compras'])
    ?? expenseCategories.value[0]?.id ?? ''
  incomeCategoryId.value = categoryWithName('income', ['outras entradas'])
    ?? incomeCategories.value[0]?.id ?? ''
  suggestedCardId.value = props.cards.find((item) => item.isDefault && !item.isFrozen)?.id ?? ''
}
async function loadFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  parsing.value = true
  error.value = ''
  statement.value = null
  try {
    const parsed = await parseBankStatementFile(file, selectedBank.value)
    statement.value = parsed
    duplicates.value = duplicateStatementRows(parsed.transactions, props.transactions)
    selected.value = duplicates.value.map((duplicate, index) => !duplicate && !parsed.transactions[index].isInternalTransfer)
    const newestDate = parsed.transactions.reduce((latest, item) => item.date > latest ? item.date : latest, '')
    reconcileBalance.value = parsed.closingBalance !== null && Number(parsed.closingBalance) >= 0
      && !props.transactions.some((item) => item.date > newestDate)
    chooseDefaults()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível ler este extrato.'
  } finally {
    parsing.value = false
    input.value = ''
  }
}
function submit() {
  if (!statement.value || !canImport.value) return
  emit('import', {
    transactions: statement.value.transactions.flatMap((item, index) => selected.value[index] ? [{
      kind: item.kind,
      amount: item.amount,
      date: item.date,
      occurredAt: item.occurredAt,
      categoryId: categoryIdFor(item),
      debitCardId: item.kind === 'expense' && item.suggestedCardLink ? suggestedCardId.value || null : null,
      description: item.description,
      recurrence: 'variable' as const,
    }] : []),
    closingBalance: reconcileBalance.value && canReconcile.value ? statement.value.closingBalance : null,
  })
}
function selectNewRows() {
  if (!statement.value) return
  selected.value = duplicates.value.map(
    (duplicate, index) => !duplicate && !statement.value!.transactions[index].isInternalTransfer,
  )
}
async function createCard(input: NewDebitCardInput) {
  if (cardSaving.value) return
  cardSaving.value = true
  cardSaveError.value = ''
  try {
    const card = await store.createDebitCard(input)
    suggestedCardId.value = card.id
    showCardCreator.value = false
    store.showFeedback('Cartão criado e selecionado para as compras importadas.', 'success')
  } catch (cause) {
    cardSaveError.value = cause instanceof Error ? cause.message : 'Não foi possível cadastrar o cartão.'
  } finally { cardSaving.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div class="pingo-modal-backdrop fixed inset-0 z-[100] flex items-end bg-slate-950/65 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" @click.self="!busy && emit('close')">
      <form class="pingo-modal-panel pingo-modal-frame flex w-full flex-col rounded-t-[2rem] bg-white p-0 shadow-2xl dark:bg-slate-900 sm:max-w-3xl sm:rounded-[2rem]" role="dialog" aria-modal="true" aria-labelledby="bank-import-title" @submit.prevent="submit">
        <header class="flex shrink-0 items-start gap-3 border-b border-slate-100 px-4 pb-4 pt-5 dark:border-slate-800 sm:px-6 sm:pt-6"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950"><FileSpreadsheet :size="22" /></div><div class="min-w-0 flex-1"><p class="text-sm font-bold text-sky-600">Conferência bancária</p><h2 id="bank-import-title" class="text-xl font-black">Importar extrato</h2><p class="mt-1 text-xs leading-relaxed text-slate-500">CSV, OFX/QFX, TXT e PDF textual. Tudo é lido neste dispositivo.</p></div><button type="button" :disabled="busy" class="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 disabled:opacity-40 dark:bg-slate-800" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button></header>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6">
        <fieldset class="mt-4"><legend class="text-xs font-black uppercase tracking-wide text-slate-500">Banco do extrato</legend><div class="mt-2 grid gap-2 sm:grid-cols-2"><label v-for="bank in SUPPORTED_STATEMENT_BANKS" :key="bank.id" class="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition" :class="selectedBank === bank.id ? 'border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/30' : 'border-slate-200 dark:border-slate-800'"><input v-model="selectedBank" type="radio" name="statement-bank" :value="bank.id" class="mt-1 accent-sky-600" :disabled="parsing || busy" /><span><strong class="block text-sm">{{ bank.label }}</strong><span class="mt-0.5 block text-xs text-slate-500">{{ bank.hint }}</span></span></label></div></fieldset>
        <p class="mt-3 text-xs leading-relaxed text-slate-500">Escolha o banco antes do arquivo para aplicar a leitura e as classificações adequadas ao extrato.</p>
        <label class="mt-4 grid min-h-24 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/60 p-4 text-center dark:border-sky-900 dark:bg-sky-950/20 sm:min-h-28 sm:p-5"><span><FileUp class="mx-auto text-sky-600" :size="28" /><strong class="mt-2 block">{{ parsing ? 'Lendo extrato…' : statement ? 'Escolher outro arquivo' : 'Escolher extrato do banco' }}</strong><span class="mt-1 block text-xs text-slate-500">CSV, TSV, TXT, OFX, QFX ou PDF · até 12 MB</span><span v-if="statement" class="mt-1 block truncate text-[11px] font-bold text-sky-700">{{ statement.fileName }}</span></span><input type="file" class="sr-only" :disabled="parsing || busy" @change="loadFile" /></label>

        <p v-if="error" class="mt-4 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"><AlertCircle :size="18" class="shrink-0" /> {{ error }}</p>

        <template v-if="statement">
          <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[10px] font-black uppercase text-slate-400">Formato</p><p class="mt-1 text-sm font-black">{{ statementFormatLabel(statement.format) }}</p></div><div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[10px] font-black uppercase text-slate-400">Para importar</p><p class="mt-1 text-sm font-black text-emerald-600">{{ selectedCount }}</p></div><div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[10px] font-black uppercase text-slate-400">Internas</p><p class="mt-1 text-sm font-black text-violet-600">{{ internalCount }}</p></div><div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[10px] font-black uppercase text-slate-400">Já existem</p><p class="mt-1 text-sm font-black">{{ duplicateCount }}</p></div></div>

          <p v-for="warning in statement.warnings" :key="warning" class="mt-3 text-xs font-bold text-amber-600">{{ warning }}</p>

          <section class="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><h3 class="text-sm font-black">Classificação inteligente</h3><p class="mt-1 text-xs leading-relaxed text-slate-500">Salário, compras, tarifas e outras entradas recebem a categoria adequada. Use as opções abaixo como padrão para Pix, transferências e casos não identificados.</p><p class="mt-3 rounded-xl bg-sky-50 p-3 text-xs font-bold leading-relaxed text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">Modo seguro recomendado: PAYMENT e OTHER ficam sem cartão. O Pingo só sugere cartão quando o extrato diz explicitamente cartão, débito ou crédito.</p><div class="mt-3 grid gap-3 sm:grid-cols-2"><label v-if="statement.transactions.some((item) => item.kind === 'expense' && !item.isInternalTransfer)" class="grid gap-1 text-xs font-bold">Padrão para outras saídas<select v-model="expenseCategoryId" class="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"><option v-for="category in expenseCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label v-if="statement.transactions.some((item) => item.kind === 'income' && !item.isInternalTransfer)" class="grid gap-1 text-xs font-bold">Padrão para outras entradas<select v-model="incomeCategoryId" class="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"><option v-for="category in incomeCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label></div></section>

          <section v-if="internalCount" class="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/25">
            <h3 class="text-sm font-black text-violet-800 dark:text-violet-200">Aplicações e resgates reconhecidos</h3>
            <p class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Essas movimentações apenas levam dinheiro entre a conta e o Porquinho. O Pingo as deixa fora de receitas e gastos para não distorcer seus relatórios; o saldo final do banco continua sendo conciliado.</p>
          </section>

          <section v-if="hasCardSuggestions" class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/25">
            <div class="flex items-start gap-3"><CreditCard :size="20" class="mt-0.5 shrink-0 text-amber-700" /><div class="min-w-0 flex-1"><h3 class="text-sm font-black">Compras no débito ou crédito encontradas</h3><p class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Selecione o cartão para mandar essas compras direto ao histórico dele. Se ainda não estiver na Pingo Wallet, você pode cadastrá-lo sem perder esta importação.</p></div></div>
            <label v-if="cards.length" class="mt-3 grid gap-1 text-xs font-bold">Cartão sugerido<select v-model="suggestedCardId" class="h-11 rounded-xl border border-amber-200 bg-white px-3 text-sm dark:border-amber-800 dark:bg-slate-900"><option value="">Importar sem vínculo</option><option v-for="card in cards" :key="card.id" :value="card.id" :disabled="card.isFrozen">{{ card.name }} · •••• {{ card.lastFour }}{{ card.isFrozen ? ' (congelado)' : '' }}</option></select></label>
            <button type="button" class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-black text-white sm:w-auto" @click="cardSaveError = ''; showCardCreator = true"><CreditCard :size="17" /> {{ cards.length ? 'Cadastrar outro cartão' : 'Cadastrar cartão agora' }}</button>
          </section>

          <label v-if="statement.closingBalance !== null" class="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border p-4" :class="canReconcile ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/25' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/25'"><input v-model="reconcileBalance" type="checkbox" class="mt-1 size-4 accent-emerald-600" :disabled="!canReconcile" /><Landmark :size="19" class="mt-0.5 shrink-0" /><span><strong class="block text-sm">Ajustar saldo da carteira para {{ money(statement.closingBalance) }}</strong><span class="mt-1 block text-xs text-slate-500">{{ canReconcile ? `Usa o saldo mais recente informado pelo banco em ${date(statementDate)}.` : hasNewerTransactions ? 'O Pingo já possui lançamentos mais novos; por segurança, este extrato antigo não substituirá o saldo atual.' : 'O saldo do extrato está negativo e não pode ser conciliado nesta versão.' }}</span></span></label>

          <section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"><div class="flex items-center justify-between gap-3 bg-slate-50 px-3 py-3 dark:bg-slate-950 sm:px-4"><div><h3 class="text-sm font-black">Prévia dos lançamentos</h3><p class="text-[11px] text-slate-500">Toque para incluir ou retirar</p></div><button type="button" class="shrink-0 text-xs font-black text-sky-600" @click="selectNewRows">Selecionar novos</button></div><div class="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto overscroll-contain dark:divide-slate-800"><label v-for="(item, index) in statement.transactions" :key="`${item.date}-${index}`" class="flex min-w-0 items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4" :class="duplicates[index] || item.isInternalTransfer ? 'opacity-55' : ''"><input v-model="selected[index]" type="checkbox" class="size-4 shrink-0 accent-emerald-600" :disabled="duplicates[index] || item.isInternalTransfer" /><span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ item.description }}</strong><span class="mt-0.5 block truncate text-[11px] text-slate-500 sm:text-xs">{{ moment(item.date, item.occurredAt) }} · {{ movementLabel(item.movementType) }}<template v-if="!item.isInternalTransfer"> · {{ categoryNameFor(item) }}</template><template v-if="item.isInternalTransfer"> · Transferência interna</template><template v-if="duplicates[index]"> · Já está no Pingo</template></span><span v-if="!item.isInternalTransfer && !duplicates[index]" class="mt-1 block truncate text-[10px] font-black text-sky-700 dark:text-sky-300">{{ importRecommendation(item) }}</span></span><strong class="max-w-[38%] shrink-0 truncate text-right text-xs tabular-nums sm:text-sm" :title="money(item.amount)" :class="item.isInternalTransfer ? 'text-violet-600' : item.kind === 'income' ? 'text-emerald-600' : 'text-rose-600'">{{ item.kind === 'income' ? '+' : '-' }}{{ money(item.amount) }}</strong></label></div></section>

          <div v-if="duplicateCount" class="mt-3 flex gap-2 text-xs text-slate-500"><CheckCircle2 :size="16" class="shrink-0 text-emerald-600" /><p>Duplicatas são comparadas por data, tipo, valor e descrição e ficam fora da importação.</p></div>
        </template>
        </div>
        <footer v-if="statement" class="shrink-0 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6 sm:pb-5"><button :disabled="busy || !canImport" class="w-full rounded-2xl bg-sky-600 py-3.5 font-black text-white shadow-lg shadow-sky-600/15 disabled:opacity-40">{{ busy ? 'Importando…' : `Importar ${selectedCount} lançamento${selectedCount === 1 ? '' : 's'}` }}</button></footer>
      </form>
    </div>
  </Teleport>
  <AddDebitCardModal v-if="showCardCreator" elevated :existing-cards-count="cards.length" :busy="cardSaving" :save-error="cardSaveError" @close="showCardCreator = false" @save="createCard" />
</template>
