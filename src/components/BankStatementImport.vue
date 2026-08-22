<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertCircle, CheckCircle2, CreditCard, FileSpreadsheet, FileUp, Landmark, X } from 'lucide-vue-next'
import type {
  BankPaymentMethod, BankStatementImportInput, Category, DebitCard, ParsedBankStatement, Transaction,
} from '../types/finance'
import {
  duplicateStatementRows, parseBankStatementFile, statementFormatLabel,
} from '../services/bankStatement'
import { useFinanceStore } from '../stores/financeStore'
import { formatCurrencyValue } from '../services/currency'

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

const expenseCategories = computed(() => props.categories.filter((item) => item.kind === 'expense'))
const incomeCategories = computed(() => props.categories.filter((item) => item.kind === 'income'))
const selectedCount = computed(() => selected.value.filter(Boolean).length)
const duplicateCount = computed(() => duplicates.value.filter(Boolean).length)
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
function paymentLabel(method: BankPaymentMethod) {
  return ({ pix: 'PIX', debit: 'Débito', credit: 'Crédito', card: 'Cartão', unknown: 'Meio não identificado' })[method]
}
function chooseDefaults() {
  expenseCategoryId.value = expenseCategories.value.find((item) => item.name === 'Compras')?.id
    ?? expenseCategories.value[0]?.id ?? ''
  incomeCategoryId.value = incomeCategories.value.find((item) => item.name === 'Outras entradas')?.id
    ?? incomeCategories.value[0]?.id ?? ''
  suggestedCardId.value = props.cards.find((item) => item.isDefault && !item.isFrozen)?.id ?? ''
}
async function loadFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  parsing.value = true
  error.value = ''
  statement.value = null
  try {
    const parsed = await parseBankStatementFile(file)
    statement.value = parsed
    duplicates.value = duplicateStatementRows(parsed.transactions, props.transactions)
    selected.value = duplicates.value.map((duplicate) => !duplicate)
    const newestDate = parsed.transactions.reduce((latest, item) => item.date > latest ? item.date : latest, '')
    reconcileBalance.value = parsed.closingBalance !== null && Number(parsed.closingBalance) >= 0
      && !props.transactions.some((item) => item.date > newestDate)
    chooseDefaults()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível ler este extrato.'
  } finally { parsing.value = false }
}
function submit() {
  if (!statement.value || !canImport.value) return
  emit('import', {
    transactions: statement.value.transactions.flatMap((item, index) => selected.value[index] ? [{
      kind: item.kind,
      amount: item.amount,
      date: item.date,
      occurredAt: item.occurredAt,
      categoryId: item.kind === 'expense' ? expenseCategoryId.value : incomeCategoryId.value,
      debitCardId: item.kind === 'expense' && item.suggestedCardLink ? suggestedCardId.value || null : null,
      description: item.description,
      recurrence: 'variable' as const,
    }] : []),
    closingBalance: reconcileBalance.value && canReconcile.value ? statement.value.closingBalance : null,
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[100] flex items-end bg-slate-950/65 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" @click.self="!busy && emit('close')">
      <form class="max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-3xl sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
        <div class="flex items-start gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950"><FileSpreadsheet :size="22" /></div><div class="min-w-0 flex-1"><p class="text-sm font-bold text-sky-600">Conferência bancária</p><h2 class="text-xl font-black">Importar extrato</h2><p class="mt-1 text-xs leading-relaxed text-slate-500">CSV, OFX e PDF com texto. A leitura acontece neste dispositivo.</p></div><button type="button" :disabled="busy" class="grid size-10 place-items-center rounded-xl bg-slate-100 disabled:opacity-40 dark:bg-slate-800" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button></div>

        <label class="mt-5 grid min-h-32 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/60 p-5 text-center dark:border-sky-900 dark:bg-sky-950/20"><span><FileUp class="mx-auto text-sky-600" :size="30" /><strong class="mt-2 block">{{ parsing ? 'Lendo extrato…' : statement ? 'Escolher outro arquivo' : 'Escolher extrato do banco' }}</strong><span class="mt-1 block text-xs text-slate-500">.csv, .txt, .ofx ou .pdf · até 12 MB</span></span><input type="file" class="sr-only" accept=".csv,.txt,.ofx,.pdf,text/csv,text/plain,application/pdf" :disabled="parsing || busy" @change="loadFile" /></label>

        <p v-if="error" class="mt-4 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"><AlertCircle :size="18" class="shrink-0" /> {{ error }}</p>

        <template v-if="statement">
          <div class="mt-4 grid grid-cols-3 gap-2"><div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[10px] font-black uppercase text-slate-400">Formato</p><p class="mt-1 text-sm font-black">{{ statementFormatLabel(statement.format) }}</p></div><div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[10px] font-black uppercase text-slate-400">Novos</p><p class="mt-1 text-sm font-black text-emerald-600">{{ selectedCount }}</p></div><div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[10px] font-black uppercase text-slate-400">Já existem</p><p class="mt-1 text-sm font-black">{{ duplicateCount }}</p></div></div>

          <p v-for="warning in statement.warnings" :key="warning" class="mt-3 text-xs font-bold text-amber-600">{{ warning }}</p>

          <section class="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><h3 class="text-sm font-black">Como classificar</h3><div class="mt-3 grid gap-3 sm:grid-cols-2"><label v-if="statement.transactions.some((item) => item.kind === 'expense')" class="grid gap-1 text-xs font-bold">Categoria das saídas<select v-model="expenseCategoryId" class="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"><option v-for="category in expenseCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label v-if="statement.transactions.some((item) => item.kind === 'income')" class="grid gap-1 text-xs font-bold">Categoria das entradas<select v-model="incomeCategoryId" class="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"><option v-for="category in incomeCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label></div></section>

          <section v-if="hasCardSuggestions" class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/25">
            <div class="flex items-start gap-3"><CreditCard :size="20" class="mt-0.5 shrink-0 text-amber-700" /><div class="min-w-0 flex-1"><h3 class="text-sm font-black">O extrato parece conter compras no cartão</h3><p class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Vincule essas compras a um cartão existente. Se ele ainda não existe, importe sem vínculo e cadastre-o depois em Carteira.</p></div></div>
            <label v-if="cards.length" class="mt-3 grid gap-1 text-xs font-bold">Cartão sugerido<select v-model="suggestedCardId" class="h-11 rounded-xl border border-amber-200 bg-white px-3 text-sm dark:border-amber-800 dark:bg-slate-900"><option value="">Importar sem vínculo</option><option v-for="card in cards" :key="card.id" :value="card.id" :disabled="card.isFrozen">{{ card.name }} · •••• {{ card.lastFour }}{{ card.isFrozen ? ' (congelado)' : '' }}</option></select></label>
            <p v-else class="mt-3 rounded-xl bg-white/70 p-3 text-xs font-bold text-amber-800 dark:bg-slate-900/50 dark:text-amber-300">Nenhum cartão cadastrado. Vá em Carteira → Novo cartão após a importação.</p>
          </section>

          <label v-if="statement.closingBalance !== null" class="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border p-4" :class="canReconcile ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/25' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/25'"><input v-model="reconcileBalance" type="checkbox" class="mt-1 size-4 accent-emerald-600" :disabled="!canReconcile" /><Landmark :size="19" class="mt-0.5 shrink-0" /><span><strong class="block text-sm">Ajustar saldo da carteira para {{ money(statement.closingBalance) }}</strong><span class="mt-1 block text-xs text-slate-500">{{ canReconcile ? `Usa o saldo mais recente informado pelo banco em ${date(statementDate)}.` : hasNewerTransactions ? 'O Pingo já possui lançamentos mais novos; por segurança, este extrato antigo não substituirá o saldo atual.' : 'O saldo do extrato está negativo e não pode ser conciliado nesta versão.' }}</span></span></label>

          <section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"><div class="flex items-center justify-between bg-slate-50 px-4 py-3 dark:bg-slate-950"><h3 class="text-sm font-black">Prévia dos lançamentos</h3><button type="button" class="text-xs font-black text-sky-600" @click="selected = duplicates.map((duplicate) => !duplicate)">Selecionar novos</button></div><div class="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800"><label v-for="(item, index) in statement.transactions" :key="`${item.date}-${index}`" class="flex items-center gap-3 px-4 py-3" :class="duplicates[index] ? 'opacity-55' : ''"><input v-model="selected[index]" type="checkbox" class="size-4 accent-emerald-600" :disabled="duplicates[index]" /><span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ item.description }}</strong><span class="mt-0.5 block truncate text-xs text-slate-500">{{ moment(item.date, item.occurredAt) }} · {{ paymentLabel(item.paymentMethod) }}<template v-if="item.suggestedCardLink"> · Vincular cartão</template><template v-if="duplicates[index]"> · Já está no Pingo</template></span></span><strong class="max-w-[35%] shrink truncate text-right text-sm tabular-nums" :title="money(item.amount)" :class="item.kind === 'income' ? 'text-emerald-600' : 'text-rose-600'">{{ item.kind === 'income' ? '+' : '-' }}{{ money(item.amount) }}</strong></label></div></section>

          <div v-if="duplicateCount" class="mt-3 flex gap-2 text-xs text-slate-500"><CheckCircle2 :size="16" class="shrink-0 text-emerald-600" /><p>Duplicatas são comparadas por data, tipo, valor e descrição e ficam fora da importação.</p></div>
          <button :disabled="busy || !canImport" class="mt-5 w-full rounded-2xl bg-sky-600 py-3.5 font-black text-white disabled:opacity-40">{{ busy ? 'Importando…' : `Importar ${selectedCount} lançamento${selectedCount === 1 ? '' : 's'}` }}</button>
        </template>
      </form>
    </div>
  </Teleport>
</template>
