<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CalendarClock, Eye, EyeOff, Gauge, Landmark, Pencil, PiggyBank, Plus,
  ShieldCheck, Sparkles, TrendingDown,
} from 'lucide-vue-next'
import { useFinanceStore, centsToDecimal } from '../stores/financeStore'
import type { NewRecurringRuleInput, NewTransactionInput, Transaction } from '../types/finance'
import SummaryCard from '../components/SummaryCard.vue'
import TransactionList from '../components/TransactionList.vue'
import AddTransactionModal from '../components/AddTransactionModal.vue'
import EditBalanceModal from '../components/EditBalanceModal.vue'
import RecurringSection from '../components/RecurringSection.vue'

const store = useFinanceStore()
const showModal = ref(false)
const showBalanceEditor = ref(false)
const editingTransaction = ref<Transaction | null>(null)
const showAllHistory = ref(false)

function money(value: bigint) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centsToDecimal(value)))
}
function privateMoney(value: bigint) { return store.balanceHidden ? 'R$ •••••' : money(value) }
const monthBalance = computed(() => privateMoney(store.currentMonthBalanceCents))
const dailyBudget = computed(() => privateMoney(store.dailyBudgetCents))
const projectedExpenses = computed(() => privateMoney(store.projectedMonthExpenseCents))
const dailyAverage = computed(() => privateMoney(store.dailySpendingAverageCents))
const scoreLabel = computed(() => {
  if (store.financialHealthScore >= 80) return 'Excelente'
  if (store.financialHealthScore >= 60) return 'Boa'
  if (store.financialHealthScore >= 40) return 'Em atenção'
  return 'Precisa de cuidado'
})
const categoryRows = computed(() => [...store.currentMonthExpensesByCategory.entries()]
  .sort((a, b) => Number(b[1] - a[1]))
  .slice(0, 5)
  .map(([id, amount]) => ({
    id,
    amount,
    category: store.categories.find((item) => item.id === id),
    percentage: store.currentMonthExpensePercentages.get(id) ?? 0,
  })))
const historyTransactions = computed(() => showAllHistory.value ? store.filteredTransactions : store.recentTransactions)

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
function editBalance(amount: string) { store.setAvailableBalance(amount); showBalanceEditor.value = false }
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
    <section class="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-700 p-6 text-white shadow-2xl sm:p-8">
      <div class="absolute -right-14 -top-16 size-52 rounded-full bg-emerald-300/15 blur-2xl"></div><div class="absolute -bottom-20 left-1/3 size-44 rounded-full bg-lime-300/10 blur-2xl"></div>
      <div class="relative flex items-start justify-between gap-3"><div class="grid size-12 place-items-center rounded-[1.1rem] bg-emerald-300 text-xl font-black text-emerald-950 shadow-lg">P</div><button class="grid size-11 place-items-center rounded-2xl bg-white/10 text-white hover:bg-white/20" :aria-label="store.balanceHidden ? 'Mostrar saldos' : 'Esconder saldos'" @click="store.toggleBalanceVisibility"><Eye v-if="store.balanceHidden" :size="20" /><EyeOff v-else :size="20" /></button></div>
      <div class="relative mt-7"><p class="text-sm font-bold text-emerald-200">Patrimônio total</p><h2 class="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{{ privateMoney(store.balanceCents) }}</h2><p class="mt-2 max-w-lg text-sm text-emerald-100/75">Conta principal + todos os porquinhos. Transferir entre eles não altera este total.</p></div>
      <div class="relative mt-6 grid grid-cols-2 gap-3"><div class="rounded-2xl bg-white/10 p-4 backdrop-blur"><div class="flex items-center gap-2 text-xs font-bold text-emerald-100/70"><Landmark :size="15" /> Na conta</div><p class="mt-2 text-lg font-black sm:text-xl">{{ privateMoney(store.availableBalanceCents) }}</p></div><div class="rounded-2xl bg-white/10 p-4 backdrop-blur"><div class="flex items-center gap-2 text-xs font-bold text-emerald-100/70"><PiggyBank :size="15" /> Guardado</div><p class="mt-2 text-lg font-black sm:text-xl">{{ privateMoney(store.vaultTotalCents) }}</p></div></div>
      <div class="relative mt-4 grid gap-2 sm:flex"><button class="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 font-black text-emerald-950 hover:bg-emerald-200" @click="showModal = true"><Plus :size="19" /> Adicionar transação</button><button class="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black hover:bg-white/20" @click="showBalanceEditor = true"><Pencil :size="17" /> Editar saldo</button></div>
    </section>

    <section class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard label="Balanço do mês" :value="monthBalance" hint="Entradas menos gastos" />
      <SummaryCard label="Média por dia" :value="dailyAverage" hint="Como o dinheiro está indo" />
      <SummaryCard label="Projeção do mês" :value="projectedExpenses" hint="Se mantiver este ritmo" />
      <SummaryCard label="Transações" :value="String(store.transactions.length)" :hint="`${store.recurringRules.length} recorrência(s)`" />
    </section>

    <RecurringSection />

    <section class="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div class="flex items-start justify-between gap-4"><div><p class="text-sm font-bold text-emerald-600">Inteligência financeira</p><h3 class="text-xl font-black">Para onde o dinheiro está indo?</h3></div><div class="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Gauge :size="23" /></div></div>
      <div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div class="flex items-center gap-2 text-xs font-bold text-slate-400"><ShieldCheck :size="15" /> Saúde financeira</div><p class="mt-2 text-2xl font-black">{{ store.financialHealthScore }}<span class="text-sm text-slate-400">/100</span></p><p class="mt-1 text-xs font-bold text-emerald-600">{{ scoreLabel }}</p></div><div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div class="flex items-center gap-2 text-xs font-bold text-slate-400"><CalendarClock :size="15" /> Pode gastar por dia</div><p class="mt-2 text-xl font-black">{{ dailyBudget }}</p><p class="mt-1 text-xs text-slate-500">Sem tocar nos cofres</p></div><div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div class="flex items-center gap-2 text-xs font-bold text-slate-400"><TrendingDown :size="15" /> Maior ralo do mês</div><p class="mt-2 truncate text-lg font-black">{{ store.topExpenseCategory.category?.name ?? 'Sem gastos' }}</p><p class="mt-1 text-xs text-slate-500">{{ store.topExpenseCategory.percentage.toFixed(1) }}% das despesas</p></div><div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div class="flex items-center gap-2 text-xs font-bold text-slate-400"><Sparkles :size="15" /> Assinaturas e fixos</div><p class="mt-2 text-xl font-black">{{ privateMoney(store.fixedMonthlyCommitmentCents) }}</p><p class="mt-1 text-xs text-slate-500">Compromisso mensal previsto</p></div></div>
      <div v-if="categoryRows.length" class="mt-5 grid gap-3"><div v-for="row in categoryRows" :key="row.id"><div class="mb-1.5 flex items-center justify-between gap-3 text-sm"><span class="truncate font-bold">{{ row.category?.name ?? 'Sem categoria' }}</span><span class="shrink-0 font-black">{{ privateMoney(row.amount) }} · {{ row.percentage.toFixed(0) }}%</span></div><div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full" :style="{ width: `${row.percentage}%`, backgroundColor: row.category?.color ?? '#10B981' }"></div></div></div></div>
      <div class="mt-5 grid gap-3 sm:grid-cols-2"><div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div class="flex items-center justify-between text-sm font-bold"><span>Taxa de economia</span><span :class="store.savingsRate >= 20 ? 'text-emerald-600' : 'text-amber-600'">{{ store.savingsRate.toFixed(1) }}%</span></div><p class="mt-1 text-xs text-slate-500">Meta inicial: guardar pelo menos 20% das entradas.</p></div><div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div class="flex items-center justify-between text-sm font-bold"><span>Gastos fixos já pagos</span><span :class="store.fixedCostRatio <= 50 ? 'text-emerald-600' : 'text-rose-600'">{{ store.fixedCostRatio.toFixed(1) }}%</span></div><p class="mt-1 text-xs text-slate-500">Percentual da renda consumido por despesas fixas.</p></div></div>
    </section>

    <section class="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div class="mb-2 flex items-center justify-between gap-3"><div><p class="text-sm font-medium text-slate-500">Histórico editável</p><h3 class="text-xl font-black">{{ showAllHistory ? 'Todas as transações' : 'Transações recentes' }}</h3></div><button class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black dark:border-slate-700" @click="showAllHistory = !showAllHistory">{{ showAllHistory ? 'Mostrar recentes' : 'Ver histórico completo' }}</button></div><TransactionList :transactions="historyTransactions" :categories="store.categories" :cards="store.debitCards" @edit="edit" /></section>
  </main>

  <AddTransactionModal v-if="showModal" :categories="store.categories" :cards="store.debitCards" :transaction="editingTransaction" @close="showModal = false; editingTransaction = null" @save="save" @save-recurring="saveRecurring" />
  <EditBalanceModal v-if="showBalanceEditor" :current-balance="centsToDecimal(store.availableBalanceCents)" @close="showBalanceEditor = false" @save="editBalance" />
</template>
