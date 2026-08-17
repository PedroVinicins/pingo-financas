<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CalendarClock, ChartPie, Flame, PiggyBank, Plus, ReceiptText, ShieldCheck,
  Sparkles, Target, TrendingDown, Wallet,
} from 'lucide-vue-next'
import AddTransactionModal from '../components/AddTransactionModal.vue'
import TransactionList from '../components/TransactionList.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { centsToDecimal, decimalToCents, useFinanceStore } from '../stores/financeStore'
import type { NewRecurringRuleInput, NewTransactionInput, Transaction } from '../types/finance'

const store = useFinanceStore()
const showModal = ref(false)
const editingTransaction = ref<Transaction | null>(null)
const deletingTransaction = ref<Transaction | null>(null)
const deleting = ref(false)

function money(value: bigint) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(centsToDecimal(value)))
}
function privateMoney(value: bigint) { return store.balanceHidden ? 'R$ •••••' : money(value) }
const safeSavingsCents = computed(() => store.reportingBalanceCents > 0n ? store.reportingBalanceCents : 0n)
const deficitCents = computed(() => store.reportingBalanceCents < 0n ? -store.reportingBalanceCents : 0n)
const savingTargetCents = computed(() => store.reportingIncomeCents / 5n)
const remainingTargetCents = computed(() => {
  const remaining = savingTargetCents.value - safeSavingsCents.value
  return remaining > 0n ? remaining : 0n
})
const savingsProgress = computed(() => savingTargetCents.value > 0n
  ? Math.min(100, Number((safeSavingsCents.value * 10_000n) / savingTargetCents.value) / 100)
  : 0)
const currentExpenses = computed(() => store.reportingTransactions.filter((transaction) => transaction.kind === 'expense'))
const expenseRules = computed(() => store.recurringRules
  .filter((rule) => rule.active && rule.kind === 'expense')
  .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)))
const categoryRows = computed(() => {
  const totals = new Map<string, bigint>()
  for (const transaction of currentExpenses.value) {
    if (transaction.categoryId) totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0n) + decimalToCents(transaction.amount))
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0n)
  return [...totals.entries()].sort((a, b) => Number(b[1] - a[1])).map(([id, amount]) => ({
    id,
    amount,
    category: store.categories.find((category) => category.id === id),
    percentage: total > 0n ? Number((amount * 10_000n) / total) / 100 : 0,
  }))
})
const pingoRadarMessage = computed(() => {
  if (store.reportingIncomeCents === 0n && store.reportingExpenseCents === 0n) {
    return 'Está quieto demais por aqui… ou você virou monge, ou esqueceu de registrar os gastos. 👀'
  }
  if (deficitCents.value > 0n) {
    return `Alerta porquinho: os gastos passaram das entradas em ${privateMoney(deficitCents.value)}. A carteira está pedindo um intervalo. 🫠`
  }
  const rate = store.reportingIncomeCents > 0n ? Number((safeSavingsCents.value * 10_000n) / store.reportingIncomeCents) / 100 : 0
  if (rate >= 20) return 'Você guardou 20% ou mais. O porquinho está ficando forte e já quer foto de academia. 🐷💪'
  if (rate >= 10) return 'Tem economia acontecendo! Mais um esforço e o porquinho sai do modo “quase lá”. 😅'
  return 'O dinheiro está escorrendo pelos cantos. Vamos fechar uma torneira antes que vire cachoeira? 🚰'
})

async function save(input: NewTransactionInput) {
  try {
    if (editingTransaction.value) await store.editTransaction({ id: editingTransaction.value.id, ...input })
    else await store.createTransaction(input)
    showModal.value = false
    editingTransaction.value = null
  } catch (cause) { store.reportError(cause, 'Não foi possível salvar.') }
}
async function saveRecurring(input: NewRecurringRuleInput) {
  try {
    await store.createRecurringRule(input)
    showModal.value = false
  } catch (cause) { store.reportError(cause, 'Não foi possível ligar o Piloto Mensal.') }
}
function edit(transaction: Transaction) { editingTransaction.value = transaction; showModal.value = true }
async function confirmDelete() {
  if (!deletingTransaction.value) return
  deleting.value = true
  try {
    await store.deleteTransaction(deletingTransaction.value.id)
    showModal.value = false
    editingTransaction.value = null
    deletingTransaction.value = null
    store.showFeedback('Despesa excluída e indicadores atualizados.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível excluir a transação.') }
  finally { deleting.value = false }
}
function dueDate(value: string) { return value.split('-').reverse().join('/') }
</script>

<template>
  <main class="mx-auto max-w-[1440px] px-5 pb-8 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-7 sm:py-8 lg:px-10">
    <section class="relative overflow-hidden rounded-[2rem] bg-hero p-6 text-white shadow-float sm:p-8">
      <div class="absolute right-0 top-0 size-52 rounded-full bg-brand/15 blur-3xl"></div>
      <div class="relative flex items-start justify-between gap-4">
        <div>
          <p class="flex items-center gap-2 text-sm font-bold text-violet-300"><ChartPie :size="17" /> Análises</p>
          <h2 class="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Gastos & economias</h2>
          <p class="mt-2 max-w-xl text-sm text-white/55">Descubra para onde o dinheiro foi e quanto conseguiu ficar.</p>
        </div>
        <button class="hidden shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 sm:flex" @click="showModal = true"><Plus :size="18" /> Registrar</button>
      </div>
      <div class="relative mt-6 flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
        <img src="/pingo-icon.svg" alt="" class="size-11 shrink-0 rounded-2xl" />
        <div><p class="text-xs font-bold uppercase tracking-wider text-violet-300"><Sparkles :size="13" class="mr-1 inline" /> Pingo analisou</p><p class="mt-1 text-sm font-semibold leading-relaxed">{{ pingoRadarMessage }}</p></div>
      </div>
    </section>

    <section class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article class="pingo-card p-4"><div class="flex items-center gap-2 text-xs font-bold text-brand"><Flame :size="15" /> Gastou no período</div><p class="mt-2 truncate text-xl font-extrabold">{{ privateMoney(store.reportingExpenseCents) }}</p></article>
      <article class="pingo-card p-4"><div class="flex items-center gap-2 text-xs font-bold text-brand"><ShieldCheck :size="15" /> Economizou</div><p class="mt-2 truncate text-xl font-extrabold">{{ privateMoney(safeSavingsCents) }}</p></article>
      <article class="pingo-card p-4"><div class="flex items-center gap-2 text-xs font-bold text-brand"><PiggyBank :size="15" /> Nos porquinhos</div><p class="mt-2 truncate text-xl font-extrabold">{{ privateMoney(store.vaultTotalCents) }}</p></article>
      <article class="pingo-card p-4"><div class="flex items-center gap-2 text-xs font-bold text-brand"><TrendingDown :size="15" /> Média diária</div><p class="mt-2 truncate text-xl font-extrabold">{{ privateMoney(store.dailySpendingAverageCents) }}</p></article>
    </section>

    <section class="mt-5 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-card">
      <div class="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div>
          <p class="flex items-center gap-2 text-sm font-bold text-brand"><Target :size="17" /> Missão: guardar 20%</p>
          <h3 class="mt-1 text-2xl font-black">{{ savingsProgress.toFixed(0) }}% da missão concluída</h3>
          <p v-if="savingTargetCents > 0n" class="mt-1 text-sm text-slate-500">Meta {{ privateMoney(savingTargetCents) }} · faltam {{ privateMoney(remainingTargetCents) }}</p>
          <p v-else class="mt-1 text-sm text-slate-500">Registre uma entrada para o Pingo calcular a meta do mês.</p>
        </div>
        <div class="grid size-20 place-items-center rounded-[1.5rem] bg-brand-soft text-3xl">🐷</div>
      </div>
      <div class="h-3 bg-muted"><div class="h-full rounded-r-full bg-brand transition-all" :style="{ width: `${savingsProgress}%` }"></div></div>
    </section>

    <div class="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold text-rose-600">Raio-X das despesas</p><h3 class="text-xl font-black">Para onde foi cada pingo?</h3></div><div class="grid size-11 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950"><ChartPie :size="21" /></div></div>
        <div v-if="categoryRows.length" class="mt-5 grid gap-4">
          <div v-for="row in categoryRows" :key="row.id">
            <div class="mb-1.5 flex items-center justify-between gap-3 text-sm"><span class="truncate font-bold">{{ row.category?.name ?? 'Sem categoria' }}</span><span class="shrink-0 font-black">{{ privateMoney(row.amount) }} · {{ row.percentage.toFixed(0) }}%</span></div>
            <div class="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full" :style="{ width: `${row.percentage}%`, backgroundColor: row.category?.color ?? '#F43F5E' }"></div></div>
          </div>
        </div>
        <div v-else class="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Nenhuma despesa no mês. O Pingo vai aproveitar esse raro momento de silêncio. 😌</div>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div><p class="text-sm font-bold text-violet-600">Piloto Mensal</p><h3 class="text-xl font-black">Contas no radar</h3></div>
        <div v-if="expenseRules.length" class="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          <div v-for="rule in expenseRules" :key="rule.id" class="flex items-center gap-3 py-3"><div class="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950"><CalendarClock :size="17" /></div><div class="min-w-0 flex-1"><p class="truncate text-sm font-black">{{ rule.description }}</p><p class="text-xs text-slate-500">{{ dueDate(rule.nextDueDate) }}</p></div><strong class="text-sm">{{ privateMoney(decimalToCents(rule.amount)) }}</strong></div>
        </div>
        <div v-else class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950">Nenhuma conta recorrente. Suspeito… mas gostei. 👀</div>
        <div class="mt-4 rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/30"><div class="flex items-center gap-2 text-xs font-black text-violet-600"><Wallet :size="15" /> Compromisso previsto</div><p class="mt-2 text-xl font-black">{{ privateMoney(store.fixedMonthlyCommitmentCents) }}</p></div>
      </section>
    </div>

    <section class="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div class="mb-2 flex items-start justify-between gap-3"><div><p class="text-sm font-bold text-slate-500">Só despesas</p><h3 class="text-xl font-black">Gastos recentes do mês</h3></div><div class="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800"><ReceiptText :size="20" /></div></div>
      <TransactionList :transactions="currentExpenses.slice(0, 8)" :categories="store.categories" :cards="store.debitCards" editable @edit="edit" />
    </section>
  </main>

  <button class="fixed bottom-28 right-4 z-30 grid size-14 place-items-center rounded-2xl bg-rose-500 text-white shadow-xl sm:hidden" aria-label="Registrar despesa" @click="showModal = true"><Plus :size="25" /></button>
  <AddTransactionModal v-if="showModal" :categories="store.categories" :cards="store.debitCards" :transaction="editingTransaction" @close="showModal = false; editingTransaction = null" @save="save" @save-recurring="saveRecurring" @delete="deletingTransaction = $event" />
  <ConfirmDialog v-if="deletingTransaction" title="Excluir transação?" :message="`“${deletingTransaction.description}” será removida e os indicadores do mês serão recalculados.`" confirm-label="Excluir transação" :busy="deleting" @cancel="deletingTransaction = null" @confirm="confirmDelete" />
</template>
