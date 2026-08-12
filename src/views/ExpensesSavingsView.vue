<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CalendarClock, ChartPie, Flame, PiggyBank, Plus, ReceiptText, ShieldCheck,
  Sparkles, Target, TrendingDown, Wallet,
} from 'lucide-vue-next'
import AddTransactionModal from '../components/AddTransactionModal.vue'
import TransactionList from '../components/TransactionList.vue'
import { centsToDecimal, decimalToCents, useFinanceStore } from '../stores/financeStore'
import type { NewRecurringRuleInput, NewTransactionInput, Transaction } from '../types/finance'

const store = useFinanceStore()
const showModal = ref(false)
const editingTransaction = ref<Transaction | null>(null)

function money(value: bigint) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(centsToDecimal(value)))
}
function privateMoney(value: bigint) { return store.balanceHidden ? 'R$ •••••' : money(value) }
function isCurrentMonth(transaction: Transaction) {
  const now = new Date()
  const date = new Date(`${transaction.date}T12:00:00`)
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

const safeSavingsCents = computed(() => store.currentMonthSavingsCents > 0n ? store.currentMonthSavingsCents : 0n)
const deficitCents = computed(() => store.currentMonthSavingsCents < 0n ? -store.currentMonthSavingsCents : 0n)
const savingTargetCents = computed(() => store.currentMonthIncomeCents / 5n)
const remainingTargetCents = computed(() => {
  const remaining = savingTargetCents.value - safeSavingsCents.value
  return remaining > 0n ? remaining : 0n
})
const savingsProgress = computed(() => savingTargetCents.value > 0n
  ? Math.min(100, Number((safeSavingsCents.value * 10_000n) / savingTargetCents.value) / 100)
  : 0)
const currentExpenses = computed(() => store.transactions
  .filter((transaction) => transaction.kind === 'expense' && isCurrentMonth(transaction))
  .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)))
const expenseRules = computed(() => store.recurringRules
  .filter((rule) => rule.active && rule.kind === 'expense')
  .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)))
const categoryRows = computed(() => [...store.currentMonthExpensesByCategory.entries()]
  .sort((a, b) => Number(b[1] - a[1]))
  .map(([id, amount]) => ({
    id,
    amount,
    category: store.categories.find((category) => category.id === id),
    percentage: store.currentMonthExpensePercentages.get(id) ?? 0,
  })))
const pingoRadarMessage = computed(() => {
  if (store.currentMonthIncomeCents === 0n && store.currentMonthExpenseCents === 0n) {
    return 'Está quieto demais por aqui… ou você virou monge, ou esqueceu de registrar os gastos. 👀'
  }
  if (deficitCents.value > 0n) {
    return `Alerta porquinho: os gastos passaram das entradas em ${privateMoney(deficitCents.value)}. A carteira está pedindo um intervalo. 🫠`
  }
  if (store.savingsRate >= 20) return 'Você guardou 20% ou mais. O porquinho está ficando forte e já quer foto de academia. 🐷💪'
  if (store.savingsRate >= 10) return 'Tem economia acontecendo! Mais um esforço e o porquinho sai do modo “quase lá”. 😅'
  return 'O dinheiro está escorrendo pelos cantos. Vamos fechar uma torneira antes que vire cachoeira? 🚰'
})

async function save(input: NewTransactionInput) {
  try {
    if (editingTransaction.value) await store.editTransaction({ id: editingTransaction.value.id, ...input })
    else await store.createTransaction(input)
    showModal.value = false
    editingTransaction.value = null
  } catch (cause) { window.alert(cause instanceof Error ? cause.message : 'Não foi possível salvar.') }
}
async function saveRecurring(input: NewRecurringRuleInput) {
  try {
    await store.createRecurringRule(input)
    showModal.value = false
  } catch (cause) { window.alert(cause instanceof Error ? cause.message : 'Não foi possível ligar o Piloto Mensal.') }
}
function edit(transaction: Transaction) { editingTransaction.value = transaction; showModal.value = true }
function dueDate(value: string) { return value.split('-').reverse().join('/') }
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
    <section class="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-rose-950 to-orange-700 p-6 text-white shadow-2xl sm:p-8">
      <div class="absolute -right-12 -top-16 size-48 rounded-full bg-amber-300/20 blur-2xl"></div>
      <div class="absolute -bottom-20 left-1/3 size-48 rounded-full bg-rose-300/15 blur-2xl"></div>
      <div class="relative flex items-start justify-between gap-4">
        <div>
          <p class="flex items-center gap-2 text-sm font-black text-amber-300"><ChartPie :size="17" /> Radar do Pingo</p>
          <h2 class="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Gastos & economias</h2>
          <p class="mt-2 max-w-xl text-sm text-orange-100/75">Um lugar só para descobrir para onde o dinheiro foi e quanto conseguiu ficar.</p>
        </div>
        <button class="hidden shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 sm:flex" @click="showModal = true"><Plus :size="18" /> Registrar</button>
      </div>
      <div class="relative mt-6 flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
        <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-300 font-black text-slate-950">P</div>
        <div><p class="text-xs font-black uppercase tracking-wider text-amber-300"><Sparkles :size="13" class="mr-1 inline" /> Pingo analisou</p><p class="mt-1 text-sm font-semibold leading-relaxed">{{ pingoRadarMessage }}</p></div>
      </div>
    </section>

    <section class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article class="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/25"><div class="flex items-center gap-2 text-xs font-black text-rose-600"><Flame :size="15" /> Gastou no mês</div><p class="mt-2 text-xl font-black">{{ privateMoney(store.currentMonthExpenseCents) }}</p></article>
      <article class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/25"><div class="flex items-center gap-2 text-xs font-black text-emerald-600"><ShieldCheck :size="15" /> Economizou</div><p class="mt-2 text-xl font-black">{{ privateMoney(safeSavingsCents) }}</p></article>
      <article class="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/25"><div class="flex items-center gap-2 text-xs font-black text-amber-700"><PiggyBank :size="15" /> Nos porquinhos</div><p class="mt-2 text-xl font-black">{{ privateMoney(store.vaultTotalCents) }}</p></article>
      <article class="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/25"><div class="flex items-center gap-2 text-xs font-black text-violet-600"><TrendingDown :size="15" /> Média diária</div><p class="mt-2 text-xl font-black">{{ privateMoney(store.dailySpendingAverageCents) }}</p></article>
    </section>

    <section class="mt-5 overflow-hidden rounded-[1.75rem] border border-emerald-200 bg-white shadow-card dark:border-emerald-900 dark:bg-slate-900">
      <div class="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div>
          <p class="flex items-center gap-2 text-sm font-black text-emerald-600"><Target :size="17" /> Missão: guardar 20%</p>
          <h3 class="mt-1 text-2xl font-black">{{ savingsProgress.toFixed(0) }}% da missão concluída</h3>
          <p v-if="savingTargetCents > 0n" class="mt-1 text-sm text-slate-500">Meta {{ privateMoney(savingTargetCents) }} · faltam {{ privateMoney(remainingTargetCents) }}</p>
          <p v-else class="mt-1 text-sm text-slate-500">Registre uma entrada para o Pingo calcular a meta do mês.</p>
        </div>
        <div class="grid size-20 place-items-center rounded-[1.5rem] bg-emerald-100 text-3xl dark:bg-emerald-950">🐷</div>
      </div>
      <div class="h-3 bg-emerald-100 dark:bg-emerald-950"><div class="h-full rounded-r-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all" :style="{ width: `${savingsProgress}%` }"></div></div>
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
      <TransactionList :transactions="currentExpenses.slice(0, 8)" :categories="store.categories" :cards="store.debitCards" @edit="edit" />
    </section>
  </main>

  <button class="fixed bottom-28 right-4 z-30 grid size-14 place-items-center rounded-2xl bg-rose-500 text-white shadow-xl sm:hidden" aria-label="Registrar despesa" @click="showModal = true"><Plus :size="25" /></button>
  <AddTransactionModal v-if="showModal" :categories="store.categories" :cards="store.debitCards" :transaction="editingTransaction" @close="showModal = false; editingTransaction = null" @save="save" @save-recurring="saveRecurring" />
</template>
